import { Module } from '@nestjs/common';
import { ScrapersService } from './scrapers.service';
import { ScrapersController } from './scrapers.controller';

@Module({
  controllers: [ScrapersController],
  providers: [ScrapersService],
})
export class ScrapersModule {}
