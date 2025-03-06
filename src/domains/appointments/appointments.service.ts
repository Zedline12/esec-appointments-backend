import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Page, Puppeteer } from 'puppeteer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import puppeteer from 'puppeteer-extra';
import {
  PassportOptions,
  ScholarshipType,
} from './entities/appointment.entity';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
@Injectable()
export class AppointmentsService {
  constructor(private eventEmitter: EventEmitter2) {}
  async create(createAppointmentDto: CreateAppointmentDto) {
    try {
      const {
        email,
        password,
        scolarshipType,
        transactionsCount,
        passportOption,
      } = createAppointmentDto;
      const browser = await puppeteer.launch({
        headless: true,
        slowMo: 30,
        timeout: 500000,
        args: [
          '--no-sandbox',
          '--incognito',
          '--ignore-certificate-errors', // Bypass "Your connection is not private" error
          '--allow-running-insecure-content',
         
        ], // (Optional) Allow insecure content to load],
      });

      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/110.0.0.0 Safari/537.36',
      );

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
      });
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.setCookie', {
          name: 'test_cookie',
          value: 'test_value',
          domain: 'example.com', // Change to the domain you need
          path: '/',
          secure: false,
          httpOnly: false,
          sameSite: 'None'
      });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      });
      await this.login(page, email, password);
      await this.appoint(
        page,
        scolarshipType,
        passportOption,
        transactionsCount,
      );
      // Navigate the page to a URL
    } catch (err) {
      throw err;
      console.log('Error handled', err);
    }
  }
  async login(page: Page, email: string, password: string) {
    await page.goto('https://www.ecsc-expat.sy/login', {
      timeout: 60000,
    });

    await page
      .locator('app-login >>> input[formcontrolname="emailFormControl"]')
      .fill(email);
    await page
      .locator('app-login >>> input[formcontrolname="passwordFormControl"]')
      .fill(password);
    (await page.waitForSelector('app-login >>> button')).click();
    let responseCount = 0;
    //I want to get the second response because the first is always 200
    return await new Promise(async (resolve, reject) => {
      await page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/login')) {
          // Adjust the endpoint to match your API
          responseCount++;
          if (responseCount === 2) {
            if (response.status() === 403) {
              reject(new UnauthorizedException('Invalid credentials'));
            }

            if (response.status() === 200) resolve('success');
          }
          // If the request is JSON, you can also get the response body
        }
      });
    });
  }
  async appoint(
    page: Page,
    scolarshipType: ScholarshipType,
    passportOption: PassportOptions,
    transactionsCount: Number,
  ) {
    await page.goto('https://www.ecsc-expat.sy/requests', {
      timeout: 60000,
    });
    const buttonSelector =
      'app-requests-container >>> button.mat-stroked-button';

    await page.waitForSelector(buttonSelector, { timeout: 10000 });

    // Find all buttons inside the shadow DOM
    const buttons = await page.$$(buttonSelector);

    for (const button of buttons) {
      // Check if the button's span contains the Arabic text
      const spanText = await page.evaluate((el) => {
        const span = el.querySelector('span.mat-button-wrapper');
        return span ? span.textContent?.trim() : null;
      }, button);

      if (spanText === 'إنشاء معاملة جديدة') {
        await button.click();
        break;
      }
    }
    await page.waitForSelector(
      'app-create-request >>> mat-card >>> mat-form-field',
    );
    const matFormFields = await page.$$(
      'app-create-request >>> mat-card >>> mat-form-field',
    );
    await matFormFields[1].click();
    await page.click('.mat-option:nth-child(18)');
    await page
      .locator('div >>> app-create-request >>> mat-card >>>  button')
      .click();

    const selector =
      '#cdk-step-content-0-1 > app-request-step2 > div > div > div > mat-card > form > div:nth-child(4) > mat-form-field';

    // Wait for the element to appear before interacting
    await page.waitForSelector(selector, { visible: true });

    // Click the element
    await page.click(selector);
    await page.click(`.mat-option:nth-child(${scolarshipType})`);
    const selector2 =
      '#cdk-step-content-0-1 > app-request-step2 > div > div > div > mat-card > form > div:nth-child(4) > mat-form-field:nth-child(2)';

    // Wait for the element to appear in the DOM
    await page.waitForSelector(selector2, { visible: true, timeout: 10000 });
    await page.click(selector2);
    await page.click(`.mat-option:nth-child(${passportOption})`);
    const selector3 =
      '#cdk-step-content-0-1 > app-request-step2 > div > div > div > mat-card > form > div:nth-child(4) > mat-form-field:nth-child(3)';
    const inputField = await page.$(selector3);
    await inputField.type(transactionsCount.toString(), { delay: 100 });

    //wait for calendar to be avaliable
    await page.evaluate(() => {
      // wait for 100ms.
      return new Promise((resolve) => setTimeout(resolve, 2000));
    });
      //open calendar
    await page.evaluate(() => {
      const button = document.querySelector(
        'button[aria-label="Open calendar"]',
      ) as HTMLElement;
      if (button) button.click();
    });
    await page.waitForSelector(
      '#mat-datepicker-0 > div > mat-month-view > table > tbody',
      { visible: true },
    );

    // Get the innerHTML of the tbody
    //click the earliest avaliable date
    await page.evaluate(() => {
      (document.querySelectorAll(
        '#mat-datepicker-0 > div > mat-month-view > table > tbody > tr > td > button:not(.mat-calendar-body-disabled)'
      )[0] as HTMLButtonElement).click()
    })
    //get all avaliables dates
    const tdInnerHTMLs = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          '#mat-datepicker-0 > div > mat-month-view > table > tbody > tr > td > button:not(.mat-calendar-body-disabled) > div.mat-calendar-body-cell-content',
        ),
      ).map((td) => td.innerHTML);
    });
      
    await page.evaluate(() => {
       (document.querySelector("#sco") as HTMLButtonElement).click()
    })
    console.log('Inner HTML of all <td> in row 2:', tdInnerHTMLs);

    // const selector4 = 'button[aria-label="Open calendar"]';
    // await page.waitForSelector(selector4);
    // await page.click(selector4);
    // const selector4 = '#cdk-step-content-0-1 > app-request-step2 > div > div > div > mat-card > form > div:nth-child(4) > mat-form-field.mat-form-field > div > div.mat-form-field-flex > div.mat-form-field-suffix > mat-datepicker-toggle > button.mat-focus-indicator.mat-icon-button.mat-button-base';
    // await page.waitForSelector(selector4);

    // await page.click(selector4,{count:2})
    // await page.waitForSelector(
    //   `app-request-step2 >>> mat-card >>> mat-form-field`,
    //   { visible: true },
    // );
    // const requestMatFormFields = await page.$$(
    //   'app-request-step2 >>> mat-card >>> mat-form-field',
    // );

    // await requestMatFormFields[0].click()
    // await page.locator('app-pguide >>> mat-select').setTimeout(3000).click();
    // await page.waitForSelector('.mat-select-panel', { visible: true });

    // // Step 3: Click the specific option by text or index
    // await page.click('.mat-option:nth-child(19)');
    // (await page.waitForSelector('#mat-tab-label-0-0'))
    // await page.locator('#mat-tab-label-0-0').setTimeout(1000).click();

    //إنشاء معاملة جديدة
  }
  findAll() {
    return `This action returns all appointments`;
  }

  findOne(id: number) {
    return `This action returns a #${id} appointment`;
  }

  update(id: number, updateAppointmentDto: UpdateAppointmentDto) {
    return `This action updates a #${id} appointment`;
  }

  remove(id: number) {
    return `This action removes a #${id} appointment`;
  }
}
