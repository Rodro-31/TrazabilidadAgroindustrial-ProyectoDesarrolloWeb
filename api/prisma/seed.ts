import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Crea el primer administrador. Uso (en desarrollo):
//   ADMIN_EMAIL=admin@ejemplo.com ADMIN_PASSWORD=una_clave_larga npx prisma db seed
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD');
  }

  await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      email,
      nombre: 'Administrador',
      passwordHash: await bcrypt.hash(password, 12),
      rol: Rol.ADMIN,
    },
  });
  console.log(`Administrador listo: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
