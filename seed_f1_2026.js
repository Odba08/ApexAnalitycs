const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedF12026() {
  console.log('🏎️ Poblando Base de Datos con Telemetría Oficial F1 2026 (GP Bakú Azerbaiyán)...');

  const gpBakú = await prisma.granPremioF1.upsert({
    where: { nombre: 'Gran Premio de Azerbaiyán (Bakú)' },
    update: {
      circuito: 'Circuito Callejero de Bakú',
      fecha: '2026-09-27',
      fase: 'Prácticas Libres FP1 y FP2 Finalizadas (Russell 1º)',
    },
    create: {
      nombre: 'Gran Premio de Azerbaiyán (Bakú)',
      circuito: 'Circuito Callejero de Bakú',
      fecha: '2026-09-27',
      fase: 'Prácticas Libres FP1 y FP2 Finalizadas (Russell 1º)',
    },
  });

  const pilotosData = [
    {
      nombre: 'Kimi Antonelli',
      escuderia: 'Mercedes',
      elo: 2150.0,
      puntosMundial: 284,
      victorias: 4,
      poles: 2,
      podios: 9,
      podiosConsecutivos: 2,
      fp1Pos: 2,
      fp2Pos: 3,
      rachaReciente: 'Líder del Mundial 2026 | 9 Podios',
      form5: 92.0,
    },
    {
      nombre: 'Lando Norris',
      escuderia: 'McLaren',
      elo: 2140.0,
      puntosMundial: 272,
      victorias: 5,
      poles: 6,
      podios: 10,
      podiosConsecutivos: 3,
      fp1Pos: 3,
      fp2Pos: 2,
      rachaReciente: '3 Poles y 2 Wins en las últimas 4 carreras',
      form5: 96.0,
    },
    {
      nombre: 'Max Verstappen',
      escuderia: 'Red Bull Racing',
      elo: 2130.0,
      puntosMundial: 258,
      victorias: 4,
      poles: 4,
      podios: 11,
      podiosConsecutivos: 5,
      fp1Pos: 4,
      fp2Pos: 4,
      rachaReciente: '5 Podios Consecutivos',
      form5: 90.0,
    },
    {
      nombre: 'George Russell',
      escuderia: 'Mercedes',
      elo: 2020.0,
      puntosMundial: 175,
      victorias: 2,
      poles: 3,
      podios: 6,
      podiosConsecutivos: 1,
      fp1Pos: 1,
      fp2Pos: 1,
      rachaReciente: '1º en Prácticas Libres FP1 y FP2 de Bakú',
      form5: 88.0,
    },
    {
      nombre: 'Charles Leclerc',
      escuderia: 'Ferrari',
      elo: 2040.0,
      puntosMundial: 210,
      victorias: 1,
      poles: 3,
      podios: 7,
      podiosConsecutivos: 1,
      fp1Pos: 5,
      fp2Pos: 5,
      rachaReciente: '1 Victoria y 3 Poles esta temporada',
      form5: 84.0,
    },
    {
      nombre: 'Lewis Hamilton',
      escuderia: 'Ferrari',
      elo: 2010.0,
      puntosMundial: 194,
      victorias: 1,
      poles: 1,
      podios: 5,
      podiosConsecutivos: 0,
      fp1Pos: 6,
      fp2Pos: 6,
      rachaReciente: '1 Victoria esta temporada',
      form5: 82.0,
    },
    {
      nombre: 'Oscar Piastri',
      escuderia: 'McLaren',
      elo: 1960.0,
      puntosMundial: 180,
      victorias: 2,
      poles: 1,
      podios: 4,
      podiosConsecutivos: 0,
      fp1Pos: 7,
      fp2Pos: 7,
      rachaReciente: '2 Victorias esta temporada',
      form5: 80.0,
    },
    {
      nombre: 'Pierre Gasly',
      escuderia: 'Alpine',
      elo: 1850.0,
      puntosMundial: 98,
      victorias: 0,
      poles: 1,
      podios: 2,
      podiosConsecutivos: 0,
      fp1Pos: 8,
      fp2Pos: 8,
      rachaReciente: '1 Pole Position esta temporada',
      form5: 75.0,
    },
    {
      nombre: 'Fernando Alonso',
      escuderia: 'Aston Martin',
      elo: 1840.0,
      puntosMundial: 90,
      victorias: 0,
      poles: 0,
      podios: 1,
      podiosConsecutivos: 0,
      fp1Pos: 9,
      fp2Pos: 9,
      rachaReciente: 'Top 10 constante',
      form5: 72.0,
    },
    {
      nombre: 'Lance Stroll',
      escuderia: 'Aston Martin',
      elo: 1650.0,
      puntosMundial: 30,
      victorias: 0,
      poles: 0,
      podios: 0,
      podiosConsecutivos: 0,
      fp1Pos: 10,
      fp2Pos: 10,
      rachaReciente: 'Luchando por puntos',
      form5: 50.0,
    },
  ];

  for (const p of pilotosData) {
    await prisma.pilotoF1.upsert({
      where: { nombre: p.nombre },
      update: { ...p },
      create: { ...p },
    });
  }

  const escuderiasData = [
    { nombre: 'Mercedes', elo: 2150.0, puntosMundial: 459, victorias: 6 },
    { nombre: 'McLaren', elo: 2140.0, puntosMundial: 452, victorias: 7 },
    { nombre: 'Ferrari', elo: 2040.0, puntosMundial: 404, victorias: 2 },
    { nombre: 'Red Bull Racing', elo: 2030.0, puntosMundial: 395, victorias: 4 },
    { nombre: 'Alpine', elo: 1850.0, puntosMundial: 110, victorias: 0 },
    { nombre: 'Aston Martin', elo: 1840.0, puntosMundial: 120, victorias: 0 },
  ];

  for (const e of escuderiasData) {
    await prisma.escuderiaF1.upsert({
      where: { nombre: e.nombre },
      update: { ...e },
      create: { ...e },
    });
  }

  console.log('✅ Base de datos de F1 2026 actualizada con GP Bakú, FP1/FP2, Rachas y Puntos.');
  await prisma.$disconnect();
}

seedF12026();
