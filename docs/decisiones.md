# Decisiones de Diseño y Arquitectura - GastroForge Academic

Este documento fundamenta las decisiones técnicas y metodológicas adoptadas en el desarrollo del módulo académico de análisis de complejidad algorítmica para la asignatura de **Programación Avanzada**. Estas decisiones constituyen la base conceptual para la sustentación del proyecto.

---

## 1. Datos simulados en memoria vs. Base de datos relacional (PostgreSQL)

- **Justificación:** El objetivo primordial del ejercicio es el análisis de complejidad computacional y el comportamiento asintótico de algoritmos sobre estructuras de datos. Introducir una base de datos relacional (como PostgreSQL y ORMs como Prisma) introduce factores externos incontrolables: latencia de red, tiempo de serialización I/O en disco, caché de la base de datos y optimizaciones internas del motor SQL.
- **Reproducibilidad:** Se implementó un Generador Congruencial Lineal (LCG) con semilla fija (`20260901`). Esto garantiza que cualquier ejecución con un tamaño `n` determinado genere exactamente los mismos pedidos con los mismos atributos, permitiendo al docente reproducir y verificar las mismas mediciones de operaciones en cualquier momento.
- **Seguridad:** Se evita la manipulación o exposición de información sensible real de restaurantes.

---

## 2. Conteo de operaciones elementales vs. Medición exclusiva de tiempo en milisegundos (`elapsedMs`)

- **Justificación:** Los milisegundos (`elapsedMs`) son una métrica complementaria, pero altamente volátil. Varían según la carga del CPU, fluctuaciones de rendimiento del contenedor en plataformas como Render, recolección de basura (*Garbage Collection*) del motor V8 y variaciones del sistema operativo anfitrión.
- **Validez Teórica:** El número de operaciones elementales ejecutadas (comparaciones de claves, asignaciones, pasos de recursión) es una métrica determinista, matemática e invariante frente a la máquina. Refleja fielmente la función de crecimiento $f(n)$ y confirma experimentalmente la clasificación Big O ($O(1)$, $O(n)$, $O(n^2)$, $O(\log n)$).

---

## 3. Límite de seguridad para la ejecución cuadrática $O(n^2)$ (`size <= 2000`)

- **Justificación:** El algoritmo de comparación de pares únicos ejecuta:
  $$\sum_{i=1}^{n-1} (n - i) = \frac{n(n - 1)}{2}$$
- **Impacto:**
  - Para $n = 2.000$, se ejecutan exactamente $1.999.000$ comparaciones, lo cual se resuelve en milisegundos en Node.js.
  - Para $n = 10.000$, son casi $50.000.000$ de operaciones.
  - Para $n = 100.000$, son casi $5.000.000.000$ de operaciones (cinco mil millones), lo que provocaría el bloqueo del *Event Loop* de Node.js, agotamiento de CPU y la terminación del proceso por *Out of Memory* o *Timeout* en Render.
- **Estrategia:** La API ejecuta físicamente el algoritmo cuando $n \le 2.000$, y cuando $n > 2.000$ retorna de forma transparente la solución analítica exacta (`executed: false`, `estimatedOperations`), demostrando en la práctica la razón teórica por la cual $O(n^2)$ no es escalable para grandes volúmenes de datos.

---

## 4. Recursión por división balanceada (*Divide and Conquer*) vs. Recursión lineal

- **Justificación:** En el motor JavaScript V8, el tamaño máximo de la pila de llamadas (*call stack*) ronda habitualmente entre 10.000 y 15.000 marcos de ejecución (*stack frames*). Una recursión lineal $T(n) = T(n - 1) + O(1)$ sobre $n = 100.000$ provocaría un error fatal `RangeError: Maximum call stack size exceeded`.
- **Estrategia:** Se implementó una descomposición por mitades tipo *Divide y Vencerás*:
  $$T(n) = 2T(n/2) + O(1)$$
  La profundidad máxima de la pila es $\lceil \log_2(n) \rceil + 1$. Para $n = 100.000$, la profundidad de llamadas es de apenas 18 marcos, procesando los 100.000 elementos de forma completamente segura y eficiente en tiempo $O(n)$.

---

## 5. Exposición mediante API REST pública, determinista y de solo lectura

- **Justificación:** Separar este módulo en una API independiente y de solo lectura permite a cualquier evaluador o docente verificar el cumplimiento de los requerimientos mediante peticiones HTTP estándar (`curl`, Swagger UI, Postman) sin necesidad de credenciales, autenticación JWT, creación de usuarios ni dependencias de una interfaz gráfica inacabada.

