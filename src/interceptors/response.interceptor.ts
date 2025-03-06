import {
    CallHandler,
    ExecutionContext,
    HttpException,
    NestInterceptor,
  } from '@nestjs/common';
  import { catchError, map, Observable, throwError } from 'rxjs';
  import { ApiBasicResponse } from 'src/interfaces/response.interface';
  
  export class ResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      const statusCode = response.statusCode;
      return next.handle().pipe(
        map(
          (data) =>
            ({
              statusCode,
              message: statusCode >= 400 ? 'Error' : 'Success',
              error: statusCode >= 400 ? response.message : null,
              timestamp: Date.now(),
              version: request.originalUrl.split('/')[1],
              path: request.url,
              data,
            }) as ApiBasicResponse,
        ),
      );
    }
  }
  