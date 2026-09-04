# Proyecto académico - Guía del ejercicio de Programación Avanzada

**Propósito:** desarrollar desde cero un repositorio independiente para el ejercicio de complejidad computacional, inspirado en el dominio de Gastroforge, y exponer una API pública, de solo lectura, que permita al docente verificar los resultados mediante peticiones HTTP.

> Este repositorio no depende del ERP Gastroforge. Se crea separado para evitar desarrollar simultáneamente la base de datos, autenticación, pedidos, frontend y análisis académico. Después puede reutilizarse como módulo, o conservarse como evidencia independiente del trabajo de Programación Avanzada.

---

## 1. Qué pide el ejercicio

La actividad usa como ejemplo una cafetería que procesa pedidos. Para Gastroforge se adaptará al dominio de restaurantes: se generará una colección de **pedidos simulados** y se analizarán algoritmos que podrían aplicarse a ese tipo de información.

La entrega debe demostrar:

1. Búsqueda de un pedido por identificador.
2. Cálculo del total de productos procesados.
3. Análisis de una estructura de pedidos con una función recursiva.
4. Comparación del comportamiento con diferentes tamaños de entrada.
5. Conteo de operaciones, mejor caso, peor caso y complejidad Big O.
6. Un caso de complejidad cuadrática y su representación mediante sumatoria.
7. Progresión aritmética para los pedidos crecientes de un cliente.
8. Regresión lineal para proyectar ventas a 2, 5 y 7 días.

El tiempo de ejecución será una medida complementaria. La evidencia principal será el número de operaciones y el análisis de cómo crecen cuando aumenta `n`.

---

## 2. Alcance del repositorio independiente

La primera versión contiene únicamente:

- API NestJS.
- Módulo `academic-analysis`.
- Datos de pedidos generados en memoria.
- Algoritmos y contadores de operaciones.
- Validación de parámetros.
- Swagger/OpenAPI.
- Endpoint `/health`.
- Despliegue de la API en Render.
- Documentación de pruebas manuales.

No contiene todavía:

- Frontend React.
- PostgreSQL, Prisma o migraciones.
- Usuarios, login, JWT o multi-tenancy.
- SSE, WebSockets o notificaciones en tiempo real.
- Módulos operativos de menú, mesas, cocina, caja o inventario.
- CI/CD propio.

La separación es intencional: este trabajo estudia algoritmos y complejidad; el ERP estudiará procesos de negocio y persistencia. No se debe crear una base de datos solo para satisfacer este ejercicio.

## 3. Decisión de implementación

Se creará un repositorio independiente, por ejemplo `gastroforge-academic-api`, con un módulo aislado dentro de NestJS:

```text
gastroforge-academic-api/
├─ src/
│  ├─ app.module.ts
│  ├─ main.ts
│  └─ modules/academic-analysis/
│     ├─ academic-analysis.module.ts
│     ├─ academic-analysis.controller.ts
│     ├─ academic-analysis.service.ts
│     ├─ dto/
│     │  ├─ benchmark-query.dto.ts
│     │  └─ forecast-query.dto.ts
│     └─ algorithms/
│        ├─ order-generator.ts
│        ├─ linear-search.ts
│        ├─ aggregation.ts
│        ├─ recursive-analysis.ts
│        ├─ quadratic-analysis.ts
│        ├─ arithmetic-progression.ts
│        └─ linear-regression.ts
├─ docs/
│  ├─ pruebas-manuales.md
│  └─ decisiones.md
├─ .env.example
├─ Dockerfile
├─ package.json
└─ README.md
```

La estructura anterior sustituye la ubicación prevista dentro de `apps/api` del ERP. Si en el futuro se integra al proyecto principal, el directorio `modules/academic-analysis` podrá copiarse o convertirse en un módulo NestJS interno.

Este módulo no utiliza pedidos reales, no modifica PostgreSQL y no requiere autenticación. Genera datos con una semilla fija, de modo que el docente puede repetir una petición y obtener los mismos conteos y resultados lógicos.

---

## 4. Endpoint público para revisión

Base de producción, una vez desplegado el repositorio:

```text
https://gastroforge-academic-api.onrender.com/api/v1/academic
```

Más adelante, si se integra al ERP, la URL podría cambiar a `https://api.gastroforge.com/api/v1/academic`; el contrato no debe cambiar.

