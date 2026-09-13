import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO VERIFICACIÓN DE ESTRUCTURAS DE DATOS (ED-01 a ED-10)');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,POST,OPTIONS',
  });

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/academic') && !req.url.startsWith('/api/v1/academic')) {
      req.url = `/api/v1${req.url}`;
    } else if (req.url.startsWith('/structures') && !req.url.startsWith('/api/v1/structures')) {
      req.url = `/api/v1${req.url}`;
    } else if (req.url === '/health') {
      req.url = '/api/v1/health';
    }
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    })
  );

  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'string' ? 3000 : address?.port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(
    id: string,
    name: string,
    endpoint: string,
    method: 'GET' | 'POST',
    body: any | null,
    expectedStatus: number,
    validator: (data: any) => boolean
  ) {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (body !== null) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${baseUrl}${endpoint}`, options);
      const statusMatch = response.status === expectedStatus;
      const data = await response.json();
      const logicMatch = validator(data);

      if (statusMatch && logicMatch) {
        console.log(`✅ [${id}] PASS: ${name}`);
        passed++;
      } else {
        console.error(`❌ [${id}] FAIL: ${name}`);
        console.error(`   Status esperado: ${expectedStatus}, obtenido: ${response.status}`);
        console.error(`   Respuesta:`, JSON.stringify(data).slice(0, 180) + '...');
        failed++;
      }
    } catch (err) {
      console.error(`❌ [${id}] ERROR: ${name} ->`, err);
      failed++;
    }
  }

  // ED-01: Health check
  await test(
    'ED-01',
    'GET /health responde 200 OK y la salud no se ve afectada',
    '/health',
    'GET',
    null,
    200,
    (d) => d.status === 'ok' && typeof d.uptime === 'number'
  );

  // ED-02: Cola FIFO con A, B, C en orden de llegada
  await test(
    'ED-02',
    'POST /api/v1/structures/queue/simulate despacha A, B, C en orden FIFO estricto',
    '/api/v1/structures/queue/simulate',
    'POST',
    {
      orders: [
        { id: 'ORD-A', table: 1, items: ['Pizza'] },
        { id: 'ORD-B', table: 2, items: ['Pasta'] },
        { id: 'ORD-C', table: 3, items: ['Ensalada'] },
      ],
    },
    200,
    (d) => {
      const seq = d.dequeuedOrderSequence.map((o: any) => o.id);
      return seq[0] === 'ORD-A' && seq[1] === 'ORD-B' && seq[2] === 'ORD-C';
    }
  );

  // ED-03: Heap con prioridades efectivas 50, 101 y 40
  await test(
    'ED-03',
    'POST /api/v1/structures/priority/simulate despacha primero la tarea de prioridad 101',
    '/api/v1/structures/priority/simulate',
    'POST',
    {
      tasks: [
        { id: 'TASK-50', description: 'Plato Normal', urgency: 'normal', waitingMinutes: 0 },
        { id: 'TASK-101', description: 'Plato Urgente', urgency: 'urgente', waitingMinutes: 1 },
        { id: 'TASK-40', description: 'Bebida Baja', urgency: 'baja', waitingMinutes: 30 },
      ],
    },
    200,
    (d) => {
      const seq = d.dispatchedSequence;
      return (
        seq.length === 3 &&
        seq[0].id === 'TASK-101' &&
        seq[0].effectivePriority === 101 &&
        seq[1].id === 'TASK-50' &&
        seq[1].effectivePriority === 50 &&
        seq[2].id === 'TASK-40' &&
        seq[2].effectivePriority === 40
      );
    }
  );

  // ED-04: Agregar, cambiar cantidad, eliminar y undo restaura el ítem
  await test(
    'ED-04',
    'POST /api/v1/structures/stack/simulate: Agregar, cambiar cantidad, eliminar y undo restaura el ítem',
    '/api/v1/structures/stack/simulate',
    'POST',
    {
      actions: [
        { type: 'ADD_ITEM', itemId: 'ITEM-1', name: 'Hamburguesa', quantity: 1 },
        { type: 'UPDATE_QUANTITY', itemId: 'ITEM-1', quantity: 2 },
        { type: 'REMOVE_ITEM', itemId: 'ITEM-1' },
        { type: 'UNDO' },
      ],
    },
    200,
    (d) => {
      return (
        d.finalItems.length === 1 &&
        d.finalItems[0].itemId === 'ITEM-1' &&
        d.finalItems[0].quantity === 2
      );
    }
  );

  // ED-05: Hacer undo y luego una acción nueva vacía redoStack
  await test(
    'ED-05',
    'POST /api/v1/structures/stack/simulate: undo y acción nueva vacía redoStack',
    '/api/v1/structures/stack/simulate',
    'POST',
    {
      actions: [
        { type: 'ADD_ITEM', itemId: 'ITEM-1', name: 'Hamburguesa', quantity: 1 },
        { type: 'UNDO' },
        { type: 'ADD_ITEM', itemId: 'ITEM-2', name: 'Papas Fritas', quantity: 1 },
      ],
    },
    200,
    (d) => {
      return (
        d.redoStackSize === 0 &&
        d.finalItems.length === 1 &&
        d.finalItems[0].itemId === 'ITEM-2'
      );
    }
  );

  // ED-06: Ruta kitchen -> terrace del grafo fijo da 21 segundos
  await test(
    'ED-06',
    'GET /api/v1/structures/graph/default-route calcula ruta kitchen -> terrace con costo 21s',
    '/api/v1/structures/graph/default-route?from=kitchen&to=terrace',
    'GET',
    null,
    200,
    (d) => {
      return (
        d.reachable === true &&
        d.totalCostSeconds === 21 &&
        JSON.stringify(d.path) === JSON.stringify(['kitchen', 'passage', 'table-1', 'terrace'])
      );
    }
  );

  // ED-07: Grafo con arista de costo -1 retorna HTTP 400
  await test(
    'ED-07',
    'POST /api/v1/structures/graph/shortest-path con arista negativa retorna HTTP 400 Bad Request',
    '/api/v1/structures/graph/shortest-path',
    'POST',
    {
      nodes: ['kitchen', 'terrace'],
      edges: [{ from: 'kitchen', to: 'terrace', cost: -1 }],
      startNode: 'kitchen',
      targetNode: 'terrace',
    },
    400,
    (d) => d.statusCode === 400
  );

  // ED-08: Grafo sin camino de origen a destino responde HTTP 200, reachable: false, ruta vacía
  await test(
    'ED-08',
    'POST /api/v1/structures/graph/shortest-path sin camino responde HTTP 200 con reachable: false',
    '/api/v1/structures/graph/shortest-path',
    'POST',
    {
      nodes: ['kitchen', 'bar', 'island'],
      edges: [{ from: 'kitchen', to: 'bar', cost: 5 }],
      startNode: 'kitchen',
      targetNode: 'island',
    },
    200,
    (d) => {
      return d.reachable === false && Array.isArray(d.path) && d.path.length === 0 && d.totalCostSeconds === null;
    }
  );

  // ED-09: Consulta de ID existente en Map retorna pedido en O(1)
  await test(
    'ED-09',
    'POST /api/v1/structures/index/simulate encuentra pedido en Map con 1 operación hash',
    '/api/v1/structures/index/simulate',
    'POST',
    {
      orders: [
        { id: 'ORD-101', table: 4, total: 45000, clientName: 'Valeria' },
        { id: 'ORD-102', table: 2, total: 60000, clientName: 'Andrés' },
      ],
      searchIds: ['ORD-101'],
    },
    200,
    (d) => {
      const q = d.queries[0];
      return q && q.found === true && q.order.id === 'ORD-101' && q.mapOperations === 1;
    }
  );

  // ED-10: 1.001 tareas en prioridad retorna HTTP 400
  const massiveTasks = Array.from({ length: 1001 }, (_, i) => ({
    id: `TASK-${i + 1}`,
    description: `Comanda ${i + 1}`,
    urgency: 'normal',
    waitingMinutes: 5,
  }));

  await test(
    'ED-10',
    'POST /api/v1/structures/priority/simulate con 1.001 tareas retorna HTTP 400 por superar límite',
    '/api/v1/structures/priority/simulate',
    'POST',
    {
      tasks: massiveTasks,
    },
    400,
    (d) => d.statusCode === 400
  );

  await app.close();

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL ESTRUCTURAS: ${passed} PASADAS / ${failed} FALLIDAS`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error fatal ejecutando pruebas:', err);
  process.exit(1);
});
