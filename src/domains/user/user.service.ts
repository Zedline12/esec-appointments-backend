import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import * as XLSX from 'xlsx';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async create(email: string, password: string) {
    return await this.userModel.create({ email: email, password: password });
  }

  async findAll() {
    return await this.userModel.find().exec();
  }

  async findOne(id: string) {
    return await this.userModel.findById(id).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();
  }
  async findOneByEmail(email: string) {
    return await this.userModel.findOne({ email }).exec();
 }
  async remove(id: string) {
    return await this.userModel.findByIdAndDelete(id).exec();
  }

  async processExcelFile(file: Express.Multer.File) {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const processedData = data.map((row: any) => {
        const [col1, col2, col3, col4, col5, col6] = Object.values(row);
        return {
          email: col1,
          password: col2, 
          reservationDate: col3,
          scholarshipType: col4,
          passportOption: col5,
          transactionsCount: col6
        };
      });

      return processedData;
    } catch (error) {
      throw new Error(`Error processing Excel file: ${error.message}`);
    }
  }
}
