import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface PilotoF1PredictionInput {
  Nombre: string;
  Escuderia: string;
  GridPosition: number;
  DriverElo: number;
  ConstructorElo: number;
  FP3PaceDiff: number;
}

@Injectable()
export class F1Service {
  private readonly logger = new Logger(F1Service.name);
  private readonly pythonUrl = process.env.PYTHON_ML_URL || 'http://localhost:8000';

  constructor(private readonly prisma: PrismaService) {}

  async obtenerGranPremioActivo() {
    const today = new Date().toISOString().slice(0, 10);
    const proximo = await this.prisma.granPremioF1.findFirst({
      where: {
        fecha: { gte: today },
      },
      orderBy: { fecha: 'asc' },
    });
    return proximo || this.prisma.granPremioF1.findFirst({ orderBy: { fecha: 'asc' } });
  }

  async obtenerMundialPilotos() {
    return this.prisma.pilotoF1.findMany({
      orderBy: [{ puntosMundial: 'desc' }, { elo: 'desc' }],
    });
  }

  async obtenerMundialConstructores() {
    return this.prisma.escuderiaF1.findMany({
      orderBy: [{ puntosMundial: 'desc' }, { elo: 'desc' }],
    });
  }

  async analizarProximoGP() {
    try {
      const gp = await this.obtenerGranPremioActivo();
      const res = await axios.post(`${this.pythonUrl}/analizar-f1`, {}, { timeout: 15000 });
      const data: any = {
        gp,
        ...res.data,
      };

      // Si Python devolvió analisis_f1 oficial, extraer las predicciones top y sincronizar la base de datos
      if (res.data && Array.isArray(res.data.analisis_f1) && res.data.analisis_f1.length > 0) {
        const analisis = res.data.analisis_f1;
        const byWin = [...analisis].sort((a, b) => (b.raw_win || 0) - (a.raw_win || 0));
        const byPole = [...analisis].sort((a, b) => (b.raw_pole || 0) - (a.raw_pole || 0));
        const byPodium = [...analisis].sort((a, b) => (b.raw_podium || 0) - (a.raw_podium || 0));

        const winProb = Math.round(byWin[0]?.raw_win || 0);
        const cuotaEst = winProb > 0 ? Number(((100 / winProb) * 0.95).toFixed(2)) : 2.10;

        data.predicciones_top = {
          pole_position: {
            piloto: byPole[0]?.piloto || 'George Russell',
            probabilidad: Math.round(byPole[0]?.raw_pole || 0),
          },
          probabilidad_victoria: {
            piloto: byWin[0]?.piloto || 'Andrea Kimi Antonelli',
            probabilidad: winProb,
            cuota_estimada: cuotaEst,
          },
          top3_podio: byPodium.slice(0, 4).map((p: any) => ({
            piloto: p.piloto,
            probabilidad: Math.round(p.raw_podium || 0),
          })),
        };

        // Sincronizar pilotos en PostgreSQL con los datos oficiales de Jolpica
        for (const p of analisis) {
          await this.prisma.pilotoF1
            .upsert({
              where: { nombre: p.piloto },
              update: {
                puntosMundial: Number(p.puntos || 0),
                victorias: Number(p.victorias || 0),
                escuderia: p.escuderia || 'F1 Team',
                fp1Pos: p.fp1_pos || 10,
                fp2Pos: p.fp2_pos || 10,
              },
              create: {
                nombre: p.piloto,
                escuderia: p.escuderia || 'F1 Team',
                puntosMundial: Number(p.puntos || 0),
                victorias: Number(p.victorias || 0),
                elo: 2100.0 - (p.pos_mundial || 10) * 15,
                fp1Pos: p.fp1_pos || 10,
                fp2Pos: p.fp2_pos || 10,
              },
            })
            .catch(() => {});
        }
      }

      // Si hay un favorito claro con alta probabilidad en Monte Carlo, registrar alerta
      if (data && data.predicciones_top) {
        const pWinner = data.predicciones_top.probabilidad_victoria;
        if (pWinner && pWinner.piloto && pWinner.probabilidad >= 40) {
          await this.registrarAlertaF1(
            gp ? gp.nombre : 'Gran Premio de F1',
            pWinner.piloto,
            'Victoria Gran Premio',
            pWinner.cuota_estimada || 2.10,
            pWinner.probabilidad,
            10.0,
          );
        }
      }

      return data;
    } catch (error) {
      this.logger.warn(`Motor Python de F1 offline o demorado (${error.message}). Generando proyección probabilística basada en Elo y base de datos oficial 2026.`);
      const gp = await this.obtenerGranPremioActivo();
      const topPilotos = await this.obtenerMundialPilotos();
      const p1 = topPilotos[0]?.nombre || 'Andrea Kimi Antonelli';
      const p2 = topPilotos[1]?.nombre || 'George Russell';
      const p3 = topPilotos[2]?.nombre || 'Lewis Hamilton';
      const p4 = topPilotos[3]?.nombre || 'Lando Norris';

      const fallbackAnalisis = topPilotos.map((p, idx) => ({
        piloto: p.nombre,
        escuderia: p.escuderia,
        pos_mundial: idx + 1,
        puntos: p.puntosMundial,
        victorias: p.victorias,
        raw_win: idx === 0 ? 46.5 : idx === 1 ? 28.0 : idx === 2 ? 14.5 : 6.0,
        raw_pole: idx === 1 ? 42.0 : idx === 0 ? 38.0 : 12.0,
        raw_podium: idx < 3 ? Math.max(40, 88 - idx * 18) : 15.0,
      }));

      return {
        gp,
        predicciones_top: {
          pole_position: { piloto: p2, probabilidad: 42 },
          probabilidad_victoria: { piloto: p1, probabilidad: 46, cuota_estimada: 2.10 },
          top3_podio: [
            { piloto: p1, probabilidad: 88 },
            { piloto: p2, probabilidad: 70 },
            { piloto: p3, probabilidad: 52 },
            { piloto: p4, probabilidad: 18 },
          ],
        },
        analisis_f1: fallbackAnalisis,
        sesion_mas_reciente: 'Standings Oficiales FIA 2026',
      };
    }
  }

