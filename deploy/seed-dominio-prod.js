// Datos de demostración del DOMINIO en PRODUCCIÓN: los mismos de api/prisma/seed-demo.ts
// (cardamomo, Alta Verapaz), en JavaScript puro porque la imagen de la API no trae ts-node.
// Si cambias los datos aquí, cambia también api/prisma/seed-demo.ts (y al revés).
//
// Requisito: que exista al menos un usuario ADMIN (deploy/seed-demo-prod.js de Victor).
// Es idempotente (upsert): se puede ejecutar varias veces sin duplicar.
// Todos los nombres, códigos y precios son ficticios.
//
// Uso, en el servidor (carpeta /opt/trazabilidad):
//   docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T api node - < deploy/seed-dominio-prod.js
// Opcional: -e ADMIN_EMAIL=... después de "exec -T" para elegir qué administrador
// figura como "registrado por" en las recepciones y precios de prueba.
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

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
  { nombre: 'Cooperativa Cardamomera Chisec', tipo: 'COOPERATIVA', nit: '1234567-8', telefono: '79520101' },
  { nombre: 'Asociación de Productores de Carchá', tipo: 'ASOCIACION', nit: '7654321-K', telefono: '79530202' },
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

// Recepciones de prueba: ids fijos para que el upsert no duplique.
const RECEPCIONES = [
  { n: 1, centro: 'CA-01', productor: 'P-0001', finca: 0, estado: 'UVA', bruto: '245.50', tara: '4.50', humedad: 72.5, diasAtras: 6 },
  { n: 2, centro: 'CA-01', productor: 'P-0001', finca: 0, estado: 'UVA', bruto: '180.00', tara: '3.00', humedad: 74.0, diasAtras: 3 },
  { n: 3, centro: 'CA-01', productor: 'P-0002', finca: 0, estado: 'UVA', bruto: '320.00', tara: '6.00', humedad: 71.0, diasAtras: 5 },
  { n: 4, centro: 'CA-01', productor: 'P-0003', finca: 0, estado: 'UVA', bruto: '410.50', tara: '7.50', humedad: 73.5, diasAtras: 4 },
  { n: 5, centro: 'CA-01', productor: 'P-0004', finca: 0, estado: 'UVA', bruto: '150.00', tara: '3.00', humedad: 75.0, diasAtras: 2 },
  { n: 6, centro: 'CA-02', productor: 'P-0005', finca: 0, estado: 'UVA', bruto: '275.00', tara: '5.00', humedad: 72.0, diasAtras: 6 },
  { n: 7, centro: 'CA-02', productor: 'P-0006', finca: 0, estado: 'UVA', bruto: '198.00', tara: '4.00', humedad: 70.5, diasAtras: 4 },
  { n: 8, centro: 'CA-02', productor: 'P-0007', finca: 0, estado: 'UVA', bruto: '362.00', tara: '6.00', humedad: 71.5, diasAtras: 1 },
  { n: 9, centro: 'CA-03', productor: 'P-0008', finca: 0, estado: 'PERGAMINO', bruto: '96.00', tara: '2.00', humedad: 11.5, diasAtras: 5 },
  { n: 10, centro: 'CA-03', productor: 'P-0003', finca: 1, estado: 'PERGAMINO', bruto: '84.50', tara: '1.50', humedad: 12.0, diasAtras: 2 },
];

// Precios de ejemplo (no son precios de mercado).
const PRECIOS = [
  { id: '00000000-0000-4000-8000-000000000201', estado: 'UVA', grado: null, precio: '14.50' },
  { id: '00000000-0000-4000-8000-000000000202', estado: 'PERGAMINO', grado: 'PRIMERA', precio: '95.00' },
  { id: '00000000-0000-4000-8000-000000000203', estado: 'PERGAMINO', grado: 'SEGUNDA', precio: '82.00' },
  { id: '00000000-0000-4000-8000-000000000204', estado: 'PERGAMINO', grado: 'TERCERA', precio: '70.00' },
];

const idRecepcion = (n) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, '0')}`;

async function main() {
  const admin = await prisma.usuario.findFirst({
    where: process.env.ADMIN_EMAIL ? { email: process.env.ADMIN_EMAIL } : { rol: 'ADMIN' },
    orderBy: { creadoEn: 'asc' },
  });
  if (!admin) throw new Error('No hay usuario ADMIN. Ejecuta primero deploy/seed-demo-prod.js');

  // Orden por llaves foráneas: primero lo que no depende de nada.
  for (const g of GRADOS) {
    await prisma.gradoCalidad.upsert({ where: { codigo: g.codigo }, update: {}, create: g });
  }

  const centros = new Map();
  for (const c of CENTROS) {
    const centro = await prisma.centro.upsert({ where: { codigo: c.codigo }, update: {}, create: c });
    centros.set(c.codigo, centro.id);
  }

  const organizaciones = [];
  for (const o of ORGANIZACIONES) {
    const org = await prisma.organizacion.upsert({ where: { nombre: o.nombre }, update: {}, create: o });
    organizaciones.push(org.id);
  }

  const productores = new Map();
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
    const fincas = [];
    for (const nombre of p.fincas) {
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
    const productor = productores.get(r.productor);
    // Decimal: cumple el CHECK peso_neto_kg = peso_bruto_kg - tara_kg sin errores de redondeo.
    const bruto = new Prisma.Decimal(r.bruto);
    const tara = new Prisma.Decimal(r.tara);
    await prisma.recepcion.upsert({
      where: { id: idRecepcion(r.n) },
      update: {},
      create: {
        id: idRecepcion(r.n),
        centroId: centros.get(r.centro),
        productorId: productor.id,
        fincaId: productor.fincas[r.finca],
        estadoProducto: r.estado,
        pesoBrutoKg: bruto,
        taraKg: tara,
        pesoNetoKg: bruto.minus(tara),
        humedadPct: r.humedad,
        capturadoEn: new Date(Date.now() - r.diasAtras * 24 * 60 * 60 * 1000),
        registradoPorId: admin.id,
        observaciones: 'Recepción de prueba (seed-dominio)',
      },
    });
  }

  const grados = new Map((await prisma.gradoCalidad.findMany({ select: { id: true, codigo: true } })).map((g) => [g.codigo, g.id]));
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
    `Datos demo listos: ${GRADOS.length} grados, ${CENTROS.length} centros, ${ORGANIZACIONES.length} organizaciones, ` +
      `${PRODUCTORES.length} productores, ${COMPRADORES.length} compradores, ${RECEPCIONES.length} recepciones, ${PRECIOS.length} precios.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
