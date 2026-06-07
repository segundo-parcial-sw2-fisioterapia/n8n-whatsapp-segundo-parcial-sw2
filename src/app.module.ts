import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhookModule } from './webhook/webhook.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { EmailModule } from './email/email.module';
import { EstadoModule } from './estado/estado.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WebhookModule,
    WhatsappModule,
    EmailModule,
    EstadoModule,
  ],
})
export class AppModule {}
