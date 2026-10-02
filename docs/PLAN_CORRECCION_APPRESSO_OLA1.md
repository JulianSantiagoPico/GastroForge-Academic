# Plan de corrección — Ola 1 (Appresso)

El objetivo es cerrar las ambigüedades detectadas sin romper los tests actuales (34/34). Se prioriza lo necesario para la carga controlada (A1.4, A1.5, A3.5) y se deja documentado lo que queda postergado para Ola 2.

## 1. A1.0 — Documentar decisión arquitectónica (P0)

**Motivo:** La implementación eligió PostgreSQL + fallback in-memory (Opción B+A), pero no queda registrada la decisión frente al diseño original in-memory y determinista de `docs/decisiones.md`.

### Tareas

- [ ] **C1.0** Añadir una entrada explícita de decisión en `docs/decisiones.md` que registre:
  - Decisión tomada: **Opción B (PostgreSQL durable) con fallback automático a in-memory** cuando `DATABASE_URL` no está definido.
  - Justificación: necesidad de durabilidad, idempotencia y concurrencia bajo carga controlada del bot (frente a la filosofía original de solo-in-memory para análisis determinista).
  - Alcance: Ola 1 implementada con este enfoque híbrido. Redis (Opción comparativa) queda para Ola 2.
  - Consecuencias: se añade I/O (con posibilidad de fallback local), se mantiene la capacidad de testeo determinista sin BD externa.
  - Riesgo aceptado: no se comparte estado entre réplicas en modo in-memory (documentado).

**Archivos afectados:** `docs/decisiones.md`

**Criterio de aceptación:** Existe una entrada clara, trazable y legible que explica por qué se desvió del criterio "in-memory y determinista" original.

## 2. A1.2b — Franjas horarias, base temporal y zona horaria (P0)

**Motivo:** El plan deja pendiente cerrar zona horaria fija, base temporal (`receivedAt`), precedencia entre reglas y alcance de franjas (mañana/tarde-noche/noche-madrugada).

### Tareas

- [ ] **C2.0** Documentar en el código (comentario JSDoc) y/o en `docs/PLAN_DESARROLLO_APPRESSO.md` (anexo de correcciones):
  - **Zona horaria fija:** `UTC` (recomendado para reproducibilidad entre entornos/local/staging). Justificar elección.
  - **Base temporal autoritativa:** `receivedAt` (timestamp ms del servidor). La pertenencia a franjas NO se determina por `date` (campo de negocio).
  - **Precedencia:** las reglas de franjas horarias y la ventana deslizante (`count >= threshold` en `W`) permanecen **desacopladas**. No mezclar su implementación en el algoritmo puro (`sliding-window.ts`).
  - **Alcance:** Las franjas horarias **se postergan a Ola 2**. El detector actual solo implementa ventana deslizante genérica. Esto debe quedar explícito para evitar ambigüedad.
- [ ] **C2.1** Añadir comentario en `SlidingWindowDetector` que deje constancia de esta separación (no acoplar franjas al núcleo puro).

**Archivos afectados:** `src/modules/appresso/fraud-detection/sliding-window.ts`, `docs/PLAN_DESARROLLO_APPRESSO.md`

**Criterio de aceptación:** Decisión cerrada, registrada y sin código nuevo innecesario. Tests siguen pasando.

## 3. A1.4 — Aislar ThrottlerGuard y distinguir origen de rechazos (P0)

**Motivo:** El `ThrottlerGuard` global (120/60) puede rechazar peticiones del bot antes de que el endpoint procese y contamine la medición de capacidad del detector (A1.4/A1.5).

### Tareas

- [ ] **C3.0** Aplicar protección de throttling **solo al controlador de Appresso** (evitar elevar el límite global).
  - Opción recomendada: quitar o no depender del guard global para `/api/v1/appresso/*` y aplicar `@UseGuards(ThrottlerGuard)` con configuración específica en `AppressoController` (o un guard dedicado con límites acordados con A1.3). Mantener el guard global para `academic-analysis` y `structures`.
