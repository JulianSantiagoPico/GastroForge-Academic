# Guía adaptada: estructuras de datos para GastroForge Academic

**Estado:** guía de diseño; no implica implementación todavía.  
**Propósito:** incorporar una segunda unidad académica al proyecto existente para demostrar estructuras de datos aplicadas al dominio gastronómico, sin alterar ni sustituir el módulo actual de análisis de complejidad.

---

## 1. Contexto real del proyecto

Este repositorio ya es una API NestJS 11 con TypeScript, Swagger, `class-validator`, `@nestjs/throttler` y despliegue Docker/Render. Su objetivo actual es demostrar complejidad computacional mediante datos de pedidos simulados, deterministas y sin persistencia.

Lo ya disponible debe conservarse:

| Componente existente | Uso en la ampliación |
|---|---|
| Prefijo `api/v1` | Las nuevas rutas vivirán bajo `/api/v1/structures`. |
| Swagger en `/docs` y `/api/v1/docs` | Se documentarán allí los contratos de las simulaciones. |
| `ValidationPipe` global | Validará DTOs de cola, prioridad, borrador y grafo. |
| `ThrottlerGuard` | Protege también las rutas nuevas. |
| `HealthController` y `/health` | Se mantiene sin cambios. |
| `AcademicAnalysisModule` | Permanece independiente; no debe absorber las nuevas responsabilidades. |
| Datos en memoria y ejecución determinista | Las simulaciones no guardarán estado entre peticiones. |

La guía original proponía un repositorio nuevo llamado `appresso-data-structures-api`. Aquí esa propuesta se reemplaza por un módulo adicional dentro de **GastroForge Academic**: el proyecto ya satisface la infraestructura académica que aquella guía pedía crear.

---

## 2. Decisión de alcance

Se añadirá una unidad didáctica de estructuras de datos, no funcionalidades operativas de un restaurante. Cada endpoint recibirá su escenario, lo simulará en memoria y devolverá un resultado explicable. No habrá pedidos persistidos, autenticación, pagos, inventario, Redis/BullMQ, base de datos ni colas reales de producción.

| Estructura | Caso académico GastroForge | Decisión |
|---|---|---|
| Cola FIFO | Toma de pedidos normales por cocina, en orden de llegada. | Implementar. |
| Heap / cola de prioridad | Selección de la siguiente tarea de cocina por urgencia. | Implementar. |
| Pila | Deshacer/rehacer cambios de un borrador de pedido. | Implementar. |
| Grafo ponderado + Dijkstra | Ruta interna entre cocina, barra, zonas y mesas. | Implementar como simulación. |
| `Map` | Índice temporal de pedidos por identificador. | Implementar como comparación de acceso directo. |

No se debe usar una estructura solo para cumplir el ejercicio. FIFO expresa equidad por llegada; un heap resuelve selección repetida por prioridad; una pila representa historial reversible; Dijkstra busca caminos mínimos con pesos no negativos; y `Map` indexa por clave.

---

## 3. Arquitectura propuesta

La ampliación conservará la separación actual entre HTTP, servicio y algoritmos puros.

```text
src/
├─ app.module.ts                         # Importará StructuresModule cuando se implemente
├─ main.ts                               # Sin cambios funcionales previstos
└─ modules/
   ├─ health/                            # Sin cambios
   ├─ academic-analysis/                 # Sin cambios
   └─ structures/
      ├─ structures.module.ts
      ├─ structures.controller.ts
      ├─ structures.service.ts
      ├─ dto/
      │  ├─ queue-simulation.dto.ts
      │  ├─ priority-simulation.dto.ts
      │  ├─ draft-simulation.dto.ts
      │  ├─ shortest-path.dto.ts
      │  └─ order-index.dto.ts
      ├─ data-structures/
      │  ├─ queue.ts
      │  ├─ stack.ts
      │  ├─ min-heap.ts
      │  └─ weighted-graph.ts
      ├─ scenarios/
      │  └─ restaurant-layout.ts
      └─ interfaces/
         └─ structures.interface.ts
docs/
├─ guia-estructuras-datos-adaptada.md    # Este documento
├─ pruebas-manuales.md                   # Se ampliará con casos ED-xx
└─ decisiones.md                         # Se ampliará con decisiones de estructuras
```

Las clases de `data-structures` serán genéricas, sin decoradores de NestJS, DTOs ni objetos HTTP. `StructuresService` traducirá el escenario gastronómico a dichas clases; el controlador solo recibirá, validará y documentará la petición.

