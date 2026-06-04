import { Router } from 'express';
import { requestSOABus } from '../lib/soabus';
import { verificarToken, AuthenticatedRequest, permitirRoles } from '../middleware/auth';

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
salesRouter.post('/checkout', verificarToken, permitirRoles('Vendedor', 'Admin'), async (req: AuthenticatedRequest, res) => {
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
salesRouter.get('/orders', verificarToken, permitirRoles('Admin'), async (req, res) => {
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
salesRouter.get('/reservations', verificarToken, permitirRoles('Admin', 'ECommerce'), async (req, res) => {
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
salesRouter.get('/history', verificarToken, permitirRoles('Admin'), async (req, res) => {
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

// 6. Create Product (RF-003)
salesRouter.post('/products', verificarToken, permitirRoles('Admin'), async (req, res) => {
  try {
    const { sku, nombre, precio, initialStock } = req.body;
    if (!sku || !nombre || !precio) {
      return res.status(400).json({
        codigo: 'DATOS_REQUERIDOS',
        mensaje: 'SKU, nombre y precio son requeridos.'
      });
    }

    const { status, data } = await requestSOABus(
      'sales',
      JSON.stringify({ action: 'create-product', sku, nombre, precio, initialStock })
    );

    if (status === 'NK') {
      return res.status(400).json({ codigo: 'ERROR_NEGOCIO', mensaje: data });
    }

    return res.status(201).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error creating product via ESB:', error);
    return res.status(500).json({ error: 'Error al crear producto en el bus.' });
  }
});

// 7. Update Product (RF-003)
salesRouter.put('/products/:sku', verificarToken, permitirRoles('Admin'), async (req, res) => {
  try {
    const { sku } = req.params;
    const { nombre, precio } = req.body;

    if (!nombre || !precio) {
      return res.status(400).json({
        codigo: 'DATOS_REQUERIDOS',
        mensaje: 'Nombre y precio son requeridos.'
      });
    }

    const { status, data } = await requestSOABus(
      'sales',
      JSON.stringify({ action: 'update-product', sku, nombre, precio })
    );

    if (status === 'NK') {
      return res.status(400).json({ codigo: 'ERROR_NEGOCIO', mensaje: data });
    }

    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error updating product via ESB:', error);
    return res.status(500).json({ error: 'Error al actualizar producto en el bus.' });
  }
});

// 8. Dispatch Order (RF-004)
salesRouter.post('/orders/:id/dispatch', verificarToken, permitirRoles('Admin', 'ECommerce'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, data } = await requestSOABus('sales', JSON.stringify({ action: 'dispatch-order', orderId: id }));

    if (status === 'NK') {
      return res.status(400).json({ codigo: 'ERROR_NEGOCIO', mensaje: data });
    }

    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error dispatching order via ESB:', error);
    return res.status(500).json({ error: 'Error al despachar orden en el bus.' });
  }
});
