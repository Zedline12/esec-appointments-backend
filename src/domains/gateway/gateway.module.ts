import { Module } from '@nestjs/common';
import { AppGatewayService } from './app.gateway.service';

@Module({
    providers: [AppGatewayService],
    exports:[AppGatewayService]
})
export class GatewayModule {}
