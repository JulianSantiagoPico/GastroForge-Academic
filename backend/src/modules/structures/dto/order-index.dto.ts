import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class IndexOrderInputDto {
  @ApiProperty({
    description: 'Identificador único del pedido a indexar',
    example: 'ORD-001',
  })
  @IsString({ message: 'id debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'id no puede estar vacío' })
  id: string;

  @ApiProperty({
    description: 'Número de mesa',
    example: 3,
    minimum: 1,
  })
  @IsInt({ message: 'table debe ser un número entero' })
  @Min(1, { message: 'table debe ser como mínimo 1' })
  table: number;

  @ApiProperty({
    description: 'Monto total del pedido',
    example: 45000,
    minimum: 0,
  })
  @IsNumber({}, { message: 'total debe ser un número válido' })
  @Min(0, { message: 'total no puede ser negativo' })
  total: number;

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
    example: 'Mariana Gómez',
  })
  @IsString({ message: 'clientName debe ser una cadena de texto' })
  @IsOptional()
  clientName?: string;
}

export class OrderIndexDto {
  @ApiPropertyOptional({
    description:
      'Lista personalizada de pedidos a indexar (hasta 1000). Si no se proporciona, se genera un conjunto determinista estándar.',
    type: [IndexOrderInputDto],
    example: [
      { id: 'ORD-101', table: 3, total: 45000, clientName: 'Mariana Gómez' },
      { id: 'ORD-102', table: 5, total: 82000, clientName: 'Carlos Mendoza' },
      { id: 'ORD-103', table: 2, total: 31000, clientName: 'Andrés Felipe' },
      { id: 'ORD-104', table: 8, total: 125000, clientName: 'Valeria Castro' },
      { id: 'ORD-105', table: 11, total: 67000, clientName: 'Sofía Herrera' },
    ],
  })
  @IsArray({ message: 'orders debe ser un arreglo de pedidos' })
  @ArrayMaxSize(1000, { message: 'No se permite indexar más de 1000 pedidos por simulación' })
  @ValidateNested({ each: true })
  @Type(() => IndexOrderInputDto)
  @IsOptional()
  orders?: IndexOrderInputDto[];

  @ApiProperty({
    description: 'Lista de identificadores de pedido a buscar y comparar (1 a 1000 IDs).',
    example: ['ORD-104', 'ORD-101', 'ORD-999'],
    type: [String],
  })
  @IsArray({ message: 'searchIds debe ser un arreglo de cadenas' })
  @ArrayMinSize(1, { message: 'Debe especificar al menos 1 id a buscar' })
  @ArrayMaxSize(1000, { message: 'No se permite buscar más de 1000 IDs por consulta' })
  @IsString({ each: true, message: 'Cada id de búsqueda debe ser una cadena de texto' })
  searchIds: string[];
}
