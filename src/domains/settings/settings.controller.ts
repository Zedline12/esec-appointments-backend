import {
    Controller,
    Get,
    Body,
    Patch,
    Param,
  } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Settings } from './settings.entity';
import mongoose, { mongo } from 'mongoose';
  
  @Controller('settings')
  export class SettingsController {
    constructor(private readonly settingsService:SettingsService) {}
  
    @Patch()
    async create(@Body() updateSettingsDto: Partial<Settings>) {
      return await this.settingsService.editSettings(updateSettingsDto);
    }
  @Patch("chunk/:id")
  async updateChunkSizes(@Param('id') id: string,@Body("interval") interval: number) {
       return await this.settingsService.updateChunk(new mongoose.Types.ObjectId(id), interval);
     }  
    @Get()
   async findAll() {
      return await this.settingsService.getSettings();
    }

  }
  