import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GraphqlService {
  private readonly logger = new Logger(GraphqlService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get gatewayUrl() {
    return this.config.get<string>('GRAPHQL_GATEWAY_URL') || 'http://localhost:3000/graphql';
  }

  /** Ejecuta una consulta genérica a GraphQL */
  async ejecutar<T>(query: string, variables: any = {}): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.post(
          this.gatewayUrl,
          { query, variables },
          { headers: { 'Content-Type': 'application/json' } }
        )
      );

      const body = response.data;
      if (body.errors && body.errors.length > 0) {
        this.logger.error(`Error de GraphQL: ${JSON.stringify(body.errors)}`);
        throw new InternalServerErrorException(body.errors[0].message);
      }
      return body.data as T;
    } catch (err) {
      this.logger.error(`Error al contactar Gateway GraphQL: ${err.message}`);
      throw new InternalServerErrorException('Error conectando con la clínica');
    }
  }

  async buscarPacientePorCI(ci: string): Promise<any | null> {
    const query = `
      query BuscarPaciente($termino: String!) {
        buscarPacientes(termino: $termino) {
          id
          persona {
            id
            nombre
            apellido
            email
          }
        }
      }
    `;
    const data = await this.ejecutar<{ buscarPacientes: any[] }>(query, { termino: ci });
    const pacientes = data?.buscarPacientes || [];
    return pacientes.length > 0 ? pacientes[0] : null;
  }

  async crearPersona(datos: { nombre: string; apellido: string; ci: string; telefono: string; email: string }): Promise<number> {
    const mutacion = `
      mutation CrearPersona($datos: CreatePersonaInput!) {
        crearPersonas(datos: $datos) {
          id
        }
      }
    `;
    const data = await this.ejecutar<{ crearPersonas: { id: number } }>(mutacion, { datos });
    return data.crearPersonas.id;
  }

  async crearPaciente(personaId: number): Promise<number> {
    const mutacion = `
      mutation CrearPaciente($datos: CreatePacienteInput!) {
        crearPacientes(datos: $datos) {
          id
        }
      }
    `;
    // EstadoPaciente.ACTIVO es asumiendo que el backend lo acepta como string o se mapea
    const data = await this.ejecutar<{ crearPacientes: { id: number } }>(mutacion, {
      datos: { personaId, estado: 'ACTIVO' }
    });
    return data.crearPacientes.id;
  }

  async crearEvaluacionInicial(pacienteId: number, fechaISO: string): Promise<any> {
    const mutacion = `
      mutation CrearEvaluacionInicial($datos: CreateEvaluacionesInnicialeInput!) {
        crearEvaluacionesIniciales(datos: $datos) {
          id
          estado
          fecha_evaluacion
          paciente {
            persona {
              nombre
              email
            }
          }
        }
      }
    `;
    const data = await this.ejecutar<{ crearEvaluacionesIniciales: any }>(mutacion, {
      datos: { pacienteId, fecha_evaluacion: fechaISO }
    });
    return data.crearEvaluacionesIniciales;
  }
}
