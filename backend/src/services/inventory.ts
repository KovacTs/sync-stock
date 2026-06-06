import { prisma } from '../lib/prisma';
import { EstadoReserva, TipoMovimiento, CanalVenta, EstadoOrden } from '@prisma/client';

export interface CartItem {
  sku: string;
  cantidad: number;
}

/**
 * Reserves stock for E-Commerce.
 * Lock is acquired via FOR UPDATE on the Inventario record.
 */
export async function reserveStock(sku: string, cantidad: number, ubicacionNombre: string, usuarioId?: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Product
    const product = await tx.producto.findUnique({ where: { sku } });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    // 2. Fetch Location
    const location = await tx.ubicacion.findFirst({ where: { nombre: ubicacionNombre } });
    if (!location) throw new Error('LOCATION_NOT_FOUND');

    // 3. Acquire Pessimistic Lock on Inventario row
    const inventoryResult: any[] = await tx.$queryRaw`
      SELECT * FROM "Inventario"
      WHERE "producto_id" = ${product.id}::uuid AND "ubicacion_id" = ${location.id}::uuid
      FOR UPDATE
    `;

    if (inventoryResult.length === 0) {
      throw new Error('INVENTORY_RECORD_NOT_FOUND');
    }

    const inventory = inventoryResult[0];

    // 4. Check stock availability
    if (inventory.stockDisponible < cantidad) {
      throw new Error('STOCK_INSUFICIENTE');
    }

    // 5. Update Inventario (decrement disponible, increment reservado)
    await tx.inventario.update({
      where: { id: inventory.id },
      data: {
        stockDisponible: inventory.stockDisponible - cantidad,
        stockReservado: inventory.stockReservado + cantidad,
      },
    });

    // 6. Create E-Commerce temporary reservation (TTL 15 minutes)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // +15 mins

    const reserva = await tx.reserva.create({
      data: {
        productoId: product.id,
        ubicacionId: location.id,
        cantidad,
        estado: EstadoReserva.Pendiente,
        fechaCreacion: now,
        fechaExpiracion: expiresAt,
      },
    });

    // 7. Write audit log
    await tx.historialInv.create({
      data: {
        productoId: product.id,
        ubicacionId: location.id,
        cantidad,
        tipoMovimiento: TipoMovimiento.Reserva_Creada,
        usuarioId: usuarioId || (await getSystemUserId(tx)),
      },
    });

    return reserva;
  });
}

/**
 * Commits a reservation when payment is successful.
 */
export async function commitReservation(reservaId: string, usuarioId?: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch and validate Reservation
    const reservation = await tx.reserva.findUnique({ where: { id: reservaId } });
    if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
    if (reservation.estado !== EstadoReserva.Pendiente) {
      throw new Error(`RESERVATION_ALREADY_${reservation.estado}`);
    }

    // 2. Lock Inventario Row
    const inventoryResult: any[] = await tx.$queryRaw`
      SELECT * FROM "Inventario"
      WHERE "producto_id" = ${reservation.productoId}::uuid AND "ubicacion_id" = ${reservation.ubicacionId}::uuid
      FOR UPDATE
    `;
    const inventory = inventoryResult[0];

    // 3. Confirm Reservation state
    await tx.reserva.update({
      where: { id: reservaId },
      data: { estado: EstadoReserva.Confirmada },
    });

    // 4. Update Stock (decrement reserved)
    await tx.inventario.update({
      where: { id: inventory.id },
      data: {
        stockReservado: inventory.stockReservado - reservation.cantidad,
      },
    });

    // 5. Fetch Product for pricing
    const product = await tx.producto.findUnique({ where: { id: reservation.productoId } });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    const total = product.precio.mul(reservation.cantidad);

    // 6. Create Sales Order
    const orden = await tx.orden.create({
      data: {
        canal: CanalVenta.E_Commerce,
        estado: EstadoOrden.Pagada,
        total,
        lineas: {
          create: {
            productoId: product.id,
            cantidad: reservation.cantidad,
            precioUnitario: product.precio,
          },
        },
      },
    });

    // 7. Write audit log
    await tx.historialInv.create({
      data: {
        productoId: product.id,
        ubicacionId: reservation.ubicacionId,
        cantidad: reservation.cantidad,
        tipoMovimiento: TipoMovimiento.Venta,
        usuarioId: usuarioId || (await getSystemUserId(tx)),
      },
    });

    return orden;
  });
}

