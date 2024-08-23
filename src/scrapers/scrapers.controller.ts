import { Controller, Get } from '@nestjs/common';
import { ScrapersService } from './scrapers.service';
import * as fs from 'fs-extra';

// The Controller decorator marks the class as a NestJS controller that handles incoming HTTP requests.
@Controller('movies')
export class ScrapersController {
  // Injects the ScrapersService into the controller for use in handling requests.
  constructor(private readonly scrapersService: ScrapersService) {}

  // HTTP GET route handler for fetching movie scores from the JSON file.
  @Get('scores')
  async getMovieScores() {
    // Define the path to the JSON file where movie scores are stored.
    const filePath = `./data/movie-scores.json`;

    // Check if the JSON file exists.
    if (fs.existsSync(filePath)) {
      // Read and return the JSON data from the file.
      const data = await fs.readJson(filePath);
      return data;
    } else {
      // Return a message indicating that no data is available if the file does not exist.
      return { message: 'No data found. Please run the scraper first.' };
    }
  }

  // HTTP GET route handler for initiating the movie scraping process.
  @Get('scrape')
  async scrapeMovies() {
    // Call the scrape method from ScrapersService to start the scraping process.
    await this.scrapersService.scrape();
    // Return a confirmation message indicating that the scraping process is completed.
    return { message: 'Scraping completed. Data is saved.' };
  }
}
