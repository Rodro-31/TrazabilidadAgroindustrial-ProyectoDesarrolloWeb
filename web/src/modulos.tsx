import type { ReactNode } from 'react';
import Auditoria from './pantallas/Auditoria';
import Calidad from './pantallas/Calidad';
import Catalogos from './pantallas/Catalogos';
import Lotes from './pantallas/Lotes';
import Liquidaciones from './pantallas/Liquidaciones';
import Precios from './pantallas/Precios';
import Procesos from './pantallas/Procesos';
import Traslados from './pantallas/Traslados';
import Recepciones from './pantallas/Recepciones';
import Usuarios from './pantallas/Usuarios';

// Cada módulo del menú. Para agregar una pantalla: crear el componente en
// src/pantallas y sumar una entrada aquí (ver web/LEEME.md). El menú, las rutas y la
// protección por rol salen de esta lista.
export interface Modulo {
  ruta: string; // sin "/" inicial
  titulo: string;
  descripcion: string;
  roles: string[]; // quién lo ve; la API valida el permiso de verdad
  pantalla: ReactNode;
}

export const MODULOS: Modulo[] = [
  {
    ruta: 'auditoria',
    titulo: 'Auditoría',
    descripcion: 'Quién hizo qué, cuándo y desde dónde',
    roles: ['ADMIN', 'AUDITOR'],
    pantalla: <Auditoria />,
  },
  {
    ruta: 'calidad',
    titulo: 'Calidad',
    descripcion: 'Inspecciones de recepciones y lotes: resultado, grado, humedad y defectos',
    // ADMIN, SUPERVISOR y CALIDAD registran; BASCULA y AUDITOR solo consultan.
    roles: ['ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'AUDITOR'],
    pantalla: <Calidad />,
  },
  {
    ruta: 'catalogos',
    titulo: 'Catálogos',
    descripcion: 'Productores, fincas, centros, organizaciones, compradores y grados',
    // BASCULA y AUDITOR solo consultan: la pantalla oculta los botones según el rol.
    roles: ['ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'AUDITOR'],
    pantalla: <Catalogos />,
  },
  {
    ruta: 'lotes',
    titulo: 'Lotes',
    descripcion: 'Lotes, origen, estados y QR',
    roles: ['ADMIN', 'SUPERVISOR', 'BASCULA', 'CALIDAD', 'AUDITOR'],
    pantalla: <Lotes />,
  },
  {
    ruta: 'procesos',
    titulo: 'Procesos',
    descripcion: 'Mezcla, división, secado, limpieza y clasificación de lotes',
    // Solo ADMIN y SUPERVISOR registran; los demás consultan (la pantalla oculta el botón).
    roles: ['ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'AUDITOR'],
    pantalla: <Procesos />,
  },
  {
    ruta: 'traslados',
    titulo: 'Traslados',
    descripcion: 'Envío de lotes entre centros con código de confirmación',
    // ADMIN, SUPERVISOR y BASCULA despachan y reciben; los demás consultan.
    roles: ['ADMIN', 'SUPERVISOR', 'BASCULA', 'CALIDAD', 'AUDITOR'],
    pantalla: <Traslados />,
  },
  {
    ruta: 'liquidaciones',
    titulo: 'Liquidaciones',
    descripcion: 'Pago a productores por sus recepciones',
    // Montos de dinero: solo quien los gestiona o audita.
    roles: ['ADMIN', 'SUPERVISOR', 'AUDITOR'],
    pantalla: <Liquidaciones />,
  },
  {
    ruta: 'precios',
    titulo: 'Precios',
    descripcion: 'Precio por kg según producto y grado, con historial',
    // Montos de dinero: los gestionan ADMIN y SUPERVISOR; AUDITOR consulta.
    roles: ['ADMIN', 'SUPERVISOR', 'AUDITOR'],
    pantalla: <Precios />,
  },
  {
    ruta: 'recepciones',
    titulo: 'Recepciones',
    descripcion: 'Recepciones de producto con sus pesajes y fotos',
    // Solo consulta: capturar y volver a pesar se hace en la PWA de campo.
    roles: ['ADMIN', 'SUPERVISOR', 'CALIDAD', 'BASCULA', 'AUDITOR'],
    pantalla: <Recepciones />,
  },
  {
    ruta: 'usuarios',
    titulo: 'Usuarios',
    descripcion: 'Cuentas y roles',
    roles: ['ADMIN'],
    pantalla: <Usuarios />,
  },
];

export const modulosDe = (rol: string) => MODULOS.filter((m) => m.roles.includes(rol));
