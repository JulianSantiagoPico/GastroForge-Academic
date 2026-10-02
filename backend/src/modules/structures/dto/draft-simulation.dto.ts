import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { DraftActionType } from '../interfaces/structures.interface';

export class DraftActionDto {
  @ApiProperty({
    description: 'Tipo de acción ejecutada sobre el borrador',
    enum: ['ADD_ITEM', 'UPDATE_QUANTITY', 'REMOVE_ITEM', 'UNDO', 'REDO'],
    example: 'ADD_ITEM',
  })
  @IsIn(['ADD_ITEM', 'UPDATE_QUANTITY', 'REMOVE_ITEM', 'UNDO', 'REDO'], {
    message: 'type debe ser ADD_ITEM, UPDATE_QUANTITY, REMOVE_ITEM, UNDO o REDO',
  })
  type: DraftActionType;

  @ApiPropertyOptional({
    description: 'Identificador del plato/ítem',
    example: 'ITEM-1',
  })
  @IsString({ message: 'itemId debe ser una cadena de texto' })
  @IsOptional()
  itemId?: string;

  @ApiPropertyOptional({
    description: 'Nombre descriptivo del producto',
    example: 'Tostada de Salmón Ahumado',
  })
  @IsString({ message: 'name debe ser una cadena de texto' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Cantidad del producto',
    example: 2,
    minimum: 1,
  })
  @IsInt({ message: 'quantity debe ser un entero' })
  @Min(1, { message: 'quantity debe ser como mínimo 1' })
  @IsOptional()
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Cantidad previa (útil para auditoría o reversión en UPDATE_QUANTITY)',
    example: 1,
    minimum: 0,
  })
  @IsInt({ message: 'previousQuantity debe ser un entero' })
  @Min(0, { message: 'previousQuantity debe ser como mínimo 0' })
  @IsOptional()
  @Type(() => Number)
  previousQuantity?: number;

  @ApiPropertyOptional({
    description: 'Precio unitario del ítem',
    example: 28000,
  })
  @IsNumber({}, { message: 'price debe ser un número válido' })
  @IsOptional()
  @Type(() => Number)
  price?: number;
}

export class DraftSimulationDto {
  @ApiProperty({
    description: 'Secuencia ordenada de acciones a ejecutar sobre el borrador (1 a 1000 acciones).',
    type: [DraftActionDto],
    example: [
      {
        type: 'ADD_ITEM',
        itemId: 'ITEM-BURGER',
        name: 'Hamburguesa Artesanal Angus',
        quantity: 1,
        price: 32000,
      },
      {
        type: 'ADD_ITEM',
        itemId: 'ITEM-FRIES',
        name: 'Papas Rústicas Cheddar',
        quantity: 1,
        price: 14000,
      },
      {
        type: 'UPDATE_QUANTITY',
        itemId: 'ITEM-BURGER',
        quantity: 3,
      },
      {
        type: 'ADD_ITEM',
        itemId: 'ITEM-DRINK',
        name: 'Limonada Natural',
        quantity: 2,
        price: 9000,
      },
      {
        type: 'REMOVE_ITEM',
        itemId: 'ITEM-FRIES',
      },
      {
        type: 'UNDO',
      },
      {
        type: 'UNDO',
      },
      {
        type: 'REDO',
      },
    ],
  })
  @IsArray({ message: 'actions debe ser un arreglo de acciones' })
  @ArrayMinSize(1, { message: 'Debe incluir al menos 1 acción a simular' })
  @ArrayMaxSize(1000, { message: 'No se permite simular más de 1000 acciones por solicitud' })
  @ValidateNested({ each: true })
  @Type(() => DraftActionDto)
  actions: DraftActionDto[];
}