---

## 4. Comportamientos y contratos académicos

### 4.1 Cola FIFO: pedidos normales

Una `Queue<Order>` debe implementar `enqueue`, `dequeue`, `peek`, `size` e `isEmpty`. Se recomienda una lista enlazada con `head`, `tail` y longitud, o un arreglo circular. No debe basarse en `Array.shift()` como operación principal, porque no demuestra una extracción O(1).

La cola preserva el orden **en el que la API recibió** los pedidos; no los ordena por `createdAt`. Si un caso futuro requiere orden cronológico, deberá ordenar antes de encolar y declararlo en la respuesta.

| Operación | Complejidad objetivo |
|---|---:|
| `enqueue` | O(1) |
| `dequeue` | O(1) |
| `peek` | O(1) |

### 4.2 Heap: prioridad de cocina

Un `MinHeap<T>` genérico recibirá un comparador e implementará `insert`, `extractMin`, `peek`, `size`, `bubbleUp` y `bubbleDown`. Para expresar prioridad mayor primero, la simulación podrá usar `priorityKey = -effectivePriority`.

Regla didáctica transparente:

```text
effectivePriority = basePriority + waitingMinutes
urgente = 100; normal = 50; baja = 10
```

La respuesta debe mostrar la prioridad calculada de cada tarea y el orden resultante. Un heap no devuelve la colección completa ordenada: garantiza que el próximo mejor candidato esté en la raíz. No se debe sustituir por `array.sort()` después de cada inserción.

| Operación | Complejidad objetivo |
|---|---:|
| `insert` | O(log n) |
| `extractMin` | O(log n) |
| `peek` | O(1) |

### 4.3 Pila: historial de borrador

Una `Stack<T>` deberá proveer `push`, `pop`, `peek`, `clear`, `size` e `isEmpty`. El escenario tendrá una pila de deshacer y otra de rehacer:

1. Una acción reversible se agrega a `undoStack`.
2. `undo` extrae la última acción, aplica la inversa y la deja en `redoStack`.
3. Una nueva acción después de deshacer vacía `redoStack`.
4. La simulación termina al responder; no representa el estado oficial de un pedido.

Las acciones iniciales pueden limitarse a agregar ítem, cambiar cantidad y eliminar ítem. Cada acción debe contener información suficiente para revertirse de forma determinista.

### 4.4 Grafo y Dijkstra: recorrido interno

El plano del restaurante será una lista de adyacencia:

```ts
type Edge = { to: string; cost: number };
type AdjacencyList = Map<string, Edge[]>;
```

El escenario predeterminado debe contener nodos estables como `kitchen`, `passage`, `bar`, `table-1`, `table-2` y `terrace`. Una ruta sugerida cocina → pasillo → mesa 1 → terraza suma 21 segundos.

Dijkstra debe usar el `MinHeap` propio, `Map` para distancias y predecesores, e ignorar entradas antiguas del heap cuyo costo sea superior a la mejor distancia conocida. Las aristas negativas se rechazan; si no existe ruta se responde correctamente con `reachable: false`, ruta vacía y costo `null`.

Dijkstra solo se justifica con pesos no negativos y variables. Cuando todas las aristas costaran lo mismo, BFS sería la alternativa más simple y se debe explicar esa decisión en la sustentación.

### 4.5 `Map`: acceso por ID

El índice temporal `Map<string, Order>` complementa, no reemplaza, los algoritmos ya existentes de búsqueda lineal. La simulación debe mostrar que `get(id)` es acceso promedio O(1), mientras que la búsqueda lineal recorre elementos. En una aplicación real, PostgreSQL y sus índices seguirían siendo la fuente de verdad.

---

## 5. Endpoints propuestos

El proyecto actual declara CORS solo para `GET`, `HEAD` y `OPTIONS`. Como las simulaciones reciben cuerpos, para implementar los siguientes `POST` será necesario ampliar explícitamente esa configuración a `POST`; este ajuste se hará solo durante la implementación, no en esta fase de diseño.

| Método y ruta | Demostración |
|---|---|
| `POST /api/v1/structures/queue/simulate` | Encola pedidos y devuelve la atención FIFO. |
| `POST /api/v1/structures/priority/simulate` | Calcula prioridad efectiva y devuelve el despacho por heap. |
| `POST /api/v1/structures/stack/simulate` | Ejecuta acciones, `undo` y `redo` sobre un borrador. |
| `GET /api/v1/structures/graph/default-route?from=kitchen&to=terrace` | Dijkstra sobre el plano fijo. |
| `POST /api/v1/structures/graph/shortest-path` | Dijkstra sobre un grafo controlado enviado en la petición. |
| `POST /api/v1/structures/index/simulate` | Construye un `Map` temporal y consulta IDs. |
| `GET /api/v1/structures/compare` | Resumen de usos, operaciones y complejidades. |

