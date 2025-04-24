import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { UserService } from '../user/user.service';
import { ReservationRpa } from './reservation.rpa';
import {
  Reservation,
  ReservationPassportOption,
  ReservationScholarshipType,
} from './entities/reservation.entity';
import { AppGatewayService } from '../gateway/app.gateway.service';
import * as XLSX from 'xlsx';
import { AppBootstrapService } from 'src/domains/reservations/app.bootstrap.service';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly userService: UserService,
    private readonly gatewayService: AppGatewayService,
    @InjectModel(Reservation.name)
    private reservationModel: Model<Reservation>,
    @InjectModel(ReservationScholarshipType.name)
    private reservationScholarshipTypeModel: Model<ReservationScholarshipType>,
    @InjectModel(ReservationPassportOption.name)
    private reservationPassportOptionModel: Model<ReservationPassportOption>,
    private readonly reservationRpa: ReservationRpa,
    private AppbootstrapService: AppBootstrapService,
  ) {}
  async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async getReservationById(id: mongoose.Types.ObjectId) {
    return await this.reservationModel
      .findById(id)
      .populate('scholarshipType passportOption');
  }
  async createReservation(createAppointmentDto: CreateReservationDto) {
    const result =
      await await this.reservationModel.create(createAppointmentDto);
    return result;
  }
  async deleteAllReservations() {
    return await this.reservationModel.deleteMany({});
  }
  async findOneById(id: string) {
    return await this.reservationModel
      .findById(new mongoose.Types.ObjectId(id))
      .populate('scholarshipType passportOption');
  }
  convertToDate(value: any): Date | null {
    if (typeof value === 'string' && /\d{1,2}-\d{1,2}-\d{4}/.test(value)) {
      // Handle date string in the format dd-mm-yyyy (e.g., "28-3-2025")
      const [day, month, year] = value.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed
    } else if (typeof value === 'number') {
      // Handle Excel serial date format (e.g., 45720.000601851854)
      const excelStartDate = new Date(1899, 11, 30); // Excel's base date is 30-Dec-1899
      const millisecondsPerDay = 86400 * 1000;
      return new Date(excelStartDate.getTime() + value * millisecondsPerDay);
    } else {
      return null; // Invalid format
    }
  }
  async processExcelFile(file: Express.Multer.File) {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const csvContent = file.buffer.toString('utf-8'); // Buffer → string

      const data = XLSX.utils.sheet_to_json(
        XLSX.read(csvContent, { type: 'string' }).Sheets.Sheet1,
      );
      console.log(data);
      // Convert Excel serial date number to JavaScript Date
      const processedData = data.map((row: any) => {
        const [col1, col2, col3, col4, col5, col6]: any[] = Object.values(row);
        console.log(this.convertToDate(col3));
        //  console.log(new Date(new Date((col3 - 25569) * 86400 * 1000)))
        return {
          email: col1,
          password: col2,
          reservationDate: this.convertToDate(col3),
          scholarshipType: col4,
          passportOption: col5,
          transactionsCount: Number(col6),
          isDateAutomatic: false,
        };
      });
      // console.log(processedData);
      // Process each row and create reservations for new users
      // Get existing reservations with state == 0
      const existingReservations = await this.reservationModel
        .find({
          state: 0,
        })
        .exec();

      // Create map of existing reservations by email for faster lookup
      const existingEmailMap = new Map(
        existingReservations.map((res) => [res.email, true]),
      );

      // Filter out records that already exist
      const newRecords = processedData.filter(
        (record) => !existingEmailMap.has(record.email as string),
      );
      // Get all scholarship types and passport options
      const scholarshipTypes = await this.reservationScholarshipTypeModel
        .find()
        .exec();
      const passportOptions = await this.reservationPassportOptionModel
        .find()
        .exec();
      newRecords.forEach((d) => {
        // console.log(d.scholarshipType)
        //  console.log(d.scholarshipType.replace(/[^0-9]/g, ''))
      });
      const reservationsToCreate = newRecords.map((record) => ({
        email: record.email,
        password: record.password,
        scholarshipType: scholarshipTypes.find(
          (type) => type.id === Number(record.scholarshipType.match(/\d+/)),
        )?._id,
        passportOption: passportOptions.find(
          (option) => option.id === Number(record.passportOption.match(/\d+/)),
        )?._id,
        transactionsCount: record.transactionsCount,
        reservationDate: record.reservationDate,
        state: 0,
      }));

      if (reservationsToCreate.length > 0) {
        const result =
          await this.reservationModel.insertMany(reservationsToCreate);
      }

      return processedData;
    } catch (error) {
      throw new Error(`Error processing Excel file: ${error.message}`);
    }
  }
  async getActiveOperations(): Promise<Reservation[]> {
    return await this.reservationModel
      .find({
        state: {
          $not: { $eq: 0 },
        },
      })
      .populate('user', 'email -_id');
  }
  async create(
    user: mongoose.Types.ObjectId,
    scholarshipType: number,
    passportOption: number,
    transactionsCount: number,
    isDateAutomatic,
  ): Promise<Reservation> {
    return (
      await this.reservationModel.create({
        user,
        scholarshipType,
        passportOption,
        transactionsCount,
        isDateAutomatic,
      })
    ).populate('user');
  }
  findAll() {
    return `This action returns all appointments`;
  }

  findOne(id: number) {
    return `This action returns a #${id} appointment`;
  }
  async updateOneById(
    id: mongoose.Types.ObjectId,
    updateReservationDto: Partial<Reservation>,
  ) {
    if (updateReservationDto.scholarshipType)
      updateReservationDto.scholarshipType = new mongoose.Types.ObjectId(
        updateReservationDto.scholarshipType,
      );
    if (updateReservationDto.passportOption)
      updateReservationDto.passportOption = new mongoose.Types.ObjectId(
        updateReservationDto.passportOption,
      );
    console.log(updateReservationDto);
    try {
      return await this.reservationModel.findByIdAndUpdate(
        id,
        updateReservationDto,
      );
    } catch (error) {
      throw new Error(`Error updating reservation: ${error.message}`);
    }
  }
  async getScolarshipTypes() {
    return await this.reservationScholarshipTypeModel.find({});
  }
  async getPassportOptions() {
    return await this.reservationPassportOptionModel.find({});
  }
  async createScolarshipType(data: { value: string; id: number }) {
    try {
      const exists = await this.reservationScholarshipTypeModel.findOne({
        id: data.id,
      });
      if (exists) return;
      return await this.reservationScholarshipTypeModel.create(data);
    } catch (err) {
      console.log(err);
    }
  }
  async createPassportOption(data: { value: string; id: number }) {
    const exists = await this.reservationPassportOptionModel.findOne({
      id: data.id,
    });
    if (exists) return;
    return await this.reservationPassportOptionModel.create(data);
  }
  async updateScolarshipType(_id: string, id: number, value: string) {
    try {
      return await this.reservationScholarshipTypeModel.findByIdAndUpdate(
        new mongoose.Types.ObjectId(_id),
        { id: id, value: value },
      );
    } catch (err) {
      console.log(err);
    }
  }
  async updatePassportOption(_id: string, id: number, value: string) {
    try {
      return await this.reservationPassportOptionModel.findByIdAndUpdate(
        new mongoose.Types.ObjectId(_id),
        { id: id, value: value },
      );
    } catch (err) {
      console.log(err);
    }
  }
  async getAllReservations() {
    return await this.reservationModel
      .find({
        state: 0,
      })
      .populate('scholarshipType')
      .populate('passportOption');
  }
  async getSuccessReservations() {
    return await this.reservationModel
      .find({
        state: 1,
      })
      .populate('scholarshipType')
      .populate('passportOption');
  }
  async exportAllReservations() {
    return await this.reservationModel
      .find({})
      .sort({ state: -1 })
      .populate('scholarshipType passportOption');
  }
  async updateProcessStateById(
    id: mongoose.Types.ObjectId,
    processState: string,
  ) {
    return await this.reservationModel.updateOne(
      { _id: id },
      { processState: processState },
    );
  }
  async updateStateById(id: mongoose.Types.ObjectId, state: number) {
    return await this.reservationModel.updateOne({ _id: id }, { state: state });
  }

  remove(id: number) {
    return `This action removes a #${id} appointment`;
  }
  async deleteReservation(id: string) {
    await this.reservationModel.deleteOne({ _id: id });
  }
  async deletePassportOption(id: string) {
    try {
      const result = await this.reservationPassportOptionModel
        .findByIdAndDelete(id)
        .exec();
      if (!result) {
        throw new Error('Passport option not found');
      }
      return { message: 'Passport option deleted successfully' };
    } catch (error) {
      throw new Error(`Error deleting passport option: ${error.message}`);
    }
  }

  async deleteScolarshipType(id: string) {
    try {
      const result = await this.reservationScholarshipTypeModel
        .findByIdAndDelete(id)
        .exec();
      if (!result) {
        throw new Error('Scholarship type not found');
      }
      return { message: 'Scholarship type deleted successfully' };
    } catch (error) {
      throw new Error(`Error deleting scholarship type: ${error.message}`);
    }
  }
}
