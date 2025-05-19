import {
  forwardRef,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { AppGatewayService } from '../gateway/app.gateway.service';
import { ReservationRpa } from './reservation.rpa';
import { SettingsService } from '../settings/settings.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { Reservation } from './entities/reservation.entity';
import { ChunkService } from '../chunk/chunk.service';
import axios from 'axios';
export interface IReservationToCreate {
  reservationId: string;
  email: string;
  password: string;
  scholarshipType: number;
  passportOption: number;
  transactionsCount: number;
  isDateAutomatic: boolean;
  reservationDate: string;
  interval: number;
  isProxy: boolean;
  cookie?: string;
  user?: object;
  finalDate?: string;
  //proxy
  agent?: any;
}
@Injectable()
export class AppBootstrapService implements OnApplicationBootstrap {
  constructor(
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationsService: ReservationsService,
    private readonly gatewayService: AppGatewayService,
    private readonly settingsService: SettingsService,
    private readonly reservationRpa: ReservationRpa,
    private readonly chunksService: ChunkService,
  ) {}
  public reservationsList$ = new BehaviorSubject<IReservationToCreate[]>(null);

  public pushNewReservation(reservation: Reservation) {
    const reservationToCreate: IReservationToCreate = {
      reservationId: reservation._id.toString(),
      email: reservation.email,
      password: reservation.password,
      scholarshipType: (reservation.scholarshipType as any).id,
      passportOption: (reservation.passportOption as any).id,
      transactionsCount: reservation.transactionsCount,
      isDateAutomatic: reservation.isDateAutomatic,
      reservationDate:
        reservation.reservationDate == null
          ? null
          : reservation.reservationDate.toISOString().split('T')[0],
      interval: reservation.interval,
      isProxy: reservation.isProxy,
    };
    this.reservationsList$.next([reservationToCreate]);
  }
  // public async pushReservationList(reservations: Reservation[]) {
  //   let reservationsToCreate = reservations.map((reservation) => {
  //     return {
  //       _id: reservation._id,
  //       reservationId: reservation._id.toString(),
  //       email: reservation.email,
  //       password: reservation.password,
  //       scholarshipType: (reservation.scholarshipType as any).id,
  //       passportOption: (reservation.passportOption as any).id,
  //       transactionsCount: reservation.transactionsCount,
  //       isDateAutomatic: reservation.isDateAutomatic,
  //       reservationDate:
  //         reservation.reservationDate == null
  //           ? null
  //           : reservation.reservationDate.toISOString().split('T')[0],
  //       interval: reservation.interval,
  //       isProxy: reservation.isProxy,
  //     };
  //   });
  //   const chunks = await this.splitIntoChunks(reservationsToCreate);
  //   const chunksData = await this.chunksService.findAll();
  //   chunks.forEach((chunk, index) => {
  //     this.reservationsList$.next(chunk);
  //   });
  // }
  // async splitIntoChunks(arr) {
  //   const chunkSize = (await this.settingsService.getSettings()).chunksSizes;
  //   const result = [];
  //   for (let i = 0; i < arr.length; i += chunkSize) {
  //     result.push(arr.slice(i, i + chunkSize));
  //   }
  //   return result;
  // }
  async startReservations() {
   
    await this.reservationRpa.start();
//     const agent = new https.Agent({
//   rejectUnauthorized: false,
// });
//     reservationsToCreate.forEach((user,i) =>
//       axios
//         .post(
//           url,
//           {
//             username: user.email,
//             password: user.password,
//           },
//           {
//             httpsAgent: agent,
//             headers: {
//               Accept: 'application/json, text/plain, */*',
//               'Accept-Encoding': 'gzip, deflate, br, zstd',
//               'Accept-Language': 'en-US,en;q=0.9',
//               Connection: 'keep-alive',
//               'Content-Type': 'application/json',
//               Host: 'ecsc-expat.sy:8080',
//               Origin: 'https://www.ecsc-expat.sy',
//               Referer: 'https://www.ecsc-expat.sy/login',
//               'Sec-CH-UA':
//                 '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
//               'Sec-CH-UA-Mobile': '?1',
//               'Sec-CH-UA-Platform': '"Android"',
//               'Sec-Fetch-Dest': 'empty',
//               'Sec-Fetch-Mode': 'cors',
//               'Sec-Fetch-Site': 'same-site',
//               Source: 'WEB',
//               'User-Agent':
//                 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
//             },
//             //  signal: controller.signal, // optional, only if you want to support aborting
//             // You can also add `timeout`, `withCredentials`, etc., if needed
//           },
//         )
//         .then((res) => {
//           console.log(`Response ${i + 1}:`, res.status);
//           this.gatewayService.updateReservationState(
//             {
//                   reservationId: user.reservationId,
//                   state: 0,
//                   message: 'تم تسجيل الدخول بنجاح',
//                   isError: false,
//                   errorCode: null,
//                   successCode: 'LOGGED_IN',
//                   index: 0,
//                 }
//           );
//         })
//         .catch((err) => {
//           console.error(`Request ${i + 1} failed:`, err.message);
//         }));

    // const chunks = await this.splitIntoChunks(reservationsToCreate.slice(0, 1));
    // for (let chunk of chunks) {
    //   const worker = new Worker(
    //     './src/domains/reservations/reservation.worker.cjs',
    //     {
    //       workerData: chunk,
    //     },
    //   );

    //   worker.on('message', (message) => {
    //     this.gatewayService.updateReservationState(message);
    //     console.log(message);
    //     if (message.state) {
    //       this.reservationsService.updateOneById(
    //         new mongoose.Types.ObjectId(message.reservationId),
    //         { state: 1, reservedAt: message.reservedAt },
    //       );
    //     }
    //     console.log('Message from worker:', message);
    //   });
    //   worker.on('exit', (code) => {
    //     console.log(`Worker exited with code: ${code}`);
    //   });
    //   this.gatewayService.shutdown$.subscribe((data) => {
    //     console.log('pushing message to worker');
    //     worker.postMessage({ type: 'shutdown' });
    //   });
    // }
  }
  async sendRequests() {
    const url = 'https://ecsc-expat.sy:8080/secure/auth/login'; // replace with your target URL

    const requests = Array.from({ length: 60 }, (_, i) =>
      axios
        .post(url)
        .then((res) => {
          console.log(`Response ${i + 1}:`, res.status);
        })
        .catch((err) => {
          console.error(`Request ${i + 1} failed:`, err.message);
        }),
    );

    await Promise.all(requests); // Wait for all 60 to finish
    console.log('All 60 requests completed.');
  }
  async onApplicationBootstrap() {
    // this.sendRequests();
  }
}
