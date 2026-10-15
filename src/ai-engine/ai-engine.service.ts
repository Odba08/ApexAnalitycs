import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

// Tipamos el DTO que espera Python
export interface PartidoInput {
  Liga: string;
  HomeTeam: string;
  AwayTeam: string;
  HomeElo: number;
  AwayElo: number;
  Form5Home: number;
  Form5Away: number;
  Form3Home: number;
  Form3Away: number;
}

// Tipamos la respuesta que devuelve Python
export interface AnalisisIA {
  partido: string;
  liga: string;
  xg_esperados?: { xg_local: number; xg_visitante: number };
  probabilidades_1X2: {
    Victoria_Local: string;
    Empate: string;
    Victoria_Visitante: string;
  };
  doble_oportunidad: { '1X': string; X2: string; '12': string };
  mercado_goles: { Over_2_5: string; Under_2_5: string };
  ambos_anotan?: { Si: string; No: string };
  marcadores_exactos?: Array<{ marcador: string; probabilidad: string }>;
  error?: string;
}

// Interfaz para la respuesta completa de la API
interface ApiResponse {
  analisis_multiliga: AnalisisIA[];
}

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);
  private readonly pythonBaseUrl = process.env.PYTHON_ML_URL || 'https://pythonmachinelearning.onrender.com';

  constructor(private readonly httpService: HttpService) {}

  async analizarJornada(partidos: PartidoInput[]): Promise<AnalisisIA[]> {
    const targetUrl = `${this.pythonBaseUrl}/analizar-completo`;
    this.logger.log(
      `Enviando ${partidos.length} partidos al motor cuantitativo (Python)...`,
    );

    // Intentar hasta 2 veces con timeout de 70s para tolerar cold-starts en Render
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const response: AxiosResponse<ApiResponse> = await firstValueFrom(
          this.httpService.post<ApiResponse>(targetUrl, partidos, { timeout: 70000 }),
        );

        if (response.data && Array.isArray(response.data.analisis_multiliga)) {
          return response.data.analisis_multiliga;
        }
      } catch (error: any) {
        this.logger.warn(
          `Intento ${intento}/2 falló al comunicar con Python ML (${error.message})`,
        );
        if (intento === 2) {
          this.logger.error('Error definitivo al comunicar con el microservicio de Python', error);
          throw new Error('Fallo en el motor de inferencia');
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }

    throw new Error('Fallo en el motor de inferencia');
  }
}
