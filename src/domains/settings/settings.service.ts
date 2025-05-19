import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, set } from 'mongoose';
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

 async deleteAllChunks() {
  await this.settingsModel.updateOne(
    {},
    { $set: { chunks: [] } }
  );
}
async createChunk(size: number) {
  const newChunk = {
    _id: new mongoose.Types.ObjectId(),
    size,
    interval: 0,
  };

  await this.settingsModel.updateOne(
    {},
    { $push: { chunks: newChunk } }
  );

  return newChunk; // Return it if you want to use it elsewhere
}
  async updateChunk(id:mongoose.Types.ObjectId, interval: number) {
   await this.settingsModel.findOneAndUpdate(
  {},
  { $set: { 'chunks.$[elem].interval': interval } },
  {
    arrayFilters: [{ 'elem._id': id }],
    new: true,
  }
);
  }
  async editSettings(update: any) {
    return await this.settingsModel.findOneAndUpdate({}, update);
  }
}
