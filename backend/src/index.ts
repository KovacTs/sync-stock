import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { prisma } from './lib/prisma';
import { startESBMediator } from './services/mediator';
import { authRouter } from './routes/auth';
import { inventoryRouter } from './routes/inventory';
import { salesRouter } from './routes/sales';
import { cancelReservation } from './services/inventory';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/sales', salesRouter);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Sync-Stock Backend API - Running' });
});

// Periodic Task: Check for expired reservations and cancel them (TTL Release)
async function startReservationExpirationDaemon() {
  setInterval(async () => {
    try {
      const now = new Date();
      // Find all pending reservations that have expired
      const expiredReservations = await prisma.reserva.findMany({
        where: {
          estado: 'Pendiente',
          fechaExpiracion: { lt: now }
        }
      });

      for (const res of expiredReservations) {
        console.log(`[Expiration Daemon] Reservation ${res.id} expired. Reverting reserved stock...`);
        await cancelReservation(res.id, true);
        console.log(`[Expiration Daemon] Reservation ${res.id} stock reverted successfully.`);
      }
    } catch (error: any) {
      console.error('[Expiration Daemon Error]:', error.message);
    }
  }, 10000); // Check every 10 seconds
}

// Database Seeder
async function seedDatabase() {
  const usersCount = await prisma.usuario.count();
  if (usersCount > 0) {
    console.log('Database already seeded.');
    return;
  }

  console.log('Seeding initial database contents...');

  // 1. Create Users
  const saltRounds = 10;
  const adminPass = await bcrypt.hash('admin123', saltRounds);
  const sellerPass = await bcrypt.hash('vendedor123', saltRounds);

  const admin = await prisma.usuario.create({
    data: { username: 'admin', password: adminPass, rol: 'Admin' }
  });

  const seller = await prisma.usuario.create({
    data: { username: 'vendedor1', password: sellerPass, rol: 'Vendedor' }
  });

  // 2. Create Products
  const rod = await prisma.producto.create({
    data: { sku: 'PES-CA1', nombre: 'Caña de Pescar Shakespeare Ugly Stik', precio: 59990.00 }
  });

  const reel = await prisma.producto.create({
    data: { sku: 'PES-RE1', nombre: 'Carrete de Pescar Shimano Sedona', precio: 79990.00 }
  });

  const hooks = await prisma.producto.create({
    data: { sku: 'PES-AN1', nombre: 'Anzuelos Mustad Pack x10', precio: 4990.00 }
  });

  // 3. Create Locations
  const store = await prisma.ubicacion.create({
    data: { nombre: 'Tienda Valdivia', tipo: 'Tienda' }
  });

  const warehouse = await prisma.ubicacion.create({
    data: { nombre: 'Bodega E-commerce', tipo: 'Bodega' }
  });

  // 4. Create Inventory Stocks
  // Caña
  await prisma.inventario.create({
    data: { productoId: rod.id, ubicacionId: store.id, stockDisponible: 10 }
  });
  await prisma.inventario.create({
    data: { productoId: rod.id, ubicacionId: warehouse.id, stockDisponible: 30 }
  });

  // Carrete
  await prisma.inventario.create({
    data: { productoId: reel.id, ubicacionId: store.id, stockDisponible: 8 }
  });
  await prisma.inventario.create({
    data: { productoId: reel.id, ubicacionId: warehouse.id, stockDisponible: 25 }
  });

  // Anzuelos
  await prisma.inventario.create({
    data: { productoId: hooks.id, ubicacionId: store.id, stockDisponible: 50 }
  });
  await prisma.inventario.create({
    data: { productoId: hooks.id, ubicacionId: warehouse.id, stockDisponible: 200 }
  });

  console.log('Seeding completed successfully!');
}

// Bootstrap Application
async function main() {
  try {
    // 1. Start ESB Mediator TCP Services
    await startESBMediator();

    // 2. Seed Database
    await seedDatabase();

    // 3. Start Expiration Daemon
    await startReservationExpirationDaemon();

    // 4. Start Web Server
    app.listen(PORT, () => {
      console.log(`Sync-Stock REST Backend Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failure bootstrapping backend system:', error);
    process.exit(1);
  }
}

main();
