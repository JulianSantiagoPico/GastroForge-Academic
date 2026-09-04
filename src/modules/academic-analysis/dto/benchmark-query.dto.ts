import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum SearchCase {
  BEST = 'best',
  AVERAGE = 'average',
  WORST = 'worst',
}

export class BenchmarkQueryDto {
  @ApiPropertyOptional({
    description: 'Tamaño del conjunto de pedidos simulados (1 a 100000).',
    type: Number,
    default: 2000,
    example: 2000,
    minimum: 1,
    maximum: 100000,
  })
  @Type(() => Number)
  @IsInt({ message: 'size debe ser un número entero' })
  @Min(1, { message: 'size debe ser como mínimo 1' })
  @Max(100000, { message: 'size debe ser como máximo 100000' })
  @IsOptional()
  size: number = 2000;

  @ApiPropertyOptional({
    description: 'Caso de prueba para la búsqueda lineal (best: posición 1, average: n/2, worst: última posición).',
    enum: SearchCase,
    default: SearchCase.WORST,
    example: SearchCase.WORST,
  })
  @IsEnum(SearchCase, {
    message: 'case debe ser uno de los siguientes valores: best, average, worst',
  })
  @IsOptional()
  case: SearchCase = SearchCase.WORST;
}
