import { prisma } from './lib/prisma';
import zlib from 'zlib';

async function main() {
  const history = await prisma.historialInv.findMany({
    select: {
      id: true,
      fechaHora: true,
      cantidad: true,
      tipoMovimiento: true,
      producto: {
        select: { nombre: true }
      },
      ubicacion: {
        select: { nombre: true }
      },
      usuario: {
        select: { username: true, rol: true }
      }
    },
    orderBy: { fechaHora: 'desc' },
    take: 15
  });

  const jsonStr = JSON.stringify(history);
  const compressed = zlib.deflateSync(jsonStr).toString('base64');
  console.log('Number of history records:', history.length);
  console.log('JSON String length:', jsonStr.length);
  console.log('Compressed base64 length:', compressed.length);
  console.log('Compressed prefix + base64 length:', ('_Z_' + compressed).length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