/**
 * Releases a pending reservation (used for TTL expirations or customer cancellation)
 */
export async function cancelReservation(reservaId: string, isExpired = true, usuarioId?: string) {
  return await prisma.$transaction(async (tx) => {
    const reservation = await tx.reserva.findUnique({ where: { id: reservaId } });
    if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
    if (reservation.estado !== EstadoReserva.Pendiente) {
      throw new Error(`RESERVATION_ALREADY_${reservation.estado}`);
    }

    // Lock Inventario Row
    const inventoryResult: any[] = await tx.$queryRaw`
      SELECT * FROM "Inventario"
      WHERE "producto_id" = ${reservation.productoId}::uuid AND "ubicacion_id" = ${reservation.ubicacionId}::uuid
      FOR UPDATE
    `;
    const inventory = inventoryResult[0];

    // Update Reservation state
    await tx.reserva.update({
      where: { id: reservaId },
      data: { estado: isExpired ? EstadoReserva.Expirada : EstadoReserva.Expirada }, // Keep enum state
    });

    // Return stock (decrement reservado, increment disponible)
    await tx.inventario.update({
      where: { id: inventory.id },
      data: {
        stockDisponible: inventory.stockDisponible + reservation.cantidad,
        stockReservado: inventory.stockReservado - reservation.cantidad,
      },
    });

    // Write audit log
    await tx.historialInv.create({
      data: {
        productoId: reservation.productoId,
        ubicacionId: reservation.ubicacionId,
        cantidad: reservation.cantidad,
        tipoMovimiento: TipoMovimiento.Reserva_Expirada,
        usuarioId: usuarioId || (await getSystemUserId(tx)),
      },
    });
  });
}

/**
 * POS Checkout (Point of Sale). Direct sale, no reservation.
 * Lock is acquired deterministically sorted by Product ID to prevent Deadlocks.
 */
export async function posCheckout(items: CartItem[], ubicacionNombre: string, adminUserId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Location
    const location = await tx.ubicacion.findFirst({ where: { nombre: ubicacionNombre } });
    if (!location) throw new Error('LOCATION_NOT_FOUND');

    // 2. Fetch and order items by SKU/ID deterministically to prevent deadlocks
    const fetchedItems = [];
    for (const item of items) {
      const product = await tx.producto.findUnique({ where: { sku: item.sku } });
      if (!product) throw new Error(`PRODUCT_NOT_FOUND: ${item.sku}`);
      fetchedItems.push({ item, product });
    }

    // Sort items by Product UUID deterministically
    fetchedItems.sort((a, b) => a.product.id.localeCompare(b.product.id));

    let orderTotal = 0;
    const lineItemsData = [];

    // 3. Lock and verify stock for each item in order
    for (const entry of fetchedItems) {
      const { item, product } = entry;

      // Lock row
      const inventoryResult: any[] = await tx.$queryRaw`
        SELECT * FROM "Inventario"
        WHERE "producto_id" = ${product.id}::uuid AND "ubicacion_id" = ${location.id}::uuid
        FOR UPDATE
      `;

      if (inventoryResult.length === 0) {
        throw new Error(`INVENTORY_NOT_FOUND: SKU ${item.sku}`);
      }

      const inventory = inventoryResult[0];

      if (inventory.stockDisponible < item.cantidad) {
        throw new Error(`STOCK_INSUFICIENTE: ${item.sku} (Disponible: ${inventory.stockDisponible})`);
      }

      // Decrement disponible
      await tx.inventario.update({
        where: { id: inventory.id },
        data: {
          stockDisponible: inventory.stockDisponible - item.cantidad,
        },
      });

      const totalItem = product.precio.mul(item.cantidad);
      orderTotal += Number(totalItem);

      lineItemsData.push({
        productoId: product.id,
        cantidad: item.cantidad,
        precioUnitario: product.precio,
      });

      // Write audit log
      await tx.historialInv.create({
        data: {
          productoId: product.id,
          ubicacionId: location.id,
          cantidad: item.cantidad,
          tipoMovimiento: TipoMovimiento.Venta,
          usuarioId: adminUserId,
        },
      });
    }

    // 4. Create Order
    const orden = await tx.orden.create({
      data: {
        canal: CanalVenta.POS_Fisico,
        estado: EstadoOrden.Pagada,
        total: orderTotal,
        lineas: {
          create: lineItemsData,
        },
      },
    });

    return orden;
  });
}

