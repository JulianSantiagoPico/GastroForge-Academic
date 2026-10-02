# Appresso — Ola 1: correcciones de contrato, concurrencia y observabilidad

Ejecuta `docs/PLAN_CORRECCION_APPRESSO_OLA1.md` (C1.0 – C10.1) sobre la rama `feature/appresso-fraud-detection`.

## Objetivo

Cerrar las ambigüedades de la Ola 1 sin regresión: 34 tests existentes siguen pasando, la concurrencia del mismo usuario no pierde cruces de umbral, los episodios `OPEN` se cierran oportunamente, el valor monetario es entero y el contrato HTTP es explícito y observable.

## Problema

El plan de desarrollo dejó decisiones abiertas (persistencia, zona horaria, franjas, aislamiento del limitador HTTP) y la primera corrida de Ola 1 las dejó implícitas en el código. Resultado: decisiones no trazables, una carrera real en el camino in-memory, episodios `OPEN` que nunca se cierran y una medición de carga donde un `429` del limitador global es indistinguible de una anomalía de negocio.

## Por qué

Sin estas correcciones el punto de quiebre atribuido al detector puede ser en realidad el `ThrottlerGuard` global, y la evidencia de sustentación no es reproducible ni auditable.

## Alcance autorizado

Solo `src/modules/appresso/**`, `scripts/simulate-bot-load.ts` y documentación (`docs/decisiones.md`, `docs/PLAN_DESARROLLO_APPRESSO.md`, `src/modules/appresso/persistence/README.md`). No se toca `academic-analysis` ni `structures` salvo el guard global, que debe seguir protegiéndolos.

Fuera de alcance (postergado a Ola 2): franjas horarias mañana/tarde-noche/noche-madrugada, adaptador Redis, dashboard.

## Restricciones

- TDD: no configurado en el proyecto (no hay `sdd-init` con `strict_tdd: true`). Se usan checks funcionales: `npx jest --maxWorkers=1` y `npm run build`.
- RDD: `on` (global). Riesgo base del árbol: `passive`. Revisar por work-unit commit.
- 400 líneas es heurística de planeo, no criterio de aceptación.

## Ruta de ejecución

Delegación por subagente **no disponible** en esta sesión: el proveedor responde `OpenCode's free tier can only be used from within OpenCode` al lanzar `explore`. Se ejecuta en línea (ruta directa) y queda registrado aquí para que el salto de delegación sea observable y no silencioso.

## Tareas

| ID | Tarea | Estado |
|---|---|---|
| T1 | C1.0 — Decisión A1.0 (PostgreSQL + fallback in-memory) en `docs/decisiones.md` | [x] `78f37d7` |
| T2 | C2.0 / C2.1 — Zona horaria `UTC`, base temporal `receivedAt`, franjas desacopladas y postergadas a Ola 2 | [x] `78f37d7` |
| T3 | C3.0 / C3.1 / C3.2 — Guard dedicado de Appresso, cabecera de traza y origen de rechazos | [x] |
| T4 | C5.0 / C5.1 / C5.2 — Clave de advisory lock estable + mutex por usuario en memoria | [x] |
| T5 | C6.0 / C6.1 — Cierre de episodios expirados en ingestión y en lectura | [x] |
| T6 | C7.0 / C7.1 — `value` entero en centavos, decimales rechazados | [x] |
| T7 | C8.0 / C8.1 / C8.2 — `201` nueva, `200` reintento, `401` firma, `400` validación | [x] |
| T8 | C4.0 / C4.1 — Métricas mínimo viable y reporte JSON por escalón | [x] |
| T9 | C9.0 / C9.1 — Tests de concurrencia del mismo usuario y aislamiento entre usuarios | [x] |
| T10 | C10.0 / C10.1 — Nota de degradación y reconstrucción acotada para Ola 2 | [x] `src/modules/appresso/persistence/README.md` |

## Desviaciones respecto del plan (con motivo)

1. **C7.0 no usa `Math.trunc`.** El plan sugiere `@Transform(({value}) => Math.trunc(Number(value)))`. Truncar un importe monetario convierte un payload defectuoso en un importeaccepted más bajo: se pierde dinero en silencio y el `hash` firmado dejaría de corresponder al valor persistido. Se mantiene el rechazo explícito (`400`) de decimales vía `@IsInt` + `@Type(() => Number)`, que es lo que el criterio de aceptación del propio plan exige.
2. **C6.0 se implementa en dos lugares, no invocando `checkAndCloseExpired` desde `AnomaliesService`.** `AnomalyEpisodeManager` es una instancia en memoria propiedad de `TransactionsService`; `AnomaliesService` consulta el repositorio. Invocarlo desde el servicio de lectura cerraría una instancia distinta y no tocaría la base de datos. Se implementa cierre en el repositorio (misma semántica estricta `>` y `closedAt = now`) y, además, se invoca `checkAndCloseExpired` en el camino de ingestión, que es donde está el defecto real.
3. **C3.1 no habilita skip automático.** La cabecera `x-appresso-test` es de traza únicamente, exactamente como recomienda la redacción principal del plan.

