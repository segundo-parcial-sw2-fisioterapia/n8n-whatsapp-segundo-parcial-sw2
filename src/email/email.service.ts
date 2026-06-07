import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EnviarEmailDto } from './dto/enviar-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Envía el email de confirmación de cita al paciente usando las credenciales SMTP del .env.
   */
  async enviarConfirmacion(dto: EnviarEmailDto): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    const html = this.construirHtml(dto);

    try {
      await transporter.sendMail({
        from: `"Centro de Fisioterapia" <${this.config.get('SMTP_USER')}>`,
        to: dto.para,
        subject: dto.asunto,
        html,
      });
      this.logger.log(`Email de confirmación enviado a ${dto.para}`);
    } catch (err) {
      this.logger.error(`Error SMTP: ${err?.message}`);
      throw new InternalServerErrorException('No se pudo enviar el email de confirmación');
    }
  }

  private construirHtml(dto: EnviarEmailDto): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background-color: #f0f4f8; margin: 0; padding: 20px; }
    .container { background: white; max-width: 600px; margin: 0 auto; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: #1c3766; color: white; padding: 28px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: bold; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.8; }
    .body { padding: 30px; }
    .body p { color: #333; font-size: 15px; line-height: 1.6; }
    .badge { display: inline-block; background: #16a34a; color: white; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: bold; margin: 8px 0 20px; }
    .info-card { background: #f8fafc; border-left: 4px solid #1c3766; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 10px 0; }
    .info-card strong { color: #1c3766; }
    .info-card span { color: #555; margin-left: 6px; }
    .aviso { background: #fef3c7; border: 1px solid #d97706; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-size: 13px; color: #92400e; }
    .footer { background: #f8fafc; text-align: center; padding: 18px; font-size: 12px; color: #888; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Centro de Rehabilitación y Fisioterapia</h1>
      <p>Sistema de Gestión de Citas — ERP</p>
    </div>
    <div class="body">
      <p>Estimado/a <strong>${dto.nombre}</strong>,</p>
      <p>Le confirmamos que su cita ha sido registrada exitosamente en nuestro sistema.</p>
      <div class="badge">✅ Cita Confirmada</div>
      <div class="info-card">
        <strong>📅 Fecha y Hora:</strong><span>${dto.fechaHora}</span>
      </div>
      <div class="info-card">
        <strong>🏥 Motivo de Consulta:</strong><span>${dto.motivo}</span>
      </div>
      <div class="info-card">
        <strong>📍 Lugar:</strong><span>Centro de Rehabilitación y Fisioterapia</span>
      </div>
      <div class="aviso">
        ⏰ <strong>Recuerde:</strong> Por favor llegue <strong>10 minutos antes</strong> de su cita.
        Para cancelar o reprogramar, contáctenos por WhatsApp.
      </div>
    </div>
    <div class="footer">
      Este es un mensaje automático generado por el sistema ERP del Centro de Fisioterapia.<br>
      Por favor no responda a este correo.
    </div>
  </div>
</body>
</html>`;
  }
}
