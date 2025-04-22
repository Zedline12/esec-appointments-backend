import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema()
export class Settings{
    @Prop({ type: String, required: true })
    proxyUsername: string;
    @Prop({ type: String, required: true })
    proxyPassword: string;
}
export const SettingsSchema = SchemaFactory.createForClass(Settings)