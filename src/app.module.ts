import { HttpException, HttpStatus, Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentsModule } from './domains/appointments/appointments.module';
import { OnEvent } from '@nestjs/event-emitter';
import { AppGateway } from './app.gateway';

@Module({
  imports: [AppointmentsModule],
  controllers: [AppController],
  providers: [AppService,AppGateway],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);
  @OnEvent('puppeteer.error')
  handlePuppeteerError(error: Error) {
    this.logger.error('Puppeteer Error:', error.message);
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
}
