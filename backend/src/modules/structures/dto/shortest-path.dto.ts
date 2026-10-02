import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class DefaultRouteQueryDto {
  @ApiPropertyOptional({
    description: 'Nodo de origen en el plano predeterminado',
    example: 'kitchen',
    default: 'kitchen',
  })
  @IsString({ message: 'from debe ser una cadena de texto' })
  @IsOptional()
  from: string = 'kitchen';

  @ApiPropertyOptional({
    description: 'Nodo de destino en el plano predeterminado',
    example: 'terrace',
    default: 'terrace',
  })
  @IsString({ message: 'to debe ser una cadena de texto' })
  @IsOptional()
  to: string = 'terrace';
}

export class GraphEdgeDto {
  @ApiProperty({
    description: 'Nodo origen de la arista',
    example: 'kitchen',
  })
  @IsString({ message: 'from debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'from no puede estar vacío' })
  from: string;

  @ApiProperty({
    description: 'Nodo destino de la arista',
    example: 'passage',
  })
  @IsString({ message: 'to debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'to no puede estar vacío' })
  to: string;

  @ApiProperty({
    description: 'Peso o costo de la arista (en segundos o distancia; no negativo)',
    example: 5,
    minimum: 0,
    maximum: 10000,
  })
  @IsNumber({}, { message: 'cost debe ser un número' })
  @Min(0, { message: 'El peso de la arista (cost) no puede ser negativo' })
  @Max(10000, { message: 'El peso de la arista (cost) no puede exceder 10000' })
  @Type(() => Number)
  cost: number;
}

export class ShortestPathDto {
  @ApiProperty({
    description: 'Lista de identificadores de nodos del grafo (2 a 100 nodos).',
    example: ['kitchen', 'passage', 'bar', 'table-1', 'table-2', 'terrace'],
    type: [String],
  })
  @IsArray({ message: 'nodes debe ser un arreglo de cadenas' })
  @ArrayMinSize(2, { message: 'El grafo debe tener como mínimo 2 nodos' })
  @ArrayMaxSize(100, { message: 'El grafo no puede tener más de 100 nodos' })
  @IsString({ each: true, message: 'Cada nodo debe ser una cadena de texto' })
  nodes: string[];

  @ApiProperty({
    description: 'Lista de aristas ponderadas con pesos no negativos (hasta 500 aristas).',
    type: [GraphEdgeDto],
    example: [
      { from: 'kitchen', to: 'passage', cost: 5 },
      { from: 'passage', to: 'table-1', cost: 7 },
      { from: 'table-1', to: 'terrace', cost: 9 },
      { from: 'kitchen', to: 'bar', cost: 8 },
      { from: 'bar', to: 'passage', cost: 4 },
      { from: 'passage', to: 'table-2', cost: 6 },
      { from: 'table-2', to: 'terrace', cost: 12 },
      { from: 'bar', to: 'terrace', cost: 18 },
    ],
  })
  @IsArray({ message: 'edges debe ser un arreglo de aristas' })
  @ArrayMaxSize(500, { message: 'El grafo no puede contener más de 500 aristas' })
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges: GraphEdgeDto[];

  @ApiProperty({
    description: 'Nodo origen para el cálculo de camino más corto',
    example: 'kitchen',
  })
  @IsString({ message: 'startNode debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'startNode no puede estar vacío' })
  startNode: string;

  @ApiProperty({
    description: 'Nodo destino para el cálculo de camino más corto',
    example: 'terrace',
  })
  @IsString({ message: 'targetNode debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'targetNode no puede estar vacío' })
  targetNode: string;

  @ApiPropertyOptional({
    description: 'Si es true, las aristas se configuran bidireccionales en ambos sentidos',
    default: true,
    example: true,
  })
  @IsBoolean({ message: 'bidirectional debe ser un valor booleano' })
  @IsOptional()
  bidirectional?: boolean = true;
}
