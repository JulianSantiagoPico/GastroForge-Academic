# GUÍA DE DOMINIO Y DEFENSA DEL TALLER: TÉCNICAS DE RESOLUCIÓN
## Manual para el Equipo: Cómo Entender, Navegar y Sustentar Cada Parte de la Guía Institucional

---

> 🎯 **PROPÓSITO DE ESTA GUÍA:**  
> La guía del profesor (`docs/Tecnicas_de_resolucion.md`) está dividida exactamente en **8 partes**. Esta guía te enseña cómo explicar con total seguridad cómo resolvimos cada una de esas 8 partes en nuestro código, qué responder ante las preguntas del docente y qué mostrar en pantalla.

---

## 1. MAPA DE CORRESPONDENCIA: LA GUÍA DEL PROFE VS. NUESTRO CÓDIGO

Ten esta tabla a la mano. Si el profesor te pregunta por cualquier parte de su guía, acá tenés la respuesta exacta y el archivo:

| Parte de la Guía del Profesor | Concepto Clave del Enunciado | ¿Dónde está en Nuestro Proyecto? | Archivo para Abrir en VS Code |
|---|---|---|---|
| **Parte 1** | Métodos HTTP (GET, POST, PUT, PATCH, DELETE) | Controladores REST con DTOs e Idempotencia | [`backend/src/modules/appresso/transactions/transactions.controller.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/transactions/transactions.controller.ts) y [`anomalies.controller.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/anomalies/anomalies.controller.ts) |
| **Parte 2** | Hash SHA-256 y HMAC con llave secreta | Canonicalización profunda recursiva y `crypto.timingSafeEqual` | [`backend/src/modules/appresso/crypto/hmac.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/crypto/hmac.ts) |
| **Parte 3** | Descomposición de problemas y validaciones | DTOs tipados, validación defensiva y montos en centavos | [`backend/src/modules/appresso/dto/create-transaction.dto.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/dto/create-transaction.dto.ts) |
| **Parte 4** | Divide y Vencerás (Divide, Resuelve, Combina) | Agregación balanceada $T(n)=2T(n/2)+O(1)$ con profundidad $O(\log n)$ | [`backend/src/modules/academic-analysis/algorithms/recursive-analysis.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/academic-analysis/algorithms/recursive-analysis.ts) |
| **Parte 5** | Búsqueda y filtrado eficiente | Indexación Hash $O(1)$ con `Map` e índices relacionales B-Tree | [`backend/src/modules/structures/data-structures/weighted-graph.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/structures/data-structures/weighted-graph.ts) y migraciones SQL |
| **Parte 6** | Logs y diagnóstico de problemas | Interceptor de origen de rechazo (`X-Reject-Origin`) y logs estructurados | [`backend/src/modules/appresso/throttling/appresso-reject-origin.interceptor.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/throttling/appresso-reject-origin.interceptor.ts) |
| **Parte 7** | Ventana Deslizante (Sliding Window) | Detector puro en memoria y script Lua atómico en Redis ($O(1)$) | [`backend/src/modules/appresso/fraud-detection/sliding-window.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/fraud-detection/sliding-window.ts) y [`redis-sliding-window.adapter.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/redis/redis-sliding-window.adapter.ts) |
| **Parte 8** | Proyecto Appresso (3 Casos, Franjas, DB y Dashboard) | Motor transaccional completo, PostgreSQL en Neon, Franjas horarias y Dashboard React | [`transactions.service.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/transactions/transactions.service.ts), [`time-band-policy.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/fraud-detection/time-band-policy.ts) y `frontend/src/` |

---

## 2. CÓMO DEFENDER CADA PARTE PASO A PASO

### PARTE 1: Métodos HTTP (GET, POST, PUT, PATCH, DELETE)
- **Pregunta típica del profesor:** *"¿Por qué usaron PATCH y no PUT para las anomalías?"*
- **Cómo responder:**  
  *"Profesor, aplicamos la semántica estricta del protocolo HTTP. `PUT` se utiliza para reemplazar el recurso por completo; si usáramos `PUT`, tendríamos que enviar de nuevo todas las transacciones asociadas a la anomalía, el usuario y los timestamps. En cambio, usamos `PATCH /api/v1/appresso/anomalies/:id` porque el analista de seguridad solo actualiza parcialmente un campo específico: el estado (`status: REVIEWED` o `DISMISSED`), dejando intacta la evidencia forense original."*
- **Otro detalle de nivel Senior:** Menciona que `POST /transactions` es **idempotente**: si un cliente o red inestable envía dos veces el mismo `idTxn`, la primera responde `201 Created` y la segunda responde `200 OK` devolviendo el registro existente sin recontar en la ventana.

---

### PARTE 2: Hash de Transacción y HMAC
- **Pregunta típica del profesor:** *"En mi guía puse un ejemplo en Python con `sort_keys=True`. ¿Cómo lo hicieron en TypeScript y por qué un hash normal no alcanza?"*
- **Cómo responder:**  
  1. *"Un hash SHA-256 normal solo garantiza integridad (que nadie alteró el mensaje en el camino), pero cualquiera puede alterar el mensaje, recalcular el SHA-256 y enviarlo. El **HMAC con clave secreta** garantiza autenticidad: solo quien posea la clave compartida (`APPRESSO_HMAC_SECRET`) puede generar una firma válida."*
  2. *"En Node.js, `JSON.stringify` no ordena las claves alfabéticamente. Si mandamos `{user: 'a', value: 10}` o `{value: 10, user: 'a'}`, darían hashes distintos. Por eso creamos una función `canonicalize()` en [`hmac.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/crypto/hmac.ts) que ordena recursivamente las claves de forma lexicográfica exacta antes de calcular el HMAC."*
  3. *"Y además, comparamos la firma con `crypto.timingSafeEqual()` para evitar ataques de temporización (timing attacks)."*

