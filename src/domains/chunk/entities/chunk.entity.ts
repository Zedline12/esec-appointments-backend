import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type chunkDocument = Chunk & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Chunk {


  @Prop({ required: false, min: 0,default:0 })
  chunkInterval: number;
}

export const Chunkschema = SchemaFactory.createForClass(Chunk);
