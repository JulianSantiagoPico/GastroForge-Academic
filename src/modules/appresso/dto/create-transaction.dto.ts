import { ApiProperty } from '@nestjs/swagger';
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

  @ApiProperty({
    description: 'Valor monetario en unidades enteras mínimas de la moneda (centavos). Nunca flotante.',
    example: 250000,
  })
  @IsInt({ message: 'El valor debe ser un número entero en unidades mínimas (centavos)' })
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
