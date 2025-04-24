import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Settings, SettingsSchema } from './settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { ChunkModule } from '../chunk/chunk.module';

@Module({
    controllers:[SettingsController],
  imports: [
    MongooseModule.forFeature([{ name: Settings.name, schema: SettingsSchema }]),
    forwardRef(() => ChunkModule),
  ],
  providers:[SettingsService],
  exports:[SettingsService]
})
export class SettingsModule {}
