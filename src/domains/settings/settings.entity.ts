import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { mongo } from 'mongoose';

@Schema()
export class Settings {
  @Prop({ type: String, required: true })
  proxyUsername: string;
  @Prop({ type: String, required: true })
  proxyPassword: string;
  @Prop({ type: Array, required: false })
  chunks: {_id:mongoose.Types.ObjectId; size: number; interval: number }[];
  @Prop({ type: Boolean, required: false, default: false })
  start: boolean;
  @Prop({ type: Boolean, required: false, default: true })
  isProxy:boolean
}
export const SettingsSchema = SchemaFactory.createForClass(Settings);
