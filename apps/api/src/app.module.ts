import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SuperModule } from './super/super.module';
import { TrackingModule } from './tracking/tracking.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ClientsModule } from './clients/clients.module';
import { StopsModule } from './stops/stops.module';
import { RoutesModule } from './routes/routes.module';
import { ConfigController } from './config/config.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    SuperModule,
    TrackingModule,
    DriversModule,
    VehiclesModule,
    ClientsModule,
    StopsModule,
    RoutesModule,
  ],
  controllers: [AppController, ConfigController],
  providers: [AppService],
})
export class AppModule {}
