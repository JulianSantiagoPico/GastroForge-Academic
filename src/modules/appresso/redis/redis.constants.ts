/**
 * Constantes y script Lua para la capa de ventana deslizante en Redis (W3).
 */

export const REDIS_CONFIG = {
  CONNECT_TIMEOUT_MS: 3000,
  COMMAND_TIMEOUT_MS: 1500,
  MAX_RETRIES_PER_REQ: 1,
  CIRCUIT_FAILURE_THRESHOLD: 3,
  CIRCUIT_COOLDOWN_MS: 5000,
} as const;

export const REDIS_KEY_PREFIX = 'appresso:win:';

/**
 * Script Lua atómico para la ventana deslizante por usuario.
 *
 * Entradas:
 * KEYS[1]: Clave del Sorted Set (e.g. appresso:win:{userId})
 * ARGV[1]: idTxn del evento
 * ARGV[2]: receivedAt (score en ms)
 * ARGV[3]: minTime = now - windowMs (borde inclusivo: los eventos < minTime se purgan)
 * ARGV[4]: ttlSeconds (expiración de la clave inactiva)
 *
 * Retorna: conteo de eventos vigentes en la ventana.
 *
 * El borde inclusivo se garantiza con:
 * ZREMRANGEBYSCORE key -inf (minTime
 * El paréntesis '(' excluye minTime del borrado, por lo que receivedAt == minTime se conserva.
 */
export const SLIDING_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local idTxn = ARGV[1]
local score = tonumber(ARGV[2])
local minTime = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

-- 1. Purgar eventos estrictamente vencidos (< minTime)
redis.call('ZREMRANGEBYSCORE', key, '-inf', '(' .. minTime)

-- 2. Insertar evento actual (si idTxn ya existe con el mismo score, ZADD no duplica el elemento)
redis.call('ZADD', key, score, idTxn)

-- 3. Contar eventos restantes vigentes en la ventana
local count = redis.call('ZCARD', key)

-- 4. Renovar TTL de la clave para que usuarios inactivos no consuman memoria
redis.call('EXPIRE', key, ttl)

return count
`;
