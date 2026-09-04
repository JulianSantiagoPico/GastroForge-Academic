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
