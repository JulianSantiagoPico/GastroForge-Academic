import { Test, TestingModule } from '@nestjs/testing';
import { VisionTelemetryService } from './vision-telemetry.service';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';

describe('VisionTelemetryService', () => {
  let service: VisionTelemetryService;

  const mockPayload: IngestTelemetryDto = {
    system: 'GastroForge-Vision-Ultralytics',
    timestamp: '2026-11-02T01:00:00.000Z',
    current_time_seconds: 43.0,
    salon_summary: {
      total_tables: 4,
      free_tables: 1,
      occupied_tables: 2,
      pending_clean_tables: 1,
      cleaning_tables: 0,
      temporary_absence_tables: 0,
      occupancy_rate_percent: 50.0,
    },
    kpis: {
      avg_first_service_latency_seconds: 15.2,
      avg_turnover_latency_seconds: 40.0,
      avg_stay_duration_seconds: 120.0,
      hygiene_incidents_count: 1,
      waiting_queue_count: 2,
      service_bottleneck_detected: true,
      low_demand_detected: false,
      operational_diagnosis: 'CUELLO_DE_BOTELLA_DETECTADO',
    },
    tables: [
      {
        table_id: 'Mesa 1',
        state: 'ocupada',
        current_session_id: 'Mesa 1_s1',
        is_occupied: true,
        occupied_duration_seconds: 45.0,
        occupied_duration_formatted: '00:00:45',
        first_dish_served: false,
        has_hygiene_incident: true,
      },
      {
        table_id: 'Mesa 2',
        state: 'por_recoger',
        current_session_id: 'Mesa 2_s1',
        is_occupied: false,
        occupied_duration_seconds: 100.0,
        occupied_duration_formatted: '00:01:40',
        first_dish_served: true,
        has_hygiene_incident: false,
      },
      {
        table_id: 'Mesa 3',
        state: 'libre',
        current_session_id: null,
        is_occupied: false,
        occupied_duration_seconds: 0.0,
        occupied_duration_formatted: '00:00:00',
        first_dish_served: false,
        has_hygiene_incident: false,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VisionTelemetryService],
    }).compile();

    service = module.get<VisionTelemetryService>(VisionTelemetryService);
  });

  it('debe inicializarse correctamente con estado por defecto', () => {
    const initialStatus = service.getSalonStatus();
    expect(initialStatus.currentTimeSeconds).toBe(0);
    expect(initialStatus.kpis.operational_diagnosis).toBe('SIN_TELEMETRIA_ACTIVA');
  });

  it('debe ingestar la telemetría y disparar alertas operativas e incidentes de higiene', () => {
    const result = service.ingest(mockPayload);
    expect(result.success).toBe(true);
    expect(result.ingestedTables).toBe(3);
    expect(result.alertsTriggered.length).toBeGreaterThan(0);
    expect(
      result.alertsTriggered.some((a) => a.includes('[ALERTA HIGIENE]'))
    ).toBe(true);
    expect(
      result.alertsTriggered.some((a) => a.includes('[CUELLO DE BOTELLA]'))
    ).toBe(true);

    const status = service.getSalonStatus();
    expect(status.salonSummary.total_tables).toBe(4);
    expect(status.tables.length).toBe(3);
  });

  it('debe consultar una mesa existente y arrojar NotFoundException si no existe', () => {
    service.ingest(mockPayload);
    const mesa1 = service.getTableById('Mesa 1');
    expect(mesa1.table_id).toBe('Mesa 1');
    expect(mesa1.has_hygiene_incident).toBe(true);

    expect(() => service.getTableById('Mesa 99')).toThrow();
  });

  it('debe calcular la ruta de despacho con Dijkstra desde kitchen a la mesa', () => {
    const route = service.getDispatchRoute('Mesa 1');
    expect(route.from).toBe('kitchen');
    expect(route.mappedNode).toBe('table-1');
    expect(route.reachable).toBe(true);
    expect(route.path).toContain('kitchen');
    expect(route.path).toContain('passage');
    expect(route.path).toContain('table-1');
    expect(route.transitSeconds).toBe(12); // kitchen(0) -> passage(5) -> table-1(7) = 12s
  });

  it('debe ordenar las tareas de servicio con MinHeap dando máxima prioridad a incidentes de higiene', () => {
    service.ingest(mockPayload);
    const priorityQueue = service.getServicePriorityQueue();
    expect(priorityQueue.totalPendingTasks).toBe(3);

    // La primera tarea debe ser el incidente crítico de Mesa 1
    const firstTask = priorityQueue.prioritizedTasks[0];
    expect(firstTask.tableId).toBe('Mesa 1');
    expect(firstTask.urgencyLevel).toBe('CRITICA');

    // La segunda tarea debe ser Mesa 2 (por_recoger)
    const secondTask = priorityQueue.prioritizedTasks[1];
    expect(secondTask.tableId).toBe('Mesa 2');
    expect(secondTask.urgencyLevel).toBe('ALTA');
  });
});
