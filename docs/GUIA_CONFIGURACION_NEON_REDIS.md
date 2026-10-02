# Guía de Configuración Operativa: Neon PostgreSQL y Redis

Esta guía documenta los pasos exactos para aprovisionar, conectar y verificar Neon PostgreSQL y Redis en los entornos de desarrollo, staging y producción de GastroForge / Appresso.

---

## 1. Neon PostgreSQL

Neon es una plataforma serverless de PostgreSQL que separa el almacenamiento del cómputo. Para operar Appresso de manera confiable, es imprescindible entender la diferencia entre la conexión **pooled** y la conexión **directa**.

### 1.1 Crear el Proyecto y las Bases de Datos

1. Ingresar a la consola de [Neon](https://console.neon.tech).
2. Crear un nuevo proyecto (ej. `gastroforge-appresso`).
3. Crear tres ramas o bases de datos independientes según el entorno:
   - `development` (o rama `main` para desarrollo)
   - `staging`
   - `production`

### 1.2 Cadenas de Conexión: Pooled vs Directa

En la sección **Connection Details** de la consola de Neon, tenés dos opciones:

| Tipo | Host | Propósito | Variable de Entorno |
|---|---|---|---|
| **Pooled (PgBouncer)** | `ep-xxx-pooler.region.aws.neon.tech` | Tráfico regular de la API NestJS en producción. Reutiliza conexiones y evita agotar el pool de Postgres con miles de requests. | `DATABASE_URL` |
| **Direct (Directa)** | `ep-xxx.region.aws.neon.tech` | Ejecución de migraciones DDL (`migration:run`). Permite sentencias DDL y locks exclusivos que PgBouncer no tolera bien. | `DATABASE_URL_DIRECT` |

> [!IMPORTANT]
> Siempre agregá `?sslmode=require` al final de ambas URLs. Neon rechaza conexiones sin TLS.

Ejemplo de URLs válidas:
```bash
# Pooled (para la API en runtime)
DATABASE_URL="postgresql://neondb_owner:npg_secret123@ep-lively-feather-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Directa (para TypeORM CLI migration:run)
DATABASE_URL_DIRECT="postgresql://neondb_owner:npg_secret123@ep-lively-feather.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 1.3 Advisory Locks en PgBouncer
Appresso utiliza `pg_advisory_xact_lock` para la serialización de transacciones por usuario. Al ser un lock a nivel de transacción (`xact`), se libera automáticamente al terminar la transacción (`COMMIT` o `ROLLBACK`). Esto es compatible con PgBouncer en modo de pooling transaccional (`transaction pooling`).

### 1.4 Ejecución de Migraciones Iniciales

Para aplicar las tablas e índices sobre una base Neon vacía:
```bash
# Ejecutar desde local o CI apuntando a la conexión directa
DATABASE_URL_DIRECT="postgresql://...direct..." npm run migration:run
```

---

## 2. Redis (Capa Temporal de Ventana Deslizante)

Redis almacena únicamente el estado temporal reconstruible de la ventana deslizante por usuario mediante Sorted Sets y scripts Lua atómicos.

### 2.1 Proveedor Recomendado

Podés utilizar:
- **Upstash Redis:** Ideal para serverless, incluye TLS nativo (`rediss://`) y persistencia.
- **Render Managed Redis / Redis Cloud / Aiven:** Instancias dedicadas estándar.

### 2.2 Requisitos Obligatorios

1. **Protocolo TLS:** La URL debe comenzar con `rediss://` (con doble `s`).
   Ejemplo:
   ```bash
   REDIS_URL="rediss://default:AbCdEf123456@us1-fresh-lion-12345.upstash.io:6379"
   ```
2. **Política de Memoria (Eviction Policy):**
   - Configurar `volatile-lru` o `allkeys-lru`.
   - El script Lua de Appresso ya establece un TTL automático en cada inserción (`EXPIRE key ttl`), por lo que claves inactivas se purgan solas.
3. **Resiliencia y Circuit Breaker:**
   - La API cuenta con un Circuit Breaker integrado en `RedisSlidingWindowAdapter`.
   - Si Redis falla, supera el timeout (1500 ms) o cae, el sistema pasa a estado `OPEN`, degrada temporalmente a PostgreSQL y emite métricas de degradación sin tirar abajo la ingesta de transacciones.

---

## 3. Matriz de Variables de Entorno para Producción

### 3.1 Backend (Render / Railway / AWS ECS)

| Variable | Valor de Ejemplo | Descripción |
|---|---|---|
| `NODE_ENV` | `production` | Obligatorio. Desactiva in-memory silencioso. |
| `PORT` | `3000` | Puerto HTTP del servicio. |
| `DATABASE_URL` | `postgresql://...@ep-xxx-pooler...neon.tech/db?sslmode=require` | Conexión pooled a Neon. |
| `DATABASE_URL_DIRECT` | `postgresql://...@ep-xxx...neon.tech/db?sslmode=require` | Conexión directa a Neon para migraciones. |
| `TYPEORM_MIGRATIONS_RUN` | `true` | Aplica migraciones pendientes al iniciar el proceso. |
| `REDIS_URL` | `rediss://default:...@host:port` | Instancia Redis con TLS. |
| `APPRESSO_HMAC_SECRET` | `cadena_criptografica_segura_de_64_caracteres` | Secreto para verificar la firma de transacciones. |
| `CORS_ORIGIN` | `https://gastroforge-dashboard.vercel.app` | Dominio del frontend en Vercel. |

### 3.2 Frontend (Vercel)

| Variable | Valor de Ejemplo | Descripción |
|---|---|---|
| `VITE_APPRESSO_API_BASE_URL` | `https://api.tudominio.com` | URL pública de la API de NestJS. |

---

## 4. Checklist de Verificación de Producción

- [ ] Las migraciones se aplican en Neon sin errores (`1727800000000-InitialAppressoSchema` y `1727800000001-AddAnalyticsIndexes`).
- [ ] La API arranca con `NODE_ENV=production` y falla de inmediato si `DATABASE_URL` no está definida.
- [ ] Redis conecta con TLS y el endpoint de healthcheck reporta estado `ok` para Postgres y Redis.
- [ ] Los endpoints analíticos (`/api/v1/appresso/analytics/overview`) responden en menos de 100 ms sobre Neon.
- [ ] El frontend en Vercel puede comunicarse con la API sin errores de CORS.
