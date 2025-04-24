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
import { ChunkService } from '../chunk/chunk.service';
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
  public async pushReservationList(reservations: Reservation[]) {
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
    const chunks = await this.splitIntoChunks(reservationsToCreate);
    const chunksData = await this.chunksService.findAll();
    chunks.forEach((chunk, index) => {
      this.reservationsList$.next(chunk);
    });
  }
  async splitIntoChunks(arr) {
    const chunkSize = (await this.settingsService.getSettings()).chunksSizes;
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
      result.push(arr.slice(i, i + chunkSize));
    }
    return result;
  }
  async startReservations() {
    const reservations = await this.reservationsService.getAllReservations();

    const safeClone = JSON.parse(JSON.stringify(reservations.slice(0, 6)));
    this.pushReservationList(reservations);
  }

  async onApplicationBootstrap() {
    // run in the background
    this.reservationsList$.subscribe(async (reservationsToCreate) => {
      if (reservationsToCreate != null) {
        const reservationRpa = new ReservationRpa(
          this.gatewayService,
          this.reservationsService,
          this.settingsService,
        );
        try {
          await reservationRpa.createReservation(reservationsToCreate);
        } catch (err) {
          console.log('rejecting on application bootstrap');
        }
      }
    });
  }
}
