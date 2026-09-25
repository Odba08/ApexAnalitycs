import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios'; // <--- 1. Importamos axios aquí
import { PrismaService } from '../prisma/prisma.service'; // <--- 2. Importamos Prisma

@Injectable()
export class SportsApiService {
  private readonly logger = new Logger(SportsApiService.name);
  private readonly apiKey =
    process.env.ALLSPORTS_API_KEY || process.env.SPORTS_API_KEY;
  private readonly baseUrl = 'https://apiv2.allsportsapi.com/football/';
  private readonly theOddsApiKey =
    process.env.THE_ODDS_API_KEY || '9c4667b47ad5ae80f5de259e91f8ff0f';

  constructor(private readonly prisma: PrismaService) {}

  private mapLeagueToTheOddsSport(leagueId?: number): string | null {
    if (!leagueId) return null;
    switch (leagueId) {
      case 152: return 'soccer_epl'; // Premier League
      case 302: return 'soccer_spain_la_liga'; // LaLiga
      case 175: return 'soccer_germany_bundesliga'; // Bundesliga
      case 207: return 'soccer_italy_serie_a'; // Serie A
      case 168: return 'soccer_france_ligue_one'; // Ligue 1
      case 3:   return 'soccer_uefa_champs_league'; // Champions League
      case 18:  return 'soccer_conmebol_copa_libertadores'; // Copa Libertadores
      case 99:  return 'soccer_brazil_campeonato'; // Brasileirao
      case 244: return 'soccer_netherlands_eredivisie'; // Eredivisie
      case 266: return 'soccer_portugal_primeira_liga'; // Portugal
      case 153: return 'soccer_efl_champ'; // Championship
      case 322: return 'soccer_turkey_super_league'; // SuperLig
      default:  return null;
    }
  }

  async obtenerPartidosTheOdds(leagueId?: number): Promise<any[]> {
    const sportKey = this.mapLeagueToTheOddsSport(leagueId);
    if (!sportKey) return [];

    try {
      this.logger.log(`Consultando The-Odds-API gratis para ${sportKey} (liga ${leagueId})...`);
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${this.theOddsApiKey}&regions=eu&markets=h2h`;
      const res = await axios.get(url, { headers: { 'User-Agent': 'AntigravityBot/1.0' } });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data.map((m: any) => ({
          event_key: m.id,
          event_date: m.commence_time.slice(0, 10),
          event_time: m.commence_time.slice(11, 16),
          event_home_team: m.home_team,
          event_away_team: m.away_team,
          event_final_result: '',
          event_status: '',
          league_key: leagueId,
        }));
      }
      return [];
    } catch (err: any) {
      this.logger.error(`Error consultando The-Odds-API para ${sportKey}: ${err.message}`);
      return [];
    }
  }

  async obtenerPartidosDelDia(desde: string, hasta: string, leagueId?: number) {
    try {
      let matches: any[] = [];
      let url = `${this.baseUrl}?met=Fixtures&from=${desde}&to=${hasta}&APIkey=${this.apiKey}`;
      if (leagueId) {
        url += `&leagueId=${leagueId}`;
      }

      try {
        const respuesta = await axios.get(url);
        if (respuesta.data && Array.isArray(respuesta.data.result) && respuesta.data.result.length > 0) {
          matches = respuesta.data.result;
        }
      } catch (apiErr: any) {
        this.logger.warn(`AllSportsAPI no disponible: ${apiErr.message}`);
      }

      // Si AllSportsAPI no devolvió partidos (por trial restringido o fecha lejana), recurrir a The-Odds-API
      if (matches.length === 0) {
        if (leagueId) {
          const oddsMatches = await this.obtenerPartidosTheOdds(leagueId);
          if (oddsMatches.length > 0) {
            this.logger.log(`Obtenidos ${oddsMatches.length} partidos vía The-Odds-API para liga ${leagueId}`);
            return oddsMatches;
          }
        } else {
          // Consultar Premier, LaLiga y Champions si no se especificó liga
          const [epl, laliga, champs] = await Promise.all([
            this.obtenerPartidosTheOdds(152),
            this.obtenerPartidosTheOdds(302),
            this.obtenerPartidosTheOdds(3),
          ]);
          matches = [...epl, ...laliga, ...champs];
          if (matches.length > 0) {
            this.logger.log(`Obtenidos ${matches.length} partidos combinados vía The-Odds-API`);
            return matches;
          }
        }
      }

      return matches;
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
      { id: 168, nombre: 'Ligue1' },
      { id: 266, nombre: 'Portugal' },
      { id: 244, nombre: 'Eredivisie' },
      { id: 322, nombre: 'SuperLig' },
      { id: 99, nombre: 'Brasileirao' },
      { id: 278, nombre: 'Saudi' },
      { id: 3, nombre: 'Champions' },
      { id: 18, nombre: 'Libertadores' },
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
