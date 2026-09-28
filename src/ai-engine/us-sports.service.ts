import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface PropsDeporteUS {
  spread_line?: number;
  cover_home_prob?: number;
  cover_away_prob?: number;
  runline_home?: string;
  runline_away?: string;
  runline_home_prob?: number;
  runline_away_prob?: number;
  total_line?: number;
  over_prob?: number;
  under_prob?: number;
  nrfi_prob?: number;
  yrfi_prob?: number;
  f5_pick?: string;
  f5_prob?: number;
  margen_1_6_prob?: number;
  margen_7_mas_prob?: number;
  margen_1_5_prob?: number;
  margen_6_mas_prob?: number;
  jugada_clave?: string;
}

export interface JuegoAnalizado {
  home_team: string;
  away_team: string;
  home_code: string;
  away_code: string;
  home_elo: number;
  away_elo: number;
  odds_home: number;
  odds_away: number;
  prob_home: number;
  prob_away: number;
  edge_home: number;
  edge_away: number;
  expected_margin: number;
  expected_total: number;
  book_spread: number;
  book_total: number;
  commence_time: string;
  has_value: boolean;
  value_pick?: string | null;
  value_odds?: number;
  value_prob?: number;
  value_edge?: number;
  value_side?: 'HOME' | 'AWAY' | null;
  props?: PropsDeporteUS;
}

export interface AnalisisUSResponse {
  sport: string;
  total_analizados: number;
  total_con_valor: number;
  requests_remaining?: string;
  juegos: JuegoAnalizado[];
  error?: string;
}

export interface MarcadorESPN {
  nombre: string;
  estado: string;
  horaInicio: string;
  local: string;
  visitante: string;
  puntosLocal: number;
  puntosVisitante: number;
  recordLocal?: string;
  recordVisitante?: string;
  enVivo: boolean;
}

@Injectable()
export class UsSportsService {
  private readonly logger = new Logger(UsSportsService.name);
  private readonly pythonUrl = process.env.PYTHON_ML_URL || 'https://pythonmachinelearning.onrender.com';
  // Clave exclusiva para deportes americanos (500 solicitudes gratis)
  private readonly oddsApiKey = process.env.THE_ODDS_US_KEY || 'edd86739a644ecab4b9a19edb1302d82';

  // Caché de 2 horas en memoria por deporte para proteger cuota
  private cache: { [key: string]: { timestamp: number; data: AnalisisUSResponse } } = {};
  private readonly CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 horas

  constructor(private readonly prisma: PrismaService) {}

  private resolverSportKey(deporte: 'nfl' | 'mlb' | 'nba'): string {
    switch (deporte) {
      case 'nfl':
        return 'americanfootball_nfl';
      case 'mlb':
        return 'baseball_mlb';
      case 'nba':
        return 'basketball_nba';
      default:
        return 'americanfootball_nfl';
    }
  }

  private resolverEspnUrl(deporte: 'nfl' | 'mlb' | 'nba'): string {
    switch (deporte) {
      case 'nfl':
        return 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
      case 'mlb':
        return 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
      case 'nba':
        return 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
    }
  }

