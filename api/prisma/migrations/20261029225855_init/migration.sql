-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'CAMPO', 'AUDITOR');

-- CreateEnum
CREATE TYPE "PropositoToken" AS ENUM ('QR_LOTE', 'QR_RECEPCION', 'CONFIRMACION_TRASLADO', 'RECUPERACION_PASSWORD');

-- CreateEnum
CREATE TYPE "EstadoProducto" AS ENUM ('UVA', 'PERGAMINO', 'ORO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "centro" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "centro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_centro" (
    "usuario_id" TEXT NOT NULL,
    "centro_id" TEXT NOT NULL,

    CONSTRAINT "usuario_centro_pkey" PRIMARY KEY ("usuario_id","centro_id")
);

-- CreateTable
CREATE TABLE "productor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finca" (
    "id" TEXT NOT NULL,
    "productor_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recepcion" (
    "id" TEXT NOT NULL,
    "centro_id" TEXT NOT NULL,
    "productor_id" TEXT NOT NULL,
    "finca_id" TEXT NOT NULL,
    "estado_producto" "EstadoProducto" NOT NULL,
    "peso_bruto_kg" DECIMAL(12,2) NOT NULL,
    "tara_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "peso_neto_kg" DECIMAL(12,2) NOT NULL,
    "humedad_pct" DECIMAL(5,2),
    "observaciones" TEXT,
    "capturado_en" TIMESTAMP(3) NOT NULL,
    "registrado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token" (
    "id" TEXT NOT NULL,
    "valor_hash" TEXT NOT NULL,
    "proposito" "PropositoToken" NOT NULL,
    "entidad_tipo" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3),
    "usado_en" TIMESTAMP(3),
    "revocado_en" TIMESTAMP(3),
    "creado_por_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivo" (
    "id" TEXT NOT NULL,
    "entidad_tipo" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "clave_storage" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "subido_por_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "centro_codigo_key" ON "centro"("codigo");

-- CreateIndex
CREATE INDEX "finca_productor_id_idx" ON "finca"("productor_id");

-- CreateIndex
CREATE INDEX "recepcion_productor_id_idx" ON "recepcion"("productor_id");

-- CreateIndex
CREATE INDEX "recepcion_centro_id_idx" ON "recepcion"("centro_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_valor_hash_key" ON "token"("valor_hash");

-- CreateIndex
CREATE INDEX "token_entidad_tipo_entidad_id_idx" ON "token"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "archivo_entidad_tipo_entidad_id_idx" ON "archivo"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_idx" ON "auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "auditoria_creado_en_idx" ON "auditoria"("creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_usuario_id_idx" ON "refresh_token"("usuario_id");

-- AddForeignKey
ALTER TABLE "usuario_centro" ADD CONSTRAINT "usuario_centro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_centro" ADD CONSTRAINT "usuario_centro_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finca" ADD CONSTRAINT "finca_productor_id_fkey" FOREIGN KEY ("productor_id") REFERENCES "productor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion" ADD CONSTRAINT "recepcion_centro_id_fkey" FOREIGN KEY ("centro_id") REFERENCES "centro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion" ADD CONSTRAINT "recepcion_productor_id_fkey" FOREIGN KEY ("productor_id") REFERENCES "productor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion" ADD CONSTRAINT "recepcion_finca_id_fkey" FOREIGN KEY ("finca_id") REFERENCES "finca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion" ADD CONSTRAINT "recepcion_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
