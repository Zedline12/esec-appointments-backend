import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import { AppGatewayService } from '../gateway/app.gateway.service';
import puppeteer from 'puppeteer-extra';
import { ReservationsService } from './reservations.service';
import mongoose, { set } from 'mongoose';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import { SettingsService } from '../settings/settings.service';
import { IReservationToCreate } from './app.bootstrap.service';
import pLimit from 'p-limit';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { anonymizeProxy, closeAnonymizedProxy } from 'proxy-chain';
import { ChunkService } from '../chunk/chunk.service';
const rateLimit = require('axios-rate-limit');
puppeteer.use(StealthPlugin());

export interface ReservationProcessCurrentState {
  reservationId: string;
  state: number;
  message: string;
  isError: boolean;
  errorCode?: string;
  successCode?: string;
  popup?: boolean;
  index?: number;
  remove?: boolean;
}
export interface ReservationData {
  reservationId: string;
  email: string;
  password: string;
  scholarshipType: number;
  passportOption: number;
  transactionsCount: number;
  isDateAutomatic: boolean;
  reservationDate: string;
  finalDate?: string;
  reservedAt?: string;
  isProxy: boolean;
}

export class RequestScheduler {
  queue: any[];
  isProcessing: boolean;
  batchSize: number;
  interval: number;
  anonymizedProxy: string;

  agent: any;
  constructor(agent, batchSize = 10, interval = 0) {
    this.queue = [];
    this.isProcessing = false;
    this.batchSize = batchSize;
    this.interval = interval; // ms delay between batches
    this.init();
    // this.agent = agent;
  }
  async init() {
    const proxy =
      'http://2f957320733b8578ba35__cr.fr,gb,us:9919acfe08c2c6b1@gw.dataimpulse.com:823'; // Adjust if auth is not needed
    this.anonymizedProxy = await anonymizeProxy(proxy);
    this.agent = new HttpsProxyAgent(this.anonymizedProxy, {
      keepAlive: true, // Re-use connections
      maxSockets: 999, // Max sockets per host (default: Infinity)
      maxFreeSockets: 999, // Max free sockets to keep open// Total max sockets across all hosts
      // Timeout settings
      timeout: 30000, // Overall request timeout (30s)    // Keep-alive timeout (30s)        // TCP connection timeout (5s)       // Socket inactivity timeout (25s)
      // Performance tuning
      scheduling: 'fifo',
    });
  }
  getRandomBatch(size) {
    const indices = new Set();

    while (indices.size < Math.min(size, this.queue.length)) {
      const randomIndex = Math.floor(Math.random() * this.queue.length);
      indices.add(randomIndex);
    }

    // Extract items by index and remove them from the original queue
    const batch = [];
    const remainingQueue = [];

    this.queue.forEach((item, idx) => {
      if (indices.has(idx)) {
        batch.push(item);
      } else {
        remainingQueue.push(item);
      }
    });

    this.queue = remainingQueue;
    return batch;
  }
  async queueRequest(config) {
    return new Promise((resolve, reject) => {
      this.queue.push({ config, resolve, reject });
      this.processQueue(); // attempt to start processing
    });
  }
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const running = new Set();
    const launchNext = async () => {
      if (this.queue.length === 0) return;

      // Take a random request from the queue
      const index = Math.floor(Math.random() * this.queue.length);
      const { config, resolve, reject } = this.queue.splice(index, 1)[0];
      delete config.httpsAgent;
      const promise = axios(config);

      running.add(promise);
    };

    // Start initial pool of requests
    const initial = Math.min(this.batchSize, this.queue.length);
    for (let i = 0; i < initial; i++) {
      console.log('lanching');
      launchNext();
    }

    // Wait until all requests are done
    await Promise.all(Array.from(running));

    this.isProcessing = false;
  }
}