---

### PARTE 3: Análisis, Descomposición y Validaciones
- **Pregunta típica del profesor:** *"¿Cómo evitaron que metan valores negativos o basura en las transacciones?"*
- **Cómo responder:**  
  *"Aplicamos el principio de programación defensiva. En [`create-transaction.dto.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/dto/create-transaction.dto.ts) usamos decoradores de `class-validator`: `@IsEmail()` para el usuario, `@IsInt()` y `@Min(1)` para el monto, y `@IsISO8601()` para la fecha. Además, **los montos se procesan en centavos enteros**, jamás en floats, para evitar los errores de precisión de punto flotante de JavaScript (como `0.1 + 0.2 = 0.30000000000000004`). Si algo viene mal, NestJS lo rebota inmediatamente con HTTP 400 antes de gastar memoria o CPU."*

---

### PARTE 4: Divide y Vencerás (Recursión)
- **Pregunta típica del profesor:** *"¿Por qué la recursión es peligrosa en producción y cómo la resolvieron con Divide y Vencerás?"*
- **Cómo responder:**  
  *"En la pila de llamadas (Call Stack) de Node.js solo caben unos 10.000 marcos de ejecución. Si usamos recursión lineal sobre 100.000 pedidos, el servidor se cae de inmediato con `RangeError: Maximum call stack size exceeded`.*  
  *Con Divide y Vencerás ($T(n) = 2T(n/2) + O(1)$), partimos la colección recursivamente en mitades. La profundidad máxima de la pila pasa a ser $\lceil \log_2 n \rceil + 1$. Para 100.000 elementos, la profundidad es de apenas **18 llamadas**, resolviendo la suma con total estabilidad."*
