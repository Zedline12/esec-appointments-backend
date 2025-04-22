import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ReservationProcessCurrentState } from '../reservations/reservation.rpa';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Subject } from 'rxjs/internal/Subject';

@WebSocketGateway({
  cors: {
    origin: '*', // Your Angular frontend
    methods: ['GET', 'POST'],
  },
})
export class AppGatewayService {
  constructor() { }
  @WebSocketServer()
  server: Server;
  handleConnection(client: Socket): void {
    this.server.emit('room', client.id + ' joined!');
  }
  public reservationState$ = new Subject<ReservationProcessCurrentState>();

  handleDisconnect(client: Socket): void {
    this.server.emit('room', client.id + ' left!');
  }
  reservationProcessCreated(message: string) {
    this.server.emit('reservationProcessCreated', message);
  }h
  updateReservationState(
    reservationProcessCurrentState: ReservationProcessCurrentState,
  ) {
    this.server.emit('reservationProcessState', reservationProcessCurrentState);
    this.reservationState$.next(reservationProcessCurrentState);
  }

  sendNotification(message: any): void {
    this.server.emit('notification', message);
  }



}