@Injectable()
export class ReservationRpa {
  constructor(
    private readonly gatewayService: AppGatewayService,
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationService: ReservationsService,
    private readonly settingsService: SettingsService,
    private readonly chunksService: ChunkService,
  ) {}
  proxyIndex: number = 0;
  page!: Page;
  browser!: Browser;
  reservationId: string;
  pageClosed: boolean = false;
  controller!: AbortController;
  agent!: any;
  requestScheduler: any;
  async startChunk(chunk) {
    console.log(chunk.length);
    chunk.map((user) => this.loginUser(user, null));
  }
  async splitIntoChunks(arr) {
    let startIndex = 0;
    const chunks = (await this.settingsService.getSettings()).chunks;
    console.log(chunks);
    console.log('hello');
    const result = [];
    for (let chunk of chunks) {
      result.push({
        data: arr.slice(startIndex, startIndex + chunk.size),
        interval: chunk.interval,
      });
      startIndex = startIndex + chunk.size;
    }
    return result;
  }
  async loginUser(user, chunk: { data: any; interval: number }): Promise<any> {
    if (!user.agent) {
      const proxy = `http://2f957320733b8578ba35__cr.gb,us,fr,tr:9919acfe08c2c6b1@gw.dataimpulse.com:1000${this.proxyIndex}`; // Adjust if auth is not needed

      // Create an agent using your proxy
      const agent = new HttpsProxyAgent(proxy, {
        keepAlive: true,
        timeout: 20000,
      });
      user.agent = agent;
      this.proxyIndex++;
      console.log(proxy);
    }
    console.log('loggin in');
    this.requestScheduler
      .queueRequest({
        data: {
          username: user.email,
          password: user.password,
        },
        url: 'https://ecsc-expat.sy:8080/secure/auth/login',
        method: 'POST',
        timeout: 20000,
        httpsAgent: user.agent,
        signal: this.controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
          Host: 'ecsc-expat.sy:8080',
          Origin: 'https://www.ecsc-expat.sy',
          Referer: 'https://www.ecsc-expat.sy/login',
          'Sec-CH-UA':
            '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
          'Sec-CH-UA-Mobile': '?1',
          'Sec-CH-UA-Platform': '"Android"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          Source: 'WEB',
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
        },
      })

