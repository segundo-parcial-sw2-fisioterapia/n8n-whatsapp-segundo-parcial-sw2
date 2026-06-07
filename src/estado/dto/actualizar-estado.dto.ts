import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

export const ESTADOS_VALIDOS = ['INICIO', 'NOMBRE', 'CI', 'TELEFONO', 'EMAIL', 'MOTIVO', 'HORARIO'] as const;
export type EstadoConversacion = (typeof ESTADOS_VALIDOS)[number];

/** Payload que envía n8n para actualizar el estado de una conversación */
export class ActualizarEstadoDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ESTADOS_VALIDOS)
  estado: EstadoConversacion;

  /** Datos acumulados de la conversación (nombre, ci, pacienteId, bloques, etc.) */
  @IsObject()
  datos: Record<string, any>;
}
