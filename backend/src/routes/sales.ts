import { Router } from 'express';
import { requestSOABus } from '../lib/soabus';
import { verificarToken, AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

export const salesRouter = Router();

// 1. Get all products catalog
salesRouter.get('/products', async (req, res) => {
  try {
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
    return res.status(200).json(products);
  } catch (error: any) {
    console.error('Error fetching products directly:', error);
    return res.status(500).json({ error: 'Error al consultar catálogo de productos.' });
  }
});

// 2. Direct POS Checkout
salesRouter.post('/checkout', verificarToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { items, ubicacion } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Debe especificar una lista de items no vacía.'
      });
    }

    // Call service via ESB
    const { status, data } = await requestSOABus(
      'sales',
      JSON.stringify({ action: 'checkout', items, ubicacion, usuarioId: req.user?.userId })
    );

    if (status === 'NK') {
      return res.status(409).json({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: `Error al procesar checkout: ${data}`
      });
    }

    const order = JSON.parse(data);
    return res.status(202).json({
      codigo: 'PROCESO_ACEPTADO',
      mensaje: 'La venta del POS ha sido procesada exitosamente en el bus de servicios.',
      trackingId: order.id,
      orden: order
    });
  } catch (error: any) {
    console.error('Error during POS checkout via ESB:', error);
    return res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error al procesar venta en el bus.'
    });
  }
});

// 3. Get all orders
salesRouter.get('/orders', async (req, res) => {
  try {
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
    return res.status(200).json(orders);
  } catch (error: any) {
    console.error('Error fetching orders directly:', error);
    return res.status(500).json({ error: 'Error al recuperar órdenes.' });
  }
});

// 4. Get active reservations
salesRouter.get('/reservations', async (req, res) => {
  try {
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
    return res.status(200).json(reservations);
  } catch (error: any) {
    console.error('Error fetching reservations directly:', error);
    return res.status(500).json({ error: 'Error al recuperar reservas.' });
  }
});

// 5. Get inventory log (audit history)
salesRouter.get('/history', async (req, res) => {
  try {
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
    return res.status(200).json(history);
  } catch (error: any) {
    console.error('Error fetching inventory history directly:', error);
    return res.status(500).json({ error: 'Error al recuperar historial de inventario.' });
  }
});
