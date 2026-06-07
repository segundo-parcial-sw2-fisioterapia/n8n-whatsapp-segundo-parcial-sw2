import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EstadoService } from '../estado/estado.service';
import { GraphqlService } from '../graphql/graphql.service';
import { EmailService } from '../email/email.service';
import { EstadoConversacion } from '../estado/dto/actualizar-estado.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly estadoService: EstadoService,
    private readonly graphqlService: GraphqlService,
    private readonly emailService: EmailService,
  ) {}

  async procesarMensaje(telefono: string, texto: string): Promise<void> {
    const estadoActual = this.estadoService.obtener(telefono);
    const estado = estadoActual ? estadoActual.estado : 'INICIO';
    const datos = estadoActual ? estadoActual.datos : {};

    try {
      switch (estado) {
        case 'INICIO':
          await this.whatsappService.enviarTexto(
            telefono,
            '¡Bienvenido al Centro de Rehabilitación Cyborg!\nPor favor, ingresa tu número de *Carnet de Identidad (CI)* para iniciar tu reserva.'
          );
          this.estadoService.guardar(telefono, { estado: 'ESPERANDO_CI', datos });
          break;

        case 'ESPERANDO_CI':
          const ci = texto.trim();
          await this.whatsappService.enviarTexto(telefono, 'Consultando sistema... ⏳');
          
          const pacienteExistente = await this.graphqlService.buscarPacientePorCI(ci);
          
          if (pacienteExistente) {
            datos.pacienteId = pacienteExistente.id;
            datos.nombre = pacienteExistente.persona.nombre;
            datos.email = pacienteExistente.persona.email;
            
            await this.whatsappService.enviarTexto(
              telefono, 
              `¡Hola de nuevo, ${pacienteExistente.persona.nombre}! ¿Deseas agendar una nueva evaluación clínica? (Responde *Sí* o *No*)`
            );
            this.estadoService.guardar(telefono, { estado: 'CONFIRMAR_CITA', datos });
          } else {
            // No existe, pedimos nombre
            await this.whatsappService.enviarTexto(telefono, 'No encontramos registros con ese CI. Para registrarte, por favor ingresa tu *Nombre*:');
            this.estadoService.guardar(telefono, { estado: 'ESPERANDO_NOMBRE', datos: { ci } });
          }
          break;

        case 'CONFIRMAR_CITA':
          const respuesta = texto.trim().toLowerCase();
          if (['si', 'sí', 'claro', 'ok', 'yes', 'por favor'].includes(respuesta)) {
            await this.whatsappService.enviarTexto(
              telefono, 
              '¡Perfecto! Ingresa la fecha y hora en formato *DD/MM/YYYY HH:MM* (ejemplo: 25/06/2026 10:30).\nRecuerda que atendemos de *Lunes a Viernes* entre *08:30 y 18:00*.'
            );
            this.estadoService.guardar(telefono, { estado: 'ESPERANDO_FECHA_HORA', datos });
          } else {
            await this.whatsappService.enviarTexto(telefono, 'Entendido. ¡Estaremos aquí cuando nos necesites! Que tengas un excelente día.');
            this.estadoService.eliminar(telefono);
          }
          break;

        case 'ESPERANDO_NOMBRE':
          datos.nombre = texto.trim();
          await this.whatsappService.enviarTexto(telefono, `Entendido, ${datos.nombre}. Ahora, por favor ingresa tus *Apellidos*:`);
          this.estadoService.guardar(telefono, { estado: 'ESPERANDO_APELLIDO', datos });
          break;

        case 'ESPERANDO_APELLIDO':
          datos.apellido = texto.trim();
          await this.whatsappService.enviarTexto(telefono, 'Perfecto. Por último, necesitamos tu *Correo Electrónico* para enviarte la confirmación:');
          this.estadoService.guardar(telefono, { estado: 'ESPERANDO_EMAIL', datos });
          break;

        case 'ESPERANDO_EMAIL':
          datos.email = texto.trim();
          await this.whatsappService.enviarTexto(
            telefono, 
            '¡Excelente! Ahora dinos cuándo quieres venir.\nIngresa la fecha y hora en formato *DD/MM/YYYY HH:MM* (ejemplo: 25/06/2026 10:30).\nRecuerda que atendemos de *Lunes a Viernes* entre *08:30 y 18:00*.'
          );
          this.estadoService.guardar(telefono, { estado: 'ESPERANDO_FECHA_HORA', datos });
          break;

        case 'ESPERANDO_FECHA_HORA':
          const fechaValidada = this.parsearYValidarFecha(texto.trim());
          
          if (!fechaValidada) {
            await this.whatsappService.enviarTexto(
              telefono, 
              '❌ Formato inválido o fecha fuera de horario. Asegúrate de que sea Lunes a Viernes entre 08:30 y 18:00 y en formato *DD/MM/YYYY HH:MM*.'
            );
            return; // Nos quedamos en el mismo estado
          }

          await this.whatsappService.enviarTexto(telefono, 'Registrando tu reserva en nuestro sistema... ⏳');

          try {
            let pacienteId = datos.pacienteId;

            // Si es un paciente nuevo (no hay pacienteId), lo creamos primero
            if (!pacienteId) {
              const telNormalizado = telefono.split('@')[0];
              const personaId = await this.graphqlService.crearPersona({
                nombre: datos.nombre,
                apellido: datos.apellido,
                ci: datos.ci,
                telefono: telNormalizado,
                email: datos.email,
              });
              pacienteId = await this.graphqlService.crearPaciente(personaId);
            }

            // Crear evaluación con la fecha
            const evaluacion = await this.graphqlService.crearEvaluacionInicial(pacienteId, fechaValidada.toISOString());

            // Notificar
            const personaRef = { nombre: datos.nombre, email: datos.email };
            await this.notificarExito(telefono, personaRef, evaluacion);
            
          } catch (e) {
            this.logger.error(`Error al agendar cita: ${e.message}`);
            await this.whatsappService.enviarTexto(telefono, '❌ Ocurrió un error al intentar agendar tu cita. Por favor, intenta nuevamente más tarde o comunícate con recepción.');
          } finally {
            this.estadoService.eliminar(telefono);
          }
          break;

        default:
          this.logger.warn(`Estado desconocido: ${estado}`);
          this.estadoService.eliminar(telefono);
          await this.whatsappService.enviarTexto(telefono, 'Ocurrió un error en el flujo. Volvamos a empezar. Ingresa tu CI:');
          this.estadoService.guardar(telefono, { estado: 'ESPERANDO_CI', datos: {} });
          break;
      }
    } catch (error) {
      this.logger.error(`Error procesando estado ${estado}: ${error.message}`);
      await this.whatsappService.enviarTexto(telefono, 'Disculpa, tuvimos un problema de conexión. ¿Podrías repetirlo?');
    }
  }

  /**
   * Intenta parsear "DD/MM/YYYY HH:MM"
   * Verifica Lunes-Viernes y 08:30 - 18:00
   * Retorna Date si es válido, null si es inválido
   */
  private parsearYValidarFecha(input: string): Date | null {
    // Expresión regular para capturar DD/MM/YYYY HH:MM
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
    const match = input.match(regex);
    
    if (!match) return null;

    const [_, dia, mes, anio, hora, min] = match.map(Number);

    // Los meses en JS son 0-11
    const fecha = new Date(anio, mes - 1, dia, hora, min);

    // Verificar validez (ej. no 31 de febrero)
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
      return null;
    }

    // Verificar que no sea en el pasado
    if (fecha.getTime() < Date.now()) {
      return null;
    }

    // Verificar Lunes (1) a Viernes (5)
    const diaSemana = fecha.getDay();
    if (diaSemana === 0 || diaSemana === 6) {
      return null;
    }

    // Verificar 08:30 a 18:00
    const horaFloat = hora + min / 60;
    if (horaFloat < 8.5 || horaFloat > 18) {
      return null;
    }

    return fecha;
  }

  private async notificarExito(telefono: string, persona: any, evaluacion: any) {
    // 1. Mensaje de WhatsApp
    await this.whatsappService.enviarTexto(
      telefono,
      `✅ ¡Reserva confirmada, ${persona.nombre}!\nTu evaluación clínica inicial está en estado *${evaluacion.estado}*.\nEn breve nos comunicaremos contigo o puedes acercarte a recepción con tu CI.`
    );

    // 2. Correo electrónico (si está disponible)
    if (persona.email && persona.email.includes('@')) {
      try {
        const fechaFormat = new Date(evaluacion.fecha_evaluacion).toLocaleString('es-ES', { 
          dateStyle: 'long', 
          timeStyle: 'short' 
        });

        await this.emailService.enviarConfirmacion({
          para: persona.email,
          asunto: 'Confirmación de Evaluación Inicial - Cyborg',
          nombre: persona.nombre,
          fechaHora: fechaFormat,
          motivo: 'Evaluación Clínica Inicial',
        });
      } catch (e) {
        this.logger.warn(`No se pudo enviar el correo a ${persona.email}: ${e.message}`);
      }
    }
  }
}
