import { EstadoProducto, Prisma, PrismaClient, TipoOrganizacion } from '@prisma/client';

// Datos de demostración del dominio (cardamomo, Alta Verapaz).
// Es independiente de prisma/seed.ts (Victor), que crea el administrador.
//
// Uso (en desarrollo, después de crear el administrador):
//   npm run seed:demo
// Opcional: ADMIN_EMAIL=admin@local.test npm run seed:demo
//   (usuario que figura como "registrado por" en las recepciones de prueba)
//
// Es idempotente: usa upsert, así que puede ejecutarse varias veces sin duplicar.
// Todos los nombres, códigos y precios son ficticios.
const prisma = new PrismaClient();

// --- Catálogos -------------------------------------------------------------

const GRADOS = [
  { codigo: 'PRIMERA', nombre: 'Primera', orden: 1, descripcion: 'Ejemplo: ajustar a la clasificación real de la empresa' },
  { codigo: 'SEGUNDA', nombre: 'Segunda', orden: 2, descripcion: 'Ejemplo: ajustar a la clasificación real de la empresa' },
  { codigo: 'TERCERA', nombre: 'Tercera', orden: 3, descripcion: 'Ejemplo: ajustar a la clasificación real de la empresa' },
];

const CENTROS = [
  { codigo: 'CA-01', nombre: 'Centro de Acopio Cobán', municipio: 'Cobán', departamento: 'Alta Verapaz', telefono: '79510000', direccion: '3a. Calle 2-15, Zona 1' },
  { codigo: 'CA-02', nombre: 'Centro de Acopio Chisec', municipio: 'Chisec', departamento: 'Alta Verapaz', telefono: '79520000' },
  { codigo: 'CA-03', nombre: 'Centro de Acopio Carchá', municipio: 'San Pedro Carchá', departamento: 'Alta Verapaz', telefono: '79530000' },
];

const ORGANIZACIONES = [
  { nombre: 'Cooperativa Cardamomera Chisec', tipo: TipoOrganizacion.COOPERATIVA, nit: '1234567-8', telefono: '79520101' },
  { nombre: 'Asociación de Productores de Carchá', tipo: TipoOrganizacion.ASOCIACION, nit: '7654321-K', telefono: '79530202' },
];

// org: índice en ORGANIZACIONES (null = productor independiente).
const PRODUCTORES = [
  { codigo: 'P-0001', nombre: 'Juan Caal Pop', municipio: 'Cobán', org: null, fincas: ['Finca El Roble'] },
  { codigo: 'P-0002', nombre: 'María Choc Tiul', municipio: 'Cobán', org: null, fincas: ['Finca La Esperanza'] },
  { codigo: 'P-0003', nombre: 'Pedro Xol Cucul', municipio: 'Cobán', org: null, fincas: ['Finca Sachaj', 'Finca El Naranjo'] },
  { codigo: 'P-0004', nombre: 'Rosa Pop Maquín', municipio: 'Cobán', org: null, fincas: ['Finca Las Margaritas'] },
  { codigo: 'P-0005', nombre: 'Domingo Tiul Coc', municipio: 'Chisec', org: 0, fincas: ['Finca Rubel Chaj'] },
  { codigo: 'P-0006', nombre: 'Ana Cucul Xol', municipio: 'Chisec', org: 0, fincas: ['Finca Seamay'] },
  { codigo: 'P-0007', nombre: 'Marcos Maquín Caal', municipio: 'Chisec', org: 0, fincas: ['Finca San Vicente'] },
  { codigo: 'P-0008', nombre: 'Elena Coc Choc', municipio: 'San Pedro Carchá', org: 1, fincas: ['Finca Chirrepec'] },
];

