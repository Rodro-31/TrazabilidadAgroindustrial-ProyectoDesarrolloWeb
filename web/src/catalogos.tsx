import { listarTodo } from './api';
import type { ConfigCatalogo, Opcion } from './componentes/Catalogo';

// Configuración de cada catálogo para el componente genérico <Catalogo>.
// Los roles reflejan los @Roles de la API (la API es quien valida de verdad).

const TIPOS_ORGANIZACION: Opcion[] = [
  { valor: 'COOPERATIVA', texto: 'Cooperativa' },
  { valor: 'ASOCIACION', texto: 'Asociación' },
  { valor: 'EMPRESA', texto: 'Empresa' },
  { valor: 'OTRA', texto: 'Otra' },
];

// Opciones que vienen de la API (solo registros activos).
const opcionesProductores = async (): Promise<Opcion[]> =>
  (await listarTodo<{ id: string; codigo: string; nombre: string }>('/productores?activo=true')).map((p) => ({
    valor: p.id,
    texto: `${p.codigo} – ${p.nombre}`,
  }));

const opcionesOrganizaciones = async (): Promise<Opcion[]> =>
  (await listarTodo<{ id: string; nombre: string }>('/organizaciones?activo=true')).map((o) => ({
    valor: o.id,
    texto: o.nombre,
  }));

const ESCRITURA_GENERAL = ['ADMIN', 'SUPERVISOR'];
const SOLO_ADMIN = ['ADMIN'];

// ---------------------------------------------------------------------------

interface Productor {
  id: string;
  codigo: string;
  nombre: string;
  telefono: string | null;
  municipio: string | null;
  departamento: string | null;
  activo: boolean;
  organizacion: { id: string; nombre: string } | null;
}

export const PRODUCTORES: ConfigCatalogo<Productor> = {
  clave: 'productores',
  titulo: 'Productores',
  singular: 'productor',
  ruta: '/productores',
  columnas: [
    { titulo: 'Código', celda: (p) => p.codigo },
    { titulo: 'Nombre', celda: (p) => p.nombre },
    { titulo: 'Organización', celda: (p) => p.organizacion?.nombre ?? <small>Independiente</small> },
    { titulo: 'Municipio', celda: (p) => p.municipio ?? '—' },
    { titulo: 'Teléfono', celda: (p) => p.telefono ?? '—' },
  ],
  campos: [
    { nombre: 'codigo', etiqueta: 'Código', requerido: true, ayuda: 'Ej. P-0009 (mayúsculas, números y guiones)' },
    { nombre: 'nombre', etiqueta: 'Nombre completo', requerido: true },
    { nombre: 'dpi', etiqueta: 'DPI', ayuda: '13 dígitos. Dato sensible: no aparece en las listas.' },
    { nombre: 'telefono', etiqueta: 'Teléfono', ayuda: '8 dígitos' },
    { nombre: 'municipio', etiqueta: 'Municipio' },
    { nombre: 'departamento', etiqueta: 'Departamento' },
    { nombre: 'organizacionId', etiqueta: 'Organización', tipo: 'select', opciones: opcionesOrganizaciones },
  ],
  filtros: [
    { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Nombre o código' },
    { nombre: 'organizacionId', etiqueta: 'Organización', opciones: opcionesOrganizaciones },
  ],
  rolesEscritura: ESCRITURA_GENERAL,
  rolesDesactivar: SOLO_ADMIN,
};

// ---------------------------------------------------------------------------

interface Finca {
  id: string;
  nombre: string;
  municipio: string | null;
  departamento: string | null;
  altitudMsnm: number | null;
  areaHa: string | null;
  activo: boolean;
  productor: { id: string; codigo: string; nombre: string };
}

export const FINCAS: ConfigCatalogo<Finca> = {
  clave: 'fincas',
  titulo: 'Fincas',
  singular: 'finca',
  ruta: '/fincas',
  columnas: [
    { titulo: 'Finca', celda: (f) => f.nombre },
    { titulo: 'Productor', celda: (f) => `${f.productor.codigo} – ${f.productor.nombre}` },
    { titulo: 'Municipio', celda: (f) => f.municipio ?? '—' },
    { titulo: 'Altitud', celda: (f) => (f.altitudMsnm != null ? `${f.altitudMsnm} msnm` : '—') },
    { titulo: 'Área', celda: (f) => (f.areaHa != null ? `${Number(f.areaHa).toLocaleString('es-GT')} ha` : '—') },
  ],
  campos: [
    // Una finca no cambia de dueño: reasignaría su historial de recepciones.
    { nombre: 'productorId', etiqueta: 'Productor', tipo: 'select', requerido: true, soloAlCrear: true, opciones: opcionesProductores },
    { nombre: 'nombre', etiqueta: 'Nombre de la finca', requerido: true },
    { nombre: 'municipio', etiqueta: 'Municipio' },
    { nombre: 'departamento', etiqueta: 'Departamento' },
    { nombre: 'altitudMsnm', etiqueta: 'Altitud (msnm)', tipo: 'entero' },
    { nombre: 'areaHa', etiqueta: 'Área (ha)', tipo: 'numero', ayuda: 'Hasta 2 decimales' },
    { nombre: 'latitud', etiqueta: 'Latitud', tipo: 'numero', ayuda: 'Entre -90 y 90' },
    { nombre: 'longitud', etiqueta: 'Longitud', tipo: 'numero', ayuda: 'Entre -180 y 180' },
  ],
  filtros: [
    { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Nombre de la finca' },
    { nombre: 'productorId', etiqueta: 'Productor', opciones: opcionesProductores },
  ],
  rolesEscritura: ESCRITURA_GENERAL,
  rolesDesactivar: SOLO_ADMIN,
};

// ---------------------------------------------------------------------------

interface Centro {
  id: string;
  codigo: string;
  nombre: string;
  telefono: string | null;
  municipio: string | null;
  departamento: string | null;
  activo: boolean;
}

export const CENTROS: ConfigCatalogo<Centro> = {
  clave: 'centros',
  titulo: 'Centros de acopio',
  singular: 'centro',
  ruta: '/centros',
  columnas: [
    { titulo: 'Código', celda: (c) => c.codigo },
    { titulo: 'Nombre', celda: (c) => c.nombre },
    { titulo: 'Municipio', celda: (c) => c.municipio ?? '—' },
    { titulo: 'Departamento', celda: (c) => c.departamento ?? '—' },
    { titulo: 'Teléfono', celda: (c) => c.telefono ?? '—' },
  ],
  campos: [
    // El código aparece impreso en comprobantes y etiquetas: no se cambia.
    { nombre: 'codigo', etiqueta: 'Código', requerido: true, soloAlCrear: true, ayuda: 'Ej. CA-04' },
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
    { nombre: 'telefono', etiqueta: 'Teléfono', ayuda: '8 dígitos' },
    { nombre: 'municipio', etiqueta: 'Municipio' },
    { nombre: 'departamento', etiqueta: 'Departamento' },
    { nombre: 'direccion', etiqueta: 'Dirección' },
  ],
  filtros: [{ nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Nombre o código' }],
  // Los centros son infraestructura de la empresa: solo ADMIN.
  rolesEscritura: SOLO_ADMIN,
  rolesDesactivar: SOLO_ADMIN,
};

// ---------------------------------------------------------------------------

interface Organizacion {
  id: string;
  nombre: string;
  tipo: string;
  nit: string | null;
  telefono: string | null;
  activo: boolean;
  _count: { productores: number };
}

export const ORGANIZACIONES: ConfigCatalogo<Organizacion> = {
  clave: 'organizaciones',
  titulo: 'Organizaciones',
  singular: 'organización',
  ruta: '/organizaciones',
  columnas: [
    { titulo: 'Nombre', celda: (o) => o.nombre },
    { titulo: 'Tipo', celda: (o) => TIPOS_ORGANIZACION.find((t) => t.valor === o.tipo)?.texto ?? o.tipo },
    { titulo: 'NIT', celda: (o) => o.nit ?? '—' },
    { titulo: 'Teléfono', celda: (o) => o.telefono ?? '—' },
    { titulo: 'Productores', celda: (o) => o._count.productores },
  ],
  campos: [
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
    { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', requerido: true, opciones: TIPOS_ORGANIZACION },
    { nombre: 'nit', etiqueta: 'NIT', ayuda: 'Ej. 1234567-8 o terminado en K' },
    { nombre: 'telefono', etiqueta: 'Teléfono', ayuda: '8 dígitos' },
  ],
  filtros: [
    { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Nombre o NIT' },
    { nombre: 'tipo', etiqueta: 'Tipo', opciones: TIPOS_ORGANIZACION },
  ],
  rolesEscritura: ESCRITURA_GENERAL,
  rolesDesactivar: SOLO_ADMIN,
};

// ---------------------------------------------------------------------------

interface Comprador {
  id: string;
  nombre: string;
  nit: string | null;
  pais: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
}

export const COMPRADORES: ConfigCatalogo<Comprador> = {
  clave: 'compradores',
  titulo: 'Compradores',
  singular: 'comprador',
  ruta: '/compradores',
  columnas: [
    { titulo: 'Nombre', celda: (c) => c.nombre },
    { titulo: 'País', celda: (c) => c.pais },
    { titulo: 'NIT / ID fiscal', celda: (c) => c.nit ?? '—' },
    { titulo: 'Email', celda: (c) => c.email ?? '—' },
    { titulo: 'Teléfono', celda: (c) => c.telefono ?? '—' },
  ],
  campos: [
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
    { nombre: 'pais', etiqueta: 'País', requerido: true },
    { nombre: 'nit', etiqueta: 'NIT / ID fiscal' },
    { nombre: 'contacto', etiqueta: 'Contacto' },
    { nombre: 'email', etiqueta: 'Email', tipo: 'email' },
    { nombre: 'telefono', etiqueta: 'Teléfono', ayuda: 'Formato internacional, ej. +966 11 555 0100' },
  ],
  filtros: [
    { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Nombre o NIT' },
    { nombre: 'pais', etiqueta: 'País', placeholder: 'Ej. India' },
  ],
  rolesEscritura: ESCRITURA_GENERAL,
  rolesDesactivar: SOLO_ADMIN,
};

// ---------------------------------------------------------------------------

interface GradoCalidad {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activo: boolean;
}

export const GRADOS: ConfigCatalogo<GradoCalidad> = {
  clave: 'grados',
  titulo: 'Grados de calidad',
  singular: 'grado',
  ruta: '/grados-calidad',
  columnas: [
    { titulo: 'Orden', celda: (g) => g.orden },
    { titulo: 'Código', celda: (g) => g.codigo },
    { titulo: 'Nombre', celda: (g) => g.nombre },
    { titulo: 'Descripción', celda: (g) => g.descripcion ?? '—' },
  ],
  campos: [
    { nombre: 'codigo', etiqueta: 'Código', requerido: true, soloAlCrear: true, ayuda: 'Ej. PRIMERA' },
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'entero', ayuda: '1 = mejor grado' },
    { nombre: 'descripcion', etiqueta: 'Descripción' },
  ],
  filtros: [],
  // Los grados los define el área de calidad.
  rolesEscritura: ['ADMIN', 'CALIDAD'],
  rolesDesactivar: SOLO_ADMIN,
};

export const CATALOGOS = [PRODUCTORES, FINCAS, CENTROS, ORGANIZACIONES, COMPRADORES, GRADOS] as unknown as ConfigCatalogo<{
  id: string;
  activo: boolean;
}>[];