- **Archivo para mostrar:** [`recursive-analysis.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/academic-analysis/algorithms/recursive-analysis.ts).

---

### PARTE 5: Búsqueda y Filtrado Eficiente
- **Pregunta típica del profesor:** *"¿Por qué no usar simplemente `array.find()` para buscar si el usuario ya tiene transacciones?"*
- **Cómo responder:**  
  *"Porque `Array.find()` hace una búsqueda lineal secuencial con costo $O(n)$. Si tenemos miles de transacciones de bots entrando por segundo, hacer un recorrido completo por cada petición colapsa el CPU. Nosotros indexamos en memoria usando `Map` (búsqueda en tabla hash en tiempo $O(1)$) y en PostgreSQL usamos un índice B-Tree sobre `(id_txn)` y `(user_id)`."*

---

### PARTE 6: Logs y Diagnóstico
- **Pregunta típica del profesor:** *"Si una petición falla o se rechaza, ¿cómo saben en los logs exactamente por qué fue?"*
- **Cómo responder:**  
  *"Implementamos un interceptor dedicado ([`AppressoRejectOriginInterceptor`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/throttling/appresso-reject-origin.interceptor.ts)). En cada respuesta HTTP rechazada inyectamos la cabecera `X-Reject-Origin` que clasifica con precisión quirúrgica el origen: `throttler` (límite de peticiones por segundo), `validation` (error en los datos del DTO) o `hmac` (firma inválida). Así, en las pruebas de carga, los bloqueos del servidor web nunca se confunden con el detector de fraude."*

---

### PARTE 7: Ventana Deslizante (Sliding Window)
- **Pregunta típica del profesor:** *"Explíqueme cómo funciona la ventana deslizante y cuál es su complejidad."*
- **Cómo responder (explicación con las manos):**  
  1. *"Imagínese una ventana fija de 3 segundos que se mueve con el reloj del servidor (`receivedAt`)."*
  2. *"Cuando llega una transacción nueva, no recalculamos todo el historial desde cero: simplemente aplicamos la regla de **SALE uno, ENTRA uno**."*
  3. *"Purgamos de la cola los eventos cuya fecha sea menor a `now - 3000 ms`, agregamos el nuevo evento y contamos los que quedaron."*
  4. *"Como cada evento entra una sola vez y sale una sola vez, la complejidad amortizada es **$O(1)$**."*
  5. *"Además, respetamos el **borde inclusivo**: una transacción que ocurrió exactamente hace 3.000 ms pertenece a la ventana; la que ocurrió hace 3.001 ms queda por fuera."*

---

### PARTE 8: El Proyecto Appresso en Acción

Aquí es donde demuestran que el proyecto está 100% completo según el enunciado de la guía.

#### 1. Los 3 Casos de Uso del Taller (Ténganlos grabados en la mente)
- **Caso 1 (Anomalía / POSIBLE_FRAUDE):**  
  El usuario `b@b.com` envía 3 transacciones en 10:00:01, 10:00:02 y 10:00:03. Las 3 ocurren en menos de 3 segundos $\to$ El algoritmo detecta `count = 3 >= 3` y genera o actualiza un episodio `OPEN` de `POSIBLE_FRAUDE`. La transacción se registra normalmente.
- **Caso 2 (Normal espaciado):**  
  El usuario `c@c.com` envía en 10:00:01, 10:00:10 y 10:01:20. Cuando llega la segunda, la primera ya venció (pasaron 9 segundos). El conteo de la ventana nunca supera 1 $\to$ Estado `NORMAL`.
- **Caso 3 (Diferentes usuarios / Aislamiento):**  
  Usuario 1 envía en 10:00:01, Usuario 2 en 10:00:02 y Usuario 3 en 10:00:03. Aunque ocurrieron en 3 segundos consecutivos, pertenecen a usuarios distintos. Cada usuario tiene su propia ventana independiente (conteo = 1 para cada uno) $\to$ Estado `NORMAL`, sin falsos positivos.

#### 2. Franjas Horarias UTC (Tabla del enunciado)
- **Mañana (05:00 a 12:00 UTC):** Límite de **10** transacciones.
- **Tarde-noche (12:00 a 20:00 UTC):** Límite de **6** transacciones.
- **Noche-madrugada (20:00 a 05:00 UTC):** Límite de **3** transacciones.
- *Dónde está en el código:* [`backend/src/modules/appresso/fraud-detection/time-band-policy.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/fraud-detection/time-band-policy.ts).

#### 3. Base de Datos Relacional (PostgreSQL en Neon)
- Entidad de transacciones (`TransactionEntity`) y episodios (`AnomalyEpisodeEntity`).
- Relación de uno a muchos: un episodio agrupa todas las transacciones de la ráfaga.
- Migraciones versionadas en TypeORM (`synchronize: false` mandatorio en producción).

