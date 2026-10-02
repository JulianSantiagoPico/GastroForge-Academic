# Persistencia de Appresso — decisión vigente y requisitos de Ola 2

Este directorio contiene la persistencia de Appresso. Este documento deja constancia de la decisión vigente y, sobre todo, de los requisitos que **aún no están implementados** y que no deben perderse al llegar a la Ola 2.

## Decisión vigente

El módulo usa **PostgreSQL durable con fallback automático a in-memory** (A1.0, Opción B). La elección se hace en el arranque según exista o no `DATABASE_URL`. La justificación completa está en `docs/decisiones.md`, sección 8.

## Cómo está serializada la concurrencia por usuario

| Mecanismo | Cubre | Dónde |
|---|---|---|
| `pg_advisory_xact_lock` con clave SHA-256 estable del `userId` | Varias réplicas del servicio | `advisory-lock.ts`, tomado dentro de la transacción de ingesta |
| `KeyedMutex` (cadena de promesas por clave) | Modo in-memory, un solo proceso | `transactions/user-mutex.ts` |

El orden es siempre mutex y luego advisory lock, en todas las réplicas, de modo que no existe camino de deadlock por orden inverso. Con PostgreSQL configurado, un fallo al tomar el advisory lock **se propaga**: es preferible fallar de forma explícita a procesar sin serializar y perder un cruce de umbral en silencio.

## Riesgo asumido en el modo in-memory

El estado **no se comparte entre réplicas** y se pierde al reiniciar el proceso. Es un modo de desarrollo y demostración. Además:

- El `InMemoryEntityManager` implementa solo el subconjunto del API de repositorio que usa el módulo. `createQueryBuilder` **ignora los filtros** y devuelve la lista completa, por lo que el listado paginado no filtra en memoria.
- El limitador dedicado (`AppressoThrottlerGuard`) cuenta por proceso: con varias réplicas el límite efectivo se multiplica por el número de instancias.

Ninguna de estas limitaciones es admisible para una medición de capacidad: por eso el reporte de carga debe anotar si corrió con `DATABASE_URL` presente o ausente.

## Requisitos de Ola 2 —Redis (A4)

Estos requisitos están **cerrados como diseño y no implementados**. Deben cumplirse cuando se añada el adaptador Redis; el motivo es que la evidencia de sustentación depende de ellos.

### 1. Degradación explícita, observable y acotada

Si Redis no está disponible, el servicio debe:

1. **Degradar de forma explícita**, nunca fallar en silencio. Un circuit breaker con umbral de errores y tiempo de recuperación evita que cada petición espere el timeout de Redis.
2. **Emitir un evento observable**: un contador (`redis.degraded`, `redis.circuit_open`) y un log estructurado. Una degradación invisible es indistinguible de "todo bien" en el reporte.
3. **Seguir aceptando transacciones**. La fuente de verdad de la durability es PostgreSQL, no Redis.

### 2. Reconstrucción acotada a la ventana activa

Al recuperar de una caída de Redis, el estado de ventanas se reconstruye **solo desde PostgreSQL y acotado a la ventana activa**:

```
receivedAt >= now - W        (W = 3000 ms)
```

Nunca se reconstruye el historial completo. El motivo es concreto: el detector es una cola FIFO de eventos vigentes, y cargar transacciones antiguas produciría conteos inflados y falsos positivos en el primer cruce de umbral tras la recuperación. El coste de la reconstrucción es además proporcional a la ventana, no al histórico.

### 3. Atomicidad entre Redis y PostgreSQL

PostgreSQL y Redis no comparten una transacción. La idempotencia por `idTxn` es el mecanismo que hace tolerable esa falta de atomicidad: una reconstrucción que reprocesa un `idTxn` ya conocido debe devolver el resultado persistido, no contarlo dos veces.

### 4. Límite del limitador en réplicas

El conteo del limitador dedicado pasa a ser por proceso. Con Redis disponible, el contador debe pasar a un almacén compartido, o el límite efectivo debe documentarse como "por réplica".