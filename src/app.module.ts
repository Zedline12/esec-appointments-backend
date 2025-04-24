import {
  forwardRef,
  Module,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservationsModule } from './domains/reservations/reservations.module';
import { GatewayModule } from './domains/gateway/gateway.module';
import { SettingsModule } from './domains/settings/settings.module';
import { ChunkModule } from './domains/chunk/chunk.module';
@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/', {
      dbName: 'esec',
    }),
    GatewayModule,
    SettingsModule,
    ReservationsModule,
    ChunkModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [],
})
export class AppModule {
  constructor() {}
}