const COMPRADORES = [
  { nombre: 'Gulf Spice Trading Co.', nit: 'SA-300123456', pais: 'Arabia Saudita', contacto: 'Departamento de compras', email: 'compras@gulfspice.example' },
  { nombre: 'Indo Masala Imports', nit: 'IN-27AAACI1234', pais: 'India', contacto: 'Departamento de compras', email: 'buying@indomasala.example' },
  { nombre: 'Especias del Norte S.A.', nit: '9876543-2', pais: 'Guatemala', contacto: 'Gerencia comercial', email: 'ventas@especiasnorte.example' },
];

// --- Recepciones de prueba (la tabla es de Victor) ------------------------
// Ids fijos para que el upsert no duplique. Mismo formato UUID que genera la PWA.
// centro / productor: códigos de arriba; finca: índice dentro de las fincas del productor.
const RECEPCIONES = [
  { n: 1, centro: 'CA-01', productor: 'P-0001', finca: 0, estado: EstadoProducto.UVA, bruto: 245.5, tara: 4.5, humedad: 72.5, diasAtras: 6 },
  { n: 2, centro: 'CA-01', productor: 'P-0001', finca: 0, estado: EstadoProducto.UVA, bruto: 180.0, tara: 3.0, humedad: 74.0, diasAtras: 3 },
  { n: 3, centro: 'CA-01', productor: 'P-0002', finca: 0, estado: EstadoProducto.UVA, bruto: 320.0, tara: 6.0, humedad: 71.0, diasAtras: 5 },
  { n: 4, centro: 'CA-01', productor: 'P-0003', finca: 0, estado: EstadoProducto.UVA, bruto: 410.5, tara: 7.5, humedad: 73.5, diasAtras: 4 },
  { n: 5, centro: 'CA-01', productor: 'P-0004', finca: 0, estado: EstadoProducto.UVA, bruto: 150.0, tara: 3.0, humedad: 75.0, diasAtras: 2 },
  { n: 6, centro: 'CA-02', productor: 'P-0005', finca: 0, estado: EstadoProducto.UVA, bruto: 275.0, tara: 5.0, humedad: 72.0, diasAtras: 6 },
  { n: 7, centro: 'CA-02', productor: 'P-0006', finca: 0, estado: EstadoProducto.UVA, bruto: 198.0, tara: 4.0, humedad: 70.5, diasAtras: 4 },
  { n: 8, centro: 'CA-02', productor: 'P-0007', finca: 0, estado: EstadoProducto.UVA, bruto: 362.0, tara: 6.0, humedad: 71.5, diasAtras: 1 },
  { n: 9, centro: 'CA-03', productor: 'P-0008', finca: 0, estado: EstadoProducto.PERGAMINO, bruto: 96.0, tara: 2.0, humedad: 11.5, diasAtras: 5 },
  { n: 10, centro: 'CA-03', productor: 'P-0003', finca: 1, estado: EstadoProducto.PERGAMINO, bruto: 84.5, tara: 1.5, humedad: 12.0, diasAtras: 2 },
];

// Precios de ejemplo (no son precios de mercado). Ids fijos para el upsert.
const PRECIOS = [
  { id: '00000000-0000-4000-8000-000000000201', estado: EstadoProducto.UVA, grado: null, precio: 14.5 },
  { id: '00000000-0000-4000-8000-000000000202', estado: EstadoProducto.PERGAMINO, grado: 'PRIMERA', precio: 95.0 },
  { id: '00000000-0000-4000-8000-000000000203', estado: EstadoProducto.PERGAMINO, grado: 'SEGUNDA', precio: 82.0 },
  { id: '00000000-0000-4000-8000-000000000204', estado: EstadoProducto.PERGAMINO, grado: 'TERCERA', precio: 70.0 },
];

