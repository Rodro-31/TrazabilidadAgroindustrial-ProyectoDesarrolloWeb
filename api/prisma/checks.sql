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
