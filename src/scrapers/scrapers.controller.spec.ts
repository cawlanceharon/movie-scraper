import { Test, TestingModule } from '@nestjs/testing';
import { ScrapersController } from './scrapers.controller';
import { ScrapersService } from './scrapers.service';

describe('ScrapersController', () => {
  let controller: ScrapersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScrapersController],
      providers: [ScrapersService],
    }).compile();

    controller = module.get<ScrapersController>(ScrapersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
