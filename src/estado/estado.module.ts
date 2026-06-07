import { Module } from '@nestjs/common';
import { EstadoController } from './estado.controller';
import { EstadoService } from './estado.service';

@Module({
  controllers: [EstadoController],
  providers: [EstadoService],
})
export class EstadoModule {}