- [ ] **C3.1** Añadir cabecera opcional para aislar trazas de prueba: permitir `x-appresso-test: true` (o token autenticado acordado) para facilitar el análisis de origen de rechazo, **sin habilitar skip automático**. Si se opta por skip, debe estar explícitamente documentado, acotado al entorno de prueba y nunca habilitado en producción.
- [ ] **C3.2** Instrumentar origen de rechazo: añadir interceptor/middleware ligero para registrar `throttler_rejected: true/false` y `endpoint: 'appresso.transactions'` en respuestas 429/errores relacionados. Debe permitir distinguir **rechazos originados en ThrottlerGuard** vs **procesados por el endpoint Appresso** (requisito A1.5/A6.3).

**Archivos afectados:** `src/modules/appresso/transactions/transactions.controller.ts`, `src/modules/appresso/appresso.module.ts`, `src/app.module.ts` (revisar configuración global de Throttler).

**Criterio de aceptación:** Durante carga controlada es posible separar origen de 429s en métricas/logs. No se degrada protección del resto de módulos.

## 4. A1.5 — Métricas mínimas para medición reproducible (P1)

**Motivo:** Falta registrar RPS/latencias/origen de rechazos para no atribuir al detector lo que corresponde al limitador.

### Tareas

- [ ] **C4.0** Añadir métricas mínimas (mínimo viable, sin Prometheus obligatorio):
  - Por escalón de carga: `requests_sent`, `requests_accepted`, `requests_rejected_total`, desglosado por `reject_origin` = `throttler` | `endpoint` | `validation` | `hmac`.
  - Latencias: `latency_ms.p50`, `p95`, `p99` (por endpoint `appresso.transactions`).
  - Errores: `http_4xx`, `http_5xx`, `error_rate` por origen.
  - Persistencia/infra: `db_queries`/`db_latency_ms.p95` (opcional pero útil) y `transactions_processed`, `anomalies_created`, `anomalies_updated`.
- [ ] **C4.1** Exponer estas métricas de forma estructurada (logs JSON por corrida) en el script `scripts/simulate-bot-load.ts` (o añadir helper `metrics.ts`). El reporte por escalón (A6.3) debe **obligatoriamente** separar rechazos `ThrottlerGuard` de los procesados por el endpoint Appresso.

**Archivos afectados:** `scripts/simulate-bot-load.ts`, `src/modules/appresso/transactions/transactions.service.ts` (emitir contadores), `src/common/metrics` (crear opcional si no existe).

**Criterio de aceptación:** Cada corrida del bot genera métricas separadas por origen de rechazo, suficientes para identificar cuello de botella sin contaminar la medición del detector.

## 5. A3.5 — Serialización por usuario (Advisory Lock + Mutex) (P0)

**Motivo:** Bajo POST simultáneos del mismo usuario existe riesgo de perder el evento que alcanza el umbral. El plan pide advisory lock por clave de usuario (PostgreSQL) o aislamiento equivalente; en memoria falta sincronización por usuario.

### Tareas

- [ ] **C5.0 (PostgreSQL)** Implementar `pg_advisory_xact_lock` por usuario **dentro de la transacción** utilizada para insertar/procesar la transacción y evaluar ventana+anomalía. Usar hash estable del `userId` (entero no negativo) para evitar colisión entre nombres largos.
  - Sugerencia: `const h = crypto.createHash('sha256').update(userId).digest(); const lockKey = h.readUInt32BE(0);` o usar módulo 2^31 para evitar signo. Ejecutar `SELECT pg_advisory_xact_lock($1)` con `queryRunner.query` antes de leer/escribir estado crítico del usuario.
  - Aplicar **únicamente** al procesamiento por usuario (no bloquea usuarios distintos). Justificar en comentario.
