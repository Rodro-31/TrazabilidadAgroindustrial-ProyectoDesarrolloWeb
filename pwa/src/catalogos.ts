import { listarTodo } from './api';
import { db, type CatalogoLocal } from './db';

export interface Centro {
  id: string;
  nombre: string;
}
export interface Productor {
  id: string;
  codigo: string;
  nombre: string;
}
export interface Finca {
  id: string;
  nombre: string;
  productor: { id: string };
}
export interface Grado {
  id: string;
  codigo: string;
  nombre: string;
}
export interface Catalogos {
  centros: Centro[];
  productores: Productor[];
  fincas: Finca[];
  grados: Grado[];
  actualizadoEn: string | null;
}

export const catalogosVacios: Catalogos = { centros: [], productores: [], fincas: [], grados: [], actualizadoEn: null };

// Lee la copia local (funciona sin conexión).
export async function leerCatalogos(): Promise<Catalogos> {
  const filas = await db.catalogos.toArray();
  const por = (clave: CatalogoLocal['clave']) => (filas.find((f) => f.clave === clave)?.datos ?? []) as any[];
  const fechas = filas.map((f) => f.actualizadoEn).sort();
  return {
    centros: por('centros'),
    productores: por('productores'),
    fincas: por('fincas'),
    grados: por('grados'),
    actualizadoEn: fechas.length ? fechas[0] : null,
  };
}

// Descarga los catálogos activos y reemplaza la copia local.
export async function actualizarCatalogos(): Promise<void> {
  const [centros, productores, fincas, grados] = await Promise.all([
    listarTodo<Centro>('/centros?activo=true'),
    listarTodo<Productor>('/productores?activo=true'),
    listarTodo<Finca>('/fincas?activo=true'),
    listarTodo<Grado>('/grados-calidad?activo=true').catch(() => [] as Grado[]),
  ]);
  const ahora = new Date().toISOString();
  await db.catalogos.bulkPut([
    { clave: 'centros', datos: centros, actualizadoEn: ahora },
    { clave: 'productores', datos: productores, actualizadoEn: ahora },
    { clave: 'fincas', datos: fincas, actualizadoEn: ahora },
    { clave: 'grados', datos: grados, actualizadoEn: ahora },
  ]);
}
