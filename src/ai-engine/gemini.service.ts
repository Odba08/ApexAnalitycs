import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  private readonly model = 'models/gemini-3-flash-preview';

  private readonly systemPrompt = `INSTRUCCIÓN DE SISTEMA:
Eres el Analista Cuantitativo y Asesor de Apuestas Senior de Apex Analytics.
REGLAS OBLIGATORIAS:
1. Tienes estrictamente PROHIBIDO dar saludos largos ("¡Hola!", "Buenos días"), contar historias personales, usar fórmulas de cortesía innecesarias o terminar con preguntas como "¿Deseas algo más?", "¿Quieres otros datos?" o "¿En qué más te ayudo?".
2. Ve DIRECTO AL GRANO. Responde siempre con estructura de TICKET O BOLETO DE APUESTA claro, conciso y listo para copiar en la casa de apuestas.
3. Basa tu análisis exclusivamente en los datos cuantitativos del contexto (cuotas reales, probabilidades del modelo, props, márgenes calculados y ventajas +EV).
4. Estructura estándar para apuestas:
   • Selección: [Equipo / Peleador / Prop]
   • Mercado: [Moneyline / Runline / Spread / Total / NRFI]
   • Cuota: [Número exacto]
   • Probabilidad estimada: [%]
   • Argumento técnico: [1 sola frase técnica con la ventaja estadística o física]
5. Si es una combinada (Parlay), incluye: Cuota Total combinada, Probabilidad combinada y Nivel de Riesgo (Bajo / Medio / Alto).
6. Si un partido es riesgoso o parejo (50/50), clasifícalo como "DESCARTE / NO APOSTAR" y da el motivo en 1 frase.`;

  /**
   * Envía una solicitud a Gemini con contexto deportivo específico
   */
  async consultarGemini(inputPrompt: string, contextoDeportivo?: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY no está configurada en las variables de entorno.');
      return '⚠️ La clave de API de Gemini no está configurada en el servidor.';
    }

    try {
      const fullInput = `${this.systemPrompt}\n\n` +
        (contextoDeportivo ? `DATOS CUANTITATIVOS EN TIEMPO REAL (APEX ENGINE):\n${contextoDeportivo}\n\n` : '') +
        `CONSULTA / SOLICITUD:\n${inputPrompt}`;

      const payload = {
        model: this.model,
        input: fullInput,
        generation_config: {
          temperature: 0.2,
          max_output_tokens: 4096,
          thinking_level: 'low',
        },
      };

      const res = await axios.post(`${this.endpoint}?key=${this.apiKey}`, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000,
      });

      const data = res.data;
      const outputStep = data.steps?.find((s: any) => s.type === 'model_output');
      if (outputStep && outputStep.content && outputStep.content.length > 0) {
        return outputStep.content[0].text;
      }

      return '⚠️ No se pudo extraer la respuesta del modelo Gemini.';
    } catch (err: any) {
      this.logger.error(`Error consultando Gemini API: ${err.message}`, err.response?.data);
      return '⚠️ Servicio de análisis Gemini temporalmente no disponible. Intenta de nuevo en unos momentos.';
    }
  }

  /**
   * Genera el dictamen de recomendación quirúrgica para un deporte analizado
   */
  async analizarCartelera(deporte: string, datosCartelera: string): Promise<string> {
    const prompt = `Analiza la cartelera actual de ${deporte.toUpperCase()} de Apex Analytics y genera el DICTAMEN DE APUESTA DEFINITIVO:
1. El Boleto Seguro de Máxima Certeza (1 o 2 selecciones de mayor probabilidad con cuota combinada ~1.75 - 2.10).
2. La Jugada de Valor (+EV con cuota alta respaldada por ventaja).
3. Los Partidos Trampa a Evitar (1 o 2 descartes con su motivo).
Sé conciso y ve directo al dinero.`;
    return this.consultarGemini(prompt, datosCartelera);
  }

  /**
   * Responde a una consulta en lenguaje natural del usuario (ej: "¿Qué opinas del Arsenal?", "Tengo $20 qué meto")
   */
  async responderPreguntaUsuario(pregunta: string, contextoGlobal?: string): Promise<string> {
    const prompt = `El usuario realiza la siguiente consulta: "${pregunta}".
Responde con precisión cuantitativa, indicándole exactamente qué jugar y qué descartar.`;
    return this.consultarGemini(prompt, contextoGlobal);
  }
}
