// Crea en PRODUCCIÓN los usuarios demo (uno por rol).
// Es JavaScript puro porque la imagen de la API no trae ts-node. Se puede repetir:
// si el usuario ya existe, le actualiza la contraseña.
// Los catálogos (centros, productores, fincas) NO se crean por defecto: los carga
// prisma/seed-demo.ts de Rodro. Con CON_CATALOGOS=1 crea unos mínimos (no usar junto con el otro).
//
// Uso, en el servidor (carpeta /opt/trazabilidad), sin necesidad de redeploy:
//   docker compose --env-file .env -f deploy/docker-compose.prod.yml exec -T \
//     -e DEMO_PASSWORD='ClaveLarga2026' api node - < deploy/seed-demo-prod.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const USUARIOS = [
  ['admin@demo.x-dev.store', 'Demo Administrador', 'ADMIN'],
  ['supervisor@demo.x-dev.store', 'Demo Supervisor', 'SUPERVISOR'],
  ['calidad@demo.x-dev.store', 'Demo Calidad', 'CALIDAD'],
  ['bascula@demo.x-dev.store', 'Demo Báscula', 'BASCULA'],
  ['campo@demo.x-dev.store', 'Demo Campo', 'CAMPO'],
  ['auditor@demo.x-dev.store', 'Demo Auditor', 'AUDITOR'],
];

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
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) throw new Error('Define DEMO_PASSWORD (mínimo 8 caracteres)');
  const passwordHash = await bcrypt.hash(password, 12);

  for (const [email, nombre, rol] of USUARIOS) {
    await prisma.usuario.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, nombre, rol, passwordHash },
    });
    console.log(`Usuario listo: ${email} (${rol})`);
  }

  if (process.env.CON_CATALOGOS !== '1') {
    console.log('Listo. Catálogos omitidos (usa el seed-demo de Rodro).');
    return;
  }

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
