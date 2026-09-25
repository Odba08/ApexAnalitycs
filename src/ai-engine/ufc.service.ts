import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface PropsUFC {
  metodos: {
    ko_tko: number;
    sumision: number;
    decision: number;
  };
  distancia: {
    va_distancia: number;
    no_distancia: number;
  };
  asaltos: {
    over_15: number;
    under_15: number;
    over_25: number;
    under_25: number;
  };
  props_peleador: {
    red_ko: number;
    red_sub: number;
    red_dec: number;
    blue_ko: number;
    blue_sub: number;
    blue_dec: number;
  };
  jugada_alternativa: string;
}

export interface CombateUFC {
  red_fighter: string;
  blue_fighter: string;
  weight_class: string;
  cuota_red: number;
  cuota_blue: number;
  prob_red: number;
  prob_blue: number;
  edge_red: number;
  edge_blue: number;
  reach_dif: number;
  age_dif: number;
  sig_str_dif: number;
  avg_td_dif: number;
  value_pick?: string | null;
  value_side?: 'RED' | 'BLUE' | null;
  value_odds?: number;
  value_prob?: number;
  value_edge?: number;
  has_value: boolean;
  props?: PropsUFC;
}

export interface PrediccionUFCResponse {
  total_combates: number;
  combates_con_valor: number;
  analisis_ufc: CombateUFC[];
  error?: string;
}

export interface CombateTheOddsLive {
  fighter_home: string;
  fighter_away: string;
  odds_home: number;
  odds_away: number;
  prob_home: number;
  prob_away: number;
  edge_home: number;
  edge_away: number;
  commence_time: string;
  reach_dif: number;
  age_dif: number;
  sig_str_dif: number;
  avg_td_dif: number;
  value_pick?: string | null;
  value_side?: 'HOME' | 'AWAY' | null;
  value_odds?: number;
  value_prob?: number;
  value_edge?: number;
  has_value: boolean;
  props?: PropsUFC;
}

export interface TheOddsLiveResponse {
  total_analizados: number;
  total_con_valor: number;
  combates: CombateTheOddsLive[];
  requests_remaining?: string;
  error?: string;
}

@Injectable()
export class UfcService {
  private readonly logger = new Logger(UfcService.name);
  private readonly pythonUrl = process.env.PYTHON_ML_URL || 'http://localhost:8000';
  private readonly theOddsApiKey = process.env.THE_ODDS_API_KEY || '9c4667b47ad5ae80f5de259e91f8ff0f';

  constructor(private readonly prisma: PrismaService) {}

  async obtenerCarteleraUFC(): Promise<PrediccionUFCResponse> {
    try {
      const res = await axios.get<PrediccionUFCResponse>(`${this.pythonUrl}/predecir-ufc`);
      const data = res.data;
      if (data && data.analisis_ufc) {
        for (const c of data.analisis_ufc) {
          if (c.has_value) {
            await this.registrarAlertaUFC(c);
          }
        }
      }
      return data;
    } catch (error) {
      this.logger.error('Error conectando con el motor Python UFC', error.message);
      return {
        total_combates: 0,
        combates_con_valor: 0,
        analisis_ufc: [],
        error: 'No se pudo conectar con el motor de predicción UFC en Python.',
      };
    }
  }

  async escanearTheOddsAPI(): Promise<TheOddsLiveResponse> {
    try {
      this.logger.log('Consultando The-Odds-API en vivo para MMA/UFC...');
      const url = `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?apiKey=${this.theOddsApiKey}&regions=us,eu&markets=h2h`;
      const oddsRes = await axios.get(url, { headers: { 'User-Agent': 'AntigravityBot/1.0' } });

      const events = oddsRes.data || [];
      const requestsRemaining = oddsRes.headers['x-requests-remaining'] || 'N/A';

      if (!Array.isArray(events) || events.length === 0) {
        return {
          total_analizados: 0,
          total_con_valor: 0,
          combates: [],
          requests_remaining: requestsRemaining,
          error: 'No hay eventos de MMA con cuotas activas en este momento.',
        };
      }

      // Filtrar únicamente los combates inminentes de este fin de semana / próximos 4 días
      const ahora = new Date().getTime();
      const eventosActivos = events.filter((e: any) => {
        if (!e.commence_time) return false;
        const t = new Date(e.commence_time).getTime();
        const diffHoras = (t - ahora) / (1000 * 3600);
        return (diffHoras >= -6 && diffHoras <= 96) || e.commence_time.includes('2026-09-26') || e.commence_time.includes('2026-09-27');
      });

      const listaAProcesar = eventosActivos.length > 0 ? eventosActivos : events;

      // Extraer mejores cuotas por combate
      const peleasPayload: any[] = [];
      for (const e of listaAProcesar) {
        let bestHome = 1.90;
        let bestAway = 1.90;

        if (e.bookmakers && e.bookmakers.length > 0) {
          for (const bm of e.bookmakers) {
            const h2h = bm.markets?.find((m: any) => m.key === 'h2h');
            if (h2h && h2h.outcomes) {
              const oHome = h2h.outcomes.find((o: any) => o.name.toLowerCase() === e.home_team.toLowerCase());
              const oAway = h2h.outcomes.find((o: any) => o.name.toLowerCase() === e.away_team.toLowerCase());
              if (oHome && oHome.price > bestHome) bestHome = oHome.price;
              if (oAway && oAway.price > bestAway) bestAway = oAway.price;
            }
          }
        }

        peleasPayload.push({
          home_team: e.home_team,
          away_team: e.away_team,
          odds_home: bestHome,
          odds_away: bestAway,
          commence_time: e.commence_time || '',
        });
      }

      // Enviar a Python para inferencia cuantitativa con los CSVs de Greco y el modelo .pkl
      const aiRes = await axios.post(`${this.pythonUrl}/analizar-peleas-odds`, peleasPayload);
      const resultado = {
        ...aiRes.data,
        requests_remaining: requestsRemaining,
      };

      if (resultado.combates) {
        for (const c of resultado.combates) {
          if (c.has_value) {
            await this.registrarAlertaUFC(c);
          }
        }
      }

      return resultado;
    } catch (error) {
      this.logger.error('Error escaneando The-Odds-API', error.message);
      return {
        total_analizados: 0,
        total_con_valor: 0,
        combates: [],
        error: `Error consultando The-Odds-API: ${error.message}`,
      };
    }
  }