- [ ] **C5.1 (In-memory fallback)** Añadir sincronización por usuario cuando no hay `DATABASE_URL`. Usar `Map<string, AsyncMutex>` (o `Mutex` por clave) para serializar `processEvent`/ingestión del mismo `userId`, evitando carreras entre llamadas concurrentes en el mismo proceso. Liberar siempre en `finally`.
- [ ] **C5.2** Documentar brevemente el mecanismo elegido (advisory xact lock + mutex por usuario) en `TransactionsService` (comentario JSDoc).

**Archivos afectados:** `src/modules/appresso/transactions/transactions.service.ts`, `src/modules/appresso/persistence/in-memory-entity-manager.ts` (si requiere ajuste menor).

**Criterio de aceptación:** No se pierde el cruce de umbral bajo concurrencia del mismo usuario. Usuarios distintos no comparten bloqueo innecesario.

## 6. Cierre periódico de episodios de anomalía (P1)

**Motivo:** `AnomalyEpisodeManager.checkAndCloseExpired(now)` existe pero no se invoca en ningún punto de consulta/procesamiento. Los episodios `OPEN` pueden permanecer sin cerrarse hasta que se llame explícitamente.

### Tareas

- [ ] **C6.0** Invocar `checkAndCloseExpired(now)` **antes** de devolver listados/consultas de anomalías (mínimo): en `AnomaliesService.getAllEpisodes()`, `getEpisodesByUser()`, `getEpisodeById()` (o al menos en endpoints de consulta). Alternativa: invocarlo también tras procesar transacciones (no obligatorio).
- [ ] **C6.1** Mantener la semántica: condición `now - episode.updatedAt > windowMs` (estricta `>`), `closedAt = now` (momento de cierre de la comprobación). No modifica la regla “un episodio `CLOSED` nunca se reabre”.

**Archivos afectados:** `src/modules/appresso/anomalies/anomalies.service.ts`

**Criterio de aceptación:** Los estados `CLOSED` se actualizan de forma oportuna al consultar, sin cambiar comportamiento de creación/actualización de episodios.

## 7. Garantías de valor monetario (entero en centavos) (P1)

**Motivo:** A1.1 exige convertir `value` a entero (centavos) antes de firmar y persistir. El DTO no fuerza `@IsInt()` ni transformación explícita.

### Tareas

- [ ] **C7.0** En `CreateTransactionDto.value` añadir validación y transformación:
  - `@IsInt({ message: 'value debe ser entero en unidades mínimas (centavos)' })`
  - `@Transform(({ value }) => Math.trunc(Number(value)))` (o equivalente con class-transformer) para asegurar entero antes de validación/persistencia.
- [ ] **C7.1** Añadir breve comentario en DTO/HMAC indicando que `value` se trata como **entero en centavos** (nunca float). Verificar que HMAC firma ese valor numérico entero resultante.

**Archivos afectados:** `src/modules/appresso/dto/create-transaction.dto.ts`, `src/modules/appresso/crypto/hmac.ts` (comentario aclaratorio opcional).

**Criterio de aceptación:** Se rechazan decimales explícitamente y se asegura representación entera coherente entre DTO, HMAC y entidad. Tests existentes siguen válidos (usan enteros).

## 8. Contrato HTTP explícito (códigos de respuesta) (P1)

**Motivo:** A3.6 pide definir código HTTP para registro nuevo, duplicado, firma inválida y anomalía (transacción aceptada).

### Tareas

- [ ] **C8.0** En `TransactionsController` definir códigos explícitos:
  - **Transacción nueva** (no existía `idTxn`): `@HttpCode(201)` (Created) o mantener 200 si se prefiere coherencia API; documentado en Swagger. Recomendado **201 Created**.
  - **Reintento/duplicado** (`idTxn` existente, devuelve resultado persistido): **200 OK** (idempotente, no crea recurso nuevo). No usar 409.
