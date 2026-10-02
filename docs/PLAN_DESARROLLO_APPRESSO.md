# Plan de desarrollo: detección con ventana deslizante en Appresso

Este plan propone implementar la recepción de transacciones y la detección por ventana deslizante en la API NestJS existente, y medir cómo responde bajo la carga incremental que enviará el bot del profesor. El objetivo del algoritmo es **detectar y registrar** actividad concentrada por usuario; no rechazar automáticamente la transacción por ser sospechosa. La carga del bot medirá capacidad del servicio y no debe confundirse con la regla de fraude.

## Decisión recomendada

- **PostgreSQL** será la fuente durable de verdad para transacciones y anomalías. Neon es viable desde Render; Render Postgres es una alternativa más simple de conectar si ambos servicios se despliegan en la misma región.
- Implementar primero y probar una versión de referencia de la ventana deslizante sin Redis. Luego añadir Redis como una segunda versión comparativa si se desea medir cómo cambia el comportamiento con estado compartido y operaciones atómicas.
- En la versión Redis, mantener la persistencia en PostgreSQL. Redis guardará sólo estado temporal derivable; no será el único registro de transacciones ni anomalías.
- Separar explícitamente el limitador HTTP actual de la detección de Appresso. La configuración actual en `src/app.module.ts` aplica globalmente `ThrottlerGuard` con un límite de 120 peticiones por 60 segundos. El bot podría alcanzar ese límite antes de que se mida la capacidad del algoritmo; no se debe desactivar la protección global sin decidir cómo se aislará y protegerá la prueba.
- Para la primera versión, `receivedAt` será el tiempo autoritativo de la ventana y los eventos se procesarán en orden de recepción confirmado por el servidor. No se soportarán eventos fuera de orden por `date` en el algoritmo `O(1)`; esa fecha es información de negocio y de reporte.
- Una anomalía representa un **episodio** por usuario y regla, no una alerta nueva por cada transacción posterior al umbral. El episodio se actualiza mientras la ventana siga en estado sospechoso y se cierra cuando ya no queden eventos que cumplan la regla. Un episodio `CLOSED` **no se reabre**: si el umbral vuelve a superarse, se crea un episodio nuevo.

## Contrato funcional propuesto

1. El bot envía cada transacción mediante `POST /api/v1/appresso/transactions`.
2. El servidor valida el DTO y el HMAC; los secretos nunca llegan en la respuesta ni se escriben en logs.
3. Cada transacción nueva se guarda de forma idempotente usando `idTxn`; un reintento no debe duplicar ni el registro ni el conteo de la ventana.
4. El detector conserva una ventana independiente por usuario. Para una ventana configurable de `W` milisegundos, descarta los eventos con `receivedAt < now - W`, agrega el evento actual y cuenta los restantes. Por tanto, el evento exactamente en `now - W` pertenece a la ventana (**borde inclusivo**) y el evento en `now - W - 1 ms` queda excluido.
5. Con la regla didáctica inicial, `count >= 3` dentro de `W = 3000 ms` genera o actualiza una anomalía `POSIBLE_FRAUDE`. La transacción sigue registrada; la anomalía no equivale por sí sola a rechazarla.
6. Guardar la hora de recepción del servidor (`receivedAt`) por separado de la fecha declarada de la transacción (`date`). Usar `receivedAt` para medir peticiones y calcular la ventana; usar `date` para reportes. Así un bot que envía fechas viejas no altera la medición de carga ni el orden real de llegada.
7. La firma será `HMAC-SHA-256` de una representación canónica UTF-8 de los campos firmados. El contrato debe enumerar esos campos, su **orden estricto**, formato de fechas y representación monetaria, además de los campos **excluidos** de la firma; la comparación será de tiempo constante. HMAC autentica e integra el mensaje, pero no reemplaza la idempotencia ni la protección contra replay.
8. `idTxn` será único globalmente mientras exista un único emisor de transacciones. Si se incorporan varios emisores, la clave pasará a ser `(source, idTxn)`. Un duplicado devuelve el resultado previamente persistido —incluida la anomalía creada o actualizada en esa petición original— y nunca vuelve a contar en la ventana.

Antes de cerrar el contrato deben quedar documentados el formato exacto de la firma (campos firmados, orden, canonicalización y exclusiones), el manejo de usuarios/email, la semántica del episodio de anomalía y la respuesta HTTP para registro nuevo, duplicado, firma inválida y anomalía.

