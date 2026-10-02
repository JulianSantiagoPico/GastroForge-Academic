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
| T1 | C1.0 — Decisión A1.0 (PostgreSQL + fallback in-memory) en `docs/decisiones.md` | [ ] |
| T2 | C2.0 / C2.1 — Zona horaria `UTC`, base temporal `receivedAt`, franjas desacopladas y postergadas a Ola 2 | [ ] |
| T3 | C3.0 / C3.1 / C3.2 — Guard dedicado de Appresso, cabecera de traza y origen de rechazos | [ ] |
| T4 | C5.0 / C5.1 / C5.2 — Clave de advisory lock estable + mutex por usuario en memoria | [ ] |
| T5 | C6.0 / C6.1 — Cierre de episodios expirados en ingestión y en lectura | [ ] |
| T6 | C7.0 / C7.1 — `value` entero en centavos, decimales rechazados | [ ] |
| T7 | C8.0 / C8.1 / C8.2 — `201` nueva, `200` reintento, `401` firma, `400` validación | [ ] |
| T8 | C4.0 / C4.1 — Métricas mínimo viable y reporte JSON por escalón | [ ] |
| T9 | C9.0 / C9.1 — Tests de concurrencia del mismo usuario y aislamiento entre usuarios | [ ] |
| T10 | C10.0 / C10.1 — Nota de degradación y reconstrucción acotada para Ola 2 | [ ] |

## Desviaciones respecto del plan (con motivo)

1. **C7.0 no usa `Math.trunc`.** El plan sugiere `@Transform(({value}) => Math.trunc(Number(value)))`. Truncar un importe monetario convierte un payload defectuoso en un importeaccepted más bajo: se pierde dinero en silencio y el `hash` firmado dejaría de corresponder al valor persistido. Se mantiene el rechazo explícito (`400`) de decimales vía `@IsInt` + `@Type(() => Number)`, que es lo que el criterio de aceptación del propio plan exige.
2. **C6.0 se implementa en dos lugares, no invocando `checkAndCloseExpired` desde `AnomaliesService`.** `AnomalyEpisodeManager` es una instancia en memoria propiedad de `TransactionsService`; `AnomaliesService` consulta el repositorio. Invocarlo desde el servicio de lectura cerraría una instancia distinta y no tocaría la base de datos. Se implementa cierre en el repositorio (misma semántica estricta `>` y `closedAt = now`) y, además, se invoca `checkAndCloseExpired` en el camino de ingestión, que es donde está el defecto real.
3. **C3.1 no habilita skip automático.** La cabecera `x-appresso-test` es de traza únicamente, exactamente como recomienda la redacción principal del plan.

## Criterios de aceptación

- [ ] `npx jest --maxWorkers=1` → 34 tests preexistentes siguen pasando + los nuevos de T9.
- [ ] `npm run build` sin errores.
- [ ] `npm run test:bot` corre y su reporte JSON separa `throttler` / `endpoint` / `validation` / `hmac`.
- [ ] Bordes inclusivo/exclusivo, idempotencia por `idTxn`, no reapertura de `CLOSED` y HMAC canónico siguen correctos.
- [ ] Decisiones A1.0 y A1.2b registradas de forma trazable.

## Checks aplicables

```
npx jest --maxWorkers=1
npm run build
npm run test:bot
```

## Progreso

_(se actualiza al cerrar cada tarea)_

## Próximo paso

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10, en ese orden (el orden del plan).