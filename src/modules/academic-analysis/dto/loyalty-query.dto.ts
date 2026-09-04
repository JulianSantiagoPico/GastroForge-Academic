import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class LoyaltyQueryDto {
  @ApiPropertyOptional({
    description: 'Lista de objetivos de productos acumulados separados por comas (ejemplo: 42,72,120).',
    type: String,
    default: '42,72,120',
    example: '42,72,120',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [42, 72, 120];
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    return String(value)
      .split(',')
      .map((item) => Number(item.trim()));
  })
  @IsArray({ message: 'targets debe ser una lista válida de enteros separados por comas' })
  @Min(1, { each: true, message: 'Cada objetivo en targets debe ser mayor o igual a 1' })
  @IsInt({ each: true, message: 'Cada objetivo en targets debe ser un número entero' })
  targets: number[] = [42, 72, 120];
}
