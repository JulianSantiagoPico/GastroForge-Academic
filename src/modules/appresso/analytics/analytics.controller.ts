import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AppressoAnalyticsService } from './analytics.service';
import {
  OverviewQueryDto,
  TimeseriesQueryDto,
  AnalyticsOverviewResponse,
  AnalyticsTimeseriesResponse,
  AnalyticsTimelineResponse,
} from './dto/analytics-query.dto';

@Controller('appresso/analytics')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AppressoAnalyticsController {
  constructor(private readonly analyticsService: AppressoAnalyticsService) {}

  @Get('overview')
  async getOverview(
    @Query() query: OverviewQueryDto,
  ): Promise<AnalyticsOverviewResponse> {
    return await this.analyticsService.getOverview(query);
  }

  @Get('timeseries')
  async getTimeseries(
    @Query() query: TimeseriesQueryDto,
  ): Promise<AnalyticsTimeseriesResponse> {
    return await this.analyticsService.getTimeseries(query);
  }

  @Get('anomalies/:id/timeline')
  async getEpisodeTimeline(
    @Param('id') id: string,
  ): Promise<AnalyticsTimelineResponse> {
    return await this.analyticsService.getEpisodeTimeline(id);
  }
}
