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
      const res = await axios.post(`${this.pythonUrl}/analizar-f1`);
      const data = {
        gp,
        ...res.data,
      };

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
      this.logger.error('Error invocando motor Python de F1', error.message);
      return { error: 'No se pudo conectar con el cerebro Python de F1.' };
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
