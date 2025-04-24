import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Settings {
  @Prop({ type: String, required: true })
  proxyUsername: string;
  @Prop({ type: String, required: true })
  proxyPassword: string;
  @Prop({ type: Number, required: false, default: 5 })
  chunksSizes: number;
  @Prop({ type: Boolean, required: false, default: false })
  start: boolean;
}
export const SettingsSchema = SchemaFactory.createForClass(Settings);
