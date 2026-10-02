import { generateOrders } from '../src/modules/academic-analysis/algorithms/order-generator';

// Tomar cantidad solicitada por argumento CLI o por defecto 10
const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0], 10) : 10;
const validCount = Number.isNaN(count) || count < 1 ? 10 : Math.min(count, 100);

console.log(`\n=============================================================`);
console.log(`📋 MUESTRA DE PEDIDOS SIMULADOS EN MEMORIA (Total: ${validCount})`);
console.log(`   Generador: LCG determinista con semilla fija 20260901`);
console.log(`=============================================================\n`);

const orders = generateOrders(validCount);
console.table(orders);

console.log(`\n💡 Para consultar otra cantidad, ejecuta:`);
console.log(`   npx ts-node scripts/view-orders.ts [cantidad]\n`);