#### 4. Dashboard de Monitoreo
- Métricas consolidadas (Total transacciones, Monto total, Episodios activos, Recurrencia).
- Gráfico cronológico con **Cumulative Layout Shift cero (CLS = 0)**.
- **Línea de tiempo de la anomalía (`TimelineDrawer`):** panel lateral slide-over que abre las transacciones del episodio.
- **Simulador de tráfico interactivo:** permite al docente probar ráfagas en vivo con firma segura desde el backend.

---

## 3. LAS 5 PREGUNTAS TRAMPA DEL DOCENTE (Y CÓMO DEJARLO IMPRESIONADO)

1. **"¿Por qué en su modelo relacional la transacción no se rechaza si es fraude?"**  
   *Respuesta:* *"Porque el enunciado dice textualmente: 'El objetivo es detectar y registrar actividad sospechosa, no rechazarla automáticamente'. En sistemas financieros reales (como Stripe o pasarelas de bancos), una transacción sospechosa se aprueba provisionalmente o se marca para revisión humana (`AnomalyEpisode: OPEN`), ya que un falso positivo que bloquea a un cliente legítimo genera pérdida inmediata de ventas."*
2. **"¿Qué pasa si dos transacciones del mismo usuario llegan exactamente en el mismo milisegundo?"**  
   *Respuesta:* *"Sin protección, habría una condición de carrera: ambas leerían la ventana antes de que la otra se guarde. Lo resolvimos implementando `pg_advisory_xact_lock(hash(userId))` en PostgreSQL. La base de datos bloquea transaccionalmente a nivel de usuario: la segunda espera a que la primera haga `COMMIT`, garantizando que la ventana cuente exactamente las dos transacciones sin bloquear a otros usuarios."*
3. **"¿Qué pasa si Redis se cae en mitad de la operación?"**  
   *Respuesta:* *"Implementamos el patrón **Circuit Breaker** en [`redis-sliding-window.adapter.ts`](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/backend/src/modules/appresso/redis/redis-sliding-window.adapter.ts). Si Redis falla 2 veces seguidas, el circuito pasa a `OPEN` y el sistema conmuta automáticamente al detector en memoria o PostgreSQL sin demorar las peticiones con timeouts. Tras 5 segundos, pasa a `HALF_OPEN` para probar si Redis ya se recuperó."*
4. **"¿Por qué los tests corren deterministamente sin importar a qué hora del día los ejecute?"**  
   *Respuesta:* *"Detectamos que como las franjas horarias dependen de la hora UTC, un test que esperaba umbral 3 fallaba si se corría de mañana cuando el umbral es 10. Lo resolvimos inyectando una `TimeBandPolicy` parametrizada determinista en la suite general, y creamos un test unitario exclusivo que prueba la rotación de las 24 horas del día de forma aislada."*
5. **"¿Por qué hicieron el frontend desacoplado con Vite en vez de renderizar vistas con SSR en NestJS?"**  
   *Respuesta:* *"Para separar responsabilidades y escalar independientemente. El frontend es una SPA pura en React 18 que solo consume los contratos analíticos REST (`/overview`, `/timeseries`, `/timeline`). No contiene secretos criptográficos, compila con Vite de forma ultrarrápida y se despliega como estático en Vercel mientras el backend corre en Render."*

---

## 4. LISTA DE VERIFICACIÓN FINAL ANTES DE SUSTENTAR

- [ ] ¿Tienen abierta la API en Render con Swagger UI? 👉 [https://gastroforge-academic.onrender.com/docs#/](https://gastroforge-academic.onrender.com/docs#/)
- [ ] ¿Tienen abierto el Dashboard de frontend corriendo o desplegado?
- [ ] ¿Tienen VS Code listo con los archivos clave abiertos en pestañas (`hmac.ts`, `sliding-window.ts`, `time-band-policy.ts`, `advisory-lock.ts`)?
- [ ] ¿Saben explicar con sus palabras los 3 Casos de Uso del taller?
- [ ] ¿Saben por qué `CLS = 0` y por qué los montos van en centavos enteros?

¡Con este dominio técnico y conceptual, la sustentación está garantizada para nota máxima! 🚀
