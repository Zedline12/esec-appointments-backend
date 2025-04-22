import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { AppGatewayService } from '../gateway/app.gateway.service';
import { FileInterceptor } from '@nestjs/platform-express/multer';
import mongoose from 'mongoose';
import { ReservationRpa } from './reservation.rpa';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly reservationRpa: ReservationRpa,
    private readonly gatewayService: AppGatewayService,
  ) {}

  @Post()
  async create(@Body() createReservationDto: CreateReservationDto) {
    return await this.reservationsService.createReservation(
      createReservationDto,
    );
  }
  @Delete()
  async deleteAll() {
    return await this.reservationsService.deleteAllReservations();
    }
  @Get('export')
  async exportReservations(@Res() res: Response) {
    const reservations = await this.reservationsService.exportAllReservations();
    console.log(reservations);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reservations');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: '_id', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Password', key: 'password', width: 20 },
      { header: 'Scholarship Type', key: 'scholarshipType', width: 25 },
      { header: 'Passport Option', key: 'passportOption', width: 20 },
      { header: 'Transactions Count', key: 'transactionsCount', width: 25 },
      { header: 'State', key: 'state', width: 20 },
      { header: 'ReservationDate', key: 'reservationDate', width: 20 },
    ];

    // Filter fields
    const filtered = reservations.map((r) => ({
      _id: r._id,
      email: r.email,
      password: r.password,
      scholarshipType: (r.scholarshipType as any).value,
      passportOption: (r.passportOption as any).value,
      transactionsCount: r.transactionsCount,
      state: r.state == 0 ? 'لم يتم الحجز' : 'تم الحجز بنجاح',
      reservationDate: r.reservedAt,
    }));

    // Add data to worksheet
    filtered.forEach((item) => worksheet.addRow(item));

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=reservations.xlsx',
    );

    // Stream the Excel file to response
    await workbook.xlsx.write(res);
    res.end();
  }
  @Post('test')
  async test(@Body() createReservationDto: any) {
    // return await this.reservationRpa.createReservation(
    //   '6800cccd6a0d9f73b02cb795',
    //   createReservationDto.email,
    //   createReservationDto.password,
    //   createReservationDto.scholarshipType,
    //   createReservationDto.passportOption,
    //   createReservationDto.transactionsCount,
    //   createReservationDto.isDateAutomatic,
    //   createReservationDto.reservationDate,
    //   createReservationDto.isProxy,
    // );
  }
  @Post('test-websocket')
  async testWebsocket(@Body() test) {
    await this.gatewayService.updateReservationState(test);
  }

  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    return this.reservationsService.processExcelFile(file);
  }
  @Get()
  async getAllReservations() {
    return await this.reservationsService.getAllReservations();
  }
  @Get('success')
  async getSuccessReservations() {
    return await this.reservationsService.getSuccessReservations();
  }
  @Get('scolarship-types')
  async getScolarshipTypes() {
    return await this.reservationsService.getScolarshipTypes();
  }
  @Get('passport-options')
  async getPassportOptions() {
    return await this.reservationsService.getPassportOptions();
  }
  @Post('scolarship-type')
  async createScholarShipType(
    @Body() createScolarshipTypeDto: { value: string; id: number },
  ) {
    return await this.reservationsService.createScolarshipType(
      createScolarshipTypeDto,
    );
  }
  @Post('passport-option')
  async createPassportOption(
    @Body() createPassportOptionDto: { value: string; id: number },
  ) {
    return await this.reservationsService.createPassportOption(
      createPassportOptionDto,
    );
  }
  @Patch('scolarship-type/:id/update')
  async updateScolarshipType(
    @Param('id') id: string,
    @Body() createScolarshipTypeDto: { value: string; id: number },
  ) {
    console.log(createScolarshipTypeDto);
    return await this.reservationsService.updateScolarshipType(
      id,
      createScolarshipTypeDto.id,
      createScolarshipTypeDto.value,
    );
  }
  @Patch('passport-option/:id/update')
  async updatePassportOption(
    @Param('id') id: string,
    @Body() createPassportOptionDto: { value: string; id: number },
  ) {
    console.log(createPassportOptionDto);
    return await this.reservationsService.updatePassportOption(
      id,
      createPassportOptionDto.id,
      createPassportOptionDto.value,
    );
  }

  @Get('operations')
  async getAllActiveOperations() {
    return await this.reservationsService.getActiveOperations();
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reservationsService.findOne(+id);
  }

  @Patch(':id/update')
  async update(@Param('id') id: string, @Body() updateReservationDto: any) {
    try {
      console.log(updateReservationDto);
      return await this.reservationsService.updateOneById(
        new mongoose.Types.ObjectId(id),
        updateReservationDto,
      );
    } catch (error) {
      throw new Error(`Error updating reservation: ${error.message}`);
    }
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reservationsService.deleteReservation(id);
  }

  @Delete('passport-options/:id/delete')
  async deletePassportOption(@Param('id') id: string) {
    return await this.reservationsService.deletePassportOption(id);
  }

  @Delete('scolarship-types/:id/delete')
  async deleteScolarshipType(@Param('id') id: string) {
    return await this.reservationsService.deleteScolarshipType(id);
  }
}
