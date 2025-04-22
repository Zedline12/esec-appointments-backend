import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './entities/notification.entity';
import { AppModule } from 'src/app.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports:[MongooseModule.forFeature([{ name: Notification.name, schema: NotificationSchema }]),GatewayModule],
  providers: [NotificationsService],
  exports:[NotificationsService]
})
export class NotificationsModule {}
