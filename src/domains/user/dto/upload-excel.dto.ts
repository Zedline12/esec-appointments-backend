
import { IsNotEmpty } from 'class-validator';

export class UploadExcelDto {
  @IsNotEmpty()
  file: Express.Multer.File;
}
