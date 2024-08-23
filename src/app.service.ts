import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getMain(): string {
    return 'Movie Scrapper!';
  }
}