---

## 6. Validación estricta de parámetros en la capa de entrada

- **Justificación:** Un endpoint público no debe confiar ciegamente en la entrada del usuario. Mediante DTOs con `class-validator` y `class-transformer`:
  - Se restringe el rango numérico permitido ($1 \le n \le 100.000$).
  - Se rechazan tipos inválidos (cadenas no numéricas, números negativos, valores nulos).
  - Se evita la denegación de servicio accidental o intencionada antes de asignar memoria en el servidor.

---

## 7. Decisiones de Diseño para la Unidad 2: Estructuras de Datos (`StructuresModule`)

### 7.1. Separación modular e independencia académica
- **Justificación:** Se integró un módulo dedicado (`StructuresModule`) bajo el prefijo `/api/v1/structures` sin modificar `AcademicAnalysisModule`. Esto preserva la responsabilidad única y permite evaluar de forma independiente los análisis asintóticos de la Unidad 1 y las estructuras de datos aplicadas de la Unidad 2.

### 7.2. Cola FIFO con Lista Enlazada vs. Arreglo Convencional (`Array.shift`)
- **Justificación:** En JavaScript/TypeScript, invocar `Array.prototype.shift()` sobre un arreglo convencional tiene un costo asintótico $O(n)$, ya que el motor V8 debe reindexar todos los elementos restantes hacia la izquierda.
- **Implementación:** Se construyó una clase pura `Queue<T>` basada en una lista simplemente enlazada con punteros a `head` y `tail`. Esto garantiza complejidad $O(1)$ estricta y demostrable en `enqueue`, `dequeue` y `peek`.
- **Caso de uso:** Expresa equidad en la toma de comandas por orden estricto de llegada.

### 7.3. Montículo Binario (`MinHeap<T>`) vs. Ordenamiento Repetido (`Array.sort`)
- **Justificación:** Ordenar un arreglo con `Array.sort()` tras cada nuevo pedido en cocina demanda $O(n \log n)$. 
- **Implementación:** El `MinHeap` genérico con comparador configurable mantiene la propiedad de montículo binario:
  - Inserción (`insert`) en $O(\log n)$ mediante flotación (`bubbleUp`).
  - Extracción de la raíz óptima (`extractMin`) en $O(\log n)$ mediante hundimiento (`bubbleDown`).
  - Consulta del elemento más urgente (`peek`) en $O(1)$.
- **Prioridad Efectiva:** Se implementó la regla didáctica transparente $\text{effectivePriority} = \text{basePriority} + \text{waitingMinutes}$ (Urgente = 100, Normal = 50, Baja = 10), garantizando que pedidos demorados o críticos sean despachados prioritariamente.

### 7.4. Pila LIFO (`Stack<T>`) con doble stack para historial reversible (Undo / Redo)
- **Justificación:** Gestionar el borrador de un pedido requiere revertir acciones en orden inverso al que se aplicaron (semántica LIFO).
- **Implementación:**
  1. Cada mutación reversible (`ADD_ITEM`, `UPDATE_QUANTITY`, `REMOVE_ITEM`) se apila en `undoStack` en $O(1)$.
  2. La acción `UNDO` desapila la última mutación, aplica su inversa determinista y la almacena en `redoStack`.
  3. Cualquier acción nueva realizada después de deshacer purga y vacía completamente `redoStack`, garantizando coherencia del árbol de estados.

### 7.5. Grafo Ponderado y Algoritmo de Dijkstra con MinHeap propio
- **Justificación:** Para calcular la ruta óptima de servicio entre cocina, pasillo, barra, mesas y terraza, las distancias/tiempos de tránsito son variables y no negativos.
- **Implementación:** Lista de adyacencia (`Map<string, Edge[]>`) y algoritmo de Dijkstra impulsado por el `MinHeap` propio. Esto reduce la complejidad de $O(V^2)$ a $O((V + E) \log V)$.
- **Pesos no negativos:** Se rechazan aristas negativas (HTTP 400), pues invalidarían el principio de optimalidad greedy de Dijkstra.
- **Justificación teórica frente a BFS:** Dijkstra se justifica únicamente por la presencia de pesos variables y no negativos. Si todas las aristas tuvieran el mismo costo, una Búsqueda en Anchura (BFS) sería la elección más simple y eficiente ($O(V + E)$).

