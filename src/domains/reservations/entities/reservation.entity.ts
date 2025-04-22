import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';

export type ReservationDocument = Reservation & Document;
@Schema()
export class ReservationScholarshipType {
  _id: mongoose.Types.ObjectId;
  @Prop({ type: String, required: true })
  value: string;
  @Prop({ type: Number, required: true })
  id: number;
}
@Schema()
export class ReservationPassportOption {
  _id: mongoose.Types.ObjectId;
  @Prop({ type: String, required: true })
  value: string;
  @Prop({ type: Number, required: true })
  id: number;
}
@Schema()
export class Reservation {
  _id: mongoose.Types.ObjectId;
  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  password: string;
  @Prop({
    type: mongoose.Types.ObjectId,
    ref: 'ReservationScholarshipType',
    required: true,
  })
  scholarshipType: mongoose.Types.ObjectId;
  @Prop({
    type: mongoose.Types.ObjectId,
    ref: 'ReservationPassportOption',
    required: true,
  })
  passportOption: mongoose.Types.ObjectId;
  @Prop({ type: Number, required: true })
  transactionsCount: number;
  @Prop({ type: Boolean, required: false, default: true })
  isDateAutomatic: boolean;
  @Prop({
    type: String,
    required: false,
  })
  processState: string;
  @Prop({
    type: Number,
    default: 0,
    required: false,
  })
  state: number;
  @Prop({ type: Date, default: Date.now(), required: false })
  processDate: Date;
  @Prop({ type: Date, required: false })
  reservationDate: Date;
  @Prop({ type: String, required: false })
  reservedAt?: string;
  @Prop({ type: Number, required: false, default: 1 })
  interval: number;
  @Prop({ type: Boolean, required: false, default: true })
  isProxy: boolean;
}
export const ReservationSchema = SchemaFactory.createForClass(Reservation);
export const ReservationScholarshipTypeSchema = SchemaFactory.createForClass(
  ReservationScholarshipType,
);
export const ReservationPassportOptionSchema = SchemaFactory.createForClass(
  ReservationPassportOption,
);
// Set isDateAutomatic to true when reservationDate is null
ReservationSchema.pre('save', function (next) {
  console.log(this.reservationDate);
  if (this.reservationDate === null) {
    this.isDateAutomatic = true;
  } else {
    this.isDateAutomatic = false;
  }
  next();
});
// Set isDateAutomatic to true when reservationDate is null for bulk operations
ReservationSchema.pre('insertMany', function (next, docs) {
  if (Array.isArray(docs)) {
    docs.forEach((doc) => {
      if (doc.reservationDate === null) {
        doc.isDateAutomatic = true;
      } else {
        doc.isDateAutomatic = false;
      }
    });
  }
  next();
});