## Ubicaciones en el codebase

| Ubicación | Responsabilidad propuesta |
|---|---|
| `src/modules/appresso/appresso.module.ts` | Componer controller, casos de uso y adapters de almacenamiento/ventana. |
| `src/modules/appresso/transactions/` | DTO, controller y caso de uso de recepción; mantener HTTP fuera del algoritmo. |
| `src/modules/appresso/fraud-detection/sliding-window.ts` | Algoritmo puro y testeable de ventana deslizante, primero como implementación de referencia. |
| `src/modules/appresso/fraud-detection/` | Política de detección, umbral/configuración y mapeo de resultados a anomalías. |
| `src/modules/appresso/anomalies/` | Consulta, deduplicación y transición de estados de anomalías. |
| `src/modules/appresso/persistence/` | Adapter PostgreSQL y migraciones; única fuente durable. |
| `src/modules/appresso/redis/` | Adapter Redis opcional para estado efímero y operación atómica por usuario; introducir después de la línea base. |
| `src/app.module.ts` | Registrar `AppressoModule` y configurar persistencia/Redis sin mezclar el detector con `AcademicAnalysisModule`. |
| `src/main.ts` | Prefijo global `/api/v1`, validación global y documentación Swagger existentes. Revisar la política HTTP global antes de habilitar el bot. |

Estos nombres de subcarpeta son una propuesta; seguir el patrón ya presente en `src/modules/academic-analysis/` y `src/modules/structures/` al implementar.

## Fases y tareas

### Fase 1 — Cerrar reglas y preparar la medición

- [ ] **A1.0** **Decisión arquitectónica crítica — persistencia.** El codebase actual (`docs/decisiones.md`) se diseñó intencionalmente como **in-memory y determinista** para medir complejidad algorítmica sin ruido de I/O. Appresso requiere durabilidad e idempotencia bajo concurrencia, por lo que esta decisión debe resolverse antes de Fase 2. Opciones:
  - **Opción A — In-memory con snapshot (recomendado para fase académica):** la ventana y anomalías viven en memoria (Map por usuario) durante el proceso; transacciones duplicadas se deduplican por `idTxn` en un `Set`. Ventaja: mantiene la filosofía actual, fácil de testear, sin dependencias externas. Desventaja: el estado se pierde en restart/redeploy y no se comparte entre réplicas. Adecuado para validar el algoritmo y el contrato antes de producción.
  - **Opción B — PostgreSQL durable:** añadir `@nestjs/typeorm` + `pg` + migraciones, modelar usuarios/transacciones/anomalías. Ventaja: durabilidad e idempotencia reales bajo concurrencia (advisory locks). Desventaja: introduce latencia de red, requiere gestión de conexiones y una base de datos en staging/producción. Rompe con el patrón in-memory del codebase existente.
  - **Salida esperada:** decisión consensuada con el profesor. Si se escoge Opción A, Fase 3 usará persistencia in-memory; Fase 4 (Redis) pasa a ser opcional y Fase 5/6 se adaptan a memoria. Si se escoge Opción B, instalar dependencias y migraciones antes de A3.3.

- [ ] **A1.0b** **Infraestructura de tests.** El codebase actual no tiene configuración de tests (no hay `jest.config.js`, no hay archivos `.spec.ts` en `src/`). Antes de A2.x, instalar: `npm i -D jest @types/jest ts-jest` y crear `jest.config.js` con `preset: 'ts-jest'`, `testEnvironment: 'node'`. Los tests de Fase 2 (algoritmo puro) no necesitan DB; los de Fase 3 (integración) requerirán un test DB o mocks según A1.0.

