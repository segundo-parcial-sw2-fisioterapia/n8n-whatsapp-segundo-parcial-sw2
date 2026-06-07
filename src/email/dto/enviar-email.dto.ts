import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** Payload que envía n8n para enviar el email de confirmación de cita */
export class EnviarEmailDto {
  @IsEmail()
  para: string;

  @IsString()
  @IsNotEmpty()
  asunto: string;

  /** Nombre completo del paciente para personalizar el email */
  @IsString()
  @IsNotEmpty()
  nombre: string;

  /** Fecha y hora formateada: "2025-06-10 a las 10:00 AM" */
  @IsString()
  @IsNotEmpty()
  fechaHora: string;

  /** Motivo de consulta para incluir en el cuerpo */
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