  async registrarAlertaUFC(c: CombateUFC | CombateTheOddsLive) {
    try {
      const pHome = (c as CombateUFC).red_fighter || (c as CombateTheOddsLive).fighter_home;
      const pAway = (c as CombateUFC).blue_fighter || (c as CombateTheOddsLive).fighter_away;
      const cat = (c as CombateUFC).weight_class || 'UFC MMA';
      const pick = c.value_pick;
      if (!c.has_value || !pick) return;

      const partido = `${pHome} vs ${pAway}`;
      const existing = await this.prisma.alertaValor.findFirst({
        where: {
          deporte: 'UFC',
          partido,
          mercadoRecomendado: pick,
          estado: 'PENDIENTE',
        },
      });

      if (!existing) {
        await this.prisma.alertaValor.create({
          data: {
            deporte: 'UFC',
            partido,
            liga: cat,
            mercadoRecomendado: pick,
            cuotaCasa: c.value_odds || 1.8,
            probabilidadIA: c.value_prob || 55.0,
            ventajaPorcentaje: c.value_edge || 4.0,
            stakeRecomendado: 1.0,
            estado: 'PENDIENTE',
          },
        });
        this.logger.log(`Registrada alerta de valor UFC: ${partido} -> ${pick}`);
      }
    } catch (err) {
      this.logger.error('Error al registrar alerta de valor UFC', err.message);
    }
  }

  async liquidarCombatesUFC(): Promise<number> {
    try {
      const pendientes = await this.prisma.alertaValor.findMany({
        where: { deporte: 'UFC', estado: 'PENDIENTE' },
      });
      if (pendientes.length === 0) return 0;

      const url = `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/scores/?apiKey=${this.theOddsApiKey}&daysFrom=3`;
      const res = await axios.get(url, { headers: { 'User-Agent': 'AntigravityBot/1.0' } });
      const completedEvents = (res.data || []).filter((e: any) => e.completed);

      let liquidadas = 0;
      for (const alerta of pendientes) {
        const teams = alerta.partido.split(' vs ');
        if (teams.length < 2) continue;
        const f1 = teams[0].trim().toLowerCase();
        const f2 = teams[1].trim().toLowerCase();

        const match = completedEvents.find((e: any) => {
          const h = (e.home_team || '').toLowerCase();
          const a = (e.away_team || '').toLowerCase();
          return (h.includes(f1) && a.includes(f2)) || (h.includes(f2) && a.includes(f1));
        });

        if (match && match.scores && match.scores.length >= 2) {
          const sHome = parseInt(match.scores.find((s: any) => s.name === match.home_team)?.score || '0');
          const sAway = parseInt(match.scores.find((s: any) => s.name === match.away_team)?.score || '0');
          const winner = sHome > sAway ? match.home_team : (sAway > sHome ? match.away_team : null);

          if (winner) {
            const isGanada = alerta.mercadoRecomendado.toLowerCase().includes(winner.toLowerCase());
            await this.prisma.alertaValor.update({
              where: { id: alerta.id },
              data: {
                estado: isGanada ? 'GANADA' : 'PERDIDA',
                resultadoFinal: `Ganador: ${winner}`,
                ejecutada: true,
              },
            });
            liquidadas++;
          }
        }
      }
      return liquidadas;
    } catch (err) {
      this.logger.error('Error liquidando combates UFC', err.message);
      return 0;
    }
  }

  async sincronizarDatosGreco(): Promise<{ status: string; mensaje: string; archivos?: string[] }> {
    try {
      const res = await axios.post(`${this.pythonUrl}/sincronizar-ufc-greco`);
      return res.data;
    } catch (error) {
      this.logger.error('Error sincronizando con GitHub de Greco', error.message);
      return {
        status: 'error',
        mensaje: `Error al sincronizar: ${error.message}`,
      };
    }
  }
}
