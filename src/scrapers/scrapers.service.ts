import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';

@Injectable()
export class ScrapersService {
  private readonly logger = new Logger(ScrapersService.name);
  private readonly movies = [
    { title: 'Casper', year: 1995 },
    { title: 'Drop Dead Fred', year: 1991 },
    { title: 'Dumb and Dumber', year: 1994 },
    { title: 'Stand by Me', year: 1986 },
    { title: 'Toy Story', year: 1995 },
  ];

  // Called when the module is initialized
  async onModuleInit() {
    this.logger.debug('Running the scraper immediately on startup...');
    await this.scrape();
  }

  // Schedule the scraper to run every hour
  @Cron('0 * * * *')
  async handleCron() {
    this.logger.debug('Running the scheduled movie scraper...');
    await this.scrape();
  }

  async scrape() {
    const results = {};
    for (const movie of this.movies) {
      results[movie.title] = await this.scrapeMovieScores(movie.title, movie.year);
    }
    this.storeData(results);
  }

  private async scrapeMovieScores(title: string, year: number) {
    const scores = {
      imdb: await this.scrapeIMDB(title, year),
      rottenTomatoes: await this.scrapeRottenTomatoes(title, year),
      metaCritic: await this.scrapeMetaCritic(title, year),
    };
    return scores;
  }

  private async scrapeIMDB(title: string, year: number): Promise<string | null> {
    try {
      const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=ft&ref_=fn_ft`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      });

      const $ = cheerio.load(data);

      const movieLink = $('.ipc-metadata-list-summary-item__c').filter((_, el) => {
        const movieTitle = $(el).find('a.ipc-metadata-list-summary-item__t').first()
          .text().trim();
        const movieYear = $(el).find('span.ipc-metadata-list-summary-item__li').first()
          .text().trim();
        return movieTitle === title && movieYear === year.toString();
      }).map((_, el) => {
        return $(el).find('a.ipc-metadata-list-summary-item__t').attr('href');
      }).get()[0];

      if (!movieLink) {
        this.logger.warn(`No movie link found for "${title}" on IMDb.`);
        return null;
      }

      const moviePageUrl = `https://www.imdb.com${movieLink}`;
      const { data: moviePageData } = await axios.get(moviePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $$ = cheerio.load(moviePageData);

      const ratingElement = $$('div[data-testid="hero-rating-bar__aggregate-rating__score"]');
      const rating = ratingElement.find('span').first().text(); // rating
      const maxScore = ratingElement.find('span').last().text().trim(); // max rating

      if (!rating || !maxScore) {
        this.logger.warn(`Rating for "${title}" not found on IMDb.`);
        return null;
      }

      return `${rating}${maxScore}`;
    } catch (error) {
      this.logger.error(`Failed to scrape IMDb for "${title}": ${error.message}`);
      return null;
    }
  }

  private async scrapeRottenTomatoes(title: string, year: number): Promise<string | null> {
    try {
      const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      });

      const $ = cheerio.load(data);
      const movieLink = $('search-page-media-row[data-qa="data-row"]').filter((_, el) => {
        const movieTitle = $(el).find('a[data-qa="info-name"]').first()
          .text().trim();
        const movieYear = $(el).attr('releaseyear');
        return movieTitle === title && movieYear === year.toString();
      }).map((_, el) => {
        return $(el).find('a[data-qa="info-name"]').first().attr('href');
      }).get()[0];

      if (!movieLink) return null;

      const moviePageUrl = `${movieLink}`;
      const { data: moviePageData } = await axios.get(moviePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const $$ = cheerio.load(moviePageData);

      const ratingText = $$('rt-button[slot="criticsScore"]').first().text().trim();
      const rating = parseInt(ratingText.replace('%', ''), 10);
      return isNaN(rating) ? null : `${rating}/${100}`;
    } catch (error) {
      this.logger.error(`Failed to scrape Rotten Tomatoes for ${title}: ${error.message}`);
      return null;
    }
  }

  private async scrapeMetaCritic(title: string, year: number): Promise<string | null> {
    try {
      const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(title)}`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      });
      const $ = cheerio.load(data);
      const movieLink = $('a.c-pageSiteSearch-results-item').filter((_, el) => {
        const movieTitle = $(el).find('p.g-text-medium-fluid').first().text().trim();
        const movieYear = $(el).find('span.u-text-uppercase').first().text().trim();
        const type = $(el).find('span.c-tagList_button').first().text().trim();
        return type === 'movie' && movieTitle === title && movieYear === year.toString();
      }).map((_, el) => {
        return $(el).attr('href');
      }).get()[0];

      if (!movieLink) return null;

      const moviePageUrl = `https://www.metacritic.com${movieLink}`;
      const { data: moviePageData } = await axios.get(moviePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      const $$ = cheerio.load(moviePageData);

      const metascore = $('div.c-siteReviewScore_background div.c-siteReviewScore')
      .first()
      .find('span')
      .text()
      .trim();

      return !metascore ? null : `${metascore}/${100}`;
    } catch (error) {
      this.logger.error(`Failed to scrape MetaCritic for ${title}: ${error.message}`);
      return null;
    }
  }

  private storeData(data: object) {
    const filePath = `./data/movie-scores.json`;
    fs.outputJsonSync(filePath, data, { spaces: 2 });
    this.logger.log(`Data saved to ${filePath}`);
  }
}
