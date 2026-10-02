import { AppressoAnalyticsController } from './analytics.controller';
import { AppressoAnalyticsService } from './analytics.service';

describe('AppressoAnalyticsController (W4)', () => {
  let controller: AppressoAnalyticsController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getOverview: jest.fn().mockResolvedValue({ status: 'ok' }),
      getTimeseries: jest.fn().mockResolvedValue({ data: [] }),
      getEpisodeTimeline: jest.fn().mockResolvedValue({ episode: {}, events: [] }),
    };
    controller = new AppressoAnalyticsController(mockService as AppressoAnalyticsService);
  });

  it('delega getOverview al servicio analítico', async () => {
    const query = { from: '100', to: '200' };
    await controller.getOverview(query);
    expect(mockService.getOverview).toHaveBeenCalledWith(query);
  });

  it('delega getTimeseries al servicio analítico', async () => {
    const query = { bucket: 'hour' as const };
    await controller.getTimeseries(query);
    expect(mockService.getTimeseries).toHaveBeenCalledWith(query);
  });

  it('delega getEpisodeTimeline al servicio analítico con el id correcto', async () => {
    await controller.getEpisodeTimeline('ep-test-123');
    expect(mockService.getEpisodeTimeline).toHaveBeenCalledWith('ep-test-123');
  });
});
