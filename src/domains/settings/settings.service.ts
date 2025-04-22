import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, set } from 'mongoose';
import { Settings } from './settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private settingsModel: Model<Settings>,
  ) {}
    async getSettings(){
       return await this.settingsModel.find({})
    }
    async editSettings(update:any) {
        return await this.settingsModel.findOneAndUpdate({},update);
        
    }
}
