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
import mongoose from 'mongoose';
export interface IReservationToCreate {
  _id: mongoose.Types.ObjectId;
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
}
@Injectable()
export class AppBootstrapService implements OnApplicationBootstrap {
  constructor(
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationsService: ReservationsService,
    private readonly gatewayService: AppGatewayService,
    private readonly settingsService: SettingsService,
    private readonly reservationRpa: ReservationRpa,
  ) {}
  public reservationsList$ = new BehaviorSubject<IReservationToCreate[]>(null);
  public pushNewReservation(reservation: Reservation) {
    const reservationToCreate: IReservationToCreate = {
      _id: reservation._id,
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
  public pushReservationList(reservations: Reservation[]) {
    let reservationsToCreate = reservations.map((reservation) => {
      return {
        _id: reservation._id,
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
    });
    const chunks = this.splitIntoChunksOfFive(reservationsToCreate);
    chunks.forEach((chunk) => {
      this.reservationsList$.next(chunk);
    });
  }
  splitIntoChunksOfFive(arr) {
    const result = [];
    for (let i = 0; i < arr.length; i += 5) {
      result.push(arr.slice(i, i + 5));
    }
    return result;
  }
  async startReservations() {
    const reservations = await this.reservationsService.getAllReservations();

    let requestsCount = 0;
    let loggedinCount = 3;
    let loggedinIds = [];
    this.gatewayService.reservationState$.subscribe((x) => {
      console.log(x);
      if (
        x.successCode == 'LOGGED_IN' &&
        !loggedinIds.includes(x.reservationId)
      ) {
        loggedinCount++;
        console.log('new log in');
        loggedinIds.push(x.reservationId);
      }
    });
    // let reservationsToCreate = reservations.slice(0,5).map((reservation) => {
    //   return {
    //     _id: reservation._id,
    //     reservationId: reservation._id.toString(),
    //     email: reservation.email,
    //     password: reservation.password,
    //     scholarshipType: (reservation.scholarshipType as any).id,
    //     passportOption: (reservation.passportOption as any).id,
    //     transactionsCount: reservation.transactionsCount,
    //     isDateAutomatic: reservation.isDateAutomatic,
    //     reservationDate:
    //       reservation.reservationDate == null
    //         ? null
    //         : reservation.reservationDate.toISOString().split('T')[0],
    //     interval: reservation.interval,
    //     isProxy: reservation.isProxy,
    //   };
    // });

    this.reservationsList$.subscribe(async (reservationsToCreate) => {
      console.log(reservationsToCreate);
      if (reservationsToCreate != null) {
        const reservationRpa = new ReservationRpa(
          this.gatewayService,
          this.reservationsService,
          this.settingsService,
        );
        await reservationRpa.createReservation(reservationsToCreate);
      }
      // if (reservationsToCreate == null) return;
      // for (const reservation of reservationsToCreate) {
      //   const pRetry = require('p-retry').default;
      //   pRetry(
      //     async () => {
      //       const newReservation =
      //         await this.reservationsService.getReservationById(
      //           reservation._id,
      //         );
      //       const {
      //         _id,
      //         email,
      //         password,
      //         scholarshipType,
      //         passportOption,
      //         transactionsCount,
      //         isDateAutomatic,
      //         reservationDate,
      //         interval,
      //         isProxy,
      //       } = newReservation;
      //       const reservationRpa = new ReservationRpa(
      //         this.gatewayService,
      //         this.reservationsService,
      //         this.settingsService,
      //       );
      //       // await reservationRpa
      //       //   .createReservation(
      //       //     _id.toString(),
      //       //     email,
      //       //     password,
      //       //     (scholarshipType as any).id,
      //       //     (passportOption as any).id,
      //       //     transactionsCount,
      //       //     isDateAutomatic,
      //       //     reservationDate == null
      //       //       ? null
      //       //       : reservationDate.toISOString().split('T')[0],
      //       //     isProxy,
      //       //   )
      //       //   .then(async (data) => {
      //       //     console.log(data);
      //       //     await this.reservationsService.updateOneById(_id, {
      //       //       state: 1,
      //       //       reservedAt: data,
      //       //     });
      //       //   })
      //       //   .catch(async (err) => {
      //       //     if (err == 'RES_DELETED') {
      //       //       return;
      //       //     } else {
      //       //       console.log('retrying changing proxies');
      //       //       throw new Error('retry');
      //       //     }
      //       //   });
      //     },
      //     {
      //       retries: 999999,
      //       minTimeout: 0,
      //       maxTimeout: 0,
      //       onFailedAttempt: (error) => {
      //         console.log('retring p-retry');
      //       },
      //     },
      //   );
      //   requestsCount++;
      //   console.log(requestsCount);
      //   console.log(loggedinCount);
      //   await new Promise((resolve, reject) => {
      //     if (requestsCount == loggedinCount) {
      //       console.log('awaiting promise');
      //       const check = () => {
      //         if (requestsCount + 3 == loggedinCount) {
      //           clearInterval(interval);
      //           resolve('resolve'); // now your await unblocks
      //         }
      //       };
      //       const interval = setInterval(check, 100); // check every 100 ms
      //     } else {
      //       resolve('resolve');
      //     }
      //   });
      // }n
    });
    this.pushReservationList(reservations.slice(0, 1));
    // reservations.forEach((res) => {
    //   this.pushNewReservation(res);
    // });
  }

  async onApplicationBootstrap() {
    setTimeout(() => {
      this.startReservations();
    }, 0); // run in the background
  }
}
