import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  TransactionsService,
  ProcessTransactionResponse,
} from './transactions.service';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';

@ApiTags('Appresso - Detección de Fraude')
@Controller('appresso')
export class AppressoTransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('transactions')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle() // A1.4: Evita que el ThrottlerGuard global (120/60s) interfiera con la medición de capacidad del bot
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Recibir y procesar una transacción de pago con detección por ventana deslizante',
    description:
      'Valida la firma criptográfica HMAC-SHA-256 en tiempo constante, garantiza idempotencia por idTxn, serializa la concurrencia por usuario mediante advisory locks y evalúa la regla de ventana deslizante O(1) registrando episodios de posible fraude.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transacción procesada o resultado previo retornado de forma idempotente',
    schema: {
      example: {
        status: 'ACCEPTED',
        idTxn: 'txn-78a9c2-20260923',
        receivedAt: 1727087401120,
        isDuplicate: false,
        anomaly: {
          detected: true,
          rule: 'POSIBLE_FRAUDE',
          episodeId: 'a3d82f1b-c32f-4c55-b771-48e0d9b4b0e1',
          windowCount: 3,
          threshold: 3,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Firma HMAC inválida o manipulada',
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido o campos faltantes según el contrato DTO',
  })
  async createTransaction(
    @Body() dto: CreateAppressoTransactionDto,
  ): Promise<ProcessTransactionResponse> {
    return await this.transactionsService.processTransaction(dto);
  }
}
