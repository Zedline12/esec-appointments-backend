import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  @IsString()
  password: string;
  @IsNotEmpty()
  scholarshipType: string;
  @IsNotEmpty()
  passportOption: string;
  @IsNotEmpty()
  @IsNumber()
  transactionsCount: number;
  @IsNotEmpty()
  @IsBoolean()
  isDateAutomatic: boolean;
   @IsOptional()
  reservationDate: Date;
}
