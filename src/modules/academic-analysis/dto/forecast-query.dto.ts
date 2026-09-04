import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ForecastQueryDto {
  @ApiPropertyOptional({
    description: 'Días a futuro para proyectar las ventas separados por comas (ejemplo: 2,5,7).',
    type: String,
    default: '2,5,7',
    example: '2,5,7',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [2, 5, 7];
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    return String(value)
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((n) => !Number.isNaN(n));
  })
  @IsArray({ message: 'daysAhead debe ser una lista válida de enteros separados por comas' })
  @IsInt({ each: true, message: 'Cada día en daysAhead debe ser un número entero' })
  @Min(1, { each: true, message: 'Cada día en daysAhead debe ser mayor o igual a 1' })
  @Max(365, { each: true, message: 'Cada día en daysAhead no debe exceder 365 días' })
  daysAhead: number[] = [2, 5, 7];
}
