const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function seedF1() {
  console.log('🏎️ Iniciando carga oficial de Pilotos y Escuderías de F1 en PostgreSQL...');

  try {
    const response = await axios.get('https://api.openf1.org/v1/drivers?session_key=latest');
    const driversData = response.data || [];

    if (!Array.isArray(driversData) || driversData.length === 0) {
      console.error('❌ No se encontraron datos en OpenF1 API.');
      return;
    }

    const escuderiaMap = new Map();

    for (const d of driversData) {
      const nombrePiloto = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.full_name;
      const escuderia = d.team_name || 'F1 Team';

      if (!nombrePiloto) continue;

      // Asignación de Elo inicial basado en jerarquía
      let eloInicial = 1600.0;
      if (nombrePiloto.toLowerCase().includes('verstappen')) eloInicial = 2100.0;
      else if (nombrePiloto.toLowerCase().includes('norris')) eloInicial = 2050.0;
      else if (nombrePiloto.toLowerCase().includes('leclerc')) eloInicial = 2020.0;
      else if (nombrePiloto.toLowerCase().includes('hamilton')) eloInicial = 2000.0;
      else if (nombrePiloto.toLowerCase().includes('piastri')) eloInicial = 1950.0;
      else if (nombrePiloto.toLowerCase().includes('russell')) eloInicial = 1920.0;

      await prisma.pilotoF1.upsert({
        where: { nombre: nombrePiloto },
        update: { escuderia },
        create: {
          nombre: nombrePiloto,
          escuderia,
          elo: eloInicial,
          puntosMundial: 0.0,
          victorias: 0,
          form5: 75.0,
        },
      });

      escuderiaMap.set(escuderia, true);
    }

    // Insertar Escuderías (Constructores)
    for (const escuderia of escuderiaMap.keys()) {
      let eloEscuderia = 1600.0;
      if (escuderia.toLowerCase().includes('mclaren')) eloEscuderia = 2100.0;
      else if (escuderia.toLowerCase().includes('red bull')) eloEscuderia = 2080.0;
      else if (escuderia.toLowerCase().includes('ferrari')) eloEscuderia = 2040.0;
      else if (escuderia.toLowerCase().includes('mercedes')) eloEscuderia = 1980.0;

      await prisma.escuderiaF1.upsert({
        where: { nombre: escuderia },
        update: {},
        create: {
          nombre: escuderia,
          elo: eloEscuderia,
          puntosMundial: 0.0,
          victorias: 0,
        },
      });
    }

    const totalPilotos = await prisma.pilotoF1.count();
    const totalEscuderias = await prisma.escuderiaF1.count();

    console.log(`✅ ¡ÉXITO! Se han guardado ${totalPilotos} Pilotos y ${totalEscuderias} Escuderías de F1 en PostgreSQL.`);
  } catch (error) {
    console.error('❌ Error guardando datos de F1:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

seedF1();
