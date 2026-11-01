import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Uso (en desarrollo, desde api/):
//   Solo administrador:
//     ADMIN_EMAIL=admin@ejemplo.com ADMIN_PASSWORD=clave_larga npx prisma db seed
//   Un usuario demo por rol (misma contraseña para todos):
//     DEMO_PASSWORD=clave_larga npx prisma db seed
// Las contraseñas nunca se guardan en el repo: se leen de variables de entorno.
const prisma = new PrismaClient();

const USUARIOS_DEMO: { email: string; nombre: string; rol: Rol }[] = [
  { email: 'admin@demo.x-dev.store', nombre: 'Demo Administrador', rol: Rol.ADMIN },
  { email: 'supervisor@demo.x-dev.store', nombre: 'Demo Supervisor', rol: Rol.SUPERVISOR },
  { email: 'calidad@demo.x-dev.store', nombre: 'Demo Calidad', rol: Rol.CALIDAD },
  { email: 'bascula@demo.x-dev.store', nombre: 'Demo Báscula', rol: Rol.BASCULA },
  { email: 'campo@demo.x-dev.store', nombre: 'Demo Campo', rol: Rol.CAMPO },
  { email: 'auditor@demo.x-dev.store', nombre: 'Demo Auditor', rol: Rol.AUDITOR },
];

async function crearUsuario(email: string, nombre: string, rol: Rol, password: string) {
  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { email, nombre, rol, passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Usuario listo: ${email} (${rol})`);
}

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD } = process.env;

  if (!(ADMIN_EMAIL && ADMIN_PASSWORD) && !DEMO_PASSWORD) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD, o DEMO_PASSWORD');
  }

  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    await crearUsuario(ADMIN_EMAIL, 'Administrador', Rol.ADMIN, ADMIN_PASSWORD);
  }

  if (DEMO_PASSWORD) {
    if (DEMO_PASSWORD.length < 8) throw new Error('DEMO_PASSWORD debe tener al menos 8 caracteres');
    for (const u of USUARIOS_DEMO) {
      await crearUsuario(u.email, u.nombre, u.rol, DEMO_PASSWORD);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