- [ ] **C8.1** Mapear errores con códigos claros: firma inválida/HMAC incorrecto -> **401 Unauthorized** (o 403 Forbidden) según contrato; validación DTO -> **400 Bad Request** (ya cubierto por ValidationPipe). Añadir descripciones en `@ApiResponse` (Swagger).
- [ ] **C8.2** Documentar en comentario del contrato que el reintento **no recalcula ni vuelve a contar en la ventana** (ya implementado) y que devuelve el resultado previamente persistido.

**Archivos afectados:** `src/modules/appresso/transactions/transactions.controller.ts`

**Criterio de aceptación:** Contrato HTTP explícito, visible en Swagger y coherente con idempotencia.

## 9. Tests de integración — concurrencia del mismo usuario (P1)

**Motivo:** A3.6 pide test explícito de peticiones simultáneas del mismo usuario validando cruce de umbral y sin duplicados.

### Tareas

- [ ] **C9.0** Añadir test en `transactions.service.spec.ts` (o controller) con `Promise.all`:
  - 3-4 llamadas simultáneas con `receivedAt` muy próximos (mismo o ms consecutivos), mismo `userId`, `idTxn` distintos.
  - Verificar que exactamente 3 generan conteo >= umbral (o el cruce esperado), no hay duplicados contados, y reintento posterior con `idTxn` existente devuelve `isDuplicate`/resultado persistido (sin incrementar contador).
- [ ] **C9.1** Añadir caso de concurrencia que fuerza actualización de episodio OPEN (no crea 3 episodios distintos) cuando el umbral se cruza simultáneamente.

**Archivos afectados:** `src/modules/appresso/transactions/transactions.service.spec.ts`, opcional `transactions.controller.spec.ts`

**Criterio de aceptación:** Test pasa y valida serialización/idempotencia bajo concurrencia. No rompe tests existentes.

## 10. Degradación/reconstrucción acotada (P2 — Mejora operativa)

**Motivo:** El plan exige, ante pérdida/caída de Redis, degradación explícita, observable y **reconstrucción acotada** (`receivedAt >= now - W`) desde PostgreSQL. Hoy solo existe fallback in-memory (sin Redis implementado aún). Conviene dejar esto preparado/documentado para Ola 2.

### Tareas

- [ ] **C10.0** Documentar en código/comentarios (cuando se añada adapter Redis en A4): estrategia de degradación con circuit breaker, evento de degradación en métricas/logs y reconstrucción **acotada a ventana activa** (`now - W <= receivedAt`) — nunca reconstruir historial completo.
- [ ] **C10.1** Añadir nota en `persistence/` sobre este requisito para no perderlo al implementar Fase 4.

**Archivos afectados:** `src/modules/appresso/redis/` (comentarios guía), `docs/PLAN_DESARROLLO_APPRESSO.md`

**Criterio de aceptación:** Requisito trazable para Ola 2, sin cambios funcionales en Ola 1.

## Orden de ejecución recomendado

1. **C1.0**, **C2.0** (documentación/base contrato) — sin riesgo
2. **C3.0–C3.2** (throttler + origen rechazos) — afecta medición carga
3. **C5.0–C5.2** (advisory lock + mutex) — crítico concurrencia
4. **C6.0–C6.1** (cierre episodios)
5. **C7.0–C7.1** (value entero)
6. **C8.0–C8.2** (códigos HTTP)
7. **C4.0–C4.1** (métricas) — complementa 3
8. **C9.0–C9.1** (tests concurrencia)
9. **C10.0–C10.1** (preparación Ola 2)

## Criterio de validación final

- [ ] Todos los tests existentes siguen pasando: `npx jest --maxWorkers=1` → **34 passed, 6 suites** (sin regresiones).
- [ ] Build NestJS sin errores (`npm run build`).
- [ ] Verificación rápida de contrato: bordes inclusivo/exclusivo, idempotencia por `idTxn`, no reapertura de episodios `CLOSED` y HMAC canónico siguen correctos.
- [ ] Mediciones de carga distinguen rechazos `throttler` vs `endpoint` (verificable con script de bot).
- [ ] Decisiones A1.0 y A1.2b quedan explícitamente registradas.