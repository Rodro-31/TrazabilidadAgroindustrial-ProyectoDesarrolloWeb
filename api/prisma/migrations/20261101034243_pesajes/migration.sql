-- CreateTable
CREATE TABLE "recepcion_pesaje" (
    "id" TEXT NOT NULL,
    "recepcion_id" TEXT NOT NULL,
    "peso_bruto_kg" DECIMAL(12,2) NOT NULL,
    "tara_kg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "peso_neto_kg" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT,
    "registrado_por_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recepcion_pesaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recepcion_pesaje_recepcion_id_creado_en_idx" ON "recepcion_pesaje"("recepcion_id", "creado_en");

-- AddForeignKey
ALTER TABLE "recepcion_pesaje" ADD CONSTRAINT "recepcion_pesaje_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "recepcion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recepcion_pesaje" ADD CONSTRAINT "recepcion_pesaje_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