### 7.6. Índice `Map` vs. Búsqueda Lineal Secuencial
- **Justificación:** Demostrar empíricamente la diferencia entre acceso directo por tabla hash $O(1)$ promedio (`map.get(id)`) y recorrido secuencial $O(n)$ sobre listas no indexadas. En entornos de alta concurrencia, la indexación en memoria complementa la persistencia relacional.

---

## 8. Appresso: PostgreSQL durable con fallback in-memory (desvío del criterio "in-memory y determinista")

Esta sección registra de forma explícita una **desviación deliberada** de la decisión registrada en la sección 1 de este mismo documento.

- **Criterio original (sección 1):** todo el proyecto es in-memory y determinista, sin base de datos relacional, para que la medición de complejidad no dependa de la latencia de disco ni de la red.

- **Decisión adoptada (A1.0):** el módulo Appresso implementa la **Opción B (PostgreSQL durable) con fallback automático a in-memory**. La selección ocurre en el arranque: si existe la variable de entorno `DATABASE_URL` se usa PostgreSQL mediante TypeORM; si no existe, se inyecta un `InMemoryEntityManager` con la misma interfaz de repositorio. Redis queda como opción comparativa para una Ola 2.

- **Justificación de la desviación:** el módulo Appresso no mide únicamente complejidad asintótica; recibe el tráfico de un bot externo y debe sostener **durabilidad, idempotencia y concurrencia** bajo carga controlada. Con solo in-memory se pierden tres garantías que el enunciado exige: la idempotencia por `idTxn` no sobrevive a un reinicio, dos réplicas del servicio no comparten el conteo de la ventana y el estado de un episodio `OPEN` se reinicia. La reproducibilidad del módulo de análisis algorítmico (sección 1) no se sacrifica: se conserva intacta y se aplica una base de datos **solo** al módulo Appresso.

- **Consecuencias aceptadas:**
  1. Appresso introduce I/O real, con lo que su latencia deja de ser una métrica de complejidad pura y pasa a ser una métrica de capacidad (motivo por el cual el reporte de carga debe separar el origen de los rechazos).
  2. El determinismo del algoritmo de ventana deslizante **no depende** de la base de datos: `SlidingWindowDetector` sigue siendo una clase pura sin acceso a disco ni al reloj del sistema, y su comportamiento está cubierto por pruebas unitarias deterministas.
  3. Sigue siendo posible ejecutar y probar todo el módulo sin ninguna base de datos externa, gracias al fallback in-memory.

- **Riesgo aceptado:** en modo in-memory el estado **no se comparte entre réplicas** y se pierde al reiniciar. Es un modo de desarrollo y demostración, no de producción. El modo in-memory además serializa la concurrencia por usuario con un mutex en proceso (`src/modules/appresso/transactions/user-mutex.ts`), mientras que PostgreSQL usa `pg_advisory_xact_lock` con una clave estable derivada de SHA-256 del identificador de usuario.

- **Trazabilidad:** la ambigüedad se cerró durante la Ola 1; el detalle de concurrencia y de cierre de episodios quedó registrado en `odd/tasks/appresso-ola1-corrections.md`.

---

## 9. Appresso en Neon: Migraciones Versionadas y Desactivación de `synchronize` (W1)

Para llevar Appresso a un entorno de staging/producción real sobre Neon PostgreSQL, se implementa una estrategia estricta de gestión de esquemas:

- **Desactivación absoluta de `synchronize`:** En producción y entornos persistentes, `synchronize: false` es mandatorio. Toda alteración estructural de tablas o índices (`appresso_transactions`, `appresso_anomaly_episodes`) se ejecuta a través de migraciones versionadas en `src/migrations/`.
- **Doble cadena de conexión (Pooled vs Directa):**
  - `DATABASE_URL` (Pooled con TLS): Utilizada por el proceso web de la API para atender tráfico con alta concurrencia mediante el PgBouncer integrado de Neon.
  - `DATABASE_URL_DIRECT` (Directa con TLS): Opcional, reservada para el CLI de migraciones (`typeorm migration:run`), garantizando compatibilidad ante transacciones DDL que no admitan poolers transaccionales.
- **Fallo explícito en producción:** Si `NODE_ENV=production` y `DATABASE_URL` no está presente, la aplicación aborta el arranque de forma inmediata (`validateDatabaseEnvironment()`), impidiendo caídas silenciosas al modo en memoria en despliegues reales.
- **Procedimiento de Rollback:** Reversible mediante `npm run migration:revert`, asegurando reproducibilidad y auditoría de cambios.

---

## 10. Redis como capa temporal de la ventana deslizante y degradación observable (W3)

