import {  Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Reservation,
  ReservationPassportOption,
  ReservationPassportOptionSchema,
  ReservationSchema,
  ReservationScholarshipType,
  ReservationScholarshipTypeSchema,
} from './entities/reservation.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GatewayModule } from '../gateway/gateway.module';
import { UserModule } from '../user/user.module';
import { ReservationRpa } from './reservation.rpa';
import { AppBootstrapService } from 'src/domains/reservations/app.bootstrap.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
      {
        name: ReservationScholarshipType.name,
        schema: ReservationScholarshipTypeSchema,
      },
      {
        name: ReservationPassportOption.name,
        schema: ReservationPassportOptionSchema,
      },
    ]),
    NotificationsModule,
    GatewayModule,
    UserModule,
    SettingsModule
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationRpa, AppBootstrapService],
  exports: [ReservationsService, ReservationRpa,AppBootstrapService],
})
export class ReservationsModule {}
