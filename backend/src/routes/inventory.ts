import { Router } from 'express';
import { requestSOABus } from '../lib/soabus';
import { verificarToken, AuthenticatedRequest } from '../middleware/auth';

export const inventoryRouter = Router();

// 1. Stock Query
inventoryRouter.get('/stock/:sku', async (req, res) => {
  try {
    const { sku } = req.params;

    const { status, data } = await requestSOABus('inven', JSON.stringify({ action: 'stock', sku }));

    if (status === 'NK') {
      return res.status(404).json({
        codigo: 'PRODUCTO_NO_ENCONTRADO',
        mensaje: `El producto con SKU ${sku} no existe en el catálogo.`
      });
    }

    return res.status(200).json(JSON.parse(data));
  } catch (error: any) {
    console.error('Error fetching stock via ESB:', error);
    return res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error al consultar stock en el bus.'
    });
  }
});

// 2. Reserve Stock
inventoryRouter.post('/reserve', verificarToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { sku, cantidad, ubicacion } = req.body;

    if (!sku || !cantidad || !ubicacion) {
      return res.status(400).json({
        codigo: 'DATOS_REQUERIDOS',
        mensaje: 'SKU, cantidad y ubicacion son requeridos.'
      });
    }

    if (cantidad <= 0) {
      return res.status(400).json({
        codigo: 'CANTIDAD_INVALIDA',
        mensaje: 'La cantidad debe ser mayor que cero.'
      });
    }

    // Call service via ESB
    const { status, data } = await requestSOABus(
      'inven',
      JSON.stringify({ action: 'reserve', sku, cantidad, ubicacion, usuarioId: req.user?.userId })
    );

    if (status === 'NK') {
      // Map domain errors
      if (data.includes('PRODUCT_NOT_FOUND')) {
        return res.status(404).json({ codigo: 'PRODUCTO_NO_ENCONTRADO', mensaje: 'El producto especificado no existe.' });
      }
      if (data.includes('LOCATION_NOT_FOUND')) {
        return res.status(404).json({ codigo: 'UBICACION_NO_ENCONTRADA', mensaje: 'La ubicación especificada no existe.' });
      }
      if (data.includes('STOCK_INSUFICIENTE')) {
        return res.status(409).json({ codigo: 'STOCK_INSUFICIENTE', mensaje: 'No hay suficiente stock en esa ubicación.' });
      }
      return res.status(500).json({ codigo: 'ERROR_NEGOCIO', mensaje: data });
    }

    const reservation = JSON.parse(data);
    return res.status(201).json({
      reservaId: reservation.reservaId,
      estado: reservation.estado,
      expiraEn: reservation.expiraEn,
      mensaje: 'Stock reservado temporalmente por 15 minutos.'
    });
  } catch (error: any) {
    console.error('Error reserving stock via ESB:', error);
    return res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error procesando la reserva.'
    });
  }
});

// 3. Commit Reservation
inventoryRouter.post('/commit', verificarToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { reservaId } = req.body;

    if (!reservaId) {
      return res.status(400).json({
        codigo: 'DATOS_REQUERIDOS',
        mensaje: 'reservaId es requerido.'
      });
    }

    // Call service via ESB
    const { status, data } = await requestSOABus('inven', JSON.stringify({ action: 'commit', reservaId, usuarioId: req.user?.userId }));

    if (status === 'NK') {
      return res.status(400).json({
        codigo: 'RESERVA_ESTADO_INVALIDO',
        mensaje: `Error al consolidar reserva: ${data}`
      });
    }

    return res.status(202).json({
      codigo: 'PROCESO_ACEPTADO',
      mensaje: 'La confirmación de la orden ha sido procesada exitosamente en el bus de servicios.',
      trackingId: reservaId,
      detalles: JSON.parse(data)
    });
  } catch (error: any) {
    console.error('Error committing reservation via ESB:', error);
    return res.status(500).json({
      codigo: 'ERROR_INTERNO',
      mensaje: 'Error al enviar confirmación al bus de servicios.'
    });
  }
});
