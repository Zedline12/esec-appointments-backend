const { log } = require('console');
const { resolve } = require('path');
const { workerData, parentPort } = require('worker_threads');
const pRetry = require('p-retry').default;
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));
let users = [];
let loggedInUsers = [];
users = workerData;
logInUsers();
async function logInUsers() {
  while (users.length > 0) {
    let abortReason = 0;
    try {
      await pRetry(
        async () => {
          const controller = new AbortController();
          const user = users[0];
          if (!user.agent) {
            const proxy =
              'http://2f957320733b8578ba35__cr.fr:9919acfe08c2c6b1@gw.dataimpulse.com:823'; // Adjust if auth is not needed

            // Create an agent using your proxy
            const agent = new HttpsProxyAgent(proxy, { keepAlive: true });
            user.agent = agent;
          }
          let abortReason = 0;
          parentPort.on('message', async (message) => {
            if (message.type == 'shutdown') {
              abortReason = 1;
              controller.abort(); // Cancel fetch
              console.log('Worker received shutdown signal');
              // Let the fetch cancellation complete gracefully
              setTimeout(() => {
                process.exit(0); // Clean exit
              }, 100);
            }
          });
          // 5 second timeout:
          if (user.cookie) {
            console.log('skipping login');
            controller.abort();
            abortReason = 1;
            resolve('skipping login');
          } else {
            console.log(users[0]);
          }
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 15000);
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
                username: user.email,
                password: user.password,
              }),
              signal: controller.signal,
              // agent: user.agent,
            },
          )
            .then(async (response) => {
              const data = await response.json();
              //return server error
              if (
                ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
              ) {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: data.Message,
                  isError: true,
                  errorCode: data.ErrorCode,
                };
                parentPort.postMessage(state);
                if (state.errorCode == 'U401' || state.errorCode == 'U423') {
                  console.log('wrong crediantls');
                  users.shift();
                } else {
                  throw new Error('retry');
                }
              } else {
                console.log(response);
                user.cookie = response.headers.get('set-cookie').split(';')[0];
                user.user = data.P_PROFILE_RESULT;
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: 'تم تسجيل الدخول بنجاح',
                  isError: false,
                  errorCode: null,
                  successCode: 'LOGGED_IN',
                  index: 0,
                };
                parentPort.postMessage(state);
                loggedInUsers.push(user);
                users.shift();
              }

              //   this.gatewayService.updateReservationState(state);
            })
            .catch((err) => {
              console.log(err);
              if (err.name == 'AbortError') {
                if (abortReason == 0) {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'الموقع لا يستجيب',
                    isError: true,
                    errorCode: 'RESPONSE_TIMEOUT',
                  };
                  parentPort.postMessage(state);
                  throw new Error('retry');
                } else {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'تم ايقاف العملية',
                    isError: true,
                    errorCode: 'PROCESS_TERMINATED',
                  };
                  parentPort.postMessage(state);
                  throw new Error('STOP');
                }
                //if server takes too long to respond
              } else {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: err.message,
                  isError: true,
                  errorCode: err.message,
                };
                parentPort.postMessage(state);
                users.shift();
              }
            });
        },
        {
          retries: 9999999,
          maxTimeout: 0,
          minTimeout: 0,
          onFailedAttempt: (error) => {
            if (error.message == 'STOP') {
              throw new Error('stopping');
            }
          },
        },
      );
    } catch (err) {}
  }
  try {
    findReservations();
  } catch (err) {}
}
async function logInUser(user) {
  return new Promise(async (res, rej) => {
    let abortReason = 0;
    try {
      await pRetry(
        async () => {
          const controller = new AbortController();
          // 5 second timeout:
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 15000);
          process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
          const resp = await fetch(
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
                username: user.email,
                password: user.password,
              }),
              signal: controller.signal,
              // agent: user.agent,
            },
          )
            .then(async (response) => {
              const data = await response.json();
              //return server error
              if (
                ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
              ) {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: data.Message,
                  isError: true,
                  errorCode: data.ErrorCode,
                };
                parentPort.postMessage(state);
                if (data.ErrorCode == 'U404') {
                  rej('INVALID_CREDINATLS');
                } else {
                  throw new Error('retry');
                }
              }
              user.cookie = response.headers.get('set-cookie').split(';')[0];
              user.user = data.P_PROFILE_RESULT;
              const state = {
                reservationId: user.reservationId,
                state: 0,
                message: 'تم تسجيل الدخول بنجاح',
                isError: false,
                errorCode: null,
                successCode: 'LOGGED_IN',
                index: 0,
              };
              parentPort.postMessage(state);
              res(user);
            })
            .catch((err) => {
              console.log(err);
              if (err.message == 'STOP') {
                throw new Error('STOP');
              }
              if (err.name == 'AbortError') {
                if (abortReason == 0) {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'الموقع لا يستجيب',
                    isError: true,
                    errorCode: 'RESPONSE_TIMEOUT',
                  };
                  parentPort.postMessage(state);
                  throw new Error('retry');
                } else {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: err.message,
                    isError: true,
                    errorCode: err.message,
                  };
                  parentPort.postMessage(state);
                  throw new Error('retry');
                }
                //if server takes too long to respond
              } else {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: err.message,
                  isError: true,
                  errorCode: err.message,
                };
                parentPort.postMessage(state);
                throw new Error('retry');
              }
            });
        },
        {
          retries: 9999999,
          maxTimeout: 0,
          minTimeout: 0,
          onFailedAttempt: (error) => {
            if (error.message == 'STOP') {
            }
          },
        },
      );
    } catch (err) {
      console.log(err);
      //   reject('stopping');
    }
  });
}
async function findReservations() {
  return new Promise(async (resolve, reject) => {
    while (loggedInUsers.length > 0) {
      //0 when the abort is timeout and 1 when i am aborting it
      try {
        await pRetry(
          async () => {
            let user = loggedInUsers[0];

            const controller = new AbortController();

            // 5 second timeout:
            let abortReason = 0;
            parentPort.on('message', async (message) => {
              if (message.type == 'shutdown') {
                abortReason = 1;
                controller.abort(); // Cancel fetch
                console.log('Worker received shutdown signal');
                // Let the fetch cancellation complete gracefully
                setTimeout(() => {
                  process.exit(0); // Clean exit
                }, 100);
              }
            });
            const timeoutId = setTimeout(() => {
              controller.abort();
            }, 10000);
            const params = {
              missionId: user.scholarshipType.toString(),
              serviceId: user.passportOption.toString(),
              companion: user.transactionsCount.toString(),
            };
            // const start = (await this.settingsService.getSettings()).start;
            // if (!start) {
            //   abortReason = 1;
            //   controller.abort();
            // }
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
                signal: controller.signal,
                agent: user.agent, // Include cookies/sessions
              },
            )
              .then(async (response) => {
                //UA100
                const data = await response.json();

                if (
                  ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
                ) {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: data.Message,
                    isError: true,
                    errorCode: data.ErrorCode,
                  };
                  parentPort.postMessage(state);
                  if (state.errorCode === 'UA100') {
                    try {
                      user = await logInUser(user);
                      throw new Error('retry');
                    } catch (err) {
                      if (err.message == 'retry') {
                        throw new Error('retry');
                      } else {
                        loggedInUsers.push(loggedInUsers.shift());
                      }
                    }
                  } else if (state.errorCode === 'RE100') {
                    loggedInUsers.push(loggedInUsers.shift());
                  } else {
                    loggedInUsers.push(loggedInUsers.shift());
                  }
                } else {
                  if (!data.length) {
                    console.log('no reservations avaliable');
                    const state = {
                      reservationId: user.reservationId,
                      state: 0,
                      message: 'لا يوجد حجوزات متاحة',
                      isError: true,
                      errorCode: 'NO_RESERVATIONS_AVAILABLE',
                    };
                    parentPort.postMessage(state);
                    loggedInUsers.push(loggedInUsers.shift());
                  } else {
                    const state = {
                      reservationId: user.reservationId,
                      state: 0,
                      message: 'هناك حجوزات متاحة',
                      isError: false,
                      errorCode: null,
                      index: 1,
                    };
                    parentPort.postMessage(state);
                    const dates = data;
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
                    try {
                      await excueteReservation(user);
                      loggedInUsers.shift();
                    } catch (err) {
                      console.log(err);
                    }
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
                      reservationId: user.reservationId,
                      state: 0,
                      message: 'الموقع لا يستجيب',
                      isError: true,
                      errorCode: 'RESPONSE_TIMEOUT',
                    };
                    parentPort.postMessage(state);
                    throw new Error('retry');
                  } else {
                    const state = {
                      reservationId: user.reservationId,
                      state: 0,
                      message: 'تم ايقاف العملية',
                      isError: true,
                      errorCode: 'PROCESS_TERMINATED',
                    };
                    parentPort.postMessage(state);
                    throw new Error('STOP');
                  }
                } else if (err.message == 'NO_RESERVATIONS_AVAILABLE') {
                  // throw new Error('retry');
                } else {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: err.message,
                    isError: true,
                    errorCode: err.message,
                  };
                  parentPort.postMessage(state);
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
        console.log(err);
        //   reject('stopping');
      }
    }
  });
}
async function excueteReservation(user) {
  return new Promise(async (resolve, reject) => {
    let PID;
    try {
      await pRetry(
        async () => {
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

          const controller = new AbortController();
          let abortReason = 0;
          // 5 second timeout:
          parentPort.on('message', async (message) => {
            if (message.type == 'shutdown') {
              abortReason = 1;
              controller.abort(); // Cancel fetch
              console.log('Worker received shutdown signal');
              // Let the fetch cancellation complete gracefully
              setTimeout(() => {
                process.exit(0); // Clean exit
              }, 100);
            }
          });
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 10000);
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
            body: JSON.stringify(payload),
            signal: controller.signal,
            agent: user.agent, // Include existing cookies like SESSION
          })
            .then(async (response) => {
              //UA100
              console.log(response);
              const data = await response.json();
              if (
                ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
              ) {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: data.Message,
                  isError: true,
                  errorCode: data.ErrorCode,
                };
                parentPort.postMessage(state);
                if (state.errorCode === 'UA100') {
                  try {
                    user = await logInUser(user);
                    throw new Error('retry');
                  } catch (err) {
                    if (err.message == 'retry') {
                      throw new Error('retry');
                    } else {
                      loggedInUsers.push(loggedInUsers.shift());
                    }
                  }
                } else if (state.errorCode === 'RE100') {
                  console.log('shitfing logged in users');
                  loggedInUsers.shift();
                } else {
                  loggedInUsers.shift();
                  throw new Error('STOP');
                }
              } else {
                PID = data.P_ID;
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
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'الموقع لا يستجيب',
                    isError: true,
                    errorCode: 'RESPONSE_TIMEOUT',
                  };
                  parentPort.postMessage(state);
                  throw new Error('retry');
                } else {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'تم ايقاف العملية',
                    isError: true,
                    errorCode: 'PROCESS_TERMINATED',
                  };
                  parentPort.postMessage(state);
                  throw new Error('STOP');
                }
              } else {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: err.message,
                  isError: true,
                  errorCode: err.message,
                };
                parentPort.postMessage(state);
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
          let abortReason = 0;
          // 5 second timeout:
          parentPort.on('message', async (message) => {
            if (message.type == 'shutdown') {
              abortReason = 1;
              controller.abort(); // Cancel fetch
              console.log('Worker received shutdown signal');
              // Let the fetch cancellation complete gracefully
              setTimeout(() => {
                process.exit(0); // Clean exit
              }, 100);
            }
          });
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 10000);
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
            signal: controller.signal,
            agent: user.agent, // Include existing cookies like SESSION
          })
            .then(async (response) => {
              //UA100

              if (
                ![200, 201, 202, 203, 204, 205, 206].includes(response.status)
              ) {
                console.log('error here');
                const data = await response.json();
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: data.Message,
                  isError: true,
                  errorCode: data.ErrorCode,
                };
                parentPort.postMessage(state);
                if (state.errorCode === 'UA100') {
                  try {
                    user = await logInUser(user);
                    throw new Error('retry');
                  } catch (err) {
                    if (err.message == 'retry') {
                      throw new Error('retry');
                    } else {
                      loggedInUsers.push(loggedInUsers.shift());
                    }
                  }
                } else if (state.errorCode === 'RE100') {
                  console.log('shitfing logged in users');
                  loggedInUsers.shift();
                  throw new Error('STOP');
                } else {
                  loggedInUsers.shift();
                  throw new Error('STOP');
                }
              } else {
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
                parentPort.postMessage(state);
              }
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
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'الموقع لا يستجيب',
                    isError: true,
                    errorCode: 'RESPONSE_TIMEOUT',
                  };
                  parentPort.postMessage(state);
                  throw new Error('retry');
                } else {
                  const state = {
                    reservationId: user.reservationId,
                    state: 0,
                    message: 'تم ايقاف العملية',
                    isError: true,
                    errorCode: 'PROCESS_TERMINATED',
                  };
                  parentPort.postMessage(state);
                  throw new Error('STOP');
                }
                //if server takes too long to respond
              } else {
                const state = {
                  reservationId: user.reservationId,
                  state: 0,
                  message: err.message,
                  isError: true,
                  errorCode: err.message,
                };
                parentPort.postMessage(state);
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
}
