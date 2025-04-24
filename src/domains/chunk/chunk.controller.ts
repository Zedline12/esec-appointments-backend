import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ChunkService } from './chunk.service';
import { CreateChunkDto } from './dto/create-chunk.dto';
import { UpdateChunkDto } from './dto/update-chunk.dto';

@Controller('chunk')
export class ChunkController {
  constructor(private readonly chunkService: ChunkService) {}

  @Post()
  create(@Body("chunkCount") chunkCount:number) {
    return this.chunkService.create(chunkCount);
  }

  @Get()
  findAll() {
    return this.chunkService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chunkService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body("chunkInterval") chunkInterval: number) {
    return this.chunkService.update(id, chunkInterval);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chunkService.remove(+id);
  }
}