| Endpoint | Propósito |
|---|---|
| `GET /report` | Ejecuta el informe completo con tamaños predefinidos. Es el endpoint principal para el docente. |
| `GET /benchmark?size=2000` | Ejecuta búsqueda, agregación y recursividad para un tamaño específico. |
| `GET /quadratic?size=1000` | Ejecuta o estima el algoritmo cuadrático, según el tamaño. |
| `GET /loyalty?targets=42,72,120` | Resuelve la progresión aritmética de fidelización. |
| `GET /sales-forecast?daysAhead=2,5,7` | Calcula regresión lineal y proyecciones de ventas. |
| `GET /docs` | Swagger/OpenAPI para que se puedan probar y consultar los contratos. |
| `GET /health` | Verifica que la API desplegada está disponible. |

Ejemplo de prueba:

```bash
curl "https://gastroforge-academic-api.onrender.com/api/v1/academic/benchmark?size=2000"
```

---

## 5. Qué pasa si el docente envía `size=2000`

Debe funcionar correctamente. `2000` es un tamaño intermedio útil para evidenciar el crecimiento lineal sin depender solo de los tamaños sugeridos en la presentación.

### Reglas de validación

| Algoritmo | Tamaño aceptado | Respuesta para `size=2000` | Razón |
|---|---:|---|---|
| Búsqueda lineal | 1 a 100.000 | Se ejecuta. | Tiene costo O(n); 2.000 iteraciones son seguras. |
| Total de productos | 1 a 100.000 | Se ejecuta. | Tiene costo O(n). |
| Recursión divide y vencerás | 1 a 100.000 | Se ejecuta. | Recorre n elementos, pero su profundidad es aproximadamente log2(n). |
| Comparación cuadrática | 1 a 2.000 | Se ejecuta. | Al comparar pares únicos, son 1.999.000 comparaciones; es demostrable, pero se debe controlar. |
| Comparación cuadrática | 2.001 a 100.000 | No se ejecuta; se entrega estimación. | Evita bloquear la API con millones o miles de millones de operaciones. |

Si el profesor consulta:

```text
GET /benchmark?size=2000
```

la API devuelve HTTP `200` y los resultados medidos.

Si consulta:

```text
GET /quadratic?size=10000
```

la API también debe devolver HTTP `200`, pero no ejecutará los 100 millones de comparaciones. En su lugar devolverá una respuesta transparente:

```json
{
  "size": 10000,
  "algorithm": "comparación de pares de pedidos",
  "timeComplexity": "O(n²)",
  "estimatedOperations": 49995000,
  "executed": false,
  "reason": "El tamaño excede el límite seguro de ejecución para O(n²); se entrega el cálculo teórico."
}
```

Si el tamaño es inválido, por ejemplo `size=-1`, `size=abc` o `size=100001`, se devuelve HTTP `400`:

```json
{
  "statusCode": 400,
  "message": "size debe ser un entero entre 1 y 100000",
  "error": "Bad Request"
}
```

Esto es preferible a aceptar cualquier número, porque un endpoint público no debe permitir que una sola petición agote la memoria o CPU del servicio en Render.

---

## 6. Algoritmos y análisis esperado

### 5.1 Búsqueda lineal de pedido por ID

Se genera una lista de pedidos y se busca un identificador específico recorriendo uno a uno los registros.

```ts
function findOrderById(orders: Order[], targetId: string) {
  let operations = 0;

  for (const order of orders) {
    operations++;
    if (order.id === targetId) {
      return { order, operations };
    }
  }

  return { order: null, operations };
}
```

| Caso | Ubicación del pedido buscado | Operaciones aproximadas | Complejidad |
|---|---|---:|---|
| Mejor caso | Primera posición | 1 | O(1) |
| Caso promedio | Mitad de la lista | n / 2 | O(n) |
| Peor caso | Última posición o inexistente | n | O(n) |

Para que la prueba sea repetible, `benchmark` usará por defecto el pedido ubicado al final de la lista: representa el peor caso. Opcionalmente puede recibir `case=best`, `case=average` o `case=worst`.

### 5.2 Total de productos procesados

Cada pedido simulado incluye una cantidad total de productos. El algoritmo suma esa cantidad para todos los pedidos.

```ts
function countProcessedProducts(orders: Order[]) {
  let total = 0;
  let operations = 0;

  for (const order of orders) {
    total += order.totalProducts;
    operations++;
  }

  return { total, operations };
}
```

El algoritmo visita todos los pedidos una vez: tiempo O(n) y memoria adicional O(1).

### 5.3 Análisis recursivo

No se debe hacer una recursión de uno en uno hasta 100.000 porque JavaScript podría exceder el límite de pila. Se utilizará división y conquista: se parte el rango de pedidos en dos mitades hasta llegar a un pedido individual.

