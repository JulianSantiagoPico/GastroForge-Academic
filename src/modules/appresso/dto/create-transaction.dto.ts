import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsISO8601,
  Matches,
  Length,
} from 'class-validator';

/**
 * DTO para la recepción de transacciones del bot de Appresso (A1.1, A3.2).
 */
export class CreateAppressoTransactionDto {
  @ApiProperty({
    description: 'Identificador único global de la transacción provisto por el emisor',
    example: 'txn-78a9c2-20260923',
  })
  @IsString()
  @IsNotEmpty()
  idTxn: string;

  @ApiProperty({
    description: 'Identificador del usuario o cliente que origina la transacción',
    example: 'user_4821@appresso.com',
  })
  @IsString()
  @IsNotEmpty()
  user: string;

  /**
   * Valor monetario en **unidades enteras mínimas de la moneda (centavos)**.
   *
   * El importe viaja como entero y solo como entero. Un importe nunca es un `float`: la
   * aritmética binaria de coma flotante no representa de forma exacta muchos decimales y el
   * redondeo acumularía diferencias reales de dinero.
   *
   * `@Type(() => Number)` normaliza un valor enviado como cadena numérica al número entero
   * correspondiente. `@IsInt` **rechaza** cualquier decimal con HTTP 400 en lugar de truncarlo.
   * Truncar sería peor que rechazar: convertiría un payload defectuoso en un importe menor
   * aceptado en silencio, y además el `hash` firmado dejaría de corresponder al valor que se
   * persiste. Ante la duda, el sistema falla de forma visible.
   */
  @ApiProperty({
    description:
      'Valor monetario en unidades enteras mínimas de la moneda (centavos). Nunca flotante; los decimales se rechazan.',
    example: 250000,
  })
  @Type(() => Number)
  @IsInt({
    message:
      'El valor debe ser un número entero en unidades mínimas (centavos); los decimales no se aceptan',
  })
  @Min(1, { message: 'El valor debe ser mayor o igual a 1' })
  value: number;

  @ApiProperty({
    description: 'Código de moneda de 3 caracteres ISO-4217',
    example: 'COP',
  })
  @IsString()
  @Length(3, 3, { message: 'La moneda debe ser un código ISO de 3 letras' })
  currency: string;

  @ApiProperty({
    description: 'Método de pago utilizado',
    example: 'CREDIT_CARD',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({
    description: 'Fecha y hora declarada por el emisor en formato ISO-8601 con zona horaria explícita',
    example: '2026-09-23T10:30:01.120Z',
  })
  @IsISO8601({ strict: true }, { message: 'date debe ser una cadena ISO-8601 válida' })
  date: string;

  @ApiProperty({
    description: 'Firma HMAC-SHA-256 (64 caracteres hexadecimales) calculada sobre la representación canónica de los campos firmados',
    example: 'a6f5e9d2...64chars',
  })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, { message: 'hash debe ser una cadena hexadecimal HMAC-SHA-256 de 64 caracteres' })
  hash: string;
}
