import { Module } from '@nestjs/common';
import { SuperEnterprisesController } from './super-enterprises.controller';
import { SuperEnterprisesService } from './super-enterprises.service';

@Module({
  controllers: [SuperEnterprisesController],
  providers: [SuperEnterprisesService],
})
export class SuperModule {}
