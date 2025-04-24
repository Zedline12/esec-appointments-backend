import { Test, TestingModule } from '@nestjs/testing';
import { ChunkController } from './chunk.controller';
import { ChunkService } from './chunk.service';

describe('ChunkController', () => {
  let controller: ChunkController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChunkController],
      providers: [ChunkService],
    }).compile();

    controller = module.get<ChunkController>(ChunkController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
