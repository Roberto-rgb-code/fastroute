import { Module } from '@nestjs/common';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { StopsController } from './stops.controller';
import { StopsService } from './stops.service';

@Module({
  imports: [GeocodingModule],
  controllers: [StopsController],
  providers: [StopsService],
})
export class StopsModule {}
