# Protocolo y Evidencia de Pruebas Manuales - GastroForge Academic

Este documento contiene la matriz de pruebas manuales y verificación de contratos requerida en la guía académica. Permite validar los endpoints en local (`http://localhost:3000`) o en el entorno de producción en Render (`https://gastroforge-academic-api.onrender.com`).

---

## Matriz de Pruebas

| ID | Endpoint / Petición | Parámetros | Código HTTP Esperado | Resultado Esperado | Criterio de Aceptación |
|---|---|---|:---:|---|---|
| **PA-01** | `GET /health` | Ninguno | `200 OK` | `status: "ok"`, uptime y timestamp en formato ISO. | El servicio responde y reporta salud operativa. |
| **PA-02** | `GET /api/v1/academic/report` | Ninguno | `200 OK` | Tabla comparativa de operaciones para $n \in \{10, 100, 1000, 10000, 100000\}$, casos de fidelización y pronóstico. | Retorna el reporte consolidado sin errores de memoria ni de pila. |
| **PA-03** | `GET /api/v1/academic/benchmark?size=2000` | `size=2000` | `200 OK` | Búsqueda lineal con 2.000 operaciones (peor caso), agregación con 2.000 operaciones, recursión con 2.000 operaciones y `maxDepth = 11`. | Se valida la proporcionalidad lineal $O(n)$ y profundidad logarítmica. |
| **PA-04** | `GET /api/v1/academic/benchmark?size=1` | `size=1` | `200 OK` | 1 operación en búsqueda, agregación y recursión. | Comportamiento correcto para el caso base límite inferior. |
| **PA-05** | `GET /api/v1/academic/benchmark?size=100000` | `size=100000` | `200 OK` | 100.000 operaciones en búsqueda y agregaciones. `maxDepth = 18`. | Ejecución exitosa sin desbordamiento de pila (*Maximum call stack size exceeded*). |
| **PA-06** | `GET /api/v1/academic/quadratic?size=2000` | `size=2000` | `200 OK` | `executed: true`, exactamente $1.999.000$ comparaciones ejecutadas físicamente en bucle anidado. | Valida la sumatoria $\frac{n(n-1)}{2}$ en el límite máximo de ejecución física. |
| **PA-07** | `GET /api/v1/academic/quadratic?size=10000` | `size=10000` | `200 OK` | `executed: false`, `estimatedOperations: 49995000`, razón clara de salvaguarda de recursos. | Demuestra la protección contra $O(n^2)$ y la exactitud del modelo teórico. |
| **PA-08** | `GET /api/v1/academic/benchmark?size=100001` | `size=100001` | `400 Bad Request` | Mensaje de validación informando que `size` excede el máximo permitido (100.000). | Rechaza la petición sin degradar el servidor. |
| **PA-09** | `GET /api/v1/academic/benchmark?size=abc` | `size=abc` | `400 Bad Request` | Mensaje de validación indicando que `size` debe ser un entero numérico. | DTO rechaza tipos no válidos. |
| **PA-10** | `GET /api/v1/academic/loyalty?targets=42,72,120` | `targets=42,72,120` | `200 OK` | Metas alcanzadas en las semanas 21, 36 y 60 respectivamente ($O(1)$ por meta). | Confirma la fórmula de progresión aritmética $n = ((objetivo - a_1) / d) + 1$. |
| **PA-11** | `GET /api/v1/academic/sales-forecast?daysAhead=2,5,7` | `daysAhead=2,5,7` | `200 OK` | Pendiente ($m$), intercepto ($b$), ecuación de la recta y pronósticos calculados para $+2$, $+5$ y $+7$ días. | Modelo de regresión OLS exacto con datos históricos deterministas. |

---

## Comandos curl para Reproducción Rápida

