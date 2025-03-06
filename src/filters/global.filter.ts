import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
  } from '@nestjs/common';
  import { Request, Response } from 'express';
import { ApiBasicResponse } from 'src/interfaces/response.interface';
  
  @Catch(HttpException)
  export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
      const status = exception.getStatus();
      const errorResponse = {
        statusCode: status,
        //check for validation array messages
        message: Array.isArray((exception.getResponse() as any).message)
          ? (exception.getResponse() as any).message
          : exception.message || 'Internal server error',
        error: exception.name || 'Error',
        timestamp: Date.now(),
        version: request.originalUrl.split('/')[1],
        path: request.url,
        data: {},
      } as ApiBasicResponse;
      response.status(status).json(errorResponse);
    }
  }
  