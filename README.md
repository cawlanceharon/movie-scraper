# Movie Scores Scraper

This application scrapes movie scores from IMDb, Rotten Tomatoes, and MetaCritic for specified movies and stores the data in a JSON file.

## Movies

The following movies are scraped:
- Casper (1995)
- Drop Dead Fred (1991)
- Dumb and Dumber (1994)
- Stand by Me (1986)
- Toy Story (1995)

## Prerequisites

- Node.js (v16+)
- Nest.js (v10+)
- Yarn or npm

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/cawlanceharon/movie-scraper
   cd movie-scraper
   yarn install
   yarn start

2. Rest API
   ```bash
   /movies/scores, GET
   /movies/scrape, GET

3. Considerations
- **Data Storage:** The scores are stored as JSON files in the `src/data` directory.
- **Aggregation:** None currently, but could be added to calculate averages.
- **System Utilization:** JSON format makes it easy for other systems to utilize the data.
- **Performance:** Optimized for sequential requests to avoid server overload.
- **Scalability:** Modular design allows adding more sources or movies easily.
- **Error Handling:** Logs errors to the console and skips saving data if scraping fails.

This setup provides a robust foundation for scraping and storing movie scores from the given sources.