```bash
# PA-01: Health check
curl -X GET "http://localhost:3000/health"

# PA-02: Reporte académico general
curl -X GET "http://localhost:3000/api/v1/academic/report"

# PA-03: Benchmark con n = 2.000
curl -X GET "http://localhost:3000/api/v1/academic/benchmark?size=2000"

# PA-04: Benchmark con n = 1
curl -X GET "http://localhost:3000/api/v1/academic/benchmark?size=1"

# PA-05: Benchmark con n = 100.000
curl -X GET "http://localhost:3000/api/v1/academic/benchmark?size=100000"

# PA-06: Comparación cuadrática con n = 2.000 (ejecutada)
curl -X GET "http://localhost:3000/api/v1/academic/quadratic?size=2000"

# PA-07: Comparación cuadrática con n = 10.000 (estimada)
curl -X GET "http://localhost:3000/api/v1/academic/quadratic?size=10000"

# PA-08: Validación límite superior (100.001)
curl -X GET "http://localhost:3000/api/v1/academic/benchmark?size=100001"

# PA-09: Validación tipo alfanumérico
curl -X GET "http://localhost:3000/api/v1/academic/benchmark?size=abc"

# PA-10: Fidelización con progresión aritmética
curl -X GET "http://localhost:3000/api/v1/academic/loyalty?targets=42,72,120"

# PA-11: Proyección de ventas con regresión lineal
curl -X GET "http://localhost:3000/api/v1/academic/sales-forecast?daysAhead=2,5,7"
```

---

## Matriz de Pruebas: Unidad 2 - Estructuras de Datos (ED-01 a ED-10)

| ID | Endpoint / Petición | Método / Parámetros / Body | Código HTTP | Resultado Esperado | Criterio de Aceptación |
|---|---|---|:---:|---|---|
| **ED-01** | `/health` | `GET` (sin body) | `200 OK` | `status: "ok"`, uptime y timestamp ISO. | Se confirma que la ampliación del módulo no degrada la salud del servicio. |
| **ED-02** | `/api/v1/structures/queue/simulate` | `POST` con pedidos `ORD-A`, `ORD-B`, `ORD-C` | `200 OK` | Secuencia de despacho `['ORD-A', 'ORD-B', 'ORD-C']`. | Atención FIFO estricta en orden de llegada sin reindexación O(n). |
| **ED-03** | `/api/v1/structures/priority/simulate` | `POST` con tareas de prioridades efectivas 50, 101 y 40 | `200 OK` | Sale primero la tarea de prioridad 101 (`TASK-101`), luego 50 y finalmente 40. | El MinHeap extrae en la raíz la comanda más urgente en $O(\log n)$. |
| **ED-04** | `/api/v1/structures/stack/simulate` | `POST` con `ADD_ITEM`, `UPDATE_QUANTITY`, `REMOVE_ITEM` y `UNDO` | `200 OK` | `finalItems` contiene el ítem restaurado con la cantidad previa (2). | La pila LIFO invierte la acción de eliminación deterministamente. |
| **ED-05** | `/api/v1/structures/stack/simulate` | `POST` con `ADD_ITEM`, `UNDO` y `ADD_ITEM` | `200 OK` | `redoStackSize = 0` y `finalItems` solo contiene el nuevo ítem. | Una acción nueva tras un deshacer invalida y vacía la pila de rehacer. |
| **ED-06** | `/api/v1/structures/graph/default-route?from=kitchen&to=terrace` | `GET` con query params | `200 OK` | `reachable: true`, costo 21 segundos, ruta `kitchen -> passage -> table-1 -> terrace`. | Dijkstra sobre el plano fijo calcula el camino mínimo calibrado exacto. |
| **ED-07** | `/api/v1/structures/graph/shortest-path` | `POST` con arista de costo `-1` | `400 Bad Request` | Mensaje de error explicando que no se admiten costos negativos. | El DTO rechaza pesos negativos para preservar la validez de Dijkstra. |
| **ED-08** | `/api/v1/structures/graph/shortest-path` | `POST` entre nodos inconexos | `200 OK` | `reachable: false`, `path: []`, `totalCostSeconds: null`. | Grafo sin camino responde correctamente sin arrojar error 500. |
| **ED-09** | `/api/v1/structures/index/simulate` | `POST` con lista de pedidos y búsqueda por ID | `200 OK` | `found: true`, `mapOperations: 1` frente a búsqueda lineal secuencial. | Demuestra acceso promedio $O(1)$ por tabla hash vs $O(n)$ lineal. |
| **ED-10** | `/api/v1/structures/priority/simulate` | `POST` con 1.001 tareas | `400 Bad Request` | Error de validación por superar el límite de 1.000 tareas. | Salvaguarda contra sobrecarga de memoria en el servidor. |

