import { forwardRef, Module } from '@nestjs/common';
import { ChunkService } from './chunk.service';
import { ChunkController } from './chunk.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, Chunkschema } from './entities/chunk.entity';
import { ReservationsModule } from '../reservations/reservations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chunk.name, schema: Chunkschema }]),
   forwardRef(()=>ReservationsModule)
  ],
  controllers: [ChunkController],
  providers: [ChunkService],
  exports:[ChunkService]
})
export class ChunkModule {}
