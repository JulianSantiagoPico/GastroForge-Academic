import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from '../transactions/transactions.service';
import { SimulationBurstDto } from './dto/simulation-burst.dto';
import { computeHmac } from '../crypto/hmac';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { randomUUID } from 'crypto';

@ApiTags('Appresso - Simulación de Tráfico')
@Controller('appresso/simulation')
export class SimulationController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('burst')
  @ApiOperation({
    summary: 'Ejecuta una ráfaga controlada de transacciones firmadas',
    description:
      'Permite al dashboard o herramientas de prueba generar una secuencia de transacciones legítimamente firmadas para verificar la ventana deslizante y la detección de anomalías sin exponer la clave HMAC al cliente.',
  })
  @ApiResponse({ status: 200, description: 'Ráfaga simulada procesada con resumen.' })
  async runBurst(@Body() dto: SimulationBurstDto) {
    const user = dto.user || `sim-user-${randomUUID().substring(0, 8)}`;
    const count = dto.count;
    const delayMs = dto.delayMs || 0;
    const paymentMethod = dto.paymentMethod || 'DEBIT_CARD';
    const secret =
      process.env.APPRESSO_HMAC_SECRET || 'gastroforge-default-dev-secret';

    const results: any[] = [];
    const startTime = Date.now();
    let anomaliesCount = 0;

    for (let i = 1; i <= count; i++) {
      if (delayMs > 0 && i > 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const idTxn = `sim-${user}-${Date.now()}-${i}`;
      const txnPayload: CreateAppressoTransactionDto = {
        idTxn,
        user,
        value: 25000 + Math.floor(Math.random() * 50000),
        currency: 'COP',
        paymentMethod,
        date: new Date().toISOString(),
        hash: '',
      };
      txnPayload.hash = computeHmac(txnPayload, secret);

      const txnStart = Date.now();
      const res = await this.transactionsService.processTransaction(txnPayload);
      const latencyMs = Date.now() - txnStart;

      if (res.anomaly.detected) {
        anomaliesCount++;
      }

      results.push({
        idTxn: res.idTxn,
        status: res.status,
        isDuplicate: res.isDuplicate,
        latencyMs,
        anomaly: res.anomaly,
      });
    }

    const totalDurationMs = Date.now() - startTime;
    const avgLatencyMs =
      results.length > 0
        ? Math.round(
            results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length,
          )
        : 0;

    return {
      summary: {
        sent: count,
        accepted: results.length,
        anomalies: anomaliesCount,
        avgLatencyMs,
        totalDurationMs,
        userId: user,
      },
      results,
    };
  }
}