## Criterios de aceptación

- [x] `npx jest --maxWorkers=1` → **45 passed, 6 suites** (34 preexistentes + 11 nuevos).
- [x] `npm run build` sin errores.
- [x] `npm run test:bot` → 285/285 aceptadas, reporte JSON con `rejected_by_origin` por escalón.
- [x] Separación de origen verificada forzando `APPRESSO_THROTTLE_LIMIT=20`: **265 rechazos atribuidos a `throttler`, 0 a `endpoint`**.
- [x] Bordes inclusivo/exclusivo, idempotencia por `idTxn`, no reapertura de `CLOSED` y HMAC canónico siguen correctos.
- [x] Decisiones A1.0 y A1.2b registradas de forma trazable.

## Checks aplicables

```
npx jest --maxWorkers=1
npm run build
npm run test:bot
```

## Progreso

### Evidencia

- **T3** — El guard global (120/60 s) queda intacto para `academic-analysis`, `structures` y `health`. Appresso se exonera con `@SkipThrottle()` a nivel de clase y aplica `AppressoThrottlerGuard` con límites propios (`APPRESSO_THROTTLE_LIMIT` / `APPRESSO_THROTTLE_TTL`, por defecto 600/60 s). Toda respuesta lleva `x-appresso-reject-origin` y `x-appresso-throttler-rejected`. `x-appresso-test` solo produce eco: **no hay bypass por cabecera**.
- **T4** — `advisory-lock.ts` deriva la clave con SHA-256 (estable entre réplicas y versiones de PostgreSQL, a diferencia de `hashtext()`) y la reduce módulo $2^{31}-1$. Con PostgreSQL configurado, un fallo del advisory lock **se propaga**: se falla de forma explícita en lugar de procesar sin serializar. `KeyedMutex` serializa por `userId` en proceso.
- **T5** — El cierre perezoso ocurre en los dos caminos. En la ingesta se cierra el índice en memoria **y** la fila `OPEN` persistida, porque si solo se cerrara el primero la siguiente anomalía volvería a encontrar la fila antigua y arrastraría un único episodio indefinidamente. En la lectura, `AnomaliesService.closeExpiredEpisodes()` cierra antes de listar o resumir, con `>` estricto y `closedAt = now`.
- **T8** — `AppressoMetricsService` acumula contadores y percentiles con reservorio acotado; `GET /api/v1/appresso/metrics` los expone. El simulador escribe `reports/appresso-load-<ts>.json` con escalones, origen de rechazo, latencias y las métricas del servidor.

### Defectos encontrados y corregidos durante la ejecución

1. **Carrera en el camino in-memory (C5.1, elgap real de la Ola 1).** El advisory lock solo cubría PostgreSQL; en modo fallback no había serialización alguna.
2. **Episodio `OPEN` eterno (C6.0).** Sin `checkAndCloseExpired`, todas las anomalías futuras de un usuario actualizaban un único episodio para siempre, violando A1.2a. Confirmado en producción: la corrida completa creó **3 episodios y actualizó 276**; sin el cierre serían 1 y 284.
3. **Arranque roto en modo in-memory.** `AnomaliesService` usa `@InjectRepository`, pero sin `TypeOrmModule.forFeature` ese token no existía y el fallback in-memory no arrancaba. Se registra el token con el repositorio del gestor en memoria.
4. **Contrato HTTP ambiguo.** Todo devolvía `200`; ahora es `201` para recurso nuevo y `200` para reintento, con la tabla de contrato en el controlador y en Swagger.
5. **`getRepository` sin tipo de retorno explícito** rompía `npm run build` (TS2527).

### Decisión sobre TDD

El proyecto no tiene TDD estricto configurado (no existe `sdd-init` con `strict_tdd: true`), así que no se invocó. Los checks funcionales son `jest`, `build` y `test:bot`.

## Próximo paso

Entrega. Dos unidades de trabajo pendientes de commit. El PR es decisión del usuario; si se pide, el acumulado ronda las 400 líneas de código authored y conviene encadenar por T3-T7 y T8-T10.