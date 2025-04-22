import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema()
export class User{
  @Prop({ type: String, required: true })
  email: string
  @Prop({ type: String, required: true })
  password: string
  @Prop({ type: Number, required: false,default:0 })
  totalReversations: number
  @Prop({ type: Number, required: false,default:0 })
  pendingReversations: number
  @Prop({ type: Number, required: false, default: 0 })
  successReversations: number
}
export const UserSchema = SchemaFactory.createForClass(User)