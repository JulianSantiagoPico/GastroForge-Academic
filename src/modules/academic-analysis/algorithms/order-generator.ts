import { AcademicOrder, OrderStatus } from '../interfaces/academic-order.interface';

const CUSTOMER_FIRST_NAMES = [
  'Carlos', 'Ana', 'Mateo', 'Sofia', 'Santiago',
  'Valentina', 'Alejandro', 'Isabella', 'Daniel', 'Camila',
  'Andrés', 'Mariana', 'Julián', 'Luciana', 'Diego',
  'Gabriela', 'Nicolás', 'Paula', 'David', 'Elena'
];

const CUSTOMER_LAST_NAMES = [
  'Gómez', 'Rodríguez', 'López', 'Martínez', 'Pérez',
  'García', 'Sánchez', 'Ramírez', 'Torres', 'Díaz',
  'Vargas', 'Castro', 'Morales', 'Rojas', 'Herrera'
];

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'preparing',
  'delivered',
  'cancelled'
];

/**
 * Generador Congruencial Lineal (LCG) para asegurar reproducibilidad determinista.
 * Parámetros de Numerical Recipes: a = 1664525, c = 1013904223, m = 2^32.
 */
class DeterministicPRNG {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0);
  }

  public next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return (this.state >>> 16) & 0x7fff;
  }

  public nextBetween(min: number, max: number): number {
    const range = max - min + 1;
    return min + (this.next() % range);
  }
}

/**
 * Genera una lista en memoria de `size` pedidos simulados deterministas.
 * Con la misma semilla y tamaño, la secuencia generada es 100% idéntica.
 *
 * @param size Cantidad de pedidos a generar (1 a 100.000).
 * @param seed Semilla para el generador pseudoaleatorio (por defecto 20260901).
 * @returns Arreglo de pedidos `AcademicOrder`.
 */
export function generateOrders(size: number, seed = 20260901): AcademicOrder[] {
  const prng = new DeterministicPRNG(seed);
  const orders = new Array<AcademicOrder>(size);
  const baseTimestamp = new Date('2026-09-01T08:00:00.000Z').getTime();

  for (let i = 0; i < size; i++) {
    const index = i + 1;
    const id = `ORD-${index.toString().padStart(6, '0')}`;
    const firstName = CUSTOMER_FIRST_NAMES[prng.next() % CUSTOMER_FIRST_NAMES.length];
    const lastName = CUSTOMER_LAST_NAMES[prng.next() % CUSTOMER_LAST_NAMES.length];
    const totalProducts = prng.nextBetween(1, 10);
    const status = ORDER_STATUSES[prng.next() % ORDER_STATUSES.length];
    const createdAt = new Date(baseTimestamp + i * 60000).toISOString();

    orders[i] = {
      id,
      customerName: `${firstName} ${lastName}`,
      totalProducts,
      status,
      createdAt,
    };
  }

  return orders;
}
