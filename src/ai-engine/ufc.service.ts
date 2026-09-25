import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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

  async obtenerCarteleraUFC(): Promise<PrediccionUFCResponse> {
    try {
      const res = await axios.get<PrediccionUFCResponse>(`${this.pythonUrl}/predecir-ufc`);
      return res.data;
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
      // Esto elimina permanentemente cuotas especulativas o de fantasía a años futuros (2027, 2028 como Gaethje vs Tsarukyan)
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
      return {
        ...aiRes.data,
        requests_remaining: requestsRemaining,
      };
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