---

## Comandos curl para Reproducción de Estructuras de Datos (ED-01 a ED-10)

```bash
# ED-01: Health check
curl -X GET "http://localhost:3000/health"

# ED-02: Cola FIFO de pedidos
curl -X POST "http://localhost:3000/api/v1/structures/queue/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      { "id": "ORD-A", "table": 1, "items": ["Pizza Napolitana"] },
      { "id": "ORD-B", "table": 2, "items": ["Pasta Carbonara"] },
      { "id": "ORD-C", "table": 3, "items": ["Ensalada César"] }
    ]
  }'

# ED-03: Cola de prioridad / Heap de cocina
curl -X POST "http://localhost:3000/api/v1/structures/priority/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      { "id": "TASK-50", "description": "Hamburguesa", "urgency": "normal", "waitingMinutes": 0 },
      { "id": "TASK-101", "description": "Lomo al Trapo", "urgency": "urgente", "waitingMinutes": 1 },
      { "id": "TASK-40", "description": "Bebida", "urgency": "baja", "waitingMinutes": 30 }
    ]
  }'

# ED-04: Historial de borrador (Pila Undo restaura ítem eliminado)
curl -X POST "http://localhost:3000/api/v1/structures/stack/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      { "type": "ADD_ITEM", "itemId": "ITEM-1", "name": "Hamburguesa", "quantity": 1 },
      { "type": "UPDATE_QUANTITY", "itemId": "ITEM-1", "quantity": 2 },
      { "type": "REMOVE_ITEM", "itemId": "ITEM-1" },
      { "type": "UNDO" }
    ]
  }'

# ED-05: Pila Redo vaciada tras nueva acción post-undo
curl -X POST "http://localhost:3000/api/v1/structures/stack/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      { "type": "ADD_ITEM", "itemId": "ITEM-1", "name": "Hamburguesa", "quantity": 1 },
      { "type": "UNDO" },
      { "type": "ADD_ITEM", "itemId": "ITEM-2", "name": "Papas Fritas", "quantity": 1 }
    ]
  }'

# ED-06: Ruta óptima plano fijo (kitchen -> terrace = 21s)
curl -X GET "http://localhost:3000/api/v1/structures/graph/default-route?from=kitchen&to=terrace"

# ED-07: Grafo con arista de costo negativo (Rechazo 400)
curl -X POST "http://localhost:3000/api/v1/structures/graph/shortest-path" \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": ["kitchen", "terrace"],
    "edges": [{ "from": "kitchen", "to": "terrace", "cost": -1 }],
    "startNode": "kitchen",
    "targetNode": "terrace"
  }'

# ED-08: Grafo sin camino alcanzable (200 OK con reachable: false)
curl -X POST "http://localhost:3000/api/v1/structures/graph/shortest-path" \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": ["kitchen", "bar", "island"],
    "edges": [{ "from": "kitchen", "to": "bar", "cost": 5 }],
    "startNode": "kitchen",
    "targetNode": "island"
  }'

# ED-09: Índice Map vs búsqueda lineal
curl -X POST "http://localhost:3000/api/v1/structures/index/simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "orders": [
      { "id": "ORD-101", "table": 4, "total": 45000, "clientName": "Valeria" },
      { "id": "ORD-102", "table": 2, "total": 60000, "clientName": "Andrés" }
    ],
    "searchIds": ["ORD-101"]
  }'

# ED-10: Matriz comparativa académica de estructuras
curl -X GET "http://localhost:3000/api/v1/structures/compare"
```

