import { Module } from '@nestjs/common';
import { VisionTelemetryController } from './vision-telemetry.controller';
import { VisionTelemetryService } from './vision-telemetry.service';

@Module({
  controllers: [VisionTelemetryController],
  providers: [VisionTelemetryService],
  exports: [VisionTelemetryService],
})
export class VisionTelemetryModule {}
