import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/global.filter';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common';
import * as os from 'os'; // <- move bootstrap into its own file if needed
import * as _cluster from 'cluster';
const cluster = _cluster as unknown as _cluster.Cluster;
const numCPUs = os.cpus().length;

// if (cluster.isPrimary) {
//   console.log(`Primary process running on PID: ${process.pid}`);
//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }

//   cluster.on('exit', (worker, code, signal) => {
//     console.warn(`Worker ${worker.process.pid} died. Restarting...`);
//     cluster.fork(); // Auto-restart failed workers
//   });
// } else {
//   console.log(`Worker ${process.pid} started`);
//   bootstrap(); // run NestJS server in each worker
// }
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter()); // Register the filter globally
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  await app.listen(3001);
}

bootstrap();
