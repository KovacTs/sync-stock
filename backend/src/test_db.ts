import { prisma } from './lib/prisma';

async function main() {
  const orders = await prisma.orden.findMany({
    select: {
      id: true,
      canal: true,
      estado: true,
      fechaCreacion: true,
      total: true
    },
    orderBy: { fechaCreacion: 'desc' }
  });

  const jsonStr = JSON.stringify(orders);
  console.log('Number of orders:', orders.length);
  console.log('JSON String length (chars):', jsonStr.length);
  console.log('JSON String byte length (bytes):', Buffer.byteLength(jsonStr, 'utf-8'));
  console.log('Last order details:', orders[orders.length - 1]);
  console.log('JSON String tail:', jsonStr.substring(jsonStr.length - 100));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
