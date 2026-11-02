import { Test, TestingModule } from '@nestjs/testing';
import { VisionTelemetryController } from './vision-telemetry.controller';
import { VisionTelemetryService } from './vision-telemetry.service';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';

describe('VisionTelemetryController', () => {
  let controller: VisionTelemetryController;
  let service: VisionTelemetryService;

  const mockPayload: IngestTelemetryDto = {
    system: 'GastroForge-Vision-Ultralytics',
    timestamp: '2026-11-02T01:00:00.000Z',
    current_time_seconds: 20.0,
    salon_summary: {
      total_tables: 2,
      free_tables: 1,
      occupied_tables: 1,
      pending_clean_tables: 0,
      cleaning_tables: 0,
      temporary_absence_tables: 0,
      occupancy_rate_percent: 50.0,
    },
    kpis: {
      avg_first_service_latency_seconds: null,
      avg_turnover_latency_seconds: null,
      avg_stay_duration_seconds: 20.0,
      hygiene_incidents_count: 0,
      waiting_queue_count: 0,
      service_bottleneck_detected: false,
      low_demand_detected: false,
      operational_diagnosis: 'OPERACION_BALANCEADA',
    },
    tables: [
      {
        table_id: 'Mesa 1',
        state: 'ocupada',
        current_session_id: 'Mesa 1_s1',
        is_occupied: true,
        occupied_duration_seconds: 20.0,
        occupied_duration_formatted: '00:00:20',
        first_dish_served: false,
        has_hygiene_incident: false,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisionTelemetryController],
      providers: [VisionTelemetryService],
    }).compile();

    controller = module.get<VisionTelemetryController>(VisionTelemetryController);
    service = module.get<VisionTelemetryService>(VisionTelemetryService);
  });

  it('debe registrar telemetría a través del endpoint ingestTelemetry', () => {
    const res = controller.ingestTelemetry(mockPayload);
    expect(res.success).toBe(true);
    expect(res.ingestedTables).toBe(1);
  });

  it('debe devolver el estado del salón y las mesas', () => {
    controller.ingestTelemetry(mockPayload);
    const status = controller.getSalonStatus();
    expect(status.system).toBe('GastroForge-Vision-Ultralytics');

    const tables = controller.getTables();
    expect(tables.length).toBe(1);
    expect(tables[0].table_id).toBe('Mesa 1');
  });

  it('debe responder la ruta y prioridad de servicio', () => {
    controller.ingestTelemetry(mockPayload);
    const route = controller.getDispatchRoute('Mesa 1');
    expect(route.reachable).toBe(true);
    expect(route.transitSeconds).toBe(12);

    const priority = controller.getServicePriority();
    expect(priority.totalPendingTasks).toBe(1);
  });
});
