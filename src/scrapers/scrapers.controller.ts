import { Controller, Get } from '@nestjs/common';
import { ScrapersService } from './scrapers.service';
import * as fs from 'fs-extra';

@Controller('movies')
export class ScrapersController {
  constructor(private readonly scrapersService: ScrapersService) {}

  @Get('scores')
  async getMovieScores() {
    const filePath = `./data/movie-scores.json`;
    if (fs.existsSync(filePath)) {
      const data = await fs.readJson(filePath);
      return data;
    } else {
      return { message: 'No data found. Please run the scraper first.' };
    }
  }

  @Get('scrape')
  async scrapeMovies() {
    await this.scrapersService.scrape();
    return { message: 'Scraping completed. Data is saved.' };
  }
}
