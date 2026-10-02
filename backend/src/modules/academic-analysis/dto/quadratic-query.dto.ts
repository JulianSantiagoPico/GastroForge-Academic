import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class QuadraticQueryDto {
  @ApiPropertyOptional({
    description:
      'Tamaño del conjunto de pedidos (1 a 100000). Para valores <= 2000 se ejecuta realmente; para > 2000 se entrega la estimación teórica exacta sin agotar CPU.',
    type: Number,
    default: 1000,
    example: 1000,
    minimum: 1,
    maximum: 100000,
  })
  @Type(() => Number)
  @IsInt({ message: 'size debe ser un número entero' })
  @Min(1, { message: 'size debe ser como mínimo 1' })
  @Max(100000, { message: 'size debe ser como máximo 100000' })
  @IsOptional()
  size: number = 1000;
}
