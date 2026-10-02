import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  TransactionsService,
  ProcessTransactionResponse,
} from './transactions.service';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { AppressoThrottlerGuard } from '../throttling/appresso-throttler.guard';
import { AppressoRejectOriginInterceptor } from '../throttling/appresso-reject-origin.interceptor';

@ApiTags('Appresso - Detección de Fraude')
@Controller('appresso')
// A1.4: Appresso no depende del `ThrottlerGuard` global (120/60s). Este nivel de clase lo excluye
// del limitador global, que sigue protegiendo `academic-analysis` y `structures`, y a cambio se
// aplica abajo un guard dedicado con límites propios y medibles.
@SkipThrottle()
@UseGuards(AppressoThrottlerGuard)
@UseInterceptors(AppressoRejectOriginInterceptor)
export class AppressoTransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Contrato HTTP de la ingesta (A3.6).
   *
   * | Caso                                | Código | Motivo                                                        |
   * |-------------------------------------|--------|--------------------------------------------------------------|
   * | Transacción nueva                   | 201    | Se creó un recurso (`idTxn` no existía previamente)          |
   * | Reintento con `idTxn` existente     | 200    | No se crea nada: se devuelve el resultado ya persistido       |
   * | Firma HMAC inválida                 | 401    | Integridad/autenticidad del payload no verificada             |
   * | DTO inválido                        | 400    | Contrato de entrada incumplido                                |
   * | Límite de Appresso excedido         | 429    | Rechazo del limitador HTTP, **no** del detector               |
   *
   * El reintento es idempotente y **no recalcula ni vuelve a contar en la ventana**: devuelve
   * exactamente lo que ya se procesó la primera vez.
   */
  @Post('transactions')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Recibir y procesar una transacción de pago con detección por ventana deslizante',
    description:
      'Valida la firma criptográfica HMAC-SHA-256 en tiempo constante, rechaza importes decimales, ' +
      'garantiza idempotencia por idTxn, serializa la concurrencia por usuario (mutex en proceso y ' +
      'advisory lock transaccional) y evalúa la regla de ventana deslizante O(1) registrando episodios ' +
      'de posible fraude. Toda respuesta incluye la cabecera x-appresso-reject-origin con el origen ' +
      'del resultado: none, throttler, validation, hmac o endpoint.',
  })
  @ApiCreatedResponse({
    description:
      'Transacción nueva aceptada y persistida. El recurso se acaba de crear.',
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
  @ApiOkResponse({
    description:
      'Reintento idempotente: el idTxn ya existía y se devuelve el resultado previamente persistido ' +
      'sin recalcular ni contar de nuevo en la ventana.',
    schema: {
      example: {
        status: 'ACCEPTED',
        idTxn: 'txn-78a9c2-20260923',
        receivedAt: 1727087401120,
        isDuplicate: true,
        anomaly: {
          detected: true,
          rule: 'POSIBLE_FRAUDE',
          episodeId: 'a3d82f1b-c32f-4c55-b771-48e0d9b4b0e1',
          windowCount: 0,
          threshold: 3,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description:
      'Firma HMAC inválida o manipulada (x-appresso-reject-origin: hmac)',
  })
  @ApiBadRequestResponse({
    description:
      'Payload inválido: campos faltantes, importe decimal o no entero, moneda inválida ' +
      '(x-appresso-reject-origin: validation)',
  })
  @ApiTooManyRequestsResponse({
    description:
      'Límite de peticiones de Appresso excedido. El rechazo lo produjo el limitador HTTP y no el ' +
      'detector de anomalías (x-appresso-reject-origin: throttler, x-appresso-throttler-rejected: true)',
  })
  async createTransaction(
    @Body() dto: CreateAppressoTransactionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProcessTransactionResponse> {
    const result = await this.transactionsService.processTransaction(dto);

    // El estado depende del resultado, no de la ruta: 201 para un recurso nuevo, 200 para un
    // reintento que no creó nada. `passthrough: true` mantiene la serialización normal de NestJS.
    res.status(result.isDuplicate ? HttpStatus.OK : HttpStatus.CREATED);

    return result;
  }
}