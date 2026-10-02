# GUÍA RÁPIDA DE PRUEBAS PARA EL DOCENTE / EVALUADOR
## Microservicio GastroForge-Academic & Appresso (Detección de Fraude)
### Institución Universitaria Pascual Bravo — Programación Avanzada

---

## 🌐 URLs y Recursos en Producción

| Recurso | URL |
|---|---|
| **API Backend (Render)** | [https://gastroforge-academic.onrender.com](https://gastroforge-academic.onrender.com) |
| **Documentación Swagger UI** | [https://gastroforge-academic.onrender.com/docs#/](https://gastroforge-academic.onrender.com/docs#/) |
| **Dashboard Operativo (Vercel)** | [https://gastro-forge-academic.vercel.app](https://gastro-forge-academic.vercel.app) |
| **Health Check (PostgreSQL + Redis)** | [https://gastroforge-academic.onrender.com/api/v1/health](https://gastroforge-academic.onrender.com/api/v1/health) |

---

## 🚀 Método 1: Prueba Rápida sin Cálculo de Firma HMAC (Endpoint Libre)

Para facilitar la evaluación inmediata de la **ventana deslizante** sin necesidad de correr scripts externos de hashing en Python, el backend expone un endpoint de ráfaga que genera, firma internamente y evalúa las transacciones:

### Enviar ráfaga de 5 transacciones en 100 ms (Dispara Anomalía de Fraude)
```bash
curl -X POST "https://gastroforge-academic.onrender.com/api/v1/appresso/simulation/burst" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "profesor@pascualbravo.edu.co",
    "count": 5,
    "delayMs": 100
  }'
```

**Respuesta esperada:**
* Conteo de enviadas: 5
* Anomalías detectadas: a partir de la transacción 3 (o el umbral activo según la franja horaria).
* Desglose con latencia por transacción y episodio abierto.

---

## ⏱️ Método 2: Consultar y Modificar la Ventana y Límites en Caliente

La API permite inspeccionar y alterar la ventana temporal y los límites **en tiempo de ejecución** sin reiniciar el servidor.

### 1. Consultar la configuración activa
```bash
curl -X GET "https://gastroforge-academic.onrender.com/api/v1/appresso/config"
```

**Ejemplo de respuesta:**
```json
{
  "windowMs": 3000,
  "windowSeconds": 3,
  "activeThreshold": 3,
  "currentBand": "NOCHE_MADRUGADA",
  "serverTimeUtc": "2026-10-02T06:55:00.000Z",
  "timeBands": {
    "MANANA": { "scheduleUtc": "05:00:01 - 12:00:00 UTC", "threshold": 10 },
    "TARDE_NOCHE": { "scheduleUtc": "12:00:01 - 20:00:00 UTC", "threshold": 6 },
    "NOCHE_MADRUGADA": { "scheduleUtc": "20:00:01 - 05:00:00 UTC", "threshold": 3 }
  }
}
```

### 2. Cambiar la ventana a 5 segundos y el umbral de la franja activa a 2
```bash
curl -X PATCH "https://gastroforge-academic.onrender.com/api/v1/appresso/config" \
  -H "Content-Type: application/json" \
  -d '{
    "windowSeconds": 5,
    "thresholds": {
      "NOCHE_MADRUGADA": 2
    }
  }'
```

---

## 💳 Método 3: Envío Directo de Transacciones (`POST /transactions`)

El endpoint oficial de ingesta recibe transacciones individuales bajo el contrato de la guía académica:

### Caso A: 3 Transacciones consecutivas del mismo usuario (Genera `POSIBLE_FRAUDE`)

Para agilizar las pruebas, el campo `hash` acepta el HMAC formal, el hash de ejemplo de la guía (`ec37a3a3...`), o el token de prueba `"test"`:

#### Petición 1:
```bash
curl -X POST "https://gastroforge-academic.onrender.com/api/v1/appresso/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "idTxn": 10001,
    "user": "profe@test.com",
    "value": 50000,
    "paymentMethod": "Tarjeta",
    "date": "2026-10-02T10:30:01.000Z",
    "hash": "test"
  }'
```
*(Respuesta: `HTTP 201 Created`, `windowCount: 1`, `anomaly.detected: false`)*

#### Petición 2 (en menos de 3 segundos):
```bash
curl -X POST "https://gastroforge-academic.onrender.com/api/v1/appresso/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "idTxn": 10002,
    "user": "profe@test.com",
    "value": 30000,
    "paymentMethod": "Tarjeta",
    "date": "2026-10-02T10:30:02.000Z",
    "hash": "test"
  }'
```
*(Respuesta: `HTTP 201 Created`, `windowCount: 2`, `anomaly.detected: false`)*

#### Petición 3 (en menos de 3 segundos → Cruce de Umbral):
```bash
curl -X POST "https://gastroforge-academic.onrender.com/api/v1/appresso/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "idTxn": 10003,
    "user": "profe@test.com",
    "value": 20000,
    "paymentMethod": "Tarjeta",
    "date": "2026-10-02T10:30:03.000Z",
    "hash": "test"
  }'
```
*(Respuesta: `HTTP 201 Created`, `windowCount: 3`, `anomaly.detected: true`, `rule: "POSIBLE_FRAUDE"`, `episodeId: "uuid..."`)*

---

### Caso B: Verificación de Idempotencia Estricta
Si repite la misma petición con `idTxn: 10003`:
* El servidor responde `HTTP 200 OK` (en lugar de `201`).
* Devuelve `isDuplicate: true` y no vuelve a sumar la transacción a la ventana del usuario.

---

## 📊 Método 4: Consultar Episodios y Analítica en Tiempo Real

### Listar episodios de anomalía detectados:
```bash
curl -X GET "https://gastroforge-academic.onrender.com/api/v1/appresso/anomalies?limit=10"
```

### Consultar métricas agregadas del sistema:
```bash
curl -X GET "https://gastroforge-academic.onrender.com/api/v1/appresso/analytics/overview"
```

---

## 🖥️ Método 5: Demostración Visual en el Dashboard Web

1. Ingrese a: **[https://gastro-forge-academic.vercel.app](https://gastro-forge-academic.vercel.app)**.
2. Desplácese hasta la sección **Simulador de Tráfico Interactivo**:
   * Ingrese el ID del usuario de prueba (ej. `evaluador-pascual-bravo`).
   * Ajuste la cantidad de transacciones con el control deslizante (ej. `8 transacciones`).
   * Presione **Disparar Ráfaga**.
3. Observe cómo:
   * La tabla interna del simulador detalla la latencia y el resultado (`NORMAL` vs `ALERTA FRAUDE`) de cada transacción.
   * Las tarjetas métricas superiores y la tabla de **Episodios de Anomalía** inferior se actualizan automáticamente en tiempo real.
   * Al hacer clic en un episodio, se despliega el **Drawer Lateral** con la trazabilidad completa y las transacciones que causaron el fraude.
