import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios'; // <--- 1. Importamos axios aquí
import { PrismaService } from '../prisma/prisma.service'; // <--- 2. Importamos Prisma

@Injectable()
export class SportsApiService {
  private readonly logger = new Logger(SportsApiService.name);
  private readonly apiKey =
    process.env.ALLSPORTS_API_KEY || process.env.SPORTS_API_KEY;
  private readonly baseUrl = 'https://apiv2.allsportsapi.com/football/';

  constructor(private readonly prisma: PrismaService) {} // <--- 3. Inyectamos Prisma en el constructor

  async obtenerPartidosDelDia(desde: string, hasta: string) {
    try {
      const url = `${this.baseUrl}?met=Fixtures&from=${desde}&to=${hasta}&APIkey=${this.apiKey}`;
      const respuesta = await axios.get(url);

      if (respuesta.data && respuesta.data.result) {
        this.logger.log(
          `¡Se encontraron ${respuesta.data.result.length} partidos!`,
        );
        return respuesta.data.result;
      }
      return [];
    } catch (error) {
      this.logger.error('Error al obtener partidos de la API', error);
      return [];
    }
  }

  async obtenerStandingsLiga(leagueId: number) {
    try {
      const url = `${this.baseUrl}?met=Standings&leagueId=${leagueId}&APIkey=${this.apiKey}`;
      const respuesta = await axios.get(url);
      if (respuesta.data && respuesta.data.result && respuesta.data.result.total) {
        return respuesta.data.result.total;
      }
      return [];
    } catch (error) {
      this.logger.error(`Error al obtener standings para liga ${leagueId}`, error);
      return [];
    }
  }

  async obtenerPartidosHoyOProximos(diasFuturos: number = 3) {
    const hoy = new Date();
    const futuro = new Date();
    futuro.setDate(hoy.getDate() + diasFuturos);

    const formatoFecha = (d: Date) => d.toISOString().split('T')[0];
    const desde = formatoFecha(hoy);
    const hasta = formatoFecha(futuro);

    this.logger.log(`Consultando partidos entre ${desde} y ${hasta}...`);
    return this.obtenerPartidosDelDia(desde, hasta);
  }

  async actualizarEstadisticasEquipos() {
    this.logger.log(
      'Iniciando descarga masiva de Standings (Tabla de Posiciones)...',
    );

    const ligas = [
      { id: 152, nombre: 'Premier' },
      { id: 302, nombre: 'LaLiga' },
      { id: 175, nombre: 'Bundesliga' },
      { id: 207, nombre: 'SerieA' },
      { id: 153, nombre: 'Championship' },
    ];

    for (const liga of ligas) {
      try {
        const url = `${this.baseUrl}?met=Standings&leagueId=${liga.id}&APIkey=${this.apiKey}`;
        const respuesta = await axios.get(url);

        if (
          respuesta.data &&
          respuesta.data.result &&
          respuesta.data.result.total
        ) {
          const tabla = respuesta.data.result.total;

          this.logger.log(
            `Procesando ${tabla.length} equipos de ${liga.nombre}...`,
          );

          for (const fila of tabla) {
            const nombreEquipo = fila.standing_team || fila.team_name;
            if (!nombreEquipo) continue;
            const puntos = parseInt(fila.standing_PTS || '0');
            const partidosJugados = parseInt(fila.standing_P || '0');
            const golesFavor = parseInt(fila.standing_F || '0');
            const golesContra = parseInt(fila.standing_A || '0');
            const difGoles = golesFavor - golesContra;

            const puntosPorPartido = partidosJugados > 0 ? puntos / partidosJugados : 1.0;
            const difGolesPorPartido = partidosJugados > 0 ? difGoles / partidosJugados : 0.0;

            // Fórmula Estadística Real de Elo: Base 1500 + rendimiento + ajuste por diferencia de goles
            let eloCalculado = 1500 + (puntosPorPartido * 160) + (difGolesPorPartido * 65);
            
            // Forma calculada estadísticamente en escala 0 - 100
            let formCalculado = Math.min(100, Math.max(0, (puntosPorPartido * 28) + (difGolesPorPartido * 8) + 15));

            await this.prisma.equipo.upsert({
              where: { nombre: nombreEquipo },
              update: {
                elo: parseFloat(eloCalculado.toFixed(2)),
                form5: parseFloat(formCalculado.toFixed(2)),
                form3: parseFloat(formCalculado.toFixed(2)),
              },
              create: {
                nombre: nombreEquipo,
                liga: liga.nombre,
                elo: parseFloat(eloCalculado.toFixed(2)),
                form5: parseFloat(formCalculado.toFixed(2)),
                form3: parseFloat(formCalculado.toFixed(2)),
              },
            });
          }
          this.logger.log(`✅ ${liga.nombre} actualizada correctamente en BD.`);
        }
      } catch (error) {
        this.logger.error(
          `Error actualizando liga ${liga.nombre}:`,
          error.message,
        );
      }
    }

    this.logger.log(
      '🎉 ¡Todos los equipos han sido actualizados en la Base de Datos!',
    );
  }
}