  async analizarDeporte(deporte: 'nfl' | 'mlb' | 'nba'): Promise<AnalisisUSResponse> {
    const ahora = Date.now();
    const cached = this.cache[deporte];
    if (cached && ahora - cached.timestamp < this.CACHE_DURATION_MS) {
      this.logger.log(`Retornando análisis de ${deporte.toUpperCase()} desde caché en memoria.`);
      return cached.data;
    }

    try {
      this.logger.log(`Escaneando The-Odds-API para ${deporte.toUpperCase()}...`);
      const sportKey = this.resolverSportKey(deporte);
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${this.oddsApiKey}&regions=us&markets=h2h,spreads,totals`;
      const oddsRes = await axios.get(url, {
        headers: { 'User-Agent': 'ApexAnalytics/1.0' },
        timeout: 15000,
      });

      const events = oddsRes.data || [];
      const requestsRemaining = oddsRes.headers['x-requests-remaining'] || 'N/A';

      if (!Array.isArray(events) || events.length === 0) {
        return {
          sport: deporte,
          total_analizados: 0,
          total_con_valor: 0,
          requests_remaining: requestsRemaining,
          juegos: [],
          error: `No hay partidos de ${deporte.toUpperCase()} programados con cuotas activas en este momento.`,
        };
      }

      const payloadJuegos: any[] = [];
      for (const e of events.slice(0, 25)) {
        let bestHome = 0;
        let bestAway = 0;
        let spread = 0;
        let total = 0;

        if (e.bookmakers && e.bookmakers.length > 0) {
          for (const bm of e.bookmakers) {
            const h2h = bm.markets?.find((m: any) => m.key === 'h2h');
            const spr = bm.markets?.find((m: any) => m.key === 'spreads');
            const tot = bm.markets?.find((m: any) => m.key === 'totals');

            if (h2h && h2h.outcomes) {
              const oHome = h2h.outcomes.find((o: any) => o.name === e.home_team);
              const oAway = h2h.outcomes.find((o: any) => o.name === e.away_team);
              if (oHome && (bestHome === 0 || oHome.price > bestHome)) bestHome = oHome.price;
              if (oAway && (bestAway === 0 || oAway.price > bestAway)) bestAway = oAway.price;
            }
            if (spr && spread === 0) {
              const oHome = spr.outcomes?.find((o: any) => o.name === e.home_team);
              if (oHome) spread = oHome.point || 0;
            }
            if (tot && total === 0) {
              const over = tot.outcomes?.find((o: any) => o.name === 'Over');
              if (over) total = over.point || 0;
            }
          }
        }

        if (bestHome === 0) bestHome = 1.90;
        if (bestAway === 0) bestAway = 1.90;

        payloadJuegos.push({
          home_team: e.home_team,
          away_team: e.away_team,
          odds_home: bestHome,
          odds_away: bestAway,
          spread,
          total,
          commence_time: e.commence_time || '',
        });
      }

      this.logger.log(`Enviando ${payloadJuegos.length} juegos de ${deporte.toUpperCase()} a Python ML...`);
      const aiRes = await axios.post(
        `${this.pythonUrl}/analizar-us-sports`,
        { sport: deporte, games: payloadJuegos },
        { timeout: 35000 },
      );

      const resultado: AnalisisUSResponse = {
        ...aiRes.data,
        requests_remaining: requestsRemaining,
      };

      if (resultado.juegos) {
        for (const j of resultado.juegos) {
          if (j.has_value) {
            await this.registrarAlertaUsSport(deporte, j);
          }
        }
      }

      this.cache[deporte] = {
        timestamp: ahora,
        data: resultado,
      };

      return resultado;
    } catch (error) {
      this.logger.error(`Error analizando ${deporte.toUpperCase()}: ${error.message}`);
      return {
        sport: deporte,
        total_analizados: 0,
        total_con_valor: 0,
        juegos: [],
        error: `No se pudo obtener el análisis cuantitativo de ${deporte.toUpperCase()}: ${error.message}`,
      };
    }
  }

  async obtenerMarcadoresESPN(deporte: 'nfl' | 'mlb' | 'nba'): Promise<MarcadorESPN[]> {
    try {
      const url = this.resolverEspnUrl(deporte);
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });

      const events = res.data?.events || [];
      const marcadores: MarcadorESPN[] = [];

      for (const e of events) {
        const comp = e.competitions?.[0];
        if (!comp) continue;

        const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away');

        const estadoDesc = e.status?.type?.detail || e.status?.type?.description || 'Programado';
        const isLive = e.status?.type?.state === 'in';

        marcadores.push({
          nombre: e.name || `${away?.team?.displayName} en ${home?.team?.displayName}`,
          estado: estadoDesc,
          horaInicio: e.date || '',
          local: home?.team?.displayName || 'Local',
          visitante: away?.team?.displayName || 'Visitante',
          puntosLocal: parseInt(home?.score || '0'),
          puntosVisitante: parseInt(away?.score || '0'),
          recordLocal: home?.records?.[0]?.summary,
          recordVisitante: away?.records?.[0]?.summary,
          enVivo: isLive,
        });
      }

      return marcadores;
    } catch (error) {
      this.logger.warn(`Error consultando marcadores ESPN (${deporte}): ${error.message}`);
      return [];
    }
  }

  private async registrarAlertaUsSport(deporte: string, j: JuegoAnalizado) {
    try {
      const deporteNombre = deporte.toUpperCase();
      const partidoStr = `${j.home_team} vs ${j.away_team}`;
      const mercado = `Victoria ${j.value_pick}`;

      const existing = await this.prisma.alertaValor.findFirst({
        where: {
          deporte: deporteNombre,
          partido: partidoStr,
          mercadoRecomendado: mercado,
          estado: 'PENDIENTE',
        },
      });

      if (!existing && j.value_odds && j.value_prob && j.value_edge) {
        await this.prisma.alertaValor.create({
          data: {
            deporte: deporteNombre,
            partido: partidoStr,
            liga: deporteNombre,
            mercadoRecomendado: mercado,
            cuotaCasa: j.value_odds,
            probabilidadIA: j.value_prob,
            ventajaPorcentaje: j.value_edge,
            estado: 'PENDIENTE',
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Error guardando alerta ${deporte}: ${err.message}`);
    }
  }
}