Todos los endpoints serán sin estado entre peticiones. El controlador se marcará con `@ApiTags('Data-Structures')`, para preservar la agrupación actual `Academic-Analysis` en Swagger.

### Límites iniciales de validación

| Entrada | Límite |
|---|---:|
| Pedidos, tareas o acciones | 1 a 1.000 por solicitud |
| Nodos de un grafo enviado | 2 a 100 |
| Aristas de un grafo enviado | Hasta 500 |
| Peso de arista | 0 a 10.000 |

Entradas inválidas responderán HTTP 400 mediante DTOs. Un destino sin ruta no es una entrada inválida: responde HTTP 200 y `reachable: false`.

---

## 6. Orden de implementación futuro

1. Crear las cuatro estructuras genéricas y pruebas unitarias de sus invariantes.
2. Crear `StructuresModule`, sus interfaces y escenarios puros.
3. Incorporar validación DTO y contratos Swagger.
4. Exponer los endpoints e importar el módulo en `AppModule`.
5. Ajustar CORS para los `POST` de simulación, manteniendo la política explícita.
6. Ampliar `docs/pruebas-manuales.md`, `docs/decisiones.md` y README con evidencias y ejemplos `curl`.
7. Ejecutar `npm run build` y verificar localmente los contratos nuevos junto con los endpoints actuales.

No debe modificarse `AcademicAnalysisService` para mezclar estas simulaciones con los benchmarks de O(1), O(n), O(n²), recursión, progresión y regresión existentes.

---

## 7. Matriz de pruebas manuales a añadir

| ID | Caso | Resultado esperado |
|---|---|---|
| ED-01 | `GET /health` | HTTP 200; se confirma que la ampliación no afecta salud. |
| ED-02 | Cola con A, B, C | Se atienden A, B, C en el mismo orden recibido. |
| ED-03 | Heap con prioridades efectivas 50, 101 y 40 | Sale primero la tarea de prioridad 101. |
| ED-04 | Agregar, cambiar cantidad, eliminar y `undo` | Se restaura el ítem eliminado. |
| ED-05 | Hacer `undo` y luego una acción nueva | `redoStack` queda vacío. |
| ED-06 | Ruta `kitchen` → `terrace` del grafo fijo | Ruta válida con costo 21 segundos. |
| ED-07 | Grafo con arista de costo -1 | HTTP 400 con explicación de peso inválido. |
| ED-08 | Grafo sin camino de origen a destino | HTTP 200, `reachable: false`, ruta vacía. |
| ED-09 | Consulta de ID existente en `Map` | Pedido encontrado por acceso directo. |
| ED-10 | 1.001 tareas en prioridad | HTTP 400 por superar el límite. |

Cada prueba debe registrar fecha, ambiente, URL o body, pasos, resultado esperado, resultado real, evidencia y estado. La numeración `ED-xx` evita colisión con la matriz existente `PA-01` a `PA-11`.

---

## 8. Argumentos para la sustentación

1. Este módulo amplía el repositorio académico existente y no crea un servicio duplicado.
2. FIFO es justo por llegada, pero no resuelve urgencia; para ello se usa heap.
3. El heap evita ordenar todos los elementos cada vez y ofrece inserción/extracción en O(log n).
4. Dos pilas representan correctamente la semántica LIFO de deshacer y rehacer un borrador.
5. Dijkstra depende de pesos no negativos; con costos uniformes, BFS sería preferible.
6. Las simulaciones son reproducibles y efímeras. Ninguna estructura en memoria sustituye persistencia, auditoría, permisos ni índices de una base de datos en un sistema productivo.
7. Mantener `academic-analysis` y `structures` separados permite evaluar ambas unidades sin mezclar responsabilidades ni alterar los endpoints ya entregados.

## 9. Fuera de alcance por ahora

- Implementar cualquiera de las clases, DTOs, módulos o endpoints descritos.
- Cambiar CORS, Swagger, `AppModule`, Docker, dependencias o los algoritmos existentes.
- Añadir almacenamiento persistente, autenticación, interfaz web, colas externas o mensajería en tiempo real.
- Conectar esta simulación a una operación real de cocina o pedidos.

