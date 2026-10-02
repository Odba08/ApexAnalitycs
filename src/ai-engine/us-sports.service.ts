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
  puckline_home?: string;
  puckline_away?: string;
  puckline_home_prob?: number;
  puckline_away_prob?: number;
  ot_prob?: number;
  p1_pick?: string;
  p1_prob?: number;
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
  serie_info?: string;
  ronda_playoff?: string;
  marcador_ayer?: string;
  prob_mercado_home?: number;
  prob_mercado_away?: number;
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

  private resolverSportKey(deporte: 'nfl' | 'mlb' | 'nba' | 'nhl'): string {
    switch (deporte) {
      case 'nfl':
        return 'americanfootball_nfl';
      case 'mlb':
        return 'baseball_mlb';
      case 'nba':
        return 'basketball_nba';
      case 'nhl':
        return 'icehockey_nhl';
      default:
        return 'americanfootball_nfl';
    }
  }

  private resolverEspnUrl(deporte: 'nfl' | 'mlb' | 'nba' | 'nhl'): string {
    switch (deporte) {
      case 'nfl':
        return 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
      case 'mlb':
        return 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
      case 'nba':
        return 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
      case 'nhl':
        return 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard';
    }
  }

  async obtenerContextoSerieMLB(): Promise<Map<string, { series: string; note: string; scoreAyer: string }>> {
    try {
      const hoyRes = await axios.get('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const ayerStr = `${yyyy}${mm}${dd}`;

      let ayerEvents: any[] = [];
      try {
        const ayerRes = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${ayerStr}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 },
        );
        ayerEvents = ayerRes.data?.events || [];
      } catch (_) {}

      const mapa = new Map<string, { series: string; note: string; scoreAyer: string }>();
      for (const e of hoyRes.data?.events || []) {
        const comp = e.competitions?.[0];
        if (!comp) continue;
        const cA = comp.competitors?.find((c: any) => c.homeAway === 'away');
        const cH = comp.competitors?.find((c: any) => c.homeAway === 'home');
        if (!cA || !cH) continue;

        const series = comp.series?.summary || '';
        const note = comp.notes?.[0]?.headline || '';

        const yMatch = ayerEvents.find((ye: any) => {
          const yc = ye.competitions?.[0];
          const ycA = yc?.competitors?.find((c: any) => c.homeAway === 'away');
          const ycH = yc?.competitors?.find((c: any) => c.homeAway === 'home');
          return (
            (ycA?.team?.id === cA.team.id && ycH?.team?.id === cH.team.id) ||
            (ycA?.team?.id === cH.team.id && ycH?.team?.id === cA.team.id)
          );
        });

        let scoreAyer = '';
        if (yMatch) {
          const yc = yMatch.competitions?.[0];
          const ycA = yc?.competitors?.find((c: any) => c.homeAway === 'away');
          const ycH = yc?.competitors?.find((c: any) => c.homeAway === 'home');
          if (ycA && ycH) {
            scoreAyer = `${ycA.team.displayName} ${ycA.score} - ${ycH.team.displayName} ${ycH.score} (${yc.status?.type?.detail || 'Final'})`;
          }
        }

        const key = `${cA.team.displayName} @ ${cH.team.displayName}`.toLowerCase();
        mapa.set(key, { series, note, scoreAyer });
      }
      return mapa;
    } catch (e: any) {
      this.logger.warn(`No se pudo obtener contexto de serie MLB de ESPN: ${e.message}`);
      return new Map();
    }
  }

  async analizarDeporte(deporte: 'nfl' | 'mlb' | 'nba' | 'nhl'): Promise<AnalisisUSResponse> {
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
        let seriesMap: Map<string, { series: string; note: string; scoreAyer: string }> | null = null;
        if (deporte === 'mlb') {
          seriesMap = await this.obtenerContextoSerieMLB();
        }

        for (const j of resultado.juegos) {
          // Calibración dinámica de probabilidad con cuotas reales de Las Vegas
          if (j.odds_home > 1.0 && j.odds_away > 1.0) {
            const impH = 1 / j.odds_home;
            const impA = 1 / j.odds_away;
            const sumImp = impH + impA;
            j.prob_mercado_home = Math.round((impH / sumImp) * 1000) / 10;
            j.prob_mercado_away = Math.round((impA / sumImp) * 1000) / 10;

            if (deporte === 'mlb' || deporte === 'nhl') {
              // Ponderar 70% mercado real (abridores hoy, dinero real) + 30% modelo estático
              const pCalibH = Math.round((j.prob_mercado_home * 0.7 + j.prob_home * 0.3) * 10) / 10;
              const pCalibA = Math.round((100 - pCalibH) * 10) / 10;
              j.prob_home = pCalibH;
              j.prob_away = pCalibA;
            }
          }

          // Asignar contexto de serie y resultado de ayer de ESPN
          if (seriesMap) {
            const getDist = (name: string) => {
              const l = name.toLowerCase();
              if (l.includes('white sox')) return 'white sox';
              if (l.includes('red sox')) return 'red sox';
              return l.split(' ').pop() || l;
            };
            const hDist = getDist(j.home_team);
            const aDist = getDist(j.away_team);

            // 1. Coincidencia exacta de ambos equipos
            for (const [k, v] of seriesMap.entries()) {
              const kLower = k.toLowerCase();
              if (kLower.includes(hDist) && kLower.includes(aDist)) {
                j.serie_info = v.series;
                j.ronda_playoff = v.note;
                j.marcador_ayer = v.scoreAyer;
                break;
              }
            }

            // 2. Coincidencia secundaria si no se emparejaron ambos
            if (!j.serie_info) {
              for (const [k, v] of seriesMap.entries()) {
                const kLower = k.toLowerCase();
                if (kLower.includes(hDist) || kLower.includes(aDist)) {
                  j.serie_info = v.series;
                  j.ronda_playoff = v.note;
                  j.marcador_ayer = v.scoreAyer;
                  break;
                }
              }
            }
          }

          if (j.has_value) {
            await this.registrarAlertaUsSport(deporte, j);
          }
        }
      }

      if (!resultado.error && resultado.juegos && resultado.juegos.length > 0) {
        this.cache[deporte] = {
          timestamp: ahora,
          data: resultado,
        };
      }

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

  async obtenerMarcadoresESPN(deporte: 'nfl' | 'mlb' | 'nba' | 'nhl'): Promise<MarcadorESPN[]> {
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
