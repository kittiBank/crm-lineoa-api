import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'CRM LINE OA API is running',
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      version: '1.0.0',
    };
  }
}
