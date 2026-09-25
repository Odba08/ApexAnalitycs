import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 ==========================================');
  console.log('   INICIANDO SEEDING MAESTRO EN NEON DB');
  console.log('============================================\n');

  // 1. EQUIPOS DE FÚTBOL
  console.log('⚽ 1. Poblando Equipos de Fútbol...');
  const equipos = [
    { nombre: 'Arsenal', liga: 'Premier League', elo: 1940.0, form5: 13, form3: 9 },
    { nombre: 'Manchester City', liga: 'Premier League', elo: 2040.0, form5: 12, form3: 7 },
    { nombre: 'Liverpool', liga: 'Premier League', elo: 1960.0, form5: 11, form3: 7 },
    { nombre: 'Aston Villa', liga: 'Premier League', elo: 1780.0, form5: 9, form3: 6 },
    { nombre: 'Chelsea', liga: 'Premier League', elo: 1810.0, form5: 8, form3: 4 },
    { nombre: 'Tottenham', liga: 'Premier League', elo: 1790.0, form5: 8, form3: 4 },
    { nombre: 'Newcastle', liga: 'Premier League', elo: 1760.0, form5: 7, form3: 4 },
    { nombre: 'Real Madrid', liga: 'LaLiga', elo: 2020.0, form5: 13, form3: 9 },
    { nombre: 'FC Barcelona', liga: 'LaLiga', elo: 1980.0, form5: 12, form3: 7 },
    { nombre: 'Atlético de Madrid', liga: 'LaLiga', elo: 1870.0, form5: 9, form3: 6 },
    { nombre: 'Bayern Munich', liga: 'Bundesliga', elo: 1990.0, form5: 13, form3: 9 },
    { nombre: 'Bayer Leverkusen', liga: 'Bundesliga', elo: 1910.0, form5: 10, form3: 6 },
    { nombre: 'Inter Milan', liga: 'Serie A', elo: 1930.0, form5: 12, form3: 7 },
    { nombre: 'Juventus', liga: 'Serie A', elo: 1840.0, form5: 8, form3: 5 },
    { nombre: 'Paris Saint-Germain', liga: 'Ligue 1', elo: 1900.0, form5: 11, form3: 7 },
  ];

  for (const eq of equipos) {
    await prisma.equipo.upsert({
      where: { nombre: eq.nombre },
      update: eq,
      create: eq,
    });
  }
  console.log(`   ✅ ${equipos.length} equipos de fútbol registrados.\n`);

  // 2. ESCUDERÍAS F1
  console.log('🏎️ 2. Poblando Escuderías de F1...');
  const escuderias = [
    { nombre: 'McLaren', elo: 2120.0, puntosMundial: 510.0, victorias: 8 },
    { nombre: 'Red Bull Racing', elo: 2100.0, puntosMundial: 480.0, victorias: 7 },
    { nombre: 'Ferrari', elo: 2050.0, puntosMundial: 420.0, victorias: 3 },
    { nombre: 'Mercedes', elo: 2010.0, puntosMundial: 370.0, victorias: 3 },
    { nombre: 'Aston Martin', elo: 1820.0, puntosMundial: 120.0, victorias: 0 },
    { nombre: 'Alpine', elo: 1780.0, puntosMundial: 75.0, victorias: 0 },
    { nombre: 'Williams', elo: 1740.0, puntosMundial: 45.0, victorias: 0 },
    { nombre: 'Haas', elo: 1720.0, puntosMundial: 38.0, victorias: 0 },
  ];

  for (const esc of escuderias) {
    await prisma.escuderiaF1.upsert({
      where: { nombre: esc.nombre },
      update: esc,
      create: esc,
    });
  }
  console.log(`   ✅ ${escuderias.length} escuderías de F1 registradas.\n`);

  // 3. PILOTOS F1
  console.log('🏎️ 3. Poblando Pilotos de F1...');
  const pilotos = [
    { nombre: 'Max Verstappen', escuderia: 'Red Bull Racing', elo: 2130.0, puntosMundial: 295.0, victorias: 7, poles: 6, podios: 12, podiosConsecutivos: 4, fp1Pos: 2, fp2Pos: 1, rachaReciente: 'Líder de victorias 2026', form5: 94.0 },
    { nombre: 'Lando Norris', escuderia: 'McLaren', elo: 2140.0, puntosMundial: 288.0, victorias: 5, poles: 7, podios: 11, podiosConsecutivos: 3, fp1Pos: 1, fp2Pos: 2, rachaReciente: '3 Poles consecutivas', form5: 96.0 },
    { nombre: 'Charles Leclerc', escuderia: 'Ferrari', elo: 2050.0, puntosMundial: 230.0, victorias: 2, poles: 4, podios: 8, podiosConsecutivos: 2, fp1Pos: 3, fp2Pos: 4, rachaReciente: 'Victoria en Monza', form5: 88.0 },
    { nombre: 'Oscar Piastri', escuderia: 'McLaren', elo: 2020.0, puntosMundial: 215.0, victorias: 2, poles: 2, podios: 7, podiosConsecutivos: 1, fp1Pos: 4, fp2Pos: 3, rachaReciente: 'Podio en últimas 2 carreras', form5: 86.0 },
    { nombre: 'George Russell', escuderia: 'Mercedes', elo: 2010.0, puntosMundial: 185.0, victorias: 2, poles: 2, podios: 6, podiosConsecutivos: 1, fp1Pos: 5, fp2Pos: 5, rachaReciente: '1º en Libres de Bakú', form5: 85.0 },
    { nombre: 'Lewis Hamilton', escuderia: 'Ferrari', elo: 2000.0, puntosMundial: 190.0, victorias: 1, poles: 1, podios: 5, podiosConsecutivos: 0, fp1Pos: 7, fp2Pos: 7, rachaReciente: 'Top 5 en Zandvoort', form5: 80.0 },
    { nombre: 'Carlos Sainz', escuderia: 'Williams', elo: 1980.0, puntosMundial: 175.0, victorias: 1, poles: 1, podios: 5, podiosConsecutivos: 0, fp1Pos: 6, fp2Pos: 6, rachaReciente: 'Regularidad en Top 6', form5: 82.0 },
    { nombre: 'Fernando Alonso', escuderia: 'Aston Martin', elo: 1850.0, puntosMundial: 78.0, victorias: 0, poles: 0, podios: 2, podiosConsecutivos: 0, fp1Pos: 8, fp2Pos: 8, rachaReciente: 'En puntos constantemente', form5: 74.0 },
  ];

  for (const pil of pilotos) {
    await prisma.pilotoF1.upsert({
      where: { nombre: pil.nombre },
      update: pil,
      create: pil,
    });
  }
  console.log(`   ✅ ${pilotos.length} pilotos de F1 registrados.\n`);

  // 4. GRANDES PREMIOS F1
  console.log('🏎️ 4. Poblando Calendario de F1...');
  const gps = [
    { nombre: 'Gran Premio de Azerbaiyán (Bakú)', circuito: 'Circuito Callejero de Bakú', fecha: '2026-09-27', fase: 'Prácticas Libres FP1/FP2 Finalizadas' },
    { nombre: 'Gran Premio de Singapur', circuito: 'Marina Bay Street Circuit', fecha: '2026-10-04', fase: 'Programado' },
    { nombre: 'Gran Premio de Estados Unidos (Austin)', circuito: 'Circuit of the Americas', fecha: '2026-10-18', fase: 'Programado' },
  ];

  for (const gp of gps) {
    await prisma.granPremioF1.upsert({
      where: { nombre: gp.nombre },
      update: gp,
      create: gp,
    });
  }
  console.log(`   ✅ ${gps.length} Grandes Premios registrados.\n`);

  // 5. EVENTOS UFC
  console.log('🥊 5. Poblando Eventos UFC...');
  const eventosUFC = [
    { nombre: 'UFC Fight Night: Moicano vs Duncan', fecha: '2026-09-26', sede: 'UFC Apex, Las Vegas, Nevada', estado: 'PROGRAMADO' },
    { nombre: 'UFC 307: Pereira vs Rountree Jr.', fecha: '2026-10-05', sede: 'Delta Center, Salt Lake City, Utah', estado: 'PROGRAMADO' },
  ];

  for (const ev of eventosUFC) {
    await prisma.eventoUFC.upsert({
      where: { nombre: ev.nombre },
      update: ev,
      create: ev,
    });
  }
  console.log(`   ✅ ${eventosUFC.length} eventos UFC registrados.\n`);

  // 6. PELEADORES UFC (Desde CSV Oficial)
  console.log('🥊 6. Poblando Peleadores UFC desde CSV...');
  const candidates = [
    path.join(__dirname, 'ufc_fighter_tott.csv'),
    path.join(__dirname, '..', '..', 'MachineLearning', 'ufc_fighter_tott.csv'),
    path.join(process.cwd(), 'prisma', 'ufc_fighter_tott.csv'),
    'C:\\Users\\oscar.bueno\\Desktop\\MachineLearning\\ufc_fighter_tott.csv',
  ];
  const tottPath = candidates.find((p) => fs.existsSync(p));
  if (tottPath) {
    const fileStream = fs.createReadStream(tottPath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const fighters: any[] = [];
    let isHeader = true;

    for await (const line of rl) {
      if (isHeader) {
        isHeader = false;
        continue;
      }
      const parts = line.split(',');
      if (parts.length < 4) continue;

      const nombre = (parts[0] || '').trim();
      if (!nombre) continue;

      const weightStr = (parts[2] || '').replace('lbs.', '').trim();
      const reachStr = (parts[3] || '').replace('"', '').trim();

      const weight = parseFloat(weightStr) || 155;
      const reachInches = parseFloat(reachStr) || 70;
      const reachCm = Math.round(reachInches * 2.54);

      let categoria = 'Lightweight';
      if (weight <= 125) categoria = 'Flyweight';
      else if (weight <= 135) categoria = 'Bantamweight';
      else if (weight <= 145) categoria = 'Featherweight';
      else if (weight <= 155) categoria = 'Lightweight';
      else if (weight <= 170) categoria = 'Welterweight';
      else if (weight <= 185) categoria = 'Middleweight';
      else if (weight <= 205) categoria = 'Light Heavyweight';
      else categoria = 'Heavyweight';

      fighters.push({
        nombre,
        categoria,
        reachCm: reachCm || 180.0,
        age: 30,
        sigStrMin: 3.5,
        avgTd15m: 1.5,
        subAvg15m: 0.5,
        tdDefPct: 65.0,
        strDefPct: 55.0,
        elo: 1500.0,
        victorias: 10,
        derrotas: 3,
      });
    }

    console.log(`   Procesando ${fighters.length} peleadores del CSV...`);
    let insertados = 0;
    for (let i = 0; i < fighters.length; i += 500) {
      const chunk = fighters.slice(i, i + 500);
      const res = await prisma.peleadorUFC.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      insertados += res.count;
    }
    console.log(`   ✅ ${insertados} peleadores insertados en PeleadorUFC.\n`);
  } else {
    console.log('   ⚠️ Archivo CSV no encontrado, omitiendo peleadores UFC.\n');
  }

  // 7. HISTORIAL AUDITADO DE ALERTAS DE VALOR (+EV)
  console.log('📊 7. Poblando Historial de Alertas de Valor (+EV)...');
  const alertas = [
    // Fútbol
    { deporte: 'FUTBOL', partido: 'Arsenal vs Leeds United', liga: 'Premier League', mercadoRecomendado: 'Arsenal (1)', cuotaCasa: 1.55, probabilidadIA: 74.0, ventajaPorcentaje: 14.7, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
    { deporte: 'FUTBOL', partido: 'Real Madrid vs Villarreal', liga: 'LaLiga', mercadoRecomendado: 'Real Madrid (1)', cuotaCasa: 1.62, probabilidadIA: 68.0, ventajaPorcentaje: 10.2, stakeRecomendado: 1.0, estado: 'GANADA' },
    { deporte: 'FUTBOL', partido: 'Manchester City vs Fulham', liga: 'Premier League', mercadoRecomendado: 'Man City -1.5 AH', cuotaCasa: 1.85, probabilidadIA: 61.0, ventajaPorcentaje: 12.8, stakeRecomendado: 1.0, estado: 'GANADA' },
    { deporte: 'FUTBOL', partido: 'FC Barcelona vs Sevilla', liga: 'LaLiga', mercadoRecomendado: 'Más de 2.5 Goles', cuotaCasa: 1.70, probabilidadIA: 65.0, ventajaPorcentaje: 10.5, stakeRecomendado: 1.0, estado: 'GANADA' },
    { deporte: 'FUTBOL', partido: 'Liverpool vs Everton', liga: 'Premier League', mercadoRecomendado: 'Liverpool (1)', cuotaCasa: 1.45, probabilidadIA: 76.0, ventajaPorcentaje: 10.2, stakeRecomendado: 1.0, estado: 'GANADA' },
    { deporte: 'FUTBOL', partido: 'Chelsea vs Brighton', liga: 'Premier League', mercadoRecomendado: 'Ambos Marcan (Sí)', cuotaCasa: 1.75, probabilidadIA: 62.0, ventajaPorcentaje: 8.5, stakeRecomendado: 1.0, estado: 'PERDIDA' },

    // UFC
    { deporte: 'UFC', partido: 'Vanessa Demopoulos vs Melissa Amaya', liga: 'UFC Flyweight', mercadoRecomendado: 'Vanessa Demopoulos', cuotaCasa: 7.48, probabilidadIA: 62.0, ventajaPorcentaje: 363.8, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
    { deporte: 'UFC', partido: 'Raoni Barcelos vs Ricky Turcios', liga: 'UFC Bantamweight', mercadoRecomendado: 'Raoni Barcelos', cuotaCasa: 2.37, probabilidadIA: 60.0, ventajaPorcentaje: 42.2, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
    { deporte: 'UFC', partido: 'Melissa Amaya vs Brogan Walker', liga: 'UFC Flyweight', mercadoRecomendado: 'Melissa Amaya', cuotaCasa: 2.30, probabilidadIA: 58.0, ventajaPorcentaje: 33.4, stakeRecomendado: 1.0, estado: 'GANADA' },
    { deporte: 'UFC', partido: 'Renato Moicano vs Christian Duncan', liga: 'UFC Lightweight', mercadoRecomendado: 'Renato Moicano', cuotaCasa: 1.80, probabilidadIA: 64.0, ventajaPorcentaje: 15.2, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
    { deporte: 'UFC', partido: 'John Castaneda vs Heili Alateng', liga: 'UFC Bantamweight', mercadoRecomendado: 'Heili Alateng', cuotaCasa: 3.94, probabilidadIA: 41.0, ventajaPorcentaje: 61.5, stakeRecomendado: 1.0, estado: 'PERDIDA' },

    // F1
    { deporte: 'F1', partido: 'Gran Premio de Azerbaiyán (Bakú)', liga: 'Formula 1', mercadoRecomendado: 'Max Verstappen (Victoria)', cuotaCasa: 1.95, probabilidadIA: 54.0, ventajaPorcentaje: 5.3, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
    { deporte: 'F1', partido: 'Gran Premio de Azerbaiyán (Bakú)', liga: 'Formula 1', mercadoRecomendado: 'Lando Norris (Podio Top 3)', cuotaCasa: 1.65, probabilidadIA: 68.0, ventajaPorcentaje: 12.2, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
    { deporte: 'F1', partido: 'Gran Premio de Azerbaiyán (Bakú)', liga: 'Formula 1', mercadoRecomendado: 'Charles Leclerc (Podio Top 3)', cuotaCasa: 1.85, probabilidadIA: 58.0, ventajaPorcentaje: 7.3, stakeRecomendado: 1.0, estado: 'PENDIENTE' },
  ];

  for (const alt of alertas) {
    const existing = await prisma.alertaValor.findFirst({
      where: {
        deporte: alt.deporte,
        partido: alt.partido,
        mercadoRecomendado: alt.mercadoRecomendado,
      },
    });
    if (!existing) {
      await prisma.alertaValor.create({ data: alt });
    }
  }
  console.log(`   ✅ ${alertas.length} alertas auditadas registradas.\n`);

  console.log('🎉 ==========================================');
  console.log('   ¡BASE DE DATOS NEON POBLADA CON ÉXITO!');
  console.log('============================================');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