const idRecepcion = (n: number) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, '0')}`;

async function main() {
  // Las recepciones y precios necesitan un usuario responsable: el administrador.
  const admin = await prisma.usuario.findFirst({
    where: process.env.ADMIN_EMAIL ? { email: process.env.ADMIN_EMAIL } : { rol: 'ADMIN' },
    orderBy: { creadoEn: 'asc' },
  });
  if (!admin) {
    throw new Error('No hay administrador. Ejecuta primero: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx prisma db seed');
  }

  // El orden importa por las llaves foráneas: primero lo que no depende de nada.
  for (const g of GRADOS) {
    await prisma.gradoCalidad.upsert({ where: { codigo: g.codigo }, update: {}, create: g });
  }

  const centros = new Map<string, string>();
  for (const c of CENTROS) {
    const centro = await prisma.centro.upsert({ where: { codigo: c.codigo }, update: {}, create: c });
    centros.set(c.codigo, centro.id);
  }

  const organizaciones: string[] = [];
  for (const o of ORGANIZACIONES) {
    const org = await prisma.organizacion.upsert({ where: { nombre: o.nombre }, update: {}, create: o });
    organizaciones.push(org.id);
  }

  // update: {} → si el registro ya existe (por ejemplo, creado a mano en Swagger),
  // no se modifica. El seed solo agrega lo que falta.
  const productores = new Map<string, { id: string; fincas: string[] }>();
  for (const p of PRODUCTORES) {
    const productor = await prisma.productor.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: {
        codigo: p.codigo,
        nombre: p.nombre,
        municipio: p.municipio,
        departamento: 'Alta Verapaz',
        organizacionId: p.org === null ? null : organizaciones[p.org],
      },
    });

    const fincas: string[] = [];
    for (const nombre of p.fincas) {
      // productorId_nombre: la restricción única compuesta @@unique([productorId, nombre]).
      const finca = await prisma.finca.upsert({
        where: { productorId_nombre: { productorId: productor.id, nombre } },
        update: {},
        create: { productorId: productor.id, nombre, municipio: p.municipio, departamento: 'Alta Verapaz' },
      });
      fincas.push(finca.id);
    }
    productores.set(p.codigo, { id: productor.id, fincas });
  }

  for (const c of COMPRADORES) {
    await prisma.comprador.upsert({ where: { nit: c.nit }, update: {}, create: c });
  }

  for (const r of RECEPCIONES) {
    const productor = productores.get(r.productor)!;
    // Decimal evita errores de punto flotante (0.1 + 0.2 ≠ 0.3) y cumple el CHECK
    // de la base de datos: peso_neto_kg = peso_bruto_kg - tara_kg.
    const bruto = new Prisma.Decimal(r.bruto);
    const tara = new Prisma.Decimal(r.tara);
    await prisma.recepcion.upsert({
      where: { id: idRecepcion(r.n) },
      update: {},
      create: {
        id: idRecepcion(r.n),
        centroId: centros.get(r.centro)!,
        productorId: productor.id,
        fincaId: productor.fincas[r.finca],
        estadoProducto: r.estado,
        pesoBrutoKg: bruto,
        taraKg: tara,
        pesoNetoKg: bruto.minus(tara),
        humedadPct: r.humedad,
        capturadoEn: new Date(Date.now() - r.diasAtras * 24 * 60 * 60 * 1000),
        registradoPorId: admin.id,
        observaciones: 'Recepción de prueba (seed-demo)',
      },
    });
  }

  const grados = new Map(
    (await prisma.gradoCalidad.findMany({ select: { id: true, codigo: true } })).map((g) => [g.codigo, g.id]),
  );
  for (const p of PRECIOS) {
    await prisma.precio.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        estadoProducto: p.estado,
        gradoCalidadId: p.grado ? grados.get(p.grado) : null,
        precioPorKg: p.precio,
        vigenteDesde: new Date('2026-10-01T00:00:00Z'),
        creadoPorId: admin.id,
      },
    });
  }

  console.log(
    `Datos demo listos: ${GRADOS.length} grados, ${CENTROS.length} centros, ` +
      `${ORGANIZACIONES.length} organizaciones, ${PRODUCTORES.length} productores, ` +
      `${COMPRADORES.length} compradores, ${RECEPCIONES.length} recepciones, ${PRECIOS.length} precios.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
