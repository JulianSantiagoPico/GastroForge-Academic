import { Module } from '@nestjs/common';
import { AcademicAnalysisController } from './academic-analysis.controller';
import { AcademicAnalysisService } from './academic-analysis.service';

@Module({
  controllers: [AcademicAnalysisController],
  providers: [AcademicAnalysisService],
  exports: [AcademicAnalysisService],
})
export class AcademicAnalysisModule {}