- [ ] **A1.1** Confirmar esquema de transacción, HMAC-SHA-256 (campos, bytes y canonicalización), clave de idempotencia y respuestas HTTP. Fijar la canonicalización de forma explícita y reproducible. La canonicalización se especifica para TypeScript/Node.js (no Python):
  - **Orden de claves:** ordenar recursivamente todas las claves del objeto de forma lexicográfica ascendente (deep-sort), ya que `JSON.stringify` no ordena claves. Implementación de referencia:

    ```typescript
    function canonicalize(obj: unknown): string {
      if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
      }
      if (obj !== null && typeof obj === 'object') {
        return '{' + Object.keys(obj)
          .sort()
          .map(k => JSON.stringify(k) + ':' + canonicalize((obj as Record<string, unknown>)[k]))
          .join(',') + '}';
      }
      return JSON.stringify(obj);
    }
    ```

  - **Serialización:** `canonicalize(payload)` produce una cadena con separadores compactos (`,`, `:`) y sin espacios adicionales, equivalente a `JSON.stringify(payload, null, 0)` una vez ordenadas las claves.
  - **Codificación:** UTF-8 de la cadena resultante (`Buffer.from(str, 'utf-8')` en Node.js).
  - **Formato de fecha:** ISO-8601 con zona explícita (`2026-09-23T10:30:01.120Z` o `2026-09-23T10:30:01.120+00:00`); el campo `date` NO se incluye en la firma.
  - **Valor monetario:** entero en unidades mínimas de la moneda (centavos), nunca `float`/`double`. El campo `value` del DTO se convierte a entero antes de firmar y persistir.
  - **Campos firmados (orden estricto):** `idTxn`, `user`, `value`, `currency`, `paymentMethod`, `date`.
  - **Campos excluidos de la firma:** `hash` (es el propio HMAC), `receivedAt` (asignado por el servidor).
  - **Comparación:** `crypto.timingSafeEqual` (constante en tiempo). Secreto desde variable de entorno `APPRESSO_HMAC_SECRET`.
  - Documentar explícitamente que una firma válida autentica integridad/autenticidad del remitente, pero **no evita replays** con `idTxn` nuevos; la idempotencia por `idTxn` y/o expiración de ventanas cubren ese riesgo por separado.
- [ ] **A1.2** Fijar `W`, umbral, borde inclusivo `receivedAt >= now - W`, fuente de tiempo (`receivedAt`) y que no se admiten eventos fuera de orden en la ventana de referencia.
- [ ] **A1.2a** Definir el ciclo de vida del episodio `POSIBLE_FRAUDE`: clave de deduplicación `(usuario, regla)`, estados `OPEN`, `CLOSED`, `REVIEWED`, `DISMISSED`, y marcas `opened_at`, `updated_at`, `closed_at`. Mientras el episodio esté `OPEN` se actualiza (conteo, `updated_at` y transacciones asociadas); **un episodio `CLOSED` nunca se reabre** y un nuevo cruce de umbral crea un episodio nuevo. **Condición de cierre:** el episodio pasa a `CLOSED` cuando todos los eventos asociados han vencido, es decir, cuando `receivedAt < now - W` para el más reciente de ellos. Un episodio puede agrupar varias transacciones de la ventana sospechosa, no sólo la que cruzó el umbral.
- [ ] **A1.2b** Definir la interacción de la regla de ventana con los límites por franja del enunciado (mañana 10, tarde-noche 6, noche-madrugada 3). Los intervalos y límites ya están fijados por el enunciado; lo que debe decidirse aquí es: la **zona horaria fija** con la que se evalúa la franja (`UTC` para reproducibilidad entre entornos, o `America/Bogota` si el alcance lo exige), que la pertenencia a la franja se determine por `receivedAt` y no por `date`, la **precedencia** entre ambas reglas y el alcance de la primera entrega. Ambas reglas permanecen **desacopladas** del algoritmo base de ventana; no mezclar su implementación hasta cerrar esta decisión.
- [ ] **A1.3** Acordar con el profesor la rampa del bot, concurrencia, duración, hora de prueba, volumen máximo y condición de parada.
- [ ] **A1.4** Definir cómo separar el efecto del `ThrottlerGuard` global del algoritmo. Opciones concretas:
  - **Opción A — Override por controlador (recomendado):** aplicar `@UseGuards(ThrottlerGuard)` con configuración de límites más altos o un `ThrottlerGuard` secundario sólo al `AppressoController`, dejando el guard global para el resto. NestJS permite stackar guards; el global sigue protegiendo `academic` y `structures`.
  - **Opción B — Header de test autenticado:** si el bot se marca con un header/token conocido, el `ThrottlerGuard` aplica un `skip` solo para esas peticiones, con protección de rate-override.
  - **Opción C — Aumentar el límite global:** elevar `limit` a un valor suficiente para el volumen acordado con el profesor (A1.3), aceptando menor protección general durante la prueba.
  - Registrar en métricas el origen del rechazo (throttler vs. endpoint Appresso) para la Fase 6 (A6.3).