      .then(async (response: any) => {
        const data: any = response.data;
        this.gatewayService.updateReservationState({
          reservationId: user.reservationId,
          state: 0,
          message: 'تم تسجيل الدخول بنجاح',
          isError: false,
          errorCode: null,
          successCode: 'LOGGED_IN',
          index: 0,
        });
        user.cookie = response.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
        user.user = data.P_PROFILE_RESULT;
        try {
          await this.findReservation(user, chunk);
        } catch (err) {}
      })
      .catch((err) => {
        if (err.code === 'ECONNRESET') {
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'الاتصال انقطع',
            isError: true,
            errorCode: 'ECONNRESET',
          };
          this.gatewayService.updateReservationState(state);
          this.loginUser(user, chunk);
        } else if (err.code === 'ECONNABORTED') {
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'الموقع لا يستجيب',
            isError: true,
            errorCode: 'ECONNRESET',
          };
          this.gatewayService.updateReservationState(state);
          this.loginUser(user, chunk);
        } else {
          if (err.response) {
            const errorResponse = err.response.data;
            console.log(errorResponse);
            if (
              errorResponse.ErrorCode == 'U401' ||
              errorResponse.ErrorCode == 'U423'
            ) {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: errorResponse.Message,
                isError: true,
                errorCode: errorResponse.ErrorCode,
                remove: true,
              };
              this.gatewayService.updateReservationState(state);
              return;
            } else {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: errorResponse.Message,
                isError: true,
                errorCode: errorResponse.ErrorCode,
              };
              this.gatewayService.updateReservationState(state);
              return this.loginUser(user, chunk);
            }
          } else {
            console.log(err.message);
            this.loginUser(user, chunk);
          }
        }
      });
  }
  async findReservation(
    user: IReservationToCreate & { cookie: string; user: any; agent: any },
    chunk: { data: any[]; interval: number },
  ) {
    //   axios
    // .get(url, {
    //   httpsAgent: this.agent,
    //   signal: this.controller.signal,
    //   headers: {
    //     Accept: 'application/json, text/plain, */*',
    //     'Accept-Encoding': 'gzip, deflate, br, zstd',
    //     'Accept-Language': 'en-US,en;q=0.9',
    //     Connection: 'keep-alive',
    //     'Content-Type': 'application/json',
    //     Cookie: user.cookie,
    //     Host: 'ecsc-expat.sy:8080',
    //     Origin: 'https://www.ecsc-expat.sy',
    //     Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
    //     'Sec-CH-UA':
    //       '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    //     'Sec-CH-UA-Mobile': '?1',
    //     'Sec-CH-UA-Platform': '"Android"',
    //     'Sec-Fetch-Dest': 'empty',
    //     'Sec-Fetch-Mode': 'cors',
    //     'Sec-Fetch-Site': 'same-site',
    //     Source: 'WEB',
    //     'User-Agent':
    //       'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
    //   },
    // })
    const params = {
      missionId: user.scholarshipType.toString(),
      serviceId: user.passportOption.toString(),
      companion: user.transactionsCount.toString(),
    };
    const queryString = new URLSearchParams(params).toString();
    const url = `https://ecsc-expat.sy:8080/rs/available?${queryString}`;
    this.requestScheduler
      .queueRequest({
        url: url,
        method: 'GET',
        timeout: 20000,
        httpsAgent: user.agent,
        signal: this.controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
          Cookie: user.cookie,
          Host: 'ecsc-expat.sy:8080',
          Origin: 'https://www.ecsc-expat.sy',
          Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
          'Sec-CH-UA':
            '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
          'Sec-CH-UA-Mobile': '?1',
          'Sec-CH-UA-Platform': '"Android"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          Source: 'WEB',
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
        },
      })

      .then(async (response) => {
        const data: any = response.data;
        if (!data.length) {
          console.log('no reservations avaliable');
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'لا يوجد حجوزات متاحة',
            isError: true,
            errorCode: 'NO_RESERVATIONS_AVAILABLE',
          };
          this.gatewayService.updateReservationState(state);
          if (chunk) {
            console.log(chunk.interval);
            await new Promise((res, rej) => setTimeout(res, chunk.interval));
          }
          this.findReservation(user, chunk);
        } else {
          if (chunk) {
            chunk.data.shift();
            this.startChunk(chunk.data);
          }
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'هناك حجوزات متاحة',
            isError: false,
            errorCode: null,
            index: 1,
          };
          this.gatewayService.updateReservationState(state);
          const dates = data;
          let date;
          if (dates.includes(user.reservationDate)) {
            date = user.reservationDate;
            console.log(date);
          } else {
            const referenceDate = new Date(user.reservationDate);
            const nearestDate = dates.reduce((nearest, date) => {
              const currDiff = Math.abs(
                new Date(date).getTime() - referenceDate.getTime(),
              );
              const nearestDiff = Math.abs(
                new Date(nearest).getTime() - referenceDate.getTime(),
              );
              return currDiff < nearestDiff ? date : nearest;
            });
            console.log('nearest date is', nearestDate);
            date = nearestDate;
          }

          user.finalDate = date;
          this.excuete(
            user as IReservationToCreate & {
              cookie: string;
              agent: any;
              finalDate: string;
            },
            chunk,
          );
        }
      })
      .catch((err) => {
        console.log(err);
        console.log(err.message);
        if (
          err.message?.includes(
            'Proxy connection ended before receiving CONNECT response',
          )
        ) {
          this.findReservation(user, chunk);
        } else if (err.code === 'ECONNRESET') {
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'الاتصال انقطع',
            isError: true,
            errorCode: 'ECONNRESET',
          };
          this.gatewayService.updateReservationState(state);
          this.findReservation(user, chunk);
        } else if (err.code === 'ECONNABORTED') {
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'الموقع لا يستجيب',
            isError: true,
            errorCode: 'ECONNRESET',
          };
          this.gatewayService.updateReservationState(state);
          this.findReservation(user, chunk);
        } else {
          if (err.response) {
            const errorResponse = err.response.data;
            const state = {
              reservationId: user.reservationId,
              state: 0,
              message: errorResponse.Message,
              isError: true,
              errorCode: errorResponse.ErrorCode,
            };
            this.gatewayService.updateReservationState(state);
            if (state.errorCode === 'UA100') {
              this.loginUser(user, chunk);
            } else {
              this.findReservation(user, chunk);
            }
          } else {
            this.findReservation(user, chunk);
          }
        }
      });
  }
  async excuete(
    user: IReservationToCreate & {
      cookie: string;
      agent: any;
      finalDate: string;
    },
    chunk: { data: any[]; interval: number },
  ) {
    const payload = {
      ALIAS: 'OPHRUHvKso',
      P_CENTER_ID: user.scholarshipType,
      P_COPIES: user.transactionsCount,
      P_DELIVERY_DATE: user.finalDate,
      P_MATE_COUNT: null,
      P_REFERENCES_ID: null,
      P_SERVICE_ID: user.passportOption,
      P_USERNAME: 'WebSite',
      P_ZPROCESSID: 178800193,
    };
    this.requestScheduler
      .queueRequest({
        url: 'https://ecsc-expat.sy:8080/dbm/db/execute',
        method: 'POST',
        timeout: 20000,
        data: JSON.stringify(payload),
        httpsAgent: user.agent,
        signal: this.controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          Alias: 'OPHRUHvKso', // custom header
          Connection: 'keep-alive',
          'Content-Type': 'application/json',
          'Content-Length': JSON.stringify(payload).length.toString(), // optional in fetch, included for match
          Host: 'ecsc-expat.sy:8080',
          Origin: 'https://www.ecsc-expat.sy',
          Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
          Cookie: user.cookie,
          'Sec-CH-UA':
            '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
          'Sec-CH-UA-Mobile': '?1',
          'Sec-CH-UA-Platform': '"Android"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          Source: 'WEB',
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
          'X-Forwarded-For': '195.160.118.195',
          'X-Remote-IP': '195.160.118.195',
        },
      })
      .then((response) => {
        const data: any = response.data;
        const PID: any = data.P_ID;
        axios
          .get(`https://ecsc-expat.sy:8080/rs/reserve?id=${PID}`, {
            httpsAgent: user.agent,
            signal: this.controller.signal,
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'Accept-Language': 'en-US,en;q=0.9',
              Alias: 'OPHRUHvKso', // custom header
              Connection: 'keep-alive',
              'Content-Type': 'application/json',
              Host: 'ecsc-expat.sy:8080',
              Origin: 'https://www.ecsc-expat.sy',
              Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
              Cookie: user.cookie,
              'Sec-CH-UA':
                '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
              'Sec-CH-UA-Mobile': '?1',
              'Sec-CH-UA-Platform': '"Android"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-site',
              Source: 'WEB',
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
              'X-Forwarded-For': '195.160.118.195',
              'X-Remote-IP': '195.160.118.195',
            },
          })
          .then((response) => {
            const state = {
              reservationId: user.reservationId,
              state: 1,
              message: `${user.finalDate} في معاد ${user.email} تم الحجز بنجاح للعميل `,
              isError: false,
              errorCode: null,
              popup: true,
              index: 2,
              reservedAt: user.finalDate,
            }; // 🎯 Return response here
            this.gatewayService.updateReservationState(state);
            this.reservationService.updateOneById(
              new mongoose.Types.ObjectId(user.reservationId),
              { state: 1, reservedAt: user.finalDate },
            );
          })
          .catch((err) => {
            console.log(err);
            if (
              err.message?.includes(
                'Proxy connection ended before receiving CONNECT response',
              )
            ) {
              this.excuete(user, chunk);
            } else if (err.code === 'ECONNRESET') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الاتصال انقطع',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              this.gatewayService.updateReservationState(state);
              this.excuete(user, chunk);
            } else if (err.code === 'ECONNABORTED') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الموقع لا يستجيب',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              this.gatewayService.updateReservationState(state);
              this.excuete(user, chunk);
            } else {
              console.error('Axios error:', err.message);
              console.log(err.message);
              // Optional: handle proxy-specific error

              // Log full details if needed
              // console.error('Detailed error:', error);
              const errorResponse = err.response.data;
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: errorResponse.Message,
                isError: true,
                errorCode: errorResponse.ErrorCode,
              };
              if (state.errorCode === 'UA100') {
                this.gatewayService.updateReservationState(state);
                this.loginUser(user, chunk);
              } else if (state.errorCode === 'RE100') {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: errorResponse.Message,
                  isError: true,
                  errorCode: errorResponse.ErrorCode,
                  remove: true,
                };
                this.gatewayService.updateReservationState(state);
                console.log('YOU ALREADY HAVE A RESERVATION first catch');
                return;
              } else {
                this.excuete(user, chunk);
              }
            }
          });
      })
      .catch((err) => {
        console.log(err);
        if (
          err.message?.includes(
            'Proxy connection ended before receiving CONNECT response',
          )
        ) {
          this.excuete(user, chunk);
        } else if (err.code === 'ECONNRESET') {
          console.log('ECONNRESET');
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'الاتصال انقطع',
            isError: true,
            errorCode: 'ECONNRESET',
            remove: true,
          };
          this.gatewayService.updateReservationState(state);
          this.excuete(user, chunk);
        } else if (err.code === 'ECONNABORTED') {
          console.log('ECONNABORTED');
          const state = {
            reservationId: user.reservationId,
            state: 0,
            message: 'الموقع لا يستجيب',
            isError: true,
            errorCode: 'ECONNRESET',
            remove: true,
          };
          this.gatewayService.updateReservationState(state);
          this.excuete(user, chunk);
        } else {
          const errorResponse = err.response.data;
          if (err.ErrorCode != 'UA100') {
            console.log('YOU ALREADY HAVE A RESERVATION SECOND CATCH');
            const state = {
              reservationId: user.reservationId,
              state: 0,
              message: errorResponse.Message,
              isError: true,
              errorCode: errorResponse.ErrorCode,
              remove: true,
            };
            this.gatewayService.updateReservationState(state);
            return;
          } else {
            this.loginUser(user, chunk);
          }
        }
      });
  }
  async reserve(
    axiosLimited: any,
    user: IReservationToCreate,
    proxyIndex: number,
  ) {
    return new Promise((res, rej) => {
      const proxy = `http://2f957320733b8578ba35__cr.gb,us,fr,tr:9919acfe08c2c6b1@gw.dataimpulse.com:${proxyIndex}`; // Adjust if auth is not needed

      // Create an agent using your proxy
      const agent = new HttpsProxyAgent(proxy, {
        keepAlive: true,
        timeout: 20000,
      });
      const signal = this.controller.signal;
      const gatewayService = this.gatewayService;
      const reservationService = this.reservationService;
      logIn();

      function logIn() {
        console.log('login');
        axiosLimited
          .post(
            'https://ecsc-expat.sy:8080/secure/auth/login',
            { username: user.email, password: user.password },
            {
              httpsAgent: agent,
              headers: {
                Accept: 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9',
                Connection: 'keep-alive',
                'Content-Type': 'application/json',
                Host: 'ecsc-expat.sy:8080',
                Origin: 'https://www.ecsc-expat.sy',
                Referer: 'https://www.ecsc-expat.sy/login',
                'Sec-CH-UA':
                  '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
                'Sec-CH-UA-Mobile': '?1',
                'Sec-CH-UA-Platform': '"Android"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                Source: 'WEB',
                'User-Agent':
                  'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
              },

              signal: signal,
            },
          )
          .then(async (response: any) => {
            const data: any = response.data;
            gatewayService.updateReservationState({
              reservationId: user.reservationId,
              state: 0,
              message: 'تم تسجيل الدخول بنجاح',
              isError: false,
              errorCode: null,
              successCode: 'LOGGED_IN',
              index: 0,
            });
            user.cookie =
              response.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
            user.user = data.P_PROFILE_RESULT;
            findAvaliableReservations();
          })
          .catch((err) => {
            console.log(err);
            if (err.code === 'ECONNRESET') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الاتصال انقطع',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              gatewayService.updateReservationState(state);
              logIn();
            } else if (err.code === 'ECONNABORTED') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الموقع لا يستجيب',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              gatewayService.updateReservationState(state);
              logIn();
            } else {
              if (err.response) {
                const errorResponse = err.response.data;
                console.log(errorResponse);
                if (
                  errorResponse.ErrorCode == 'U401' ||
                  errorResponse.ErrorCode == 'U423'
                ) {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: errorResponse.Message,
                    isError: true,
                    errorCode: errorResponse.ErrorCode,
                    remove: true,
                  };
                  gatewayService.updateReservationState(state);
                  return;
                } else {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: errorResponse.Message,
                    isError: true,
                    errorCode: errorResponse.ErrorCode,
                  };
                  gatewayService.updateReservationState(state);
                  logIn();
                }
              } else {
                console.log(err.message);
                logIn();
              }
            }
          });
      }
      function findAvaliableReservations() {
        const params = {
          missionId: user.scholarshipType.toString(),
          serviceId: user.passportOption.toString(),
          companion: user.transactionsCount.toString(),
        };
        const queryString = new URLSearchParams(params).toString();
        const url = `https://ecsc-expat.sy:8080/rs/available?${queryString}`;
        axiosLimited
          .get(url, {
            httpsAgent: agent,
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'Accept-Language': 'en-US,en;q=0.9',
              Connection: 'keep-alive',
              'Content-Type': 'application/json',
              Cookie: user.cookie,
              Host: 'ecsc-expat.sy:8080',
              Origin: 'https://www.ecsc-expat.sy',
              Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
              'Sec-CH-UA':
                '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
              'Sec-CH-UA-Mobile': '?1',
              'Sec-CH-UA-Platform': '"Android"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-site',
              Source: 'WEB',
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
            },
          })
          .then(async (response) => {
            const data: any = response.data;
            if (!data.length) {
              console.log('no reservations avaliable');
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'لا يوجد حجوزات متاحة',
                isError: true,
                errorCode: 'NO_RESERVATIONS_AVAILABLE',
              };
              gatewayService.updateReservationState(state);
              return findAvaliableReservations();
            } else {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'هناك حجوزات متاحة',
                isError: false,
                errorCode: null,
                index: 1,
              };
              gatewayService.updateReservationState(state);
              const dates = data;
              let date;
              if (dates.includes(user.reservationDate)) {
                date = user.reservationDate;
                console.log(date);
              } else {
                const referenceDate = new Date(user.reservationDate);
                const nearestDate = dates.reduce((nearest, date) => {
                  const currDiff = Math.abs(
                    new Date(date).getTime() - referenceDate.getTime(),
                  );
                  const nearestDiff = Math.abs(
                    new Date(nearest).getTime() - referenceDate.getTime(),
                  );
                  return currDiff < nearestDiff ? date : nearest;
                });
                console.log('nearest date is', nearestDate);
                date = nearestDate;
              }

              user.finalDate = date;
              excuete();
            }
          })
          .catch((err) => {
            console.log(err);
            if (
              err.message?.includes(
                'Proxy connection ended before receiving CONNECT response',
              )
            ) {
              return findAvaliableReservations();
            } else if (err.code === 'ECONNRESET') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الاتصال انقطع',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              gatewayService.updateReservationState(state);
              return findAvaliableReservations();
            } else if (err.code === 'ECONNABORTED') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الموقع لا يستجيب',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              gatewayService.updateReservationState(state);
              return findAvaliableReservations();
            } else {
              if (err.response) {
                const errorResponse = err.response.data;
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: errorResponse.Message,
                  isError: true,
                  errorCode: errorResponse.ErrorCode,
                };
                gatewayService.updateReservationState(state);
                if (state.errorCode === 'UA100') {
                  return logIn();
                } else {
                  return findAvaliableReservations();
                }
              } else {
                return findAvaliableReservations();
              }
            }
          });
      }
      function excuete() {
        console.log('excuete');
        const payload = {
          ALIAS: 'OPHRUHvKso',
          P_CENTER_ID: user.scholarshipType,
          P_COPIES: user.transactionsCount,
          P_DELIVERY_DATE: user.finalDate,
          P_MATE_COUNT: null,
          P_REFERENCES_ID: null,
          P_SERVICE_ID: user.passportOption,
          P_USERNAME: 'WebSite',
          P_ZPROCESSID: 178800193,
        };
        axiosLimited
          .post('https://ecsc-expat.sy:8080/dbm/db/execute', payload, {
            httpsAgent: agent,
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'Accept-Language': 'en-US,en;q=0.9',
              Alias: 'OPHRUHvKso', // custom header
              Connection: 'keep-alive',
              'Content-Type': 'application/json',
              'Content-Length': JSON.stringify(payload).length.toString(), // optional in fetch, included for match
              Host: 'ecsc-expat.sy:8080',
              Origin: 'https://www.ecsc-expat.sy',
              Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
              Cookie: user.cookie,
              'Sec-CH-UA':
                '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
              'Sec-CH-UA-Mobile': '?1',
              'Sec-CH-UA-Platform': '"Android"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-site',
              Source: 'WEB',
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
              'X-Forwarded-For': '195.160.118.195',
              'X-Remote-IP': '195.160.118.195',
            },
          })
          .then((response) => {
            const data: any = response.data;
            const PID: any = data.P_ID;

            res('done');
          })
          .catch((err) => {
            console.log(err);
            if (
              err.message?.includes(
                'Proxy connection ended before receiving CONNECT response',
              )
            ) {
              return excuete();
            } else if (err.code === 'ECONNRESET') {
              console.log('ECONNRESET');
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الاتصال انقطع',
                isError: true,
                errorCode: 'ECONNRESET',
                remove: true,
              };
              gatewayService.updateReservationState(state);
              return excuete();
            } else if (err.code === 'ECONNABORTED') {
              console.log('ECONNABORTED');
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الموقع لا يستجيب',
                isError: true,
                errorCode: 'ECONNRESET',
                remove: true,
              };
              gatewayService.updateReservationState(state);
              return excuete();
            } else {
              const errorResponse = err.response.data;
              if (err.ErrorCode != 'UA100') {
                console.log('YOU ALREADY HAVE A RESERVATION SECOND CATCH');
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: errorResponse.Message,
                  isError: true,
                  errorCode: errorResponse.ErrorCode,
                  remove: true,
                };
                gatewayService.updateReservationState(state);
                return;
              } else {
                return excuete();
              }
            }
          });
      }
      function finalExcuete(PID: string) {
        axiosLimited
          .get(`https://ecsc-expat.sy:8080/rs/reserve?id=${PID}`, {
            httpsAgent: agent,
            signal: signal,
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Accept-Encoding': 'gzip, deflate, br, zstd',
              'Accept-Language': 'en-US,en;q=0.9',
              Alias: 'OPHRUHvKso', // custom header
              Connection: 'keep-alive',
              'Content-Type': 'application/json',
              Host: 'ecsc-expat.sy:8080',
              Origin: 'https://www.ecsc-expat.sy',
              Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
              Cookie: user.cookie,
              'Sec-CH-UA':
                '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
              'Sec-CH-UA-Mobile': '?1',
              'Sec-CH-UA-Platform': '"Android"',
              'Sec-Fetch-Dest': 'empty',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'same-site',
              Source: 'WEB',
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
              'X-Forwarded-For': '195.160.118.195',
              'X-Remote-IP': '195.160.118.195',
            },
          })
          .then((response) => {
            const state = {
              reservationId: user.reservationId,
              state: 1,
              message: `${user.finalDate} في معاد ${user.email} تم الحجز بنجاح للعميل `,
              isError: false,
              errorCode: null,
              popup: true,
              index: 2,
              reservedAt: user.finalDate,
            }; // 🎯 Return response here
            gatewayService.updateReservationState(state);
            reservationService.updateOneById(
              new mongoose.Types.ObjectId(user.reservationId),
              { state: 1, reservedAt: user.finalDate },
            );
          })
          .catch((err) => {
            console.log(err);
            if (
              err.message?.includes(
                'Proxy connection ended before receiving CONNECT response',
              )
            ) {
              return excuete();
            } else if (err.code === 'ECONNRESET') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الاتصال انقطع',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              gatewayService.updateReservationState(state);
              return excuete();
            } else if (err.code === 'ECONNABORTED') {
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'الموقع لا يستجيب',
                isError: true,
                errorCode: 'ECONNRESET',
              };
              gatewayService.updateReservationState(state);
              return excuete();
            } else {
              console.error('Axios error:', err.message);
              console.log(err.message);
              // Optional: handle proxy-specific error

              // Log full details if needed
              // console.error('Detailed error:', error);
              const errorResponse = err.response.data;
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: errorResponse.Message,
                isError: true,
                errorCode: errorResponse.ErrorCode,
              };
              if (state.errorCode === 'UA100') {
                gatewayService.updateReservationState(state);
                return logIn();
              } else if (state.errorCode === 'RE100') {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: errorResponse.Message,
                  isError: true,
                  errorCode: errorResponse.ErrorCode,
                  remove: true,
                };
                gatewayService.updateReservationState(state);
                console.log('YOU ALREADY HAVE A RESERVATION first catch');
                return;
              } else {
                return excuete();
              }
            }
          });
      }
    });
  }

  async start() {
    const reservations = await this.reservationService.getAllReservations();

    let reservationsToCreate = reservations.map((reservation) => {
      return {
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
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const limit = pLimit(100);
    this.controller = new AbortController();
    const chunks = await this.splitIntoChunks(reservationsToCreate);
    const proxy =
      'http://2f957320733b8578ba35__cr.fr:9919acfe08c2c6b1@gw.dataimpulse.com:823'; // Adjust if auth is not needed

    // Create an agent using your proxy
    const agent = new HttpsProxyAgent(proxy, {});
    this.requestScheduler = new RequestScheduler(agent, 200);
    // Promise.all(chunks.map((chunk) => this.loginUser(chunk.data[0], null)));
    // await this.reserve(0, chunks[0].data[0]);
    const axiosLimited = rateLimit(axios.create(), {
      maxRequests: 5,
      perMilliseconds: 1000,
    });
    Promise.all(
      chunks[0].data.map((user, index) =>
        this.reserve(axiosLimited, user, 10000 + index),
      ),
    );
    this.gatewayService.shutdown$.subscribe((data) => {
      console.log('shutting down');
      this.controller.abort();
    });
  }
}
