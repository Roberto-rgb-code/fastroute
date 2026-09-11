import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '@prisma/client';
import { PublishLocationDto } from './dto/publish-location.dto';
import { TrackingService } from './tracking.service';

@Controller('tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('location')
  @Roles(UserRole.DRIVER, UserRole.LOGISTICS, UserRole.ADMIN, UserRole.MANAGER)
  publish(@CurrentUser() user: User, @Body() dto: PublishLocationDto) {
    if (!user.enterpriseId) {
      throw new BadRequestException('Usuario sin empresa');
    }
    return this.tracking.publishLocation(user.enterpriseId, dto);
  }
}
