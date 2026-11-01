// Crea en PRODUCCIÓN los usuarios demo (uno por rol).
// Es JavaScript puro porque la imagen de la API no trae ts-node. Se puede repetir:
// si el usuario ya existe, le actualiza la contraseña.
// No crea catálogos (centros, productores, fincas): los carga prisma/seed-demo.ts.
//
// Uso, en el servidor, sin necesidad de redeploy:
//   docker exec -i -e DEMO_PASSWORD='ClaveLarga2026' trazabilidad-api-1 node - < seed-demo-prod.js
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
