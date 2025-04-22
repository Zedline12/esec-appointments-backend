import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema()
export class Notification {
    @Prop({ type: String, required: true })
    message: string;
    @Prop({type:Date,default:Date.now()})
    date:Date
}
export const NotificationSchema = SchemaFactory.createForClass(Notification)