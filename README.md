# GastroForge Academic API 🍳📊

Repositorio independiente para el ejercicio de **Complejidad Computacional y Algoritmos** de la asignatura **Programación Avanzada**, inspirado en el dominio de gestión gastronómica de **Gastroforge**.

Este proyecto implementa una API REST pública, determinista y de solo lectura construida con **NestJS** y **TypeScript**, diseñada para permitir la verificación empírica y teórica de las órdenes de complejidad computacional ($O(1)$, $O(n)$, $O(n^2)$, $O(\log n)$) sobre colecciones de pedidos simulados en memoria sin requerir bases de datos ni autenticación.

---

## 🚀 Características Principales

- **Sin base de datos ni autenticación:** Datos generados en memoria mediante un generador pseudoaleatorio determinista (LCG) con semilla fija (`20260901`), asegurando reproducibilidad matemática absoluta.
- **Métricas Duales:** Conteo riguroso de operaciones elementales ejecutadas (invariante a la máquina) complementado con medición de tiempo en milisegundos (`performance.now()`).
- **Divide y Vencerás Seguro:** Algoritmo recursivo balanceado con profundidad $O(\log_2 n)$ para procesar hasta 100.000 elementos sin desbordamiento de pila (*call stack overflow*).
- **Salvaguarda Cuadrática:** Algoritmo $O(n^2)$ con ejecución física hasta $n \le 2.000$ (1.999.000 comparaciones) y estimación analítica inmediata mediante sumatoria $\frac{n(n-1)}{2}$ para $n > 2.000$.
- **Modelos Matemáticos Aplicados:**
  - Progresión aritmética de fidelización en $O(1)$ ($a_n = a_1 + (n - 1)d$).
  - Regresión lineal por mínimos cuadrados ($y = mx + b$) con proyecciones de ventas a 2, 5 y 7 días.
- **Validación Estricta:** DTOs con `class-validator` para prevenir sobrecarga de memoria o CPU.
- **Documentación Interactiva:** Swagger / OpenAPI disponible en `/docs` y `/api/v1/docs`.
- **Health Check:** Endpoint `/health` para monitorización de disponibilidad y despliegue continuo en Render.

---

## 📂 Estructura del Proyecto

```text
GastroForge-Academic/
├─ src/
│  ├─ app.module.ts                         # Módulo principal con Throttler y submódulos
│  ├─ main.ts                               # Bootstrap de NestJS, Swagger y filtros globales
│  └─ modules/
│     ├─ health/
│     │  └─ health.controller.ts            # Endpoint GET /health
│     └─ academic-analysis/
│        ├─ academic-analysis.module.ts     # Módulo de análisis académico
│        ├─ academic-analysis.controller.ts # Controlador de endpoints académicos
│        ├─ academic-analysis.service.ts    # Servicio orquestador de algoritmos y reportes
│        ├─ interfaces/
│        │  └─ academic-order.interface.ts  # Definición de modelo AcademicOrder
│        ├─ dto/
│        │  ├─ benchmark-query.dto.ts       # DTO para GET /benchmark (?size=&case=)
│        │  ├─ quadratic-query.dto.ts       # DTO para GET /quadratic (?size=)
│        │  ├─ loyalty-query.dto.ts         # DTO para GET /loyalty (?targets=)
│        │  └─ forecast-query.dto.ts        # DTO para GET /sales-forecast (?daysAhead=)
│        └─ algorithms/
│           ├─ order-generator.ts           # Generador LCG determinista (semilla 20260901)
│           ├─ linear-search.ts             # Búsqueda lineal (mejor, promedio y peor caso)
│           ├─ aggregation.ts               # Suma acumulativa O(n) tiempo, O(1) memoria
│           ├─ recursive-analysis.ts        # Agregación Divide y Vencerás O(log n) pila
│           ├─ quadratic-analysis.ts        # Comparación de pares y sumatoria O(n²)
│           ├─ arithmetic-progression.ts    # Progresión aritmética O(1)
│           └─ linear-regression.ts         # Regresión lineal OLS y proyecciones
├─ docs/
│  ├─ pruebas-manuales.md                   # Matriz de pruebas PA-01 a PA-11 y curls
│  └─ decisiones.md                         # Justificación de decisiones para la sustentación
├─ scripts/
│  └─ verify-phase1.ts                      # Script de verificación automatizada de endpoints
├─ .env.example                             # Variables de entorno requeridas
├─ Dockerfile                               # Construcción multi-stage para producción
├─ package.json                             # Dependencias y scripts del proyecto
├─ tsconfig.json                            # Configuración de compilación TypeScript
└─ README.md                                # Documentación general del repositorio
```

---

## 🛠️ Requisitos Previos

- **Node.js**: v18 o superior (probado en v22.x).
- **npm**: v9 o superior.

---

## ⚡ Instalación y Ejecución Local

1. **Clonar o abrir el repositorio:**
   ```bash
   cd GastroForge-Academic
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar en modo desarrollo:**
   ```bash
   npm run start:dev
   ```

4. **Acceder a la API y Swagger UI:**
   - **Swagger UI:** [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs) o [http://localhost:3000/docs](http://localhost:3000/docs)
   - **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)
   - **Reporte General:** [http://localhost:3000/api/v1/academic/report](http://localhost:3000/api/v1/academic/report)

---

## 📋 Endpoints de la API

| Endpoint | Método | Descripción |
|---|:---:|---|
| `/health` | `GET` | Verificación de estado y uptime de la aplicación. |
| `/api/v1/academic/report` | `GET` | Informe comparativo completo con tamaños estándar ($10, 100, 1000, 10000, 100000$). |
| `/api/v1/academic/benchmark?size=2000&case=worst` | `GET` | Benchmark de búsqueda lineal, agregación iterativa y recursiva. |
| `/api/v1/academic/quadratic?size=2000` | `GET` | Comparación de pares cuadrática con límite seguro de ejecución ($n \le 2000$). |
| `/api/v1/academic/loyalty?targets=42,72,120` | `GET` | Resolución de semanas en progresión aritmética en tiempo $O(1)$. |
| `/api/v1/academic/sales-forecast?daysAhead=2,5,7` | `GET` | Regresión lineal y proyecciones de ventas a futuro. |
| `/api/v1/docs` | `GET` | Interfaz interactiva OpenAPI / Swagger. |

---

## 🧪 Verificación Automatizada de Pruebas

Para validar automáticamente todos los casos del protocolo de pruebas académicas (**PA-01** a **PA-11**):

```bash
npm run test:verify
```

---

## ☁️ Despliegue en Render

El repositorio incluye un `Dockerfile` optimizado en múltiples etapas (*multi-stage build*):
1. **Crear un nuevo Web Service en Render:** Conectar el repositorio de GitHub.
2. **Entorno:** Seleccionar **Docker** (detectará automáticamente el `Dockerfile`).
3. **Health Check Path:** Configurar `/health`.
4. **Variables de entorno:** `PORT=3000`, `NODE_ENV=production`.
