import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get(AppController);
    appService = app.get(AppService);
  });

  describe('health', () => {
    it('returns ok status for the API service', () => {
      const result = appController.health();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('fastroute-api');
      expect(result.time).toEqual(expect.any(String));
    });

    it('delegates to AppService.health', () => {
      const spy = jest.spyOn(appService, 'health');
      appController.health();
      expect(spy).toHaveBeenCalled();
    });
  });
});
