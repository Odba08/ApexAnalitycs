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
      return {
        gp,
        ...res.data,
      };
    } catch (error) {
      this.logger.error('Error invocando motor Python de F1', error.message);
      return { error: 'No se pudo conectar con el cerebro Python de F1.' };
    }
  }
}
