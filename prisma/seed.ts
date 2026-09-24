import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Esto obliga al script a buscar y leer el .env de la raíz
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando la siembra de datos...');

  const equiposNuevos = [
    { nombre: 'Arsenal', liga: 'Premier', elo: 1920.0, form5: 12, form3: 7 },
    { nombre: 'Aston Villa', liga: 'Premier', elo: 1750.0, form5: 7, form3: 4 },
    {
      nombre: 'Manchester City',
      liga: 'Premier',
      elo: 2050.0,
      form5: 13,
      form3: 9,
    },
    { nombre: 'Liverpool', liga: 'Premier', elo: 1950.0, form5: 10, form3: 6 },
    { nombre: 'Real Madrid', liga: 'LaLiga', elo: 2000.0, form5: 11, form3: 7 },
  ];

  for (const equipo of equiposNuevos) {
    await prisma.equipo.upsert({
      where: { nombre: equipo.nombre },
      update: {},
      create: equipo,
    });
  }

  console.log('✅ Base de datos poblada con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
