import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ScholarshipType } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsString()
  password: string;
  @IsNotEmpty()
  @IsNumber()
  @Min(2)
  @Max(10)
  scolarshipType: number;
  @IsNotEmpty()
  @IsNumber()
  @Min(2)
  @Max(5)
  passportOption: number;
  @IsNotEmpty()
  @IsNumber()
  transactionsCount: number;
}
