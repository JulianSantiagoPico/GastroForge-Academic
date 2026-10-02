import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SimulationBurstDto {
  @ApiPropertyOptional({
    description: 'Identificador del usuario para la ráfaga de transacciones',
    example: 'sim-client-101',
  })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty({
    description: 'Cantidad de transacciones a enviar en la ráfaga (máximo 25 por petición)',
    example: 5,
    minimum: 1,
    maximum: 25,
  })
  @IsInt()
  @Min(1)
  @Max(25)
  count: number;

  @ApiPropertyOptional({
    description: 'Demora en milisegundos entre cada transacción',
    example: 50,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  delayMs?: number;

  @ApiPropertyOptional({
    description: 'Método de pago simulado',
    example: 'CREDIT_CARD',
    default: 'DEBIT_CARD',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