- [ ] **A1.5** Definir métricas mínimas: RPS aceptadas, latencia p50/p95/p99, respuestas por código, errores, CPU/memoria del servicio, latencia/conexiones de PostgreSQL y transacciones pendientes/rechazadas. Separar obligatoriamente **peticiones rechazadas por `ThrottlerGuard`** de **aceptadas por el endpoint Appresso**, con métrica propia por origen de rechazo y `error_rate` por escalón, para que los rechazos del limitador global no contaminen la medición de capacidad del detector.

**Salida:** contrato versionado en este plan o en DTOs/specs posteriores, y protocolo de carga que no dependa de peticiones manuales.

### Fase 2 — Algoritmo de referencia y pruebas unitarias

- [ ] **A2.1** Implementar ventana deslizante pura por `userId`, con entrada de evento y tiempo explícitos (sin leer el reloj del sistema dentro del algoritmo).
- [ ] **A2.2** Mantener eventos ordenados por tiempo; eliminar vencidos desde el inicio de la cola, sin recalcular toda la colección. Objetivo: cada evento se agrega y elimina una vez, con costo amortizado `O(1)` por evento y memoria proporcional a eventos dentro de ventanas activas.
- [ ] **A2.3** Probar límites —incluidos los dos casos de borde obligatorios: el evento exactamente en `now - W` **se incluye** y el evento en `now - W - 1 ms` **se excluye**—, secuencia normal/anómala, aislamiento entre usuarios, mismo milisegundo, reintentos, historial vencido y rechazo/documentación de eventos fuera de orden. Estos casos de borde son parte obligatoria de la suite unitaria, no opcionales.
- [ ] **A2.4** Exponer el resultado del algoritmo (conteo, ventana y decisión) como dato; no escribir logs ni datos en la función pura.

**Salida:** tests deterministas que demuestran la regla y su complejidad antes de conectar red o base de datos.

### Fase 3 — Endpoint y persistencia durable

> **Depende de A1.0.** Si se eligió Opción A (in-memory), A3.3-A3.5 usan estructuras en memoria (`Map`, `Set`, `Mutex` por usuario vía `async-mutex` o semáforo simple) en lugar de PostgreSQL/advisory locks. La idempotencia por `idTxn` se mantiene con un `Set`. Si se eligió Opción B (PostgreSQL), implementar como especificado.

- [ ] **A3.1** Crear `AppressoModule` e integrarlo en `src/app.module.ts`; documentar rutas con Swagger.
- [ ] **A3.2** Añadir DTOs para `POST /api/v1/appresso/transactions` aprovechando el `ValidationPipe` existente.
- [ ] **A3.3** Elegir e integrar PostgreSQL y migraciones; modelar usuarios, transacciones y anomalías. Agregar `received_at`, `idTxn` único, estado de anomalía con `opened_at`, `updated_at`, `closed_at`, y claves/índices para consultas por usuario y tiempo. Representar dinero en **unidades enteras mínimas de la moneda** (p. ej. centavos) y mapear explícitamente el `value` del DTO a entero antes de persistir; alternativa `numeric` con escala fija. Nunca `float`/`double`.
- [ ] **A3.4** Verificar HMAC antes de aceptar la transacción siguiendo la canonicalización fijada en A1.1 (campos firmados, orden estricto, separadores compactos, UTF-8, excluyendo `hash`); usar comparación de tiempo constante y secreto de entorno. No almacenar un hash provisto por el cliente como prueba de autenticidad.
- [ ] **A3.5** Procesar inserción idempotente, conteo de ventana y registro/deduplicación de anomalía en una estrategia transaccional concreta. Serializar por usuario con un mecanismo adecuado —recomendado *advisory lock* por clave derivada del identificador de usuario, que evita bloquear filas ajenas y reduce contención entre usuarios distintos— o un aislamiento/bloqueo equivalente, para impedir que POST simultáneos pierdan el evento que alcanza el umbral. Justificar el mecanismo elegido.
- [ ] **A3.6** Añadir tests de integración del endpoint, persistencia, duplicados y peticiones simultáneas del mismo usuario. Incluir el caso de reintento: un `idTxn` existente devuelve la respuesta previamente persistida (incluida la anomalía creada o actualizada en esa petición original), con el código HTTP definido en el contrato, y **no** recalcula ni vuelve a contar en la ventana.

**Salida:** la API puede recibir y conservar transacciones aunque el estado temporal Redis no esté disponible; la regla de detección es observable y repetible.

