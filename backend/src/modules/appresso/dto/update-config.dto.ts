import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAppressoConfigDto {
  @ApiPropertyOptional({
    description: 'Ancho de la ventana deslizante en segundos',
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'windowSeconds debe ser un número entero' })
  @Min(1, { message: 'windowSeconds debe ser al menos 1 segundo' })
  windowSeconds?: number;

  @ApiPropertyOptional({
    description: 'Ancho de la ventana deslizante en milisegundos',
    example: 5000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'windowMs debe ser un número entero' })
  @Min(100, { message: 'windowMs debe ser al menos 100 ms' })
  windowMs?: number;

  @ApiPropertyOptional({
    description: 'Umbrales específicos por franja horaria (MANANA, TARDE_NOCHE, NOCHE_MADRUGADA)',
    example: { NOCHE_MADRUGADA: 2, TARDE_NOCHE: 5, MANANA: 8 },
  })
  @IsOptional()
  @IsObject({ message: 'thresholds debe ser un objeto con pares franja: umbral' })
  thresholds?: Partial<Record<string, number>>;
}
