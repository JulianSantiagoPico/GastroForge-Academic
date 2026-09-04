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
