import { Router } from 'express';
import { requestSOABus } from '../lib/soabus';
import { verificarToken, AuthenticatedRequest } from '../middleware/auth';

export const salesRouter = Router();

// 1. Get all products catalog (via ESB)
salesRouter.get('/products', async (req, res) => {
  try {
    const { status, data } = await requestSOABus('sales', JSON.stringify({ action: 'products' }));
    if (status === 'NK') {
      return res.status(500).json({ error: `Error en el bus: ${data}` });
    }
    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error fetching products via ESB:', error);
    return res.status(500).json({ error: 'Error al consultar catálogo de productos en el bus.' });
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

// 3. Get all orders (via ESB)
salesRouter.get('/orders', async (req, res) => {
  try {
    const { status, data } = await requestSOABus('sales', JSON.stringify({ action: 'orders' }));
    if (status === 'NK') {
      return res.status(500).json({ error: `Error en el bus: ${data}` });
    }
    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error fetching orders via ESB:', error);
    return res.status(500).json({ error: 'Error al recuperar órdenes del bus.' });
  }
});

// 4. Get active reservations (via ESB)
salesRouter.get('/reservations', async (req, res) => {
  try {
    const { status, data } = await requestSOABus('sales', JSON.stringify({ action: 'reservations' }));
    if (status === 'NK') {
      return res.status(500).json({ error: `Error en el bus: ${data}` });
    }
    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error fetching reservations via ESB:', error);
    return res.status(500).json({ error: 'Error al recuperar reservas del bus.' });
  }
});

// 5. Get inventory log (audit history) (via ESB)
salesRouter.get('/history', async (req, res) => {
  try {
    const { status, data } = await requestSOABus('sales', JSON.stringify({ action: 'history' }));
    if (status === 'NK') {
      return res.status(500).json({ error: `Error en el bus: ${data}` });
    }
    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error fetching inventory history via ESB:', error);
    return res.status(500).json({ error: 'Error al recuperar historial de inventario del bus.' });
  }
});