### Fase 4 — Ventana compartida con Redis (experimento comparativo)

> **Depende de A1.0.** Si se eligió Opción A (in-memory), Fase 4 se marca como **postergada** — Redis añade complejidad que no aporta a la validación académica del algoritmo. Si se eligió Opción B (PostgreSQL), se implementa como especificado con la condición de que PostgreSQL sigue siendo la fuente durable.

- [ ] **A4.1** Añadir un adapter Redis detrás de una interfaz pequeña, sin introducir dependencia Redis en el algoritmo puro ni en el controller.
- [ ] **A4.2** Representar los eventos por usuario con una estructura ordenada por tiempo (por ejemplo, sorted set). Ejecutar mediante una operación atómica —por ejemplo, un script Lua—: quitar vencidos, agregar el nuevo `idTxn`, contar y aplicar expiración al estado inactivo.
- [ ] **A4.3** Garantizar que duplicados no se cuenten dos veces y definir el comportamiento ante timeout, desconexión, reinicio o estado Redis perdido. **Reconstrucción acotada:** al perder el estado de Redis, reconstruir únicamente la ventana activa de los usuarios con actividad reciente (`receivedAt >= now - W`), nunca todo el historial. **Degradación explícita:** si Redis falla, operar en modo PostgreSQL-only por solicitud o por un periodo corto (circuit breaker), registrando cada evento de degradación en métricas/logs. PostgreSQL sigue siendo durable y debe permitir esa reconstrucción acotada.
- [ ] **A4.4** Ejecutar exactamente el mismo contrato y plan de carga en perfil PostgreSQL-only y en perfil PostgreSQL+Redis.

**Salida:** comparación de rendimiento y complejidad operativa con evidencia. Si Redis no mejora una métrica objetivo o agrega demasiada fragilidad, conservar la implementación sin Redis.

### Fase 5 — Consultas de anomalías, agregados y dashboard

> **Depende de A1.0.** Si se eligió Opción A (in-memory), las consultas paginadas (A5.1) se hacen sobre estructuras en memoria con filtrado. A5.2 adapta los agregados a `Array.filter`/`reduce` en memoria en lugar de consultas SQL. Si se eligió Opción B, usar SQL con índices por usuario y tiempo.

- [ ] **A5.1** Añadir consultas paginadas de anomalías con filtros por fecha, usuario y estado.
- [ ] **A5.2** Añadir resumen y series temporales desde PostgreSQL; no calcular estadísticas recorriendo todo el historial en memoria por petición. Definir antes los contratos de agregados: recurrente, período, anomalías abiertas/nuevas/revisadas y porcentaje de transacciones sospechosas.
- [ ] **A5.3** Implementar transiciones `OPEN`, `CLOSED`, `REVIEWED`, `DISMISSED`, con quién/cuándo si la autenticación del evaluador forma parte del alcance. Aplicar la regla: **un episodio `CLOSED` nunca se reabre**. El cierre queda registrado con su timestamp (`closed_at`).
- [ ] **A5.4** Desarrollar el dashboard sólo después de definir o añadir el frontend: el codebase revisado actualmente expone una API, no una interfaz de dashboard.

**Salida:** vistas agregadas y auditables sin acoplarlas al endpoint de ingestión.

### Fase 6 — Carga controlada y criterio de aceptación

- [ ] **A6.1** Ejecutar primero una prueba de humo, un calentamiento y luego escalones reproducibles tanto de concurrencia como de tasa de llegada (RPS), con datos sintéticos e `idTxn` únicos. Limpiar o aislar los datos entre corridas.
- [ ] **A6.2** Incluir dos perfiles de tráfico: mismo usuario (presiona la contención y el conteo por clave) y muchos usuarios (presiona base de datos y capacidad global).
- [ ] **A6.3** Registrar por escalón volumen enviado/aceptado, latencia, errores y saturación; anotar configuración y proveedor de base/Redis para que el resultado sea reproducible. Separar en el reporte los rechazos originados en `ThrottlerGuard` de los procesados por el endpoint Appresso, de modo que el punto de quiebre atribuido al algoritmo no sea en realidad el limitador global.
- [ ] **A6.4** Identificar el primer escalón que viola el SLO acordado; acordar SLO y umbrales con el profesor antes de afirmar un “punto de quiebre”.
- [ ] **A6.5** Revisar datos después de cada corrida, detener ante errores sostenidos/impacto externo y confirmar que no se dejaron transacciones o anomalías inconsistentes.

