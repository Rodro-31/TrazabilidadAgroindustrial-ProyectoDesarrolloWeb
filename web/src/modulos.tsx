import type { ReactNode } from 'react';
import Auditoria from './pantallas/Auditoria';
import EnConstruccion from './pantallas/EnConstruccion';

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
    ruta: 'catalogos',
    titulo: 'Catálogos',
    descripcion: 'Productores, fincas, centros, organizaciones, compradores y grados',
    roles: ['ADMIN', 'SUPERVISOR', 'CALIDAD'],
    pantalla: <EnConstruccion titulo="Catálogos" />,
  },
  {
    ruta: 'lotes',
    titulo: 'Lotes',
    descripcion: 'Lotes, origen, estados y QR',
    roles: ['ADMIN', 'SUPERVISOR', 'BASCULA', 'CALIDAD'],
    pantalla: <EnConstruccion titulo="Lotes" />,
  },
  {
    ruta: 'usuarios',
    titulo: 'Usuarios',
    descripcion: 'Cuentas y roles',
    roles: ['ADMIN'],
    pantalla: <EnConstruccion titulo="Usuarios" nota="Falta el módulo de usuarios en la API." />,
  },
];

export const modulosDe = (rol: string) => MODULOS.filter((m) => m.roles.includes(rol));
