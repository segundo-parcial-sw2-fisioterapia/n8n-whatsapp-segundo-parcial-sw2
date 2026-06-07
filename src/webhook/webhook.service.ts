import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Recibe el evento de Whapi y lo reenvía al webhook de n8n.
 * Solo procesa mensajes de texto entrantes (no los enviados por nosotros).
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async procesarEvento(payload: any): Promise<void> {
    // Imprimir el payload completo para depuración
    this.logger.log(`Payload recibido de Whapi: ${JSON.stringify(payload)}`);

    const messages: any[] = payload?.messages || [];
    
    // Si no contiene un array de mensajes válido, lo ignoramos
    if (!messages || messages.length === 0) {
      this.logger.debug('Evento ignorado: no contiene un arreglo de mensajes.');
      return;
    }

    for (const msg of messages) {
      // Ignorar mensajes enviados por nosotros (soportando from_me de Whapi real o fromMe de pruebas)
      const deMi = msg?.from_me ?? msg?.fromMe ?? false;
      
      if (deMi || msg?.type !== 'text') {
        this.logger.debug(`Mensaje descartado (enviado por nosotros o no es texto)`);
        continue;
      }

      // Extraer el remitente (chat_id, chatId o desde)
      let desde = msg.chat_id || msg.chatId || msg.from || '';
      
      // Si "desde" es solo el número, le agregamos el sufijo estándar de WhatsApp
      if (desde && !desde.includes('@')) {
        desde = `${desde}@s.whatsapp.net`;
      }

      // Extraer el texto del mensaje (text.body o body directo)
      const texto = (msg.text?.body || msg.body || '').trim();

      if (!texto || !desde) {
        this.logger.warn(`Mensaje incompleto — desde: ${desde}, texto: ${texto}`);
        continue;
      }

      this.logger.log(`Mensaje entrante de ${desde}: "${texto}"`);
      await this.reenviarAN8n({ desde, texto, payload: msg });
    }
  }

  private async reenviarAN8n(datos: { desde: string; texto: string; payload: any }): Promise<void> {
    const n8nUrl = this.config.get<string>('N8N_WEBHOOK_URL');
    if (!n8nUrl) {
      this.logger.warn('N8N_WEBHOOK_URL no configurada — mensaje descartado');
      return;
    }
    try {
      await firstValueFrom(this.http.post(n8nUrl, datos));
      this.logger.debug(`Evento reenviado a n8n: ${n8nUrl}`);
    } catch (err) {
      this.logger.error(`Error al reenviar a n8n: ${err?.message}`);
    }
  }
}