**Criterio de éxito:** se detectan correctamente los escenarios de ventana (incluidos los casos de borde `now - W` y `now - W - 1 ms`), no se duplican transacciones ante reintentos (un reintento con `idTxn` existente devuelve el resultado persistido), la carga deja métricas suficientes para identificar el cuello de botella y las respuestas del limitador HTTP se distinguen de las anomalías de negocio.

## Riesgos y decisiones que no se deben ocultar

| Riesgo o pregunta | Tratamiento recomendado |
|---|---|
| El guard global de 120/60 puede responder antes que la regla Appresso | Medirlo y aislar perfiles de prueba conscientemente; conservar protección general. Registrar el origen del rechazo (throttler vs. endpoint) para no atribuirle al detector un límite que no le pertenece. |
| El estado en memoria desaparece en reinicio y no se comparte entre réplicas | Usarlo sólo como referencia local; comparar con Redis compartido o consulta durable. |
| Redis y PostgreSQL no comparten una transacción atómica | Diseñar idempotencia y recuperación/reconstrucción **acotada** desde PostgreSQL (sólo ventana activa `>= now - W`); establecer degradación explícita y observable si Redis falla. |
| Cola `O(1)` con eventos fuera de orden | La cola sólo es correcta con orden monotónico; fijar `receivedAt` como orden de la versión base o aceptar una estructura ordenada de mayor costo. |
| HMAC se interpreta como protección completa contra replays | Documentar su límite: protege integridad/autenticidad; idempotencia, expiración y/o nonce cubren replays según el alcance acordado. |
| Cada evento sobre el umbral genera una alerta | Modelar una anomalía como episodio deduplicable por `(usuario, regla)`, con ciclo de vida explícito `OPEN`/`CLOSED`/`REVIEWED`/`DISMISSED`, y sin reapertura de episodios `CLOSED`. |
| Email, IP o firma terminan en logs o etiquetas de métricas | Minimizar PII, ocultar firmas y no usar identificadores de usuario como etiquetas de alta cardinalidad. |
| Usuario/email no autenticado se puede suplantar | Para el laboratorio, documentar el alcance; para producción, autenticar identidad y no confiar sólo en el campo `user`. |
| Bot de carga contra el servicio público puede afectar disponibilidad y generar costos | Acordar ventana, rampa, límites de parada y responsable; preferir staging si se quiere evitar impacto a terceros. |
| El codebase actual es in-memory y determinista por diseño | Decidir A1.0 antes de implementar. Si se elige in-memory, Fases 4-6 se adaptan (Redis opcional, métricas de memoria en lugar de PostgreSQL, pruebas de concurrencia con múltiples procesos). Si se elige PostgreSQL, instalar dependencias y migraciones antes de A3.3. |
| No hay infraestructura de tests (jest.config.js, .spec.ts) | Instalar jest + ts-jest y crear jest.config.js antes de A2.x (ver A1.0b). |
| Las franjas mañana/tarde/noche y el umbral de fraude son reglas distintas | Mantenerlas desacopladas del algoritmo base. Antes de implementarlas, cerrar zona horaria fija, base temporal (`receivedAt`), precedencia y alcance de la primera entrega. |

---

## Recomendación de entregas divididas

Dado el alcance extenso del plan y la arquitectura actual in-memory del codebase, se propone dividir la implementación en dos ondas:

**Ola 1 (Mínimo viable académico):** A1.0 (Opción A in-memory), A1.0b, A1.1, A1.2-A1.5, A2.1-A2.4, A3.1-A3.2 + A3.5-A3.6 con persistencia in-memory. Entrega: endpoint funcional, ventana deslizante testeada, HMAC verificado, idempotencia por `idTxn`, anomalías como episodios. Sin PostgreSQL ni Redis.

**Ola 2 (Producción/durabilidad, opcional):** A3.3-A3.4 (PostgreSQL + migraciones + advisory locks), A4 (Redis comparativo), A5-A6 (dashboard + carga controlada). Requiere decisión de A1.0 (Opción B) y aceptación de la expansión de scope.

## Referencias internas

