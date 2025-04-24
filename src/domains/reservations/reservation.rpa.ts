import {
  Controller,
  forwardRef,
  Inject,
  Injectable,
  OnModuleInit,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import { AppGatewayService } from '../gateway/app.gateway.service';
import puppeteer from 'puppeteer-extra';
import { ReservationsService } from './reservations.service';
import mongoose, { set } from 'mongoose';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import pRetry from 'p-retry';
import { copyFileSync } from 'fs';
import { SettingsService } from '../settings/settings.service';
import { Settings } from '../settings/settings.entity';
import { IReservationToCreate } from './app.bootstrap.service';
import { resolve } from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';
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
@Injectable()
export class ReservationRpa {
  constructor(
    private readonly gatewayService: AppGatewayService,
    @Inject(forwardRef(() => ReservationsService))
    private readonly reservationService: ReservationsService,
    private readonly settingsService: SettingsService,
  ) {}

  page!: Page;
  browser!: Browser;
  reservationId: string;
  pageClosed: boolean = false;
  async startFunctions(reservationData: IReservationToCreate): Promise<string> {
    return new Promise(async (res, rej) => {
      try {
        await this.login(reservationData);
        await this.createNewRequest(reservationData);
        const result = await this.excuete(reservationData);
        res(result);
      } catch (err) {
        rej('failed');
      }
    });
  }
  async createReservation(
    reservations: IReservationToCreate[],
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let taskList: IReservationToCreate[] = reservations;
      if (taskList.length) {
        await Promise.allSettled(
          taskList.map((task) => this.startFunctions(task)),
        );
        // while (taskList.length > 0) {
        //   try {
        //     const start = (await this.settingsService.getSettings()).start;
        //     if (!start){
        //       taskList = [];
        //       reservations = [];
        //       reject("out")
        // break;
        // };
        //     let reservationData: IReservationToCreate = taskList[0];
        //     const newUserData = await this.reservationService.findOneById(
        //       reservationData.reservationId,
        //     );
        //     if (!newUserData) {
        //       taskList.shift();
        //     } else {
        //       const proxy =
        //         'http://2f957320733b8578ba35__cr.fr:9919acfe08c2c6b1@gw.dataimpulse.com:823'; // Adjust if auth is not needed

        //       // Create an agent using your proxy
        //       const agent = new HttpsProxyAgent(proxy, { keepAlive: true });
        //       taskList[0].agent = agent;
        //       await this.startFunctions(taskList[0]);
        //       console.log('continue after awaiting');
        //       taskList.shift();
        //     }
        //   } catch (err) {
        //     console.log('rejecting');
        //     taskList.push(taskList.shift());
        //   }
        // }
        //  resolve('ended');
      }
    });
  }

  async setupEnviroment(isProxy: boolean) {
    try {
      const requestHeaders = {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        Referer: 'https://www.google.com/',
      };
      const settings = await this.settingsService.getSettings();
      console.log(settings);
      const browser = await puppeteer.launch({
        // executablePath:
        //   'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: false,
        timeout: 5000000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--ignore-certificate-errors',
          isProxy ? '--proxy-server=http://gw.dataimpulse.com:823' : '',
        ],
      });
      this.browser = browser;
      const page = await browser.newPage();
      await page.authenticate({
        username: settings[0].proxyUsername,
        password: settings[0].proxyPassword,
      });
      //  const page = pages[0];
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      );

      await page.setExtraHTTPHeaders(requestHeaders);
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.setCookie', {
        name: 'result_cookie',
        value: 'result_value',
        domain: 'example.com', // Change to the domain you need
        path: '/',
        secure: false,
        httpOnly: false,
        sameSite: 'None',
      });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      });
      await page.setRequestInterception(true);

      page.on('request', async (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
        try {
        } catch (err) {
          console.log(err);
        }
      });
      this.page = page;
      this.page.on('close', async () => {
        this.pageClosed = true;
      });
    } catch (err) {
      console.log(err);
    }
  }
  async login(reservationData: IReservationToCreate): Promise<string> {
    //if page didnt load then reload until infinty
    //if request took too long then repeat the reuqets processs until it responds
    //if request gives random error then repeat the request until it responds
    //0 when the abort is timeout and 1 when i am aborting it
    let abortReason: number = 0;
    return new Promise(async (resolve, reject) => {
      try {
        const controller = new AbortController();

        // 5 second timeout:
        if (reservationData.cookie) {
          console.log('skipping login');
          controller.abort();
          abortReason = 1;
          resolve('skipping login');
        } else {
          console.log(reservationData);
        }
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 15000);
        await pRetry(
          async () => {
            process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
            const res = await fetch(
              'https://ecsc-expat.sy:8080/secure/auth/login',
              {
                method: 'POST',
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
                body: JSON.stringify({
                  username: reservationData.email,
                  password: reservationData.password,
                }),
                signal: controller.signal,
                agent: reservationData.agent,
              },
            )
              .then(async (response) => {
                const data = await response.json();
                //return server error
                if (
                  ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
                ) {
                  const currentState = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: (data as any).Message,
                    isError: true,
                    errorCode: (data as any).ErrorCode,
                  };
                  this.gatewayService.updateReservationState(currentState);
                  throw new Error('STOP');
                }
                reservationData.cookie = response.headers
                  .get('set-cookie')
                  .split(';')[0];
                reservationData.user = (data as any).P_PROFILE_RESULT;
                const currentState = {
                  reservationId: reservationData.reservationId,
                  state: 0,
                  message: 'تم تسجيل الدخول بنجاح',
                  isError: false,
                  errorCode: null,
                  successCode: 'LOGGED_IN',
                  index: 0,
                };
                this.gatewayService.updateReservationState(currentState);
              })
              .catch((err) => {
                if (err.message == 'STOP') {
                  throw new Error('STOP');
                }
                if (err.name == 'AbortError') {
                  if (abortReason == 0) {
                    const state = {
                      reservationId: reservationData.reservationId,
                      state: 0,
                      message: 'الموقع لا يستجيب',
                      isError: true,
                      errorCode: 'RESPONSE_TIMEOUT',
                    };
                    this.gatewayService.updateReservationState(state);
                    throw new Error('STOP');
                  } else {
                    console.log('Abort stopping');
                    throw new Error('STOP');
                  }
                  //if server takes too long to respond
                } else {
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: err.message,
                    isError: true,
                    errorCode: err.message,
                  };
                  this.gatewayService.updateReservationState(state);
                  throw new Error('STOP');
                }
              });
          },
          {
            retries: 9999999,
            minTimeout: 2000,
            onFailedAttempt: (error) => {
              console.log('abort error on failed attempt');
              if (error.message == 'STOP') {
                throw new Error('stoping');
              }
              console.log('failed on login');
            },
          },
        );
        resolve('resolve');
      } catch (err) {
        reject('stopping');
      }
    });
  }
  async createNewRequest(reservationData: IReservationToCreate) {
    return new Promise(async (resolve, reject) => {
      //0 when the abort is timeout and 1 when i am aborting it
      let abortReason: number = 0;
      try {
        const result = await pRetry(
          async () => {
            const controller = new AbortController();

            // 5 second timeout:
            let abortReason = 0;
            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 10000);
            const params = {
              missionId: reservationData.scholarshipType.toString(),
              serviceId: reservationData.passportOption.toString(),
              companion: reservationData.transactionsCount.toString(),
            };
            const start = (await this.settingsService.getSettings()).start;
            if (!start) {
              abortReason = 1;
              controller.abort();
            }
            // Convert the params object into a query string
            const queryString = new URLSearchParams(params).toString();
            const result = await fetch(
              `https://ecsc-expat.sy:8080/rs/available?${queryString}`,
              {
                method: 'GET',
                headers: {
                  Accept: 'application/json, text/plain, */*',
                  'Accept-Encoding': 'gzip, deflate, br, zstd',
                  'Accept-Language': 'en-US,en;q=0.9',
                  Connection: 'keep-alive',
                  'Content-Type': 'application/json',
                  Cookie: reservationData.cookie,
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
                signal: controller.signal,
                agent: reservationData.agent, // Include cookies/sessions
              },
            )
              .then(async (response) => {
                //UA100
                const data = await response.json();

                if (
                  ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
                ) {
                  const currentState = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: (data as any).Message,
                    isError: true,
                    errorCode: (data as any).ErrorCode,
                  };
                  this.gatewayService.updateReservationState(currentState);
                  if ((currentState as any).errorCode === 'UA100') {
                    console.log('UA100');
                    await this.startFunctions(reservationData);
                  } else {
                    await this.gatewayService.updateReservationState(
                      currentState,
                    );
                    throw new Error('STOP');
                  }
                  throw new Error('retry');
                } else {
                  if (!(data as any).length) {
                    const currentState = {
                      reservationId: reservationData.reservationId,
                      state: 0,
                      message: 'لا يوجد حجوزات متاحة',
                      isError: true,
                      errorCode: 'NO_RESERVATIONS_AVAILABLE',
                    };
                    this.gatewayService.updateReservationState(currentState);
                    //No reervations Avaliable
                    throw new Error('STOP');
                  } else {
                    const currentState = {
                      reservationId: reservationData.reservationId,
                      state: 0,
                      message: 'هناك حجوزات متاحة',
                      isError: false,
                      errorCode: null,
                      index: 1,
                    };
                    this.gatewayService.updateReservationState(currentState);
                    const dates: string[] = data as string[];
                    const earliest = dates.reduce((a, b) =>
                      new Date(a) < new Date(b) ? a : b,
                    );
                    let date;
                    if (reservationData.isDateAutomatic) {
                      date = earliest;
                    } else {
                      if (dates.includes(reservationData.reservationDate)) {
                        date = reservationData.reservationDate;
                      } else {
                        const referenceDate = new Date(
                          reservationData.reservationDate,
                        );
                        const nearestDate = dates.reduce((nearest, date) => {
                          const currDiff = Math.abs(
                            new Date(date).getTime() - referenceDate.getTime(),
                          );
                          const nearestDiff = Math.abs(
                            new Date(nearest).getTime() -
                              referenceDate.getTime(),
                          );
                          return currDiff < nearestDiff ? date : nearest;
                        });
                        console.log('nearest date is', nearestDate);
                        date = nearestDate;
                      }
                    }
                    reservationData.finalDate = date;
                    resolve('success');
                  }
                }
              })
              .catch(async (err) => {
                if (err.message == 'STOP') {
                  throw new Error('STOP');
                }
                if (err.name == 'AbortError') {
                  //if server takes too long to respond
                  if (abortReason == 0) {
                    const state = {
                      reservationId: reservationData.reservationId,
                      state: 0,
                      message: 'الموقع لا يستجيب',
                      isError: true,
                      errorCode: 'RESPONSE_TIMEOUT',
                    };
                    await this.gatewayService.updateReservationState(state);
                    throw new Error('retry');
                  } else {
                    throw new Error('STOP');
                  }
                } else {
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: err.message,
                    isError: true,
                    errorCode: err.message,
                  };
                  await this.gatewayService.updateReservationState(state);
                  throw new Error('STOP');
                }
              });
          },
          {
            retries: 9999999,
            minTimeout: 1000,
            maxTimeout: 5000,
            onFailedAttempt: (error) => {
              if (error.message == 'STOP') {
                throw new Error('stopping');
              }
            },
          },
        );
      } catch (err) {
        reject('stop');
      }
    });
    //         await this.page.setExtraHTTPHeaders({
    //           Referer: 'https://www.ecsc-expat.sy/requests/process/new/new',
    //         });
    //         const result = await this.page.evaluate(
    //           async (
    //             reservId,
    //             scholarshipType,
    //             passportOption,
    //             transactionsCount,
    //           ) => {
    //             console.log(
    //               reservId,
    //               scholarshipType,
    //               passportOption,
    //               transactionsCount,
    //             );
    //             const params = {
    //               missionId: scholarshipType.toString(),
    //               serviceId: passportOption.toString(),
    //               companion: transactionsCount.toString(),
    //             };

    //             // Convert the params object into a query string
    //             const queryString = new URLSearchParams(params).toString();
    //             const controller = new AbortController();

    //             // 5 second timeout:

    //             const timeoutId = setTimeout(() => {
    //               controller.abort();
    //             }, 10000);
    //             const result = await fetch(
    //               `https://ecsc-expat.sy:8080/rs/available?${queryString}`,
    //               {
    //                 method: 'GET',
    //                 headers: {
    //                   Accept: 'application/json, text/plain, */*',
    //                   'Accept-Encoding': 'gzip, deflate, br, zstd',
    //                   'Accept-Language': 'en-US,en;q=0.9',
    //                   Connection: 'keep-alive',
    //                   'Content-Type': 'application/json',

    //                   Host: 'ecsc-expat.sy:8080',
    //                   Origin: 'https://www.ecsc-expat.sy',
    //                   Referer:
    //                     'https://www.ecsc-expat.sy/requests/process/new/new',
    //                   'Sec-CH-UA':
    //                     '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    //                   'Sec-CH-UA-Mobile': '?1',
    //                   'Sec-CH-UA-Platform': '"Android"',
    //                   'Sec-Fetch-Dest': 'empty',
    //                   'Sec-Fetch-Mode': 'cors',
    //                   'Sec-Fetch-Site': 'same-site',
    //                   Source: 'WEB',
    //                   'User-Agent':
    //                     'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36',
    //                 },
    //                 signal: controller.signal, // Include cookies/sessions
    //                 credentials: 'include', // Include cookies/sessions in the request
    //               },
    //             )
    //               .then(async (response) => {
    //                 //UA100
    //                 const data = await response.json();
    //                 if (
    //                   ![200, 201, 202, 203, 204, 205, 206].includes(
    //                     response.status,
    //                   )
    //                 ) {
    //                   const currentState = {
    //                     reservationId: reservId,
    //                     state: 0,
    //                     message: data.Message,
    //                     isError: true,
    //                     errorCode: data.ErrorCode,
    //                   };
    //                   return currentState;
    //                 } else {
    //                   const currentState = {
    //                     reservationId: reservId,
    //                     state: 0,
    //                     message: data,
    //                     isError: false,
    //                     errorCode: null,
    //                   };
    //                   return currentState;
    //                 }
    //               })
    //               //  .then(data => console.log('✅ Response:', data))
    //               .catch((err) => {
    //                 console.log(err);
    //                 if (err.name == 'AbortError') {
    //                   //if server takes too long to respond
    //                   return {
    //                     reservationId: reservId,
    //                     state: 0,
    //                     message: 'الموقع لا يستجيب',
    //                     isError: true,
    //                     errorCode: 'RESPONSE_TIMEOUT',
    //                   };
    //                 } else {
    //                   return {
    //                     reservationId: reservId,
    //                     state: 0,
    //                     message: err.message,
    //                     isError: true,
    //                     errorCode: err.message,
    //                   };
    //                 }
    //               });
    //             return result;
    //           },
    //           reservationData.reservationId,
    //           reservationData.scholarshipType,
    //           reservationData.passportOption,
    //           reservationData.transactionsCount,
    //         );
    //         console.log(result);
    //         //if the login session is expired
    //         if ((result as any).isError) {
    //           this.gatewayService.updateReservationState(
    //             result as ReservationProcessCurrentState,
    //           );
    //           if ((result as any).errorCode === 'UA100') {
    //             console.log('UA100');
    //             await this.gatewayService.updateReservationState(
    //               result as ReservationProcessCurrentState,
    //             );
    //             await this.startFunctions(reservationData);
    //           } else if (result.errorCode == 'RESPONSE_TIMEOUT') {
    //             this.gatewayService.updateReservationState(
    //               result as ReservationProcessCurrentState,
    //             );
    //             throw new Error('retry');
    //           } else {
    //             await this.gatewayService.updateReservationState(
    //               result as ReservationProcessCurrentState,
    //             );
    //             throw new Error('STOP');
    //           }
    //         } else {
    //           console.log(result);
    //           if (!(result as any).message.length) {
    //             const currentState = {
    //               reservationId: reservationData.reservationId,
    //               state: 0,
    //               message: 'لا يوجد حجوزات متاحة',
    //               isError: true,
    //               errorCode: 'NO_RESERVATIONS_AVAILABLE',
    //             };
    //             this.gatewayService.updateReservationState(currentState);
    //             //No reervations Avaliable
    //             throw new Error('STOP');
    //           } else {
    //             const currentState = {
    //               reservationId: reservationData.reservationId,
    //               state: 0,
    //               message: 'هناك حجوزات متاحة',
    //               isError: false,
    //               errorCode: null,
    //               index: 1,
    //             };
    //             this.gatewayService.updateReservationState(currentState);
    //             const dates = (result as any).message;
    //             const earliest = dates.reduce((a, b) =>
    //               new Date(a) < new Date(b) ? a : b,
    //             );
    //             let date;
    //             if (reservationData.isDateAutomatic) {
    //               console.log('Earliest date:', earliest);
    //               date = earliest;
    //             } else {
    //               if (dates.includes(reservationData.reservationDate)) {
    //                 date = reservationData.reservationDate;
    //               } else {
    //                 const referenceDate = new Date(
    //                   reservationData.reservationDate,
    //                 );
    //                 const nearestDate = dates.reduce((nearest, date) => {
    //                   const currDiff = Math.abs(
    //                     new Date(date).getTime() - referenceDate.getTime(),
    //                   );
    //                   const nearestDiff = Math.abs(
    //                     new Date(nearest).getTime() - referenceDate.getTime(),
    //                   );
    //                   return currDiff < nearestDiff ? date : nearest;
    //                 });
    //                 console.log('nearest date is', nearestDate);
    //                 date = nearestDate;
    //               }
    //             }
    //             reservationData.finalDate = date;
    //             resolve('success');
    //           }
    //         }
    //       },
    //       {
    //         retries: 99999,
    //         minTimeout: 0,
    //         maxTimeout: 0,
    //         onFailedAttempt: (error) => {
    //           if (error.message == 'STOP') {
    //             throw new Error('stopping');
    //           }
    //         },
    //       },
    //     );
    //   } catch (err) {
    //     reject('stop');
    //   }
    // });
  }
  async excuete(reservationData: IReservationToCreate): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let PID;
      try {
        await pRetry(
          async () => {
            const payload = {
              ALIAS: 'OPHRUHvKso',
              P_CENTER_ID: reservationData.scholarshipType,
              P_COPIES: reservationData.transactionsCount,
              P_DELIVERY_DATE: reservationData.finalDate,
              P_MATE_COUNT: null,
              P_REFERENCES_ID: null,
              P_SERVICE_ID: reservationData.passportOption,
              P_USERNAME: 'WebSite',
              P_ZPROCESSID: 178800193,
            };

            const controller = new AbortController();
            let abortReason: number = 0;
            // 5 second timeout:

            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 10000);
            const start = (await this.settingsService.getSettings()).start;
            if (!start) {
              abortReason = 1;
              controller.abort();
            }
            await fetch('https://ecsc-expat.sy:8080/dbm/db/execute', {
              method: 'POST',
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
                Cookie: reservationData.cookie,
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
              body: JSON.stringify(payload),
              signal: controller.signal,
              agent: reservationData.agent, // Include existing cookies like SESSION
            })
              .then(async (response) => {
                //UA100
                const data = await response.json();
                if (
                  ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
                ) {
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: (data as any).Message,
                    isError: true,
                    errorCode: (data as any).ErrorCode,
                  };
                  if (state.errorCode === 'UA100') {
                    await this.gatewayService.updateReservationState(state);
                    await this.startFunctions(reservationData);
                  } else {
                    await this.gatewayService.updateReservationState(state);
                    throw new Error('STOP');
                  }
                } else {
                  PID = (data as any).P_ID;
                }
              })
              //  .then(data => console.log('✅ Response:', data))
              .catch(async (err) => {
                if (err.message == 'STOP') {
                  throw new Error('STOP');
                }
                if (err.name == 'AbortError') {
                  //if server takes too long to respond
                  if (abortReason == 0) {
                    const state = {
                      reservationId: reservationData.reservationId,
                      state: 0,
                      message: 'الموقع لا يستجيب',
                      isError: true,
                      errorCode: 'RESPONSE_TIMEOUT',
                    };
                    await this.gatewayService.updateReservationState(state);
                    throw new Error('retry');
                  } else {
                    throw new Error('STOP');
                  }
                } else {
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: err.message,
                    isError: true,
                    errorCode: err.message,
                  };
                  await this.gatewayService.updateReservationState(state);
                  throw new Error('STOP');
                }
              });
          },
          {
            retries: 9999999,
            minTimeout: 1000,
            maxTimeout: 5000,
            onFailedAttempt: (error) => {
              if (error.message == 'STOP') {
                throw new Error('stopping');
              }
            },
          },
        );
      } catch (err) {
        reject('stoping at first result');
      }

      try {
        await pRetry(
          async () => {
            const controller = new AbortController();

            // 5 second timeout:

            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 10000);
            let abortReason = 0;
            const start = (await this.settingsService.getSettings()).start;
            if (!start) {
              abortReason = 1;
              controller.abort();
            }
            await fetch(`https://ecsc-expat.sy:8080/rs/reserve?id=${PID}`, {
              method: 'GET',
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
                Cookie: reservationData.cookie,
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
              signal: controller.signal,
              agent: reservationData.agent, // Include existing cookies like SESSION
            })
              .then(async (response) => {
                //UA100

                if (
                  ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
                ) {
                  const data = await response.json();
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: (data as any).Message,
                    isError: true,
                    errorCode: (data as any).ErrorCode,
                  };
                  if (state.errorCode === 'UA100') {
                    await this.gatewayService.updateReservationState(state);
                    await this.startFunctions(reservationData);
                  } else {
                    await this.gatewayService.updateReservationState(state);
                    throw new Error('STOP');
                  }
                } else {
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 1,
                    message: `${reservationData.finalDate} في معاد ${reservationData.email} تم الحجز بنجاح للعميل `,
                    isError: false,
                    errorCode: null,
                    popup: true,
                    index: 2,
                  }; // 🎯 Return response here
                  await this.gatewayService.updateReservationState(state);
                }
                await this.reservationService.updateOneById(
                  new mongoose.Types.ObjectId(reservationData.reservationId),
                  {
                    state: 1,
                    reservedAt: reservationData.finalDate,
                  },
                );
                resolve('resolved');
              })
              //  .then(data => console.log('✅ Response:', data))
              .catch(async (err) => {
                if (err.message == 'STOP') {
                  throw new Error('STOP');
                }
                if (err.name == 'AbortError') {
                  if (abortReason == 0) {
                    const state = {
                      reservationId: reservationData.reservationId,
                      state: 0,
                      message: 'الموقع لا يستجيب',
                      isError: true,
                      errorCode: 'RESPONSE_TIMEOUT',
                    };
                    await this.gatewayService.updateReservationState(state);
                    throw new Error('retry');
                  } else {
                    throw new Error('STOP');
                  }
                  //if server takes too long to respond
                } else {
                  const state = {
                    reservationId: reservationData.reservationId,
                    state: 0,
                    message: err.message,
                    isError: true,
                    errorCode: err.message,
                  };
                  await this.gatewayService.updateReservationState(state);
                  throw new Error('STOP');
                }
              });
          },
          {
            retries: 9999999,
            minTimeout: 1000,
            maxTimeout: 5000,
            onFailedAttempt: (error) => {
              if (error.message == 'STOP') {
                throw new Error('stopping');
              }
            },
          },
        );
      } catch (err) {
        reject('stopping at second result');
      }
    });
    //   try {
    //     await pRetry(
    //       async () => {
    //         const newData = await this.reservationService.findOneById(
    //           reservationData.reservationId,
    //         );
    //         if (!newData) reject('RES_DELETED');
    //         if (newData.isProxy != reservationData.isProxy) {
    //           reject('Recreate');
    //         }
    //         const finalresult: ReservationProcessCurrentState =
    //           (await this.page.evaluate(
    //             (reservId, appointmentId, finalDate, email) => {
    //               return new Promise((resolve, reject) => {
    //                 const xhr = new XMLHttpRequest();
    //                 xhr.open(
    //                   'GET',
    //                   `https://ecsc-expat.sy:8080/rs/reserve?id=${appointmentId}`,
    //                   true,
    //                 );
    //                 xhr.withCredentials = true;

    //                 xhr.setRequestHeader(
    //                   'accept',
    //                   'application/json, text/plain, */*',
    //                 );
    //                 xhr.setRequestHeader('content-type', 'application/json');
    //                 xhr.setRequestHeader('source', 'WEB');
    //                 const timeoutId = setTimeout(() => {
    //                   xhr.abort(); // 🔥 Cancels the request
    //                   console.warn('⏱️ Request aborted due to timeout');
    //                 }, 10000);
    //                 xhr.onload = function () {
    //                   clearTimeout(timeoutId);
    //                   console.log(xhr.response);
    //                   console.log(xhr.status);
    //                   if (xhr.status >= 200 && xhr.status < 300) {
    //                     resolve({
    //                       reservationId: reservId,
    //                       state: 1,
    //                       message: `${finalDate} في معاد ${email} تم الحجز بنجاح للعميل `,
    //                       isError: false,
    //                       errorCode: null,
    //                       popup: true,
    //                       index: 2,
    //                     }); // 🎯 Return response here
    //                   } else {
    //                     const responseObj = JSON.parse(xhr.response);
    //                     resolve({
    //                       reservationId: reservId,
    //                       state: 0,
    //                       message: responseObj.Message,
    //                       isError: true,
    //                       errorCode: responseObj.ErrorCode,
    //                     });
    //                   }
    //                 };

    //                 xhr.onerror = function (err) {
    //                   clearTimeout(timeoutId);
    //                   console.log(err);
    //                   resolve({
    //                     reservationId: reservId,
    //                     state: 0,
    //                     message: 'حدث خطأ في تثبيت المعاملة',
    //                     isError: true,
    //                     errorCode: 'ERROR',
    //                   });
    //                 };
    //                 xhr.onabort = function (err) {
    //                   resolve({
    //                     reservationId: reservId,
    //                     state: 0,
    //                     message: 'الموقع لا يستجيب',
    //                     isError: true,
    //                     errorCode: 'RESPONSE_TIMEOUT',
    //                   });
    //                 };
    //                 xhr.send();
    //               });
    //             },
    //             reservationData.reservationId,
    //             firstResult.message.P_ID,
    //             reservationData.finalDate,
    //             reservationData.email,
    //           )) as ReservationProcessCurrentState;
    //         console.log(finalresult);
    //         if (finalresult.isError) {
    //           this.gatewayService.updateReservationState(
    //             finalresult as ReservationProcessCurrentState,
    //           );
    //           if (finalresult.errorCode === 'UA100') {
    //             await this.startFunctions(reservationData);
    //           } else if (finalresult.errorCode == 'RESPONSE_TIMEOUT') {
    //             throw new Error('retry');
    //           } else {
    //             throw new Error('STOP');
    //           }
    //         } else {
    //           this.gatewayService.updateReservationState(
    //             finalresult as ReservationProcessCurrentState,
    //           );
    //           await this.reservationService.updateOneById(
    //             new mongoose.Types.ObjectId(reservationData.reservationId),
    //             {
    //               state: 1,
    //               reservedAt: finalDate,
    //             },
    //           );
    //           console.log(reservationData.finalDate);
    //           resolve(reservationData.finalDate);
    //         }
    //       },
    //       {
    //         retries: 9999999,
    //         minTimeout: 1000,
    //         maxTimeout: 5000,
    //         onFailedAttempt: (error) => {
    //           if (error.message == 'STOP') {
    //             throw new Error('stoping');
    //           }
    //         },
    //       },
    //     );
    //   } catch (err) {
    //     reject('stop');
    //   }
    // });
  }
}