- **Propósito:** Disminuir consultas de conteo a Neon y compartir el estado temporal de la ventana entre múltiples réplicas del servicio sin desplazar la autoridad de persistencia fuera de PostgreSQL.
- **Script Lua atómico y borde inclusivo:** La purga de eventos vencidos (`receivedAt < now - windowMs`), inserción del evento actual (`ZADD`), conteo de elementos vigentes (`ZCARD`) y renovación de TTL se ejecutan de manera indivisible en Redis. Se garantiza el borde inclusivo mediante el operador exclusivo `'(' .. minTime` en `ZREMRANGEBYSCORE`, preservando los eventos que coinciden exactamente con la frontera inferior de la ventana.
- **Circuit Breaker observable:** `RedisSlidingWindowAdapter` implementa una máquina de estados `CLOSED`, `OPEN` y `HALF_OPEN`. Ante caídas continuadas de Redis (superando el umbral de fallos), el circuito se abre y la aplicación conmuta inmediatamente a modo degradado (consulta acotada en PostgreSQL o detector local) sin bloquear la ingesta ni acumular timeouts en peticiones vivas.
- **Reconstrucción acotada:** Al pasar a estado `HALF_OPEN`, la recuperación no consulta el historial completo; únicamente sincroniza los eventos activos (`receivedAt >= now - windowMs`) desde PostgreSQL hacia Redis.
- **Idempotencia estricta en PostgreSQL:** PostgreSQL es la única fuente de verdad para la detección de duplicados. Una transacción repetida devuelve el estado previamente registrado y jamás altera el Sorted Set en Redis ni incrementa los conteos de la ventana.

---

## 11. Read Model Analítico para el Dashboard (W4)

- **Separación de telemetría y consultas analíticas:** `AppressoMetricsService` conserva contadores de proceso para observabilidad interna (ej. fallos de Redis, HMAC o locks), mientras que `AppressoAnalyticsService` expone agregados históricos durables desde PostgreSQL para alimentar el panel de fraude.
- **Agregaciones SQL nativas sin barridos en memoria:** Los endpoints `/overview` y `/timeseries` ejecutan agregaciones directamente en el motor relacional (`COUNT`, `SUM`, `FILTER`, `date_trunc`), garantizando que la carga de cálculo y paginación recaiga en índices optimizados de PostgreSQL, sin hacer `Array.filter`/`reduce` sobre historiales extensos.
- **Indexación complementaria en Neon:** La migración `1727800000001-AddAnalyticsIndexes.ts` añade índices en `appresso_transactions(anomalyEpisodeId)`, `appresso_anomaly_episodes(openedAt)` y `appresso_anomaly_episodes(status)` para asegurar tiempos de respuesta submilisegundos en rangos de fechas y trazabilidad cronológica de episodios.
- **Derivación de recurrencia sin PII superflua:** La tasa de usuarios recurrentes y afectados se deriva directamente agrupando por `userId`, evitando crear tablas ornamentales de perfiles o persistir direcciones IP sin justificación de retención ni auditoría de privacidad.

---

## 12. Dashboard Mínimo con SPA Desacoplada (W5)

- **Elección arquitectónica:** SPA desacoplada en `frontend/` desarrollada con Vite + React 18 + TypeScript. Permite tipado cliente estricto, pruebas unitarias aisladas de adaptadores y componentes reactivos sin acoplar el build al proceso backend de NestJS.
- **Sin duplicación de lógica ni exposición de secretos:** El dashboard actúa como consumidor puro de los contratos analíticos expuestos en W4 (`/overview`, `/timeseries`, `/anomalies/:id/timeline`) y de la colección de anomalías (`/anomalies`). No contiene reglas de ventana deslizante, cálculos de umbrales ni credenciales secretas (HMAC o Neon).
- **Consumo desacoplado mediante variables públicas:** La URL de la API se parametriza vía `VITE_APPRESSO_API_URL` con dev proxy transparente en desarrollo (`/api` -> `http://localhost:3000`).
- **Diseño defensivo de estados de interfaz:** El frontend implementa componentes explícitos para estados de carga (skeletons), error con reintento activo y estados vacíos. Nunca infiere resultados ni maquilla métricas cuando la API devuelve un código de error o no responde.
- **Trazabilidad de anomalías:** Cada episodio visualizado en la tabla interactiva permite abrir una vista de detalle cronológica (`TimelineDrawer`), trazando desde la primera transacción sospechosa de la ventana hasta el cierre formal del episodio.