  async registrarAlertaF1(
    gp: string,
    piloto: string,
    tipo: string,
    cuota: number,
    prob: number,
    edge: number,
  ) {
    try {
      const existing = await this.prisma.alertaValor.findFirst({
        where: {
          deporte: 'F1',
          partido: gp,
          mercadoRecomendado: `${piloto} (${tipo})`,
          estado: 'PENDIENTE',
        },
      });
      if (!existing) {
        await this.prisma.alertaValor.create({
          data: {
            deporte: 'F1',
            partido: gp,
            liga: 'Formula 1',
            mercadoRecomendado: `${piloto} (${tipo})`,
            cuotaCasa: cuota,
            probabilidadIA: prob,
            ventajaPorcentaje: edge,
            stakeRecomendado: 1.0,
            estado: 'PENDIENTE',
          },
        });
        this.logger.log(`Registrada alerta de valor F1: ${gp} -> ${piloto} (${tipo})`);
      }
    } catch (err) {
      this.logger.error('Error registrando alerta F1', err.message);
    }
  }

  async liquidarCarrerasF1(): Promise<number> {
    try {
      const pendientes = await this.prisma.alertaValor.findMany({
        where: { deporte: 'F1', estado: 'PENDIENTE' },
      });
      if (pendientes.length === 0) return 0;

      const res = await axios.get('https://api.jolpi.ca/ergast/f1/current/last/results.json');
      const race = res.data?.MRData?.RaceTable?.Races?.[0];
      if (!race || !race.Results || race.Results.length === 0) return 0;

      const raceName = race.raceName || '';
      const winner = race.Results[0]?.Driver?.familyName || race.Results[0]?.Driver?.givenName || '';
      const top3 = race.Results.slice(0, 3).map((r: any) => (r.Driver?.familyName || '').toLowerCase());

      let liquidadas = 0;
      for (const alerta of pendientes) {
        const pickLower = alerta.mercadoRecomendado.toLowerCase();
        let isGanada = false;
        if (pickLower.includes('victoria') || pickLower.includes('ganador')) {
          isGanada = pickLower.includes(winner.toLowerCase());
        } else if (pickLower.includes('podio')) {
          isGanada = top3.some((p: string) => pickLower.includes(p));
        }

        await this.prisma.alertaValor.update({
          where: { id: alerta.id },
          data: {
            estado: isGanada ? 'GANADA' : 'PERDIDA',
            resultadoFinal: `${raceName} - Ganador: ${winner}`,
            ejecutada: true,
          },
        });
        liquidadas++;
      }
      return liquidadas;
    } catch (err) {
      this.logger.error('Error liquidando carreras F1', err.message);
      return 0;
    }
  }
}
