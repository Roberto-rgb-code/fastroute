import { Global, Module } from '@nestjs/common';
import { PusherNotifyService } from './pusher-notify.service';

@Global()
@Module({
  providers: [PusherNotifyService],
  exports: [PusherNotifyService],
})
export class RealtimeModule {}