```ts
function countProductsRecursive(orders: Order[], start = 0, end = orders.length) {
  if (end - start === 0) return { total: 0, operations: 0 };
  if (end - start === 1) {
    return { total: orders[start].totalProducts, operations: 1 };
  }

  const middle = Math.floor((start + end) / 2);
  const left = countProductsRecursive(orders, start, middle);
  const right = countProductsRecursive(orders, middle, end);

  return {
    total: left.total + right.total,
    operations: left.operations + right.operations,
  };
}
```

Visita cada pedido: O(n) en tiempo. Como divide el problema a la mitad, la profundidad de llamadas es O(log n), lo que permite trabajar con 100.000 pedidos de forma segura.

### 5.4 Caso cuadrático y sumatoria

Se comparan pares de pedidos para ilustrar, por ejemplo, una detección simple de posibles duplicados:

```ts
for (let i = 0; i < orders.length; i++) {
  for (let j = i + 1; j < orders.length; j++) {
    operations++;
    // comparar orders[i] con orders[j]
  }
}
```

El número de comparaciones es:

```text
(n - 1) + (n - 2) + ... + 1
= n(n - 1) / 2
```

| n | Comparaciones de pares |
|---:|---:|
| 10 | 45 |
| 100 | 4.950 |
| 1.000 | 499.500 |
| 2.000 | 1.999.000 |
| 10.000 | 49.995.000 |
| 100.000 | 4.999.950.000 |

Por ello, se ejecuta realmente hasta 2.000 elementos y luego se informa el valor matemático. Esto no es una omisión: es la evidencia práctica de que una solución O(n²) deja de ser escalable.

### 5.5 Progresión aritmética de fidelización

El cliente empieza solicitando 2 productos y aumenta 2 productos por semana:

```text
aₙ = a₁ + (n - 1)d
a₁ = 2
d = 2
```

Para encontrar la semana de un objetivo:

```text
n = ((objetivo - a₁) / d) + 1
```

| Objetivo | Semana |
|---:|---:|
| 42 productos | 21 |
| 72 productos | 36 |
| 120 productos | 60 |

La fórmula obtiene el resultado directamente: O(1).

### 5.6 Regresión lineal de ventas

Se usará un histórico fijo y documentado de ventas diarias simuladas. La API calculará la recta:

```text
y = mx + b
```

Donde `x` es el día, `y` son las ventas, `m` es la pendiente y `b` es el intercepto. Después evaluará la fórmula para los días actuales + 2, +5 y +7.

La respuesta debe incluir el conjunto de datos, pendiente, intercepto, fórmula y proyecciones; así se puede revisar el cálculo. Se aclarará que es una estimación académica y no una predicción financiera real.

---

## 7. Contrato sugerido de `GET /benchmark`

Ejemplo:

```text
GET /api/v1/academic/benchmark?size=2000&case=worst
```

Respuesta:

```json
{
  "input": {
    "size": 2000,
    "case": "worst",
    "dataSource": "Pedidos simulados deterministas"
  },
  "linearSearch": {
    "targetPosition": 2000,
    "found": true,
    "operations": 2000,
    "elapsedMs": 0.42,
    "bestCase": "O(1)",
    "worstCase": "O(n)"
  },
  "productAggregation": {
    "totalProducts": 6021,
    "operations": 2000,
    "elapsedMs": 0.18,
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(1)"
  },
  "recursiveAggregation": {
    "totalProducts": 6021,
    "operations": 2000,
    "maxDepth": 11,
    "elapsedMs": 0.54,
    "timeComplexity": "O(n)",
    "spaceComplexity": "O(log n)"
  },
  "notes": [
    "elapsedMs puede variar según la máquina y Render.",
    "operations es la medida principal para comparar el crecimiento."
  ]
}
```

`elapsedMs` se tomará con `performance.now()` y se redondeará. No debe utilizarse para afirmar que un algoritmo es mejor solo por una ejecución aislada.

---

## 8. Cómo construirlo en orden

### Paso 1: Crear datos simulados

- Definir interfaz `AcademicOrder`: `id`, `customerName`, `totalProducts`, `status`.
- Crear `generateOrders(size, seed)` sin usar la base de datos.
- Mantener una semilla fija, por ejemplo `20260901`.
- Generar IDs predecibles, como `ORD-000001` hasta `ORD-100000`.

Antes de programar:

```bash
npm i -g @nestjs/cli
nest new gastroforge-academic-api
cd gastroforge-academic-api
npm install class-validator class-transformer @nestjs/swagger
```

El proyecto puede comenzar con el adaptador Express que Nest instala por defecto. No hay que crear todavía PostgreSQL, Prisma ni un frontend.

