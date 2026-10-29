-- CreateEnum
CREATE TYPE "TipoOrganizacion" AS ENUM ('COOPERATIVA', 'ASOCIACION', 'EMPRESA', 'OTRA');

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('ACTIVO', 'EN_TRANSITO', 'EN_PROCESO', 'AGOTADO', 'VENDIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoRelacionLote" AS ENUM ('MEZCLA', 'DIVISION', 'TRANSFORMACION');

-- CreateEnum
CREATE TYPE "TipoProceso" AS ENUM ('MEZCLA', 'DIVISION', 'SECADO', 'LIMPIEZA', 'CLASIFICACION');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA_RECEPCION', 'ENTRADA_TRASLADO', 'ENTRADA_PROCESO', 'SALIDA_TRASLADO', 'SALIDA_PROCESO', 'SALIDA_VENTA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "EstadoTraslado" AS ENUM ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('BORRADOR', 'APROBADA', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoTarea" AS ENUM ('INSPECCION_CALIDAD', 'CONFIRMAR_TRASLADO', 'APROBAR_PROCESO', 'APROBAR_LIQUIDACION');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'COMPLETADA', 'CANCELADA');

-- AlterTable
ALTER TABLE "centro" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "telefono" TEXT;

-- AlterTable
ALTER TABLE "productor" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codigo" TEXT NOT NULL,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "dpi" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "organizacion_id" TEXT,
ADD COLUMN     "telefono" TEXT;

-- AlterTable
ALTER TABLE "finca" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "altitud_msnm" INTEGER,
ADD COLUMN     "area_ha" DECIMAL(10,2),
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "latitud" DECIMAL(9,6),
ADD COLUMN     "longitud" DECIMAL(9,6),
ADD COLUMN     "municipio" TEXT;

-- CreateTable
CREATE TABLE "organizacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoOrganizacion" NOT NULL,
    "nit" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprador" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "pais" TEXT NOT NULL,
    "contacto" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grado_calidad" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grado_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "centro_id" TEXT NOT NULL,
    "estado_producto" "EstadoProducto" NOT NULL,
    "grado_calidad_id" TEXT,
    "estado" "EstadoLote" NOT NULL DEFAULT 'ACTIVO',
    "peso_inicial_kg" DECIMAL(12,2) NOT NULL,
    "cosecha" INTEGER NOT NULL,
    "observaciones" TEXT,
    "creado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_origen_recepcion" (
    "lote_id" TEXT NOT NULL,
    "recepcion_id" TEXT NOT NULL,
    "cantidad_kg" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "lote_origen_recepcion_pkey" PRIMARY KEY ("lote_id","recepcion_id")
);

-- CreateTable
CREATE TABLE "lote_relacion" (
    "id" TEXT NOT NULL,
    "padre_id" TEXT NOT NULL,
    "hijo_id" TEXT NOT NULL,
    "proceso_id" TEXT NOT NULL,
    "tipo" "TipoRelacionLote" NOT NULL,
    "cantidad_kg" DECIMAL(12,2) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_relacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote_estado_historial" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "estado_anterior" "EstadoLote",
    "estado_nuevo" "EstadoLote" NOT NULL,
    "motivo" TEXT,
    "usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspeccion_calidad" (
    "id" TEXT NOT NULL,
    "recepcion_id" TEXT,
    "lote_id" TEXT,
    "grado_calidad_id" TEXT,
    "humedad_pct" DECIMAL(5,2),
    "impurezas_pct" DECIMAL(5,2),
    "defectos_pct" DECIMAL(5,2),
    "aprobado" BOOLEAN NOT NULL,
    "observaciones" TEXT,
    "inspector_id" TEXT NOT NULL,
    "inspeccionado_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspeccion_calidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "existencia" (
    "lote_id" TEXT NOT NULL,
    "centro_id" TEXT NOT NULL,
    "cantidad_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "existencia_pkey" PRIMARY KEY ("lote_id","centro_id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "centro_id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad_kg" DECIMAL(12,2) NOT NULL,
    "saldo_kg" DECIMAL(12,2) NOT NULL,
    "referencia_tipo" TEXT,
    "referencia_id" TEXT,
    "motivo" TEXT,
    "usuario_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traslado" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "origen_id" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "cantidad_kg" DECIMAL(12,2) NOT NULL,
    "cantidad_recibida_kg" DECIMAL(12,2),
    "estado" "EstadoTraslado" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "solicitado_por_id" TEXT NOT NULL,
    "recibido_por_id" TEXT,
    "solicitado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "despachado_en" TIMESTAMP(3),
    "recibido_en" TIMESTAMP(3),

    CONSTRAINT "traslado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proceso" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoProceso" NOT NULL,
    "centro_id" TEXT NOT NULL,
    "merma_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "realizado_por_id" TEXT NOT NULL,
    "aprobado_por_id" TEXT,
    "realizado_en" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precio" (
    "id" TEXT NOT NULL,
    "estado_producto" "EstadoProducto" NOT NULL,
    "grado_calidad_id" TEXT,
    "precio_por_kg" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'GTQ',
    "vigente_desde" TIMESTAMP(3) NOT NULL,
    "vigente_hasta" TIMESTAMP(3),
    "creado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "productor_id" TEXT NOT NULL,
    "periodo_inicio" DATE NOT NULL,
    "periodo_fin" DATE NOT NULL,
    "total_kg" DECIMAL(14,2) NOT NULL,
    "total_monto" DECIMAL(14,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'GTQ',
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'BORRADOR',
    "creado_por_id" TEXT NOT NULL,
    "aprobado_por_id" TEXT,
    "aprobado_en" TIMESTAMP(3),
    "pagado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion_detalle" (
    "id" TEXT NOT NULL,
    "liquidacion_id" TEXT NOT NULL,
    "recepcion_id" TEXT NOT NULL,
    "peso_kg" DECIMAL(12,2) NOT NULL,
    "precio_por_kg" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "liquidacion_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "centro_id" TEXT NOT NULL,
    "comprador_id" TEXT NOT NULL,
    "cantidad_kg" DECIMAL(12,2) NOT NULL,
    "precio_por_kg" DECIMAL(12,2),
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "destino" TEXT,
    "vendido_en" TIMESTAMP(3) NOT NULL,
    "registrado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea" (
    "id" TEXT NOT NULL,
    "tipo" "TipoTarea" NOT NULL,
    "titulo" TEXT NOT NULL,
    "usuario_id" TEXT,
    "rol" "Rol",
    "centro_id" TEXT,
    "entidad_tipo" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "vence_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completada_en" TIMESTAMP(3),

    CONSTRAINT "tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizacion_nombre_key" ON "organizacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "organizacion_nit_key" ON "organizacion"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "comprador_nit_key" ON "comprador"("nit");

-- CreateIndex
CREATE INDEX "comprador_nombre_idx" ON "comprador"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "grado_calidad_codigo_key" ON "grado_calidad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "lote_codigo_key" ON "lote"("codigo");

-- CreateIndex
CREATE INDEX "lote_centro_id_idx" ON "lote"("centro_id");

-- CreateIndex
CREATE INDEX "lote_estado_idx" ON "lote"("estado");

-- CreateIndex
CREATE INDEX "lote_estado_producto_grado_calidad_id_idx" ON "lote"("estado_producto", "grado_calidad_id");

-- CreateIndex
CREATE INDEX "lote_origen_recepcion_recepcion_id_idx" ON "lote_origen_recepcion"("recepcion_id");

-- CreateIndex
CREATE INDEX "lote_relacion_padre_id_idx" ON "lote_relacion"("padre_id");

-- CreateIndex
CREATE INDEX "lote_relacion_hijo_id_idx" ON "lote_relacion"("hijo_id");

-- CreateIndex
CREATE UNIQUE INDEX "lote_relacion_padre_id_hijo_id_proceso_id_key" ON "lote_relacion"("padre_id", "hijo_id", "proceso_id");

-- CreateIndex
CREATE INDEX "lote_estado_historial_lote_id_creado_en_idx" ON "lote_estado_historial"("lote_id", "creado_en");

-- CreateIndex
CREATE INDEX "inspeccion_calidad_recepcion_id_idx" ON "inspeccion_calidad"("recepcion_id");

-- CreateIndex
CREATE INDEX "inspeccion_calidad_lote_id_inspeccionado_en_idx" ON "inspeccion_calidad"("lote_id", "inspeccionado_en");

-- CreateIndex
CREATE INDEX "existencia_centro_id_idx" ON "existencia"("centro_id");

-- CreateIndex
CREATE INDEX "movimiento_inventario_lote_id_creado_en_idx" ON "movimiento_inventario"("lote_id", "creado_en");

-- CreateIndex
CREATE INDEX "movimiento_inventario_centro_id_creado_en_idx" ON "movimiento_inventario"("centro_id", "creado_en");

-- CreateIndex
CREATE INDEX "movimiento_inventario_referencia_tipo_referencia_id_idx" ON "movimiento_inventario"("referencia_tipo", "referencia_id");

-- CreateIndex
CREATE UNIQUE INDEX "traslado_codigo_key" ON "traslado"("codigo");

-- CreateIndex
CREATE INDEX "traslado_lote_id_idx" ON "traslado"("lote_id");

-- CreateIndex
CREATE INDEX "traslado_estado_idx" ON "traslado"("estado");

-- CreateIndex
CREATE INDEX "traslado_origen_id_idx" ON "traslado"("origen_id");

-- CreateIndex
CREATE INDEX "traslado_destino_id_idx" ON "traslado"("destino_id");

-- CreateIndex
CREATE UNIQUE INDEX "proceso_codigo_key" ON "proceso"("codigo");

-- CreateIndex
CREATE INDEX "proceso_centro_id_realizado_en_idx" ON "proceso"("centro_id", "realizado_en");

-- CreateIndex
CREATE INDEX "precio_estado_producto_grado_calidad_id_vigente_desde_idx" ON "precio"("estado_producto", "grado_calidad_id", "vigente_desde");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_codigo_key" ON "liquidacion"("codigo");

-- CreateIndex
CREATE INDEX "liquidacion_productor_id_periodo_inicio_idx" ON "liquidacion"("productor_id", "periodo_inicio");

-- CreateIndex
CREATE INDEX "liquidacion_estado_idx" ON "liquidacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_detalle_recepcion_id_key" ON "liquidacion_detalle"("recepcion_id");

-- CreateIndex
CREATE INDEX "liquidacion_detalle_liquidacion_id_idx" ON "liquidacion_detalle"("liquidacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "venta_codigo_key" ON "venta"("codigo");

-- CreateIndex
CREATE INDEX "venta_lote_id_idx" ON "venta"("lote_id");

-- CreateIndex
CREATE INDEX "venta_comprador_id_vendido_en_idx" ON "venta"("comprador_id", "vendido_en");

-- CreateIndex
CREATE INDEX "tarea_usuario_id_estado_idx" ON "tarea"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "tarea_rol_estado_idx" ON "tarea"("rol", "estado");

-- CreateIndex
CREATE INDEX "tarea_entidad_tipo_entidad_id_idx" ON "tarea"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "productor_codigo_key" ON "productor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "productor_dpi_key" ON "productor"("dpi");

-- CreateIndex
CREATE INDEX "productor_nombre_idx" ON "productor"("nombre");

-- CreateIndex
CREATE INDEX "productor_organizacion_id_idx" ON "productor"("organizacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "finca_productor_id_nombre_key" ON "finca"("productor_id", "nombre");

-- AddForeignKey
ALTER TABLE "productor" ADD CONSTRAINT "productor_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "organizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_grado_calidad_id_fkey" FOREIGN KEY ("grado_calidad_id") REFERENCES "grado_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_origen_recepcion" ADD CONSTRAINT "lote_origen_recepcion_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_origen_recepcion" ADD CONSTRAINT "lote_origen_recepcion_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_relacion" ADD CONSTRAINT "lote_relacion_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_relacion" ADD CONSTRAINT "lote_relacion_hijo_id_fkey" FOREIGN KEY ("hijo_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_relacion" ADD CONSTRAINT "lote_relacion_proceso_id_fkey" FOREIGN KEY ("proceso_id") REFERENCES "proceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_estado_historial" ADD CONSTRAINT "lote_estado_historial_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote_estado_historial" ADD CONSTRAINT "lote_estado_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspeccion_calidad" ADD CONSTRAINT "inspeccion_calidad_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspeccion_calidad" ADD CONSTRAINT "inspeccion_calidad_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspeccion_calidad" ADD CONSTRAINT "inspeccion_calidad_grado_calidad_id_fkey" FOREIGN KEY ("grado_calidad_id") REFERENCES "grado_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspeccion_calidad" ADD CONSTRAINT "inspeccion_calidad_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencia" ADD CONSTRAINT "existencia_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "existencia" ADD CONSTRAINT "existencia_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_solicitado_por_id_fkey" FOREIGN KEY ("solicitado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traslado" ADD CONSTRAINT "traslado_recibido_por_id_fkey" FOREIGN KEY ("recibido_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso" ADD CONSTRAINT "proceso_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso" ADD CONSTRAINT "proceso_realizado_por_id_fkey" FOREIGN KEY ("realizado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proceso" ADD CONSTRAINT "proceso_aprobado_por_id_fkey" FOREIGN KEY ("aprobado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio" ADD CONSTRAINT "precio_grado_calidad_id_fkey" FOREIGN KEY ("grado_calidad_id") REFERENCES "grado_calidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio" ADD CONSTRAINT "precio_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_productor_id_fkey" FOREIGN KEY ("productor_id") REFERENCES "productor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_aprobado_por_id_fkey" FOREIGN KEY ("aprobado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_detalle" ADD CONSTRAINT "liquidacion_detalle_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion_detalle" ADD CONSTRAINT "liquidacion_detalle_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "comprador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones CHECK que Prisma no puede expresar en schema.prisma.
-- Se agregan al final de la migración inicial (migration.sql) a mano.
-- Son la última línea de defensa: los servicios validan primero y devuelven
-- errores claros; si algo se escapa, la base de datos lo rechaza.

-- Finca
ALTER TABLE finca ADD CONSTRAINT finca_altitud_ck CHECK (altitud_msnm IS NULL OR altitud_msnm >= 0);
ALTER TABLE finca ADD CONSTRAINT finca_area_ck CHECK (area_ha IS NULL OR area_ha > 0);
ALTER TABLE finca ADD CONSTRAINT finca_coordenadas_ck CHECK (
  (latitud IS NULL OR latitud BETWEEN -90 AND 90) AND (longitud IS NULL OR longitud BETWEEN -180 AND 180)
);

-- Recepción (tabla de Victor: propuesta, revisar con él)
ALTER TABLE recepcion ADD CONSTRAINT recepcion_pesos_ck CHECK (
  peso_bruto_kg > 0 AND tara_kg >= 0 AND peso_neto_kg > 0 AND peso_neto_kg = peso_bruto_kg - tara_kg
);
ALTER TABLE recepcion ADD CONSTRAINT recepcion_humedad_ck CHECK (humedad_pct IS NULL OR humedad_pct BETWEEN 0 AND 100);

-- Lotes
ALTER TABLE lote ADD CONSTRAINT lote_peso_inicial_ck CHECK (peso_inicial_kg > 0);
ALTER TABLE lote ADD CONSTRAINT lote_cosecha_ck CHECK (cosecha BETWEEN 2000 AND 2100);
ALTER TABLE lote_origen_recepcion ADD CONSTRAINT lote_origen_cantidad_ck CHECK (cantidad_kg > 0);
ALTER TABLE lote_relacion ADD CONSTRAINT lote_relacion_cantidad_ck CHECK (cantidad_kg > 0);
ALTER TABLE lote_relacion ADD CONSTRAINT lote_relacion_distintos_ck CHECK (padre_id <> hijo_id);

-- Calidad: se inspecciona exactamente una recepción o un lote
ALTER TABLE inspeccion_calidad ADD CONSTRAINT inspeccion_objetivo_ck CHECK (num_nonnulls(recepcion_id, lote_id) = 1);
ALTER TABLE inspeccion_calidad ADD CONSTRAINT inspeccion_porcentajes_ck CHECK (
  (humedad_pct IS NULL OR humedad_pct BETWEEN 0 AND 100) AND
  (impurezas_pct IS NULL OR impurezas_pct BETWEEN 0 AND 100) AND
  (defectos_pct IS NULL OR defectos_pct BETWEEN 0 AND 100)
);

-- Inventario: regla "no permitir movimientos superiores a la existencia"
ALTER TABLE existencia ADD CONSTRAINT existencia_no_negativa_ck CHECK (cantidad_kg >= 0);
ALTER TABLE movimiento_inventario ADD CONSTRAINT movimiento_cantidad_ck CHECK (cantidad_kg <> 0);
ALTER TABLE movimiento_inventario ADD CONSTRAINT movimiento_saldo_ck CHECK (saldo_kg >= 0);

-- Traslados
ALTER TABLE traslado ADD CONSTRAINT traslado_cantidad_ck CHECK (cantidad_kg > 0);
ALTER TABLE traslado ADD CONSTRAINT traslado_centros_distintos_ck CHECK (origen_id <> destino_id);
ALTER TABLE traslado ADD CONSTRAINT traslado_recibido_ck CHECK (
  cantidad_recibida_kg IS NULL OR (cantidad_recibida_kg >= 0 AND cantidad_recibida_kg <= cantidad_kg)
);

-- Procesos
ALTER TABLE proceso ADD CONSTRAINT proceso_merma_ck CHECK (merma_kg >= 0);

-- Precios, liquidaciones y ventas
ALTER TABLE precio ADD CONSTRAINT precio_valor_ck CHECK (precio_por_kg > 0);
ALTER TABLE precio ADD CONSTRAINT precio_vigencia_ck CHECK (vigente_hasta IS NULL OR vigente_hasta > vigente_desde);
ALTER TABLE liquidacion ADD CONSTRAINT liquidacion_periodo_ck CHECK (periodo_fin >= periodo_inicio);
ALTER TABLE liquidacion ADD CONSTRAINT liquidacion_totales_ck CHECK (total_kg >= 0 AND total_monto >= 0);
ALTER TABLE liquidacion_detalle ADD CONSTRAINT liquidacion_detalle_valores_ck CHECK (
  peso_kg > 0 AND precio_por_kg > 0 AND subtotal >= 0
);
ALTER TABLE venta ADD CONSTRAINT venta_cantidad_ck CHECK (cantidad_kg > 0);
ALTER TABLE venta ADD CONSTRAINT venta_precio_ck CHECK (precio_por_kg IS NULL OR precio_por_kg >= 0);

-- Tareas: asignadas a un usuario o a un rol
ALTER TABLE tarea ADD CONSTRAINT tarea_asignacion_ck CHECK (num_nonnulls(usuario_id, rol) >= 1);
