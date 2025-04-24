import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, set } from 'mongoose';
import { Settings } from './settings.entity';
import { ChunkService } from '../chunk/chunk.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private settingsModel: Model<Settings>,

    @Inject(forwardRef(() => ChunkService))
    private readonly chunksService: ChunkService,
  ) {}
  async getSettings() {
    return await this.settingsModel.findOne({});
  }
  async updateStart(bool: boolean) {
    await this.settingsModel.findOneAndUpdate({}, { start: bool });
  }
  async updateChunksSizes(chunksSizes: number) {
    await this.settingsModel.findOneAndUpdate({}, { chunksSizes: chunksSizes });
    this.chunksService.create(chunksSizes);
  }
  async editSettings(update: any) {
    return await this.settingsModel.findOneAndUpdate({}, update);
  }
}
