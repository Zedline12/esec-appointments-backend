import {
  forwardRef,
  HttpException,
  HttpStatus,
  Logger,
  Module,
  OnModuleInit,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OnEvent } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservationsModule } from './domains/reservations/reservations.module';
import { GatewayModule } from './domains/gateway/gateway.module';
import { ReservationsService } from './domains/reservations/reservations.service';
import { AppGatewayService } from './domains/gateway/app.gateway.service';
import { ReservationRpa } from './domains/reservations/reservation.rpa';
import mongoose from 'mongoose';
import { AppBootstrapService } from './domains/reservations/app.bootstrap.service';
import { SettingsModule } from './domains/settings/settings.module';
@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/', {
      dbName: 'esec',
    }),
    GatewayModule,
    SettingsModule,
    ReservationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {
  constructor() {}
}