- `docs/Tecnicas_de_resolucion.md` — requisitos del ejercicio, ejemplo de ventana y modelo conceptual.
- `docs/DOCUMENTO_TRABAJO_APPRESSO.md` — contexto académico y criterios de medición de complejidad.
- `docs/decisiones.md` — criterio previo de análisis algorítmico y operación segura.
- `src/app.module.ts` — módulos registrados y limitador global actual.
- `src/main.ts` — prefijo `/api/v1`, validación global y Swagger.
- `src/modules/academic-analysis/` — patrón de módulos y algoritmos aislados existente.

---

# Anexo de correcciones de la Ola 1

Este anexo cierra las ambigüedades que quedaron abiertas en A1.0, A1.2b, A1.4 y A1.5 tras la primera corrida de la Ola 1. Es vinculante: donde el cuerpo del plan dice "por definir", manda lo que se decide aquí.

## A1.0 — Persistencia: PostgreSQL durable con fallback in-memory (cerrado)

**Decisión:** Opción B (PostgreSQL) como modo normal, con degradación automática a in-memory cuando no existe `DATABASE_URL`. Redis queda como opción comparativa para la Ola 2.

**Motivo:** el módulo Appresso recibe tráfico de un bot externo y necesita durabilidad, idempotencia y concurrencia. Con solo in-memory se pierden las tres. El determinismo del módulo de análisis algorítmico no se toca: sigue siendo puro, sin base de datos.

**Consecuencia asumida:** el estado en modo in-memory no se comparte entre réplicas y se pierde al reiniciar. Documentado en `docs/decisiones.md`, sección 8, y en `src/modules/appresso/persistence/README.md`.

## A1.2b — Zona horaria, base temporal y franjas horarias (cerrado)

- **Zona horaria fija: `UTC`.** Todo el razonamiento temporal es aritmética sobre `Unix epoch` en milisegundos, que ya es un instante absoluto. `UTC` garantiza que la misma traza produzca el mismo resultado en local, staging y producción, sin configuración por entorno ni problemas de hora de verano.
- **Base temporal autoritativa: `receivedAt` (timestamp del servidor).** La pertenencia a la ventana la determina `receivedAt`. El campo de negocio `date` es dato declarativo del emisor: falsificable por el cliente y jamás participa en el conteo ni en el umbral.
- **Precedencia:** la ventana deslizante y las franjas horarias son reglas **desacopladas**. La franja no hereda ni modifica el conteo de la ventana.
- **Alcance: las franjas horarias se postergan a la Ola 2.** El detector de la Ola 1 solo implementa la ventana deslizante genérica (`count >= threshold` dentro de `W`). Si se implementan después, deben vivir en una capa que componga el detector puro, nunca dentro de `sliding-window.ts`, que debe seguir sin reloj, sin calendario y sin dependencias externas.

Traza en código: bloque de documentación de `SlidingWindowDetector` en `src/modules/appresso/fraud-detection/sliding-window.ts`.

## A1.4 — Aislamiento del limitador HTTP y origen de los rechazos (cerrado)

- El `ThrottlerGuard` global (120 peticiones / 60 s) se conserva **exclusivamente** para `academic-analysis`, `structures` y `health`.
- Los controladores de Appresso están exentos del guard global mediante `@SkipThrottle()` a nivel de clase y aplican un **guard dedicado** con límites propios, configurables por `APPRESSO_THROTTLE_LIMIT` y `APPRESSO_THROTTLE_TTL`. El límite global nunca se eleva.
- Toda respuesta de Appresso incluye cabeceras de origen: `x-appresso-reject-origin` (`throttler` | `validation` | `hmac` | `endpoint` | `none`), `x-appresso-throttler-rejected` (`true`/`false`) y `x-appresso-test` de eco cuando el cliente envía esa cabecera.
- **La cabecera `x-appresso-test` es de traza únicamente: no otorga ningún skip.** No existe bypass del limitador por cabecera. Cualquier bypass futuro tendría que ser un knob de configuración acotado al entorno de prueba y nunca habilitable en producción.

## A1.5 — Métricas mínimas (cerrado)

Contadores del lado servidor en `AppressoMetricsService` (contadores por origen de rechazo, transacciones procesadas, duplicados, episodios creados/actualizados/cerrados y un reservorio acotado de latencias). El registro de referencia de la medición es el reporte JSON que emite `scripts/simulate-bot-load.ts`, que **separa obligatoriamente** `throttler` de `endpoint` por escalón.

## A4 (Ola 2) — Degradación y reconstrucción acotada

Requisito cerrado y trazable, sin cambios funcionales en la Ola 1: ver `src/modules/appresso/persistence/README.md`.
