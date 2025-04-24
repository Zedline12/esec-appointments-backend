import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateChunkDto } from './dto/create-chunk.dto';
import { UpdateChunkDto } from './dto/update-chunk.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Chunk } from './entities/chunk.entity';
import mongoose, { Model } from 'mongoose';
import { ReservationsService } from '../reservations/reservations.service';

@Injectable()
export class ChunkService {
  constructor(
    @InjectModel(Chunk.name)
    private chunkModel: Model<Chunk>,
    @Inject(forwardRef(()=>ReservationsService))
     private readonly reservationsService:ReservationsService
  ) {}
  async create(chunksSizes: number) {
    const reservations = await this.reservationsService.getAllReservations()
    const chunkCount = Math.ceil(reservations.length / chunksSizes)
    await this.chunkModel.deleteMany();
    let chunks:Chunk[]=[]
    for (let i = 0; i < chunkCount; i++) {
      chunks.push({chunkInterval:0})
      if(i===(chunkCount-1)){
        await this.chunkModel.insertMany(chunks);   
      }
    }
  }
  calculateChunkPlan(totalReservations: number, desiredChunks: number) {
    if (desiredChunks <= 0) throw new Error('Chunk count must be greater than zero');
  
    const idealChunkSize = Math.ceil(totalReservations / desiredChunks);
    const adjustedChunkSize = Math.ceil(idealChunkSize / 5) * 5; // Round up to nearest 5
    const actualChunks = Math.ceil(totalReservations / adjustedChunkSize);
  
    return {
      chunkSize: adjustedChunkSize,
      chunkCount: actualChunks,
    };
  }
  

  async findAll() {
    return await this.chunkModel.find({});
  }

  findOne(id: number) {
    return `This action returns a #${id} chunk`;
  }

 async update(id: string, interval:number) {
    return await this.chunkModel.findByIdAndUpdate(new mongoose.Types.ObjectId(id),{chunkInterval:interval})
  }

  remove(id: number) {
    return `This action removes a #${id} chunk`;
  }
}
