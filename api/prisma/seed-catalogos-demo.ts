import { PrismaClient } from '@prisma/client';

// Catálogos mínimos para probar la PWA en local: 2 centros, 3 productores y sus fincas.
// Se puede correr varias veces (no duplica). Uso, desde api/:
//   $env:DATABASE_URL="postgresql://..."; npx ts-node --transpile-only prisma/seed-catalogos-demo.ts
const prisma = new PrismaClient();

const CENTROS = [
  { codigo: 'CA-COB', nombre: 'Centro de acopio Cobán', municipio: 'Cobán', departamento: 'Alta Verapaz' },
  { codigo: 'CA-SCR', nombre: 'Centro de acopio San Cristóbal', municipio: 'San Cristóbal Verapaz', departamento: 'Alta Verapaz' },
];

const PRODUCTORES = [
  { codigo: 'P-001', nombre: 'Juan Pérez', municipio: 'Cobán', fincas: ['Finca El Mirador', 'Finca La Esperanza'] },
  { codigo: 'P-002', nombre: 'María Caal', municipio: 'Chisec', fincas: ['Finca Santa Rosa'] },
  { codigo: 'P-003', nombre: 'Pedro Xol', municipio: 'Raxruhá', fincas: ['Finca Los Cedros'] },
];

async function main() {
  for (const c of CENTROS) {
    await prisma.centro.upsert({ where: { codigo: c.codigo }, update: {}, create: c });
  }
  for (const { fincas, ...datos } of PRODUCTORES) {
    const productor = await prisma.productor.upsert({
      where: { codigo: datos.codigo },
      update: {},
      create: { ...datos, departamento: 'Alta Verapaz' },
    });
    for (const nombre of fincas) {
      await prisma.finca.upsert({
        where: { productorId_nombre: { productorId: productor.id, nombre } },
        update: {},
        create: { productorId: productor.id, nombre, municipio: datos.municipio, departamento: 'Alta Verapaz' },
      });
    }
  }
  console.log('Catálogos demo listos: 2 centros, 3 productores, 4 fincas');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
