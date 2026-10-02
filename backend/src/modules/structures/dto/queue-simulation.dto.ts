import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class QueueOrderItemDto {
  @ApiProperty({
    description: 'Identificador único del pedido',
    example: 'ORD-101',
  })
  @IsString({ message: 'El id del pedido debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El id del pedido no puede estar vacío' })
  id: string;

  @ApiProperty({
    description: 'Número de mesa asignada al pedido',
    example: 4,
    minimum: 1,
  })
  @IsInt({ message: 'La mesa debe ser un número entero' })
  @Min(1, { message: 'El número de mesa debe ser al menos 1' })
  table: number;

  @ApiProperty({
    description: 'Lista de platos o bebidas solicitadas',
    example: ['Hamburguesa Artesanal', 'Limonada de Coco'],
    type: [String],
  })
  @IsArray({ message: 'items debe ser un arreglo de cadenas de texto' })
  @ArrayMinSize(1, { message: 'El pedido debe contener al menos 1 ítem' })
  @IsString({ each: true, message: 'Cada ítem debe ser una cadena de texto' })
  items: string[];

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
    example: 'Carlos Mendoza',
  })
  @IsString({ message: 'El nombre del cliente debe ser una cadena de texto' })
  @IsOptional()
  clientName?: string;
}

export class QueueSimulationDto {
  @ApiProperty({
    description: 'Conjunto de pedidos a encolar en orden de llegada (1 a 1000 pedidos).',
    type: [QueueOrderItemDto],
    example: [
      {
        id: 'ORD-001',
        table: 4,
        items: ['Hamburguesa Clásica', 'Papas Francesas', 'Gaseosa 400ml'],
        clientName: 'Carlos Mendoza',
      },
      {
        id: 'ORD-002',
        table: 7,
        items: ['Pizza Especial Mediana', 'Cerveza Artesanal IPA'],
        clientName: 'Mariana Gómez',
      },
      {
        id: 'ORD-003',
        table: 2,
        items: ['Lomo al Trapo', 'Ensalada César', 'Vino Tinto Malbec'],
        clientName: 'Alejandro Silva',
      },
      {
        id: 'ORD-004',
        table: 12,
        items: ['Sándwich Gourmet de Salmón', 'Limonada de Coco'],
        clientName: 'Valeria Castro',
      },
    ],
  })
  @IsArray({ message: 'orders debe ser un arreglo de pedidos' })
  @ArrayMinSize(1, { message: 'Debe enviar al menos 1 pedido para simular' })
  @ArrayMaxSize(1000, { message: 'No se permite simular más de 1000 pedidos por solicitud' })
  @ValidateNested({ each: true })
  @Type(() => QueueOrderItemDto)
  orders: QueueOrderItemDto[];
}
