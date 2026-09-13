import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { UrgencyLevel } from '../interfaces/structures.interface';

export class PriorityTaskItemDto {
  @ApiProperty({
    description: 'Identificador único de la comanda/tarea de cocina',
    example: 'TASK-01',
  })
  @IsString({ message: 'id debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'id no puede estar vacío' })
  id: string;

  @ApiProperty({
    description: 'Descripción del plato o comanda a preparar',
    example: 'Lomo al Trapo con Papas Criollas',
  })
  @IsString({ message: 'description debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'description no puede estar vacío' })
  description: string;

  @ApiProperty({
    description: 'Nivel base de urgencia de la orden',
    enum: ['urgente', 'normal', 'baja'],
    example: 'normal',
  })
  @IsIn(['urgente', 'normal', 'baja'], {
    message: 'urgency debe ser uno de los siguientes valores: urgente, normal, baja',
  })
  urgency: UrgencyLevel;

  @ApiProperty({
    description: 'Tiempo transcurrido en minutos desde la solicitud del pedido',
    example: 12,
    minimum: 0,
  })
  @IsInt({ message: 'waitingMinutes debe ser un número entero' })
  @Min(0, { message: 'waitingMinutes no puede ser negativo' })
  waitingMinutes: number;
}

export class PrioritySimulationDto {
  @ApiProperty({
    description: 'Lista de tareas a despachar por orden de prioridad efectiva (1 a 1000 tareas).',
    type: [PriorityTaskItemDto],
    example: [
      {
        id: 'TASK-101',
        description: 'Bebida rápida: Jugo Natural de Maracuyá',
        urgency: 'baja',
        waitingMinutes: 5,
      },
      {
        id: 'TASK-102',
        description: 'Comanda estándar: Hamburguesa BBQ con Papas',
        urgency: 'normal',
        waitingMinutes: 10,
      },
      {
        id: 'TASK-103',
        description: 'Reclamo por demora: Lomo al Trapo Mesa 5',
        urgency: 'urgente',
        waitingMinutes: 15,
      },
      {
        id: 'TASK-104',
        description: 'Postre pendiente: Brownie con Helado',
        urgency: 'baja',
        waitingMinutes: 45,
      },
      {
        id: 'TASK-105',
        description: 'Pedido VIP: Parrillada Mixta Familiar',
        urgency: 'urgente',
        waitingMinutes: 2,
      },
    ],
  })
  @IsArray({ message: 'tasks debe ser un arreglo de tareas de cocina' })
  @ArrayMinSize(1, { message: 'Debe enviar al menos 1 tarea para la simulación' })
  @ArrayMaxSize(1000, { message: 'No se permite simular más de 1000 tareas por solicitud' })
  @ValidateNested({ each: true })
  @Type(() => PriorityTaskItemDto)
  tasks: PriorityTaskItemDto[];
}
