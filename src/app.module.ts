import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AcademicAnalysisModule } from './modules/academic-analysis/academic-analysis.module';
import { StructuresModule } from './modules/structures/structures.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 segundos
        limit: 120, // Límite amplio para pruebas automáticas continuas sin bloqueo, permitiendo protección contra abusos masivos
      },
    ]),
    AcademicAnalysisModule,
    StructuresModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
