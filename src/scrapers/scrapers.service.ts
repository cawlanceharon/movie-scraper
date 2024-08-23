import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs-extra';

// The Injectable decorator marks the class as a provider that can be injected into other classes.
@Injectable()
export class ScrapersService {
  // Logger instance for logging messages within this service.
  private readonly logger = new Logger(ScrapersService.name);

  // List of movies to scrape scores for, including their titles and release years.
  private readonly movies = [
    { title: 'Casper', year: 1995 },
    { title: 'Drop Dead Fred', year: 1991 },
    { title: 'Dumb and Dumber', year: 1994 },
    { title: 'Stand by Me', year: 1986 },
    { title: 'Toy Story', year: 1995 },
  ];

  // Called when the module is initialized. This method runs the scraper immediately on startup.
  async onModuleInit() {
    this.logger.debug('Running the scraper immediately on startup...');
    await this.scrape();
  }

  // Scheduled to run every hour based on the cron expression. This method triggers the scraping process.
  @Cron('0 * * * *')
  async handleCron() {
    this.logger.debug('Running the scheduled movie scraper...');
    await this.scrape();
  }

  // Main scraping function that iterates over the list of movies and collects their scores.
  async scrape() {
    const results = {};
    // Iterate through each movie and scrape scores from different sources.
    for (const movie of this.movies) {
      results[movie.title] = await this.scrapeMovieScores(movie.title, movie.year);
    }
    // Store the collected data in a JSON file.
    this.storeData(results);
  }

  // Aggregates scores from IMDb, Rotten Tomatoes, and MetaCritic for a given movie.
  private async scrapeMovieScores(title: string, year: number) {
    const scores = {
      imdb: await this.scrapeIMDB(title, year),
      rottenTomatoes: await this.scrapeRottenTomatoes(title, year),
      metaCritic: await this.scrapeMetaCritic(title, year),
    };
    return scores;
  }

  // Scrapes movie scores from IMDb based on the movie title and release year.
  private async scrapeIMDB(title: string, year: number): Promise<string | null> {
    try {
      // Search URL for IMDb based on the movie title and type.
      const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=ft&ref_=fn_ft`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      });

      // Load the search results page into cheerio for parsing.
      const $ = cheerio.load(data);

      // Find the link to the movie's page.
      const movieLink = $('.ipc-metadata-list-summary-item__c').filter((_, el) => {
        const movieTitle = $(el).find('a.ipc-metadata-list-summary-item__t').first().text().trim();
        const movieYear = $(el).find('span.ipc-metadata-list-summary-item__li').first().text().trim();
        return movieTitle === title && movieYear === year.toString();
      }).map((_, el) => {
        return $(el).find('a.ipc-metadata-list-summary-item__t').attr('href');
      }).get()[0];

      // Log a warning if no movie link is found.
      if (!movieLink) {
        this.logger.warn(`No movie link found for "${title}" on IMDb.`);
        return null;
      }

      // Fetch the movie page data using the movie link.
      const moviePageUrl = `https://www.imdb.com${movieLink}`;
      const { data: moviePageData } = await axios.get(moviePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      // Load the movie page into cheerio for parsing.
      const $$ = cheerio.load(moviePageData);

      // Extract rating and maximum score from IMDb.
      const ratingElement = $$('div[data-testid="hero-rating-bar__aggregate-rating__score"]');
      const rating = ratingElement.find('span').first().text(); // Rating
      const maxScore = ratingElement.find('span').last().text().trim(); // Max rating

      // Log a warning if the rating or maximum score is not found.
      if (!rating || !maxScore) {
        this.logger.warn(`Rating for "${title}" not found on IMDb.`);
        return null;
      }

      // Return the concatenated rating and max score.
      return `${rating}${maxScore}`;
    } catch (error) {
      // Log an error if the scraping fails.
      this.logger.error(`Failed to scrape IMDb for "${title}": ${error.message}`);
      return null;
    }
  }

  // Scrapes movie scores from Rotten Tomatoes based on the movie title and release year.
  private async scrapeRottenTomatoes(title: string, year: number): Promise<string | null> {
    try {
      // Search URL for Rotten Tomatoes based on the movie title.
      const searchUrl = `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      });

      // Load the search results page into cheerio for parsing.
      const $ = cheerio.load(data);

      // Find the link to the movie's page.
      const movieLink = $('search-page-media-row[data-qa="data-row"]').filter((_, el) => {
        const movieTitle = $(el).find('a[data-qa="info-name"]').first().text().trim();
        const movieYear = $(el).attr('releaseyear');
        return movieTitle === title && movieYear === year.toString();
      }).map((_, el) => {
        return $(el).find('a[data-qa="info-name"]').first().attr('href');
      }).get()[0];

      // Return null if no movie link is found.
      if (!movieLink) return null;

      // Fetch the movie page data using the movie link.
      const moviePageUrl = `${movieLink}`;
      const { data: moviePageData } = await axios.get(moviePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      // Load the movie page into cheerio for parsing.
      const $$ = cheerio.load(moviePageData);

      // Extract rating from Rotten Tomatoes.
      const ratingText = $$('rt-button[slot="criticsScore"]').first().text().trim();
      const rating = parseInt(ratingText.replace('%', ''), 10);
      // Return the rating in the format "rating/100", or null if the rating is not a number.
      return isNaN(rating) ? null : `${rating}/${100}`;
    } catch (error) {
      // Log an error if the scraping fails.
      this.logger.error(`Failed to scrape Rotten Tomatoes for ${title}: ${error.message}`);
      return null;
    }
  }

  // Scrapes movie scores from MetaCritic based on the movie title and release year.
  private async scrapeMetaCritic(title: string, year: number): Promise<string | null> {
    try {
      // Search URL for MetaCritic based on the movie title.
      const searchUrl = `https://www.metacritic.com/search/${encodeURIComponent(title)}`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
      });
      // Load the search results page into cheerio for parsing.
      const $ = cheerio.load(data);

      // Find the link to the movie's page.
      const movieLink = $('a.c-pageSiteSearch-results-item').filter((_, el) => {
        const movieTitle = $(el).find('p.g-text-medium-fluid').first().text().trim();
        const movieYear = $(el).find('span.u-text-uppercase').first().text().trim();
        const type = $(el).find('span.c-tagList_button').first().text().trim();
        return type === 'movie' && movieTitle === title && movieYear === year.toString();
      }).map((_, el) => {
        return $(el).attr('href');
      }).get()[0];

      // Return null if no movie link is found.
      if (!movieLink) return null;

      // Fetch the movie page data using the movie link.
      const moviePageUrl = `https://www.metacritic.com${movieLink}`;
      const { data: moviePageData } = await axios.get(moviePageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      // Load the movie page into cheerio for parsing.
      const $$ = cheerio.load(moviePageData);

      // Extract metascore from MetaCritic.
      const metascore = $('div.c-siteReviewScore_background div.c-siteReviewScore')
      .first()
      .find('span')
      .text()
      .trim();

      // Return the metascore in the format "metascore/100", or null if the metascore is not found.
      return !metascore ? null : `${metascore}/${100}`;
    } catch (error) {
      // Log an error if the scraping fails.
      this.logger.error(`Failed to scrape MetaCritic for ${title}: ${error.message}`);
      return null;
    }
  }

  // Stores the collected movie scores data in a JSON file.
  private storeData(data: object) {
    const filePath = './data/movie-scores.json';
    fs.outputJsonSync(filePath, data, { spaces: 2 });
    this.logger.log(`Data saved to ${filePath}`);
  }
}
