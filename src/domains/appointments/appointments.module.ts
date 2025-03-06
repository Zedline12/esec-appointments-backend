import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({imports:[EventEmitterModule.forRoot()],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