### Paso 2: Implementar algoritmos puros

- Cada algoritmo recibe datos y devuelve resultado + contador de operaciones.
- No debe conocer HTTP, NestJS ni Prisma.
- Incluir comentarios que expliquen qué cuenta como operación.

### Paso 3: Crear `AcademicAnalysisService`

- Validar el tamaño solicitado.
- Generar datos.
- Ejecutar búsqueda, suma y recursión.
- Ejecutar o estimar el caso cuadrático de acuerdo con el límite.
- Entregar complejidades teóricas y resultados empíricos.

### Paso 4: Exponer controlador NestJS

- Declarar DTO con `@IsInt()`, `@Min(1)` y `@Max(100000)`.
- Convertir el query parameter a número con `ValidationPipe`.
- Marcar rutas académicas como públicas mediante el decorador que se defina para rutas sin JWT.
- Añadir rate limit básico, por ejemplo 20 solicitudes por minuto por IP.

### Paso 5: Documentar con Swagger

- Describir cada parámetro, rango permitido y respuesta de error 400.
- Añadir ejemplos de peticiones para `10`, `2000`, `100000` y un valor inválido.
- Mantener Swagger accesible en `/api/v1/docs` para la revisión.

### Paso 6: Desplegar en Render

- Crear variables de entorno necesarias para NestJS.
- Configurar `GET /health` como health check de Render.
- Confirmar en producción que `/academic/report`, `/benchmark?size=2000` y `/docs` responden.
- Registrar la URL final en README y en la entrega de la materia.

---

## 9. Guía de pruebas manuales

| ID | Petición | Resultado esperado |
|---|---|---|
| PA-01 | `GET /health` | HTTP 200 y estado saludable. |
| PA-02 | `GET /academic/report` | HTTP 200, informe con 10, 100, 1.000, 10.000 y 100.000. |
| PA-03 | `GET /academic/benchmark?size=2000` | HTTP 200; búsqueda y agregaciones con 2.000 operaciones en peor caso. |
| PA-04 | `GET /academic/benchmark?size=1` | HTTP 200; 1 operación en las rutinas lineales. |
| PA-05 | `GET /academic/benchmark?size=100000` | HTTP 200; algoritmos lineales y recursivo finalizan sin error de pila. |
| PA-06 | `GET /academic/quadratic?size=2000` | HTTP 200; algoritmo ejecutado con 1.999.000 comparaciones. |
| PA-07 | `GET /academic/quadratic?size=10000` | HTTP 200; estimación teórica, `executed: false`. |
| PA-08 | `GET /academic/benchmark?size=100001` | HTTP 400; mensaje de validación. |
| PA-09 | `GET /academic/benchmark?size=abc` | HTTP 400; mensaje de validación. |
| PA-10 | `GET /academic/loyalty?targets=42,72,120` | HTTP 200; semanas 21, 36 y 60. |
| PA-11 | `GET /academic/sales-forecast?daysAhead=2,5,7` | HTTP 200; fórmula y tres predicciones. |

Para cada prueba se debe registrar fecha, URL, parámetros, respuesta, resultado esperado, resultado obtenido, captura de pantalla y estado (aprobada/fallida).

---

## 10. Decisiones que se deben explicar en la sustentación

1. **Datos simulados en lugar de PostgreSQL:** hace las pruebas repetibles y evita exponer información real de restaurantes.
2. **Conteo de operaciones además de milisegundos:** el tiempo depende del servidor, pero Big O y el conteo muestran el crecimiento real del algoritmo.
3. **Límite para O(n²):** protege Render y demuestra por qué el algoritmo no escala.
4. **Recursión por mitades:** permite estudiar recursividad sin alcanzar el límite de pila de JavaScript.
5. **Endpoint público y de solo lectura:** facilita revisión del docente sin comprometer la API operativa.
6. **Validación de entrada:** una URL pública debe controlar tamaños y tipos antes de asignar memoria o CPU.

---

## 11. Alcance y mejoras futuras

Esta implementación cumple el ejercicio académico. No busca reemplazar las consultas reales del ERP. En una evolución futura se podrían añadir:

- Pruebas automatizadas para cada algoritmo y endpoint.
- Exportación de informe a PDF.
- Comparación entre búsqueda lineal y búsqueda binaria sobre pedidos previamente ordenados.
- Gráficas en el frontend con Chart.js para visualizar `n` frente a operaciones.
- Ejecuciones asíncronas si se desean pruebas más pesadas.

No se deben añadir esas mejoras antes de que el flujo principal y las pruebas manuales del ejercicio estén completos.
