import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification } from './entities/notification.entity';
import { AppGatewayService } from 'src/domains/gateway/app.gateway.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
    private readonly gatewayService: AppGatewayService,
  ) {}

  async sendNotifcation(message: string) {
    await this.gatewayService.sendNotification(message);
    return await this.create(message);
  }
  private async create(message: string) {
    const notification = await this.notificationModel.create({
      message: message,
    });
    const count = await this.notificationModel.countDocuments();

    // If more than 10 documents, delete the oldest ones
    if (count > 10) {
      const oldest = await this.notificationModel
        .find()
        .sort({ createdAt: 1 }) // Sort by oldest first
        .limit(count - 10); // Get extra messages to delete

      const idsToDelete = oldest.map((doc) => doc._id);
      await this.notificationModel.deleteMany({ _id: { $in: idsToDelete } });
      return notification;
    }
  }
}