/**
 * Returns a system user id to act as owner of automated tasks.
 */
async function getSystemUserId(tx: any): Promise<string> {
  const systemUser = await tx.usuario.findFirst({ where: { rol: 'Admin' } });
  if (systemUser) return systemUser.id;
  
  // fallback create if not exists
  const newUser = await tx.usuario.create({
    data: {
      username: 'sistema',
      password: 'system_pass_secured',
      rol: 'Admin'
    }
  });
  return newUser.id;
}

/**
 * Creates a new product and initializes its inventory records in all locations.
 */
export async function createProduct(sku: string, nombre: string, precio: number, initialStock?: Array<{ ubicacionNombre: string, cantidad: number }>) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.producto.findUnique({ where: { sku } });
    if (existing) throw new Error('PRODUCT_ALREADY_EXISTS');

    const product = await tx.producto.create({
      data: { sku, nombre, precio }
    });

    const locations = await tx.ubicacion.findMany();
    for (const loc of locations) {
      const stockItem = initialStock?.find(i => i.ubicacionNombre === loc.nombre);
      const qty = stockItem ? stockItem.cantidad : 0;
      await tx.inventario.create({
        data: {
          productoId: product.id,
          ubicacionId: loc.id,
          stockDisponible: qty,
          stockReservado: 0,
          stockTransito: 0
        }
      });
      if (qty > 0) {
        await tx.historialInv.create({
          data: {
            productoId: product.id,
            ubicacionId: loc.id,
            cantidad: qty,
            tipoMovimiento: TipoMovimiento.Recepcion,
            usuarioId: await getSystemUserId(tx)
          }
        });
      }
    }
    return product;
  });
}

/**
 * Updates product details (name and price).
 */
export async function updateProduct(sku: string, nombre: string, precio: number) {
  return await prisma.producto.update({
    where: { sku },
    data: { nombre, precio }
  });
}

/**
 * Adds stock to an existing product in a specific location.
 */
export async function addStock(sku: string, cantidad: number, ubicacionNombre: string, usuarioId?: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Product
    const product = await tx.producto.findUnique({ where: { sku } });
    if (!product) throw new Error('PRODUCT_NOT_FOUND');

    // 2. Fetch Location
    const location = await tx.ubicacion.findFirst({ where: { nombre: ubicacionNombre } });
    if (!location) throw new Error('LOCATION_NOT_FOUND');

    // 3. Acquire Pessimistic Lock on Inventario row
    const inventoryResult: any[] = await tx.$queryRaw`
      SELECT * FROM "Inventario"
      WHERE "producto_id" = ${product.id}::uuid AND "ubicacion_id" = ${location.id}::uuid
      FOR UPDATE
    `;

    if (inventoryResult.length === 0) {
      throw new Error('INVENTORY_RECORD_NOT_FOUND');
    }

    const inventory = inventoryResult[0];

    // 4. Update Inventario (increment disponible)
    const updatedInv = await tx.inventario.update({
      where: { id: inventory.id },
      data: {
        stockDisponible: inventory.stockDisponible + cantidad,
      },
    });

    // 5. Write audit log
    await tx.historialInv.create({
      data: {
        productoId: product.id,
        ubicacionId: location.id,
        cantidad,
        tipoMovimiento: TipoMovimiento.Recepcion,
        usuarioId: usuarioId || (await getSystemUserId(tx)),
      },
    });

    return updatedInv;
  });
}

/**
 * Dispatches an order, changing its status to Despachada.
 */
export async function dispatchOrder(orderId: string) {
  return await prisma.orden.update({
    where: { id: orderId },
    data: { estado: EstadoOrden.Despachada }
  });
}
