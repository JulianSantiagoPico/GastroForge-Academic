import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { computeHmac } from '../src/modules/appresso/crypto/hmac';
import { CreateAppressoTransactionDto } from '../src/modules/appresso/dto/create-transaction.dto';

interface SimulationMetrics {
  totalSent: number;
  accepted: number;
  anomaliesDetected: number;
  duplicatesHandled: number;
  errors: number;
  latencies: number[];
}

async function runBotSimulation() {
  console.log('======================================================================');
  console.log('🚀 SIMULADOR DE CARGA DE BOT - APPRESSO FRAUD DETECTION (FASE 6)');
  console.log('======================================================================\n');

  const secret = process.env.APPRESSO_HMAC_SECRET || 'gastroforge-default-dev-secret';
  process.env.APPRESSO_HMAC_SECRET = secret;

  // Iniciar servidor en puerto efímero
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'string' ? 3000 : address?.port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/appresso`;

  console.log(`[INFO] Servidor levantado en puerto ${port}`);
  console.log(`[INFO] Endpoint: ${baseUrl}/transactions`);
  console.log(`[INFO] Secreto HMAC configurado correctamente\n`);

  async function sendTransaction(dto: CreateAppressoTransactionDto) {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const latency = Date.now() - start;
    const body = await res.json();
    return { status: res.status, body, latency };
  }

  // --------------------------------------------------------------------
  // PERFIL 1: Contención de usuario único y disparo de ventana deslizante
  // --------------------------------------------------------------------
  console.log('----------------------------------------------------------------------');
  console.log('⚡ PERFIL 1: Mismo usuario (Contención por clave y disparo de umbral)');
  console.log('----------------------------------------------------------------------');

  const targetUser = 'bot_target_user_01';
  const metricsP1: SimulationMetrics = {
    totalSent: 0,
    accepted: 0,
    anomaliesDetected: 0,
    duplicatesHandled: 0,
    errors: 0,
    latencies: [],
  };

  // Enviar ráfaga de 5 transacciones en el mismo segundo
  for (let i = 1; i <= 5; i++) {
    const txnId = `p1-txn-${i}-${Date.now()}`;
    const payload: CreateAppressoTransactionDto = {
      idTxn: txnId,
      user: targetUser,
      value: 150000, // 1,500.00 COP en centavos
      currency: 'COP',
      paymentMethod: 'CREDIT_CARD',
      date: new Date().toISOString(),
      hash: '',
    };
    payload.hash = computeHmac(payload, secret);

    const { status, body, latency } = await sendTransaction(payload);
    metricsP1.totalSent++;
    metricsP1.latencies.push(latency);

    if (status === 200 && body.status === 'ACCEPTED') {
      metricsP1.accepted++;
      if (body.anomaly?.detected) {
        metricsP1.anomaliesDetected++;
      }
      console.log(
        `  -> Txn ${i}: Status 200 OK | Count: ${body.anomaly?.windowCount} | Anomaly: ${body.anomaly?.detected} (${body.anomaly?.rule ?? 'NONE'}) | Latencia: ${latency}ms`,
      );
    } else {
      metricsP1.errors++;
      console.error(`  -> Error en Txn ${i}: Status ${status}`, body);
    }
  }

  // Prueba de idempotencia: Reenviar la transacción #3
  console.log('\n  [Prueba Idempotencia] Reenviando transacción #3 duplicada...');
  const duplicatePayload: CreateAppressoTransactionDto = {
    idTxn: `p1-txn-3-${Date.now()}`, // Usaremos un idTxn nuevo y lo reenviamos dos veces
    user: targetUser,
    value: 150000,
    currency: 'COP',
    paymentMethod: 'CREDIT_CARD',
    date: new Date().toISOString(),
    hash: '',
  };
  duplicatePayload.hash = computeHmac(duplicatePayload, secret);

  const firstSend = await sendTransaction(duplicatePayload);
  const secondSend = await sendTransaction(duplicatePayload);

  if (firstSend.body.isDuplicate === false && secondSend.body.isDuplicate === true) {
    metricsP1.duplicatesHandled++;
    console.log('  -> [OK] Idempotencia verificada: el reintento retornó isDuplicate = true sin duplicar conteo.');
  } else {
    console.error('  -> [FAIL] Idempotencia falló:', { first: firstSend.body, second: secondSend.body });
  }

  // --------------------------------------------------------------------
  // PERFIL 2: Concurrencia de múltiples usuarios (Aislamiento por clave)
  // --------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------');
  console.log('👥 PERFIL 2: Múltiples usuarios concurrentes (Aislamiento de ventanas)');
  console.log('----------------------------------------------------------------------');

  const metricsP2: SimulationMetrics = {
    totalSent: 0,
    accepted: 0,
    anomaliesDetected: 0,
    duplicatesHandled: 0,
    errors: 0,
    latencies: [],
  };

  const concurrentUsers = 10;
  const promises: Promise<any>[] = [];

  for (let u = 1; u <= concurrentUsers; u++) {
    const userId = `multi_user_${u}`;
    // Cada usuario envía 2 transacciones (no deben superar el umbral de 3)
    for (let t = 1; t <= 2; t++) {
      const payload: CreateAppressoTransactionDto = {
        idTxn: `p2-u${u}-t${t}-${Date.now()}`,
        user: userId,
        value: 50000 * t,
        currency: 'COP',
        paymentMethod: 'DEBIT_CARD',
        date: new Date().toISOString(),
        hash: '',
      };
      payload.hash = computeHmac(payload, secret);

      promises.push(
        sendTransaction(payload).then(({ status, body, latency }) => {
          metricsP2.totalSent++;
          metricsP2.latencies.push(latency);
          if (status === 200 && body.status === 'ACCEPTED') {
            metricsP2.accepted++;
            if (body.anomaly?.detected) {
              metricsP2.anomaliesDetected++;
            }
          } else {
            metricsP2.errors++;
          }
        }),
      );
    }
  }

  await Promise.all(promises);

  console.log(`  -> Total peticiones concurrentes enviadas: ${metricsP2.totalSent}`);
  console.log(`  -> Aceptadas: ${metricsP2.accepted} / ${metricsP2.totalSent}`);
  console.log(`  -> Anomalías disparadas (esperado 0 porque cada usuario envió 2 peticiones <= 2): ${metricsP2.anomaliesDetected}`);

  // --------------------------------------------------------------------
  // RESUMEN DE MÉTRICAS Y SLO
  // --------------------------------------------------------------------
  const allLatencies = [...metricsP1.latencies, ...metricsP2.latencies].sort((a, b) => a - b);
  const p50 = allLatencies[Math.floor(allLatencies.length * 0.5)] || 0;
  const p95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;
  const p99 = allLatencies[Math.floor(allLatencies.length * 0.99)] || 0;
  const avgLatency = (allLatencies.reduce((a, b) => a + b, 0) / (allLatencies.length || 1)).toFixed(2);

  console.log('\n======================================================================');
  console.log('📊 REPORTE DE MÉTRICAS Y OBSERVABILIDAD (A6.3 - A6.5)');
  console.log('======================================================================');
  console.log(`  - Total transacciones enviadas:   ${metricsP1.totalSent + metricsP2.totalSent}`);
  console.log(`  - Aceptadas por el endpoint:       ${metricsP1.accepted + metricsP2.accepted}`);
  console.log(`  - Tasa de errores:                 ${metricsP1.errors + metricsP2.errors}`);
  console.log(`  - Latencia media:                  ${avgLatency} ms`);
  console.log(`  - Latencia p50:                    ${p50} ms`);
  console.log(`  - Latencia p95:                    ${p95} ms`);
  console.log(`  - Latencia p99:                    ${p99} ms`);
  console.log('======================================================================');
  console.log('🎉 SIMULACIÓN COMPLETADA EXITOSAMENTE');
  console.log('======================================================================\n');

  await app.close();
}

runBotSimulation().catch((err) => {
  console.error('Error durante la simulación del bot:', err);
  process.exit(1);
});
