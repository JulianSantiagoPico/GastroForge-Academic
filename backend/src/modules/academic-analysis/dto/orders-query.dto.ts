import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class OrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Cantidad de pedidos a visualizar (1 a 100).',
    type: Number,
    default: 10,
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(100, { message: 'limit no puede superar 100 pedidos por página' })
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Número de página a consultar.',
    type: Number,
    default: 1,
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser al menos 1' })
  @IsOptional()
  page: number = 1;
}
