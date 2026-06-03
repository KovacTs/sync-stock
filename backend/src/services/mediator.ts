import { registerSOAService } from '../lib/soabus';
import { prisma } from '../lib/prisma';
import { posCheckout, commitReservation, reserveStock } from './inventory';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_98765';

/**
 * Registers all transactional services in the TCP ESB.
 */
export async function startESBMediator() {
  console.log('ESB Mediator registering services via TCP sockets...');

  // 1. Auth Service ('autho')
  registerSOAService('autho', async (payloadStr) => {
    const payload = JSON.parse(payloadStr);
    const { username, password } = payload;

    const user = await prisma.usuario.findUnique({ where: { username } });
    if (!user) throw new Error('CREDENTIALS_INVALID');

    let isPasswordCorrect = false;
    if (password === user.password) {
      isPasswordCorrect = true;
    } else {
      isPasswordCorrect = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordCorrect) throw new Error('CREDENTIALS_INVALID');

    const token = jwt.sign(
      { userId: user.id, username: user.username, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    return JSON.stringify({ token, rol: user.rol, username: user.username });
  });

  // 2. Inventory Service ('inven')
  registerSOAService('inven', async (payloadStr) => {
    const payload = JSON.parse(payloadStr);
    const { action } = payload;

    if (action === 'stock') {
      const { sku } = payload;
      const product = await prisma.producto.findUnique({
        where: { sku },
        include: {
          inventarios: {
            include: { ubicacion: true }
          }
        }
      });
      if (!product) throw new Error('PRODUCT_NOT_FOUND');
      return JSON.stringify({
        sku: product.sku,
        nombre: product.nombre,
        precio: product.precio,
        inventario: product.inventarios.map((inv) => ({
          bodega: inv.ubicacion.nombre,
          tipo: inv.ubicacion.tipo,
          disponible: inv.stockDisponible,
          reservado: inv.stockReservado,
          enTransito: inv.stockTransito
        }))
      });
    }

    if (action === 'reserve') {
      const { sku, cantidad, ubicacion, usuarioId } = payload;
      const reservation = await reserveStock(sku, cantidad, ubicacion, usuarioId);
      return JSON.stringify({
        reservaId: reservation.id,
        estado: reservation.estado,
        expiraEn: reservation.fechaExpiracion
      });
    }

    if (action === 'commit') {
      const { reservaId, usuarioId } = payload;
      const order = await commitReservation(reservaId, usuarioId);
      return JSON.stringify({
        id: order.id,
        total: order.total,
        estado: order.estado
      });
    }

    throw new Error('ACTION_NOT_SUPPORTED');
  });

  // 3. Sales Service ('sales')
  registerSOAService('sales', async (payloadStr) => {
    const payload = JSON.parse(payloadStr);
    const { action } = payload;

    if (action === 'products') {
      const products = await prisma.producto.findMany({
        select: {
          sku: true,
          nombre: true,
          precio: true,
          inventarios: {
            select: {
              stockDisponible: true,
              stockReservado: true,
              ubicacion: {
                select: {
                  nombre: true,
                  tipo: true
                }
              }
            }
          }
        }
      });
      return JSON.stringify(products);
    }



    if (action === 'checkout') {
      const { items, ubicacion, usuarioId } = payload;
      // --- DATA TRANSFORMER PATTERN ---
      const canonicalItems = transformLegacyPOSToCanonical({ items });
      // --- MESSAGE ENRICHER PATTERN ---
      const enrichedPayload = await enrichOrderPayload(canonicalItems, ubicacion || 'Tienda Valdivia');
      
      let targetUserId = usuarioId;
      if (!targetUserId) {
        const adminUser = await getAdminUser();
        targetUserId = adminUser.id;
      }
      const order = await posCheckout(enrichedPayload.items, enrichedPayload.location, targetUserId);
      return JSON.stringify(order);
    }

    if (action === 'orders') {
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
      return JSON.stringify(orders);
    }

    if (action === 'reservations') {
      const reservations = await prisma.reserva.findMany({
        select: {
          id: true,
          cantidad: true,
          estado: true,
          fechaExpiracion: true,
          producto: {
            select: { nombre: true }
          },
          ubicacion: {
            select: { nombre: true }
          }
        },
        orderBy: { fechaCreacion: 'desc' }
      });
      return JSON.stringify(reservations);
    }

    if (action === 'history') {
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
        orderBy: { fechaHora: 'desc' }
      });
      return JSON.stringify(history);
    }

    throw new Error('ACTION_NOT_SUPPORTED');
  });
}

/**
 * Data Transformer Pattern
 */
function transformLegacyPOSToCanonical(rawPayload: any): any[] {
  if (Array.isArray(rawPayload.items)) {
    return rawPayload.items;
  }
  if (rawPayload.itemsList && Array.isArray(rawPayload.itemsList)) {
    return rawPayload.itemsList.map((i: any) => ({
      sku: i.cod || i.sku,
      cantidad: Number(i.cant || i.cantidad || 0),
    }));
  }
  throw new Error('INVALID_PAYLOAD_FORMAT_COULD_NOT_TRANSFORM');
}

/**
 * Message Enricher Pattern
 */
async function enrichOrderPayload(items: any[], defaultLocation: string) {
  const enrichedItems = [];
  for (const item of items) {
    const product = await prisma.producto.findUnique({
      where: { sku: item.sku }
    });
    if (!product) {
      throw new Error(`PRODUCT_SKU_NOT_FOUND: ${item.sku}`);
    }
    enrichedItems.push({
      sku: item.sku,
      cantidad: item.cantidad,
      precio: Number(product.precio),
      nombre: product.nombre
    });
  }

  return {
    items: enrichedItems,
    location: defaultLocation,
    timestamp: new Date().toISOString()
  };
}

/**
 * Helper to fetch any admin user.
 */
async function getAdminUser() {
  let admin = await prisma.usuario.findFirst({ where: { rol: 'Admin' } });
  if (!admin) {
    admin = await prisma.usuario.create({
      data: {
        username: 'admin',
        password: 'admin_pass_secured',
        rol: 'Admin',
      },
    });
  }
  return admin;
}
