-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('Vendedor', 'Admin', 'ECommerce');

-- CreateEnum
CREATE TYPE "TipoUbicacion" AS ENUM ('Tienda', 'Bodega');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('Pendiente', 'Confirmada', 'Expirada');

-- CreateEnum
CREATE TYPE "CanalVenta" AS ENUM ('POS_Fisico', 'E_Commerce');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('Creada', 'Pagada', 'Despachada', 'Cancelada');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('Venta', 'Reserva_Creada', 'Reserva_Expirada', 'Recepcion', 'Ajuste');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(100) NOT NULL,
    "rol" "Rol" NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ubicacion" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" "TipoUbicacion" NOT NULL,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "ubicacion_id" UUID NOT NULL,
    "stockDisponible" INTEGER NOT NULL DEFAULT 0,
    "stockReservado" INTEGER NOT NULL DEFAULT 0,
    "stockTransito" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "ubicacion_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'Pendiente',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orden" (
    "id" UUID NOT NULL,
    "canal" "CanalVenta" NOT NULL,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'Creada',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Orden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaOrden" (
    "id" UUID NOT NULL,
    "orden_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "LineaOrden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialInv" (
    "id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "ubicacion_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "tipo_movimiento" "TipoMovimiento" NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "HistorialInv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_sku_key" ON "Producto"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Inventario_producto_id_ubicacion_id_key" ON "Inventario"("producto_id", "ubicacion_id");

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "Ubicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "Ubicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaOrden" ADD CONSTRAINT "LineaOrden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "Orden"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaOrden" ADD CONSTRAINT "LineaOrden_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialInv" ADD CONSTRAINT "HistorialInv_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialInv" ADD CONSTRAINT "HistorialInv_ubicacion_id_fkey" FOREIGN KEY ("ubicacion_id") REFERENCES "Ubicacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialInv" ADD CONSTRAINT "HistorialInv_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
