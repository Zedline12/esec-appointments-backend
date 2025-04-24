import {
    Controller,
    Get,
    Body,
    Patch,
  } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Settings } from './settings.entity';
  
  @Controller('settings')
  export class SettingsController {
    constructor(private readonly settingsService:SettingsService) {}
  
    @Patch()
    async create(@Body() updateSettingsDto: Partial<Settings>) {
        console.log(updateSettingsDto)
      return await this.settingsService.editSettings(updateSettingsDto);
    }
  @Patch("chunksSizes")
  async updateChunkSizes(@Body("chunksSizes") chunksSizes: number) {
       return await this.settingsService.updateChunksSizes(chunksSizes);
     }  
    @Get()
   async findAll() {
      return await this.settingsService.getSettings();
    }

  }
  