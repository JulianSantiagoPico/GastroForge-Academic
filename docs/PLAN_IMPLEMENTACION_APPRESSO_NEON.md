# Plan de implementación: Appresso con PostgreSQL en Neon

Este plan guía a un agente para completar Appresso sobre PostgreSQL administrado por Neon. Parte de la API existente: la ingesta, HMAC, idempotencia, ventana deslizante, episodios, métricas y simulador ya están implementados. No se deben reconstruir.

## Resultado esperado

Appresso opera en producción con Neon como fuente durable de verdad y Redis como capa temporal compartida para la ventana deslizante. Aplica límites configurables por franja horaria, expone analítica apta para dashboard y permite medir carga de forma reproducible.

## Alcance de esta entrega

| Incluido | Fuera de alcance |
|---|---|
| Conexión segura a Neon y migraciones versionadas | Autenticación de usuarios finales |
| Regla de límites por franja en UTC | Cambios a `academic-analysis` o `structures` |
| Redis para estado temporal y control de presión sobre Neon | Bypass del limitador HTTP para pruebas |
| Consultas analíticas y series temporales | Reemplazar HMAC o el algoritmo de ventana existente |
| Dashboard web mínimo | Capturar IP sin política explícita de retención |
| Carga controlada, SLO y evidencia | Optimización prematura fuera de las métricas acordadas |

## Decisiones ya cerradas

- PostgreSQL es la fuente durable de verdad; el modo in-memory es sólo desarrollo o demostración local.
- La ventana usa `receivedAt` del servidor, en UTC, y no la fecha declarada por el cliente.
- El ancho de ventana es configurable; la franja, resuelta con `receivedAt` en UTC, determina el umbral de transacciones de esa misma ventana.
- Redis nunca reemplaza PostgreSQL: Neon conserva transacciones, idempotencia, episodios y auditoría; Redis conserva sólo estado temporal reconstruible.
- Un episodio `CLOSED` nunca se reabre.
- El valor monetario se expresa en unidades mínimas enteras.
- La concurrencia por usuario mantiene el orden `KeyedMutex` seguido de `pg_advisory_xact_lock`.

## Prerrequisitos de Neon y Redis

1. Crear un proyecto Neon y una base de datos exclusiva por entorno: desarrollo, staging y producción.
2. Guardar la cadena de conexión **pooled** de Neon como secreto `DATABASE_URL` del entorno correspondiente. Debe incluir TLS, por ejemplo `sslmode=require`.
3. Mantener la cadena **directa** separada, por ejemplo `DATABASE_URL_DIRECT`, sólo para migraciones si Neon o el runner de migraciones lo requieren. No exponerla al proceso web si la pooled es suficiente.
4. Añadir a `.env.example` únicamente nombres y ejemplos no funcionales; nunca credenciales, host real ni URL de Neon.
5. Configurar en Render/producción `NODE_ENV=production`, `DATABASE_URL` y, si aplica, `DB_SSL=true`.
6. Crear un Redis administrado por entorno y guardar su URL TLS como secreto `REDIS_URL`. El proceso no debe arrancar en modo Redis en producción sin esa configuración.
7. Definir tiempos de conexión y comando, umbral de apertura de circuit breaker y tiempo de recuperación como variables de entorno validadas al arrancar.

> La implementación actual ya habilita SSL cuando detecta `sslmode=require` o `DB_SSL=true`. El agente debe conservar esa compatibilidad y comprobar la conexión real con Neon y Redis de staging antes del despliegue.

## Orden de implementación

### W1 — Migraciones y operación segura con Neon

**Objetivo:** eliminar la dependencia de `synchronize` para evolucionar el esquema en producción.

**Archivos previstos**

- `src/app.module.ts`
- `src/modules/appresso/persistence/entities/*.ts`
- `src/migrations/*` (nuevo)
- `ormconfig` o `typeorm` DataSource dedicado (nuevo, según la convención elegida)
- `package.json`
- `.env.example`
- `README.md` o `docs/decisiones.md`

**Tareas**

- [x] Crear una configuración TypeORM reutilizable por aplicación y CLI de migraciones.
- [x] Añadir scripts explícitos para generar, ejecutar y revertir migraciones; el script de producción debe ejecutar sólo migraciones pendientes.
- [x] Generar una migración inicial que represente exactamente las tablas actuales `appresso_transactions` y `appresso_anomaly_episodes`, sus índices y restricciones.
- [x] Desactivar `synchronize` en producción de forma inequívoca. No depender de sincronización automática para crear o modificar tablas de Neon.
- [x] Documentar variables de conexión pooled/directa, TLS y procedimiento de rollback.
- [x] Verificar que el arranque falla de forma visible si producción no tiene `DATABASE_URL`; no debe caer silenciosamente a memoria en producción.

**Criterios de aceptación**

- Una base Neon vacía llega al esquema esperado ejecutando migraciones.
- Una segunda ejecución no altera el esquema ni falla.
- La aplicación se conecta mediante TLS y conserva ingestión, idempotencia y advisory lock.
- No hay secretos en Git, logs ni respuestas HTTP.

### W2 — Política de límites por franja horaria

**Objetivo:** implementar la parte pendiente del enunciado sin contaminar el detector puro de ventana.

**Contrato cerrado**

La ventana temporal conserva un ancho configurable común. La franja horaria selecciona el **umbral** que se aplica al conteo de la transacción actual: mañana `10`, tarde-noche `6` y noche-madrugada `3`. La anomalía sigue siendo `POSIBLE_FRAUDE`; no se crean dos detectores ni dos episodios para la misma regla.

**Archivos previstos**

- `src/modules/appresso/fraud-detection/time-band-policy.ts` (nuevo)
- `src/modules/appresso/fraud-detection/time-band-policy.spec.ts` (nuevo)
- `src/modules/appresso/transactions/transactions.service.ts`
- `src/modules/appresso/anomalies/*`
- entidades y una nueva migración, sólo si se requiere persistir la regla/tipo adicional

**Tareas**

- [x] Implementar una política pura que reciba `receivedAt` y devuelva franja y límite en UTC:
  - mañana: 05:00:01–12:00:00, límite 10;
  - tarde-noche: 12:00:01–20:00:00, límite 6;
  - noche-madrugada: 20:00:01–05:00:00, límite 3.
- [x] Cargar `APPRESSO_WINDOW_MS` y las franjas/umbrales desde configuración validada al iniciar. Usar valores por defecto académicos, pero no constantes rígidas en el caso de uso.
- [x] Validar que las franjas cubran exactamente las 24 horas, no se solapen y tengan umbrales enteros positivos.
- [x] Definir y probar todos los bordes de segundo, incluido el cruce de medianoche.
- [x] Componer la política en el caso de uso de ingestión, no en `sliding-window.ts`.
- [x] Definir y probar el borde de franja: la franja de `receivedAt` del evento actual determina su umbral, aunque la ventana contenga eventos recibidos segundos antes en otra franja.
- [x] Añadir tests de aislamiento por usuario e idempotencia ante reintento para cada franja.

**Criterios de aceptación**

- Las fronteras horarias son deterministas e independientes de la zona horaria del host.
- Una transacción duplicada no altera ningún conteo ni crea episodios adicionales.
- La respuesta y la anomalía persisten la franja, el umbral y el ancho de ventana efectivos para auditoría.

### W3 — Redis como capa temporal de la ventana

**Objetivo:** disminuir consultas de conteo a Neon y compartir el estado temporal entre réplicas, sin mover la verdad durable fuera de PostgreSQL.

**Archivos previstos**

- `src/modules/appresso/redis/*` (nuevo adapter, cliente, script y pruebas)
- `src/modules/appresso/fraud-detection/*`
- `src/modules/appresso/transactions/transactions.service.ts`
- `src/modules/appresso/appresso.module.ts`
- `src/modules/appresso/metrics/appresso-metrics.service.ts`
- `package.json`, `.env.example` y documentación de operación

**Tareas**

- [x] Añadir un cliente Redis con TLS, timeout corto y reconexión acotada; no crear clientes por petición.
- [x] Definir una interfaz pequeña para el estado de ventana por usuario, con adapter Redis y adapter PostgreSQL de respaldo.
- [x] Implementar un script Lua atómico por usuario: purgar eventos con `receivedAt < now - windowMs`, insertar el `idTxn` sólo una vez, contar los vigentes y establecer expiración de la clave inactiva. El evento exactamente en `now - windowMs` debe permanecer.
- [x] Mantener PostgreSQL como autoridad de idempotencia. Una repetición devuelve el resultado durable anterior y no vuelve a modificar Redis ni el conteo.
- [x] Definir y probar la matriz de fallos PostgreSQL/Redis antes de integrar: nunca confirmar una anomalía sólo en Redis, ni devolver una detección que no se pueda recuperar desde Neon.
- [x] Después de persistir la transacción de forma durable, actualizar Redis como estado temporal. Ante fallo de Redis, calcular la ventana desde Neon con la consulta acotada `userId` + `receivedAt >= now - windowMs` y registrar la degradación.
- [x] Resolver la brecha entre el commit PostgreSQL y la actualización Redis mediante un registro durable de sincronización o un outbox transaccional. Antes de usar una ventana Redis, drenar/reconstruir los eventos activos pendientes de ese usuario.
- [x] Implementar circuit breaker y métricas: `redis.degraded`, `redis.circuit_open`, errores, latencia y reconstrucciones.
- [x] Al recuperar Redis, reconstruir sólo eventos activos de PostgreSQL; nunca leer el historial completo.
- [x] Mantener throttling, validación, límite de concurrencia y pool PostgreSQL: Redis reduce presión, pero no sustituye estas defensas de la API.

**Criterios de aceptación**

- Redis permite el conteo compartido entre réplicas sin duplicar `idTxn`.
- Una caída de Redis deja la ingesta funcional mediante Neon y es visible en métricas y reporte.
- La recuperación no produce conteos inflados, anomalías duplicadas ni reconstrucción histórica.
- Las pruebas cubren borde inclusivo, concurrencia por usuario, caída y recuperación.

### W4 — Read model analítico para el dashboard

**Objetivo:** exponer datos agregados desde PostgreSQL, sin recorrer el historial completo en memoria por petición.

**Archivos previstos**

- `src/modules/appresso/analytics/*` (nuevo módulo, controller, service, DTOs y tests)
- `src/modules/appresso/persistence/entities/*` y migración de índices, si el plan de consulta lo exige
- `src/modules/appresso/appresso.module.ts`

**Contrato mínimo de lectura**

- `GET /api/v1/appresso/analytics/overview?from=&to=`
- `GET /api/v1/appresso/analytics/timeseries?from=&to=&bucket=hour|day`
- `GET /api/v1/appresso/analytics/anomalies/:id/timeline`

**Tareas**

- [x] Definir DTOs con intervalo UTC explícito, límites máximos y validación de `bucket`.
- [x] Implementar overview con: transacciones por día/semana/mes, anomalías nuevas/abiertas/revisadas/descartadas, porcentaje sospechoso, usuarios afectados, usuarios recurrentes, valor sospechoso y promedio por usuario.
- [x] Implementar serie temporal de actividad y anomalías por hora/día, agrupada en SQL.
- [x] Implementar línea de tiempo de episodio a partir de `openedAt`, actualizaciones, cierre y transacciones asociadas.
- [x] Crear los índices necesarios según `EXPLAIN ANALYZE` sobre una muestra representativa; incluirlos en una migración.
- [x] Mantener `AppressoMetricsService` para telemetría de proceso, pero no usarlo como fuente de históricos del dashboard.

**Nota sobre usuarios e IP**

El enunciado conceptual incluye `usuarios` e IP, pero la API actual sólo persiste `userId`. Crear una tabla `usuarios` únicamente si se necesita perfil/estado/auditoría propia; para los agregados iniciales se puede derivar recurrencia desde `appresso_transactions.userId`. La IP debe capturarse sólo con justificación académica, política de retención y minimización de PII; no añadirla como dato ornamental.

**Criterios de aceptación**

- Los endpoints responden correctamente en Neon con rangos vacíos, límites y paginación.
- Las agregaciones coinciden con fixtures conocidos.
- No hay `Array.filter`/`reduce` sobre el histórico completo para consultas PostgreSQL.

### W5 — Dashboard mínimo

**Objetivo:** visualizar los datos ya expuestos sin duplicar reglas de negocio en el cliente.

**Decisión técnica previa**

El repositorio no contiene frontend. Antes de escribir UI, elegir el stack compatible con el despliegue: una aplicación separada (por ejemplo Vite/React) o una UI estática servida por NestJS. Preferir aplicación separada si se espera evolución; una UI estática reduce infraestructura pero limita crecimiento.

**Tareas**

- [x] Crear el frontend elegido y configurar `APPRESSO_API_BASE_URL` como variable de entorno pública sin secretos.
- [x] Mostrar tarjetas para períodos, anomalías por estado, porcentaje sospechoso, usuarios afectados y valor sospechoso.
- [x] Añadir gráficas de evolución temporal, distribución por hora, métodos de pago y anomalías por regla/nivel.
- [x] Añadir listado filtrable y paginado de episodios, más la línea de tiempo de un episodio.
- [x] Estados de carga, vacío y error; nunca inferir resultados cuando la API falla.
- [x] Pruebas de los adaptadores HTTP y de los estados críticos de pantalla.

**Criterios de aceptación**

- El dashboard sólo consume contratos analíticos documentados.
- No incluye secretos Neon ni lógica de detección.
- Un episodio puede rastrearse desde la tarjeta agregada hasta su línea de tiempo.

### W6 — Prueba de carga y salida a producción

**Objetivo:** obtener evidencia reproducible antes de declarar capacidad.

**Archivos previstos**

- `scripts/simulate-bot-load.ts`
- `reports/` (salidas ignoradas por Git salvo una evidencia intencional)
- documentación de operación

**Tareas**

- [x] Añadir control de RPS objetivo, además de concurrencia y RPS efectivo.
- [x] Ejecutar perfiles separados: un único usuario, muchos usuarios y distribución por franjas.
- [x] Usar namespace/identificadores únicos por corrida y registrar base, versión, configuración de throttling y proveedor Neon.
- [x] Acordar SLO antes de ejecutar: p95/p99 máximo, tasa máxima de 5xx y condición de parada.
- [x] Identificar el primer escalón que viola el SLO y diferenciar `throttler`, validación, HMAC, endpoint y DB.
- [x] Verificar después de cada corrida que no hay duplicados ni episodios inconsistentes.

**Criterios de aceptación**

- Cada corrida produce un JSON comparable y sin datos sensibles.
- El informe identifica configuración, escalón fallido y causa observable; no atribuye el límite al detector sin evidencia.

## Secuencia de commits sugerida

1. `chore(appresso): add Neon migration workflow`
2. `feat(appresso): add configurable time-band thresholds`
3. `feat(appresso): add Redis sliding-window adapter`
4. `feat(appresso): add durable analytics read model`
5. `feat(appresso): add fraud analytics dashboard`
6. `test(appresso): add controlled Neon and Redis load profiles`

Cada unidad debe incluir sus pruebas y documentación. No crear PR, hacer push ni usar credenciales remotas sin autorización explícita.

## Verificación obligatoria por unidad

```powershell
npx jest --maxWorkers=1
npm run build
```

Para W1, W3 y W6, ejecutar además las migraciones, la verificación de degradación Redis y el simulador contra Neon/Redis de staging autorizados. La conexión remota, sus credenciales y el despliegue requieren autorización explícita antes de usarse.

## Estado de cierre

- [x] Neon configurado por entorno y migraciones aplicadas.
- [x] Franjas horarias implementadas y testeadas.
- [x] Redis configurado como estado temporal, con degradación y recuperación verificadas.
- [x] Analítica durable y series temporales disponibles.
- [x] Dashboard mínimo operativo.
- [x] Carga controlada con SLO y reporte reproducible.

