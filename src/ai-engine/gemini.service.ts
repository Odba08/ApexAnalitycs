import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  private readonly model = 'models/gemini-3-flash-preview';

  private readonly systemPrompt = `INSTRUCCIÓN DE SISTEMA:
Eres el Asesor Personal de Apuestas Deportivas de Apex Analytics.
REGLAS OBLIGATORIAS:
1. PROHIBIDO TOTALMENTE usar lenguaje técnico de finanzas, matemáticas o estadísticas como: "+EV", "EV", "ventaja matemática", "algorítmico", "varianza", "exposición a underdogs", "disparidad", "cuota implícita", "probabilidad implícita". Habla como un apostador experimentado y callejero: claro, honesto y directo ("la jugada es...", "ve a lo seguro con...", "es una trampa").
2. Cero rodeos, cero saludos largos y cero preguntas de cierre como "¿Deseas algo más?".
3. SI EL USUARIO PIDE LA CARTELERA COMPLETA:
   - Debes listar CADA UNO de los partidos o peleas del contexto en orden numerado (1, 2, 3...).
   - Para cada uno, indica la jugada exacta (quién gana directo o el runline/hándicap/altas) y el porcentaje (%) de probabilidad.
   - Si un partido/pelea está muy parejo (50/50 o volado), di claramente: "🚫 NO METER, es una trampa 50/50".
4. AL FINAL DE LA CARTELERA COMPLETA O SI PIDE BOLETOS, PRESENTA SIEMPRE LOS 3 BOLETOS CLAVE:
   - 🟢 BOLETO SEGURO (x2): Las 2 mejores jugadas de alta certeza para duplicar el dinero.
   - 🟡 BOLETO MULTIPLICADOR (x3 a x5): 3 selecciones de gran valor para triplicar la apuesta.
   - 💣 BOLETO BOMBA (TODA LA CARTELERA): Todas las selecciones sólidas combinadas, con su cuota total, probabilidad real estimada (~1% a 3%) y la advertencia: "Solo monedas sueltas por diversión, riesgo extremo".
5. SI PREGUNTA POR UN EQUIPO O PELEADOR ESPECÍFICO:
   - Analiza ese duelo directo, di quién tiene las de ganar y la recomendación exacta en 2 líneas.`;

  /**
   * Envía una solicitud a Gemini con contexto deportivo específico
   */
  async consultarGemini(inputPrompt: string, contextoDeportivo?: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY no está configurada en las variables de entorno.');
      return '⚠️ La clave de API de Gemini no está configurada en el servidor.';
    }

    const fullInput = `${this.systemPrompt}\n\n` +
      (contextoDeportivo ? `DATOS CUANTITATIVOS EN TIEMPO REAL (APEX ENGINE):\n${contextoDeportivo}\n\n` : '') +
      `CONSULTA / SOLICITUD:\n${inputPrompt}`;

    const payload = {
      model: this.model,
      input: fullInput,
      generation_config: {
        temperature: 0.15,
        max_output_tokens: 4096,
        thinking_level: 'low',
      },
    };

    for (let intento = 1; intento <= 2; intento++) {
      try {
        const res = await axios.post(`${this.endpoint}?key=${this.apiKey}`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000,
        });

        const data = res.data;
        const outputStep = data.steps?.find((s: any) => s.type === 'model_output');
        if (outputStep && outputStep.content && outputStep.content.length > 0) {
          return outputStep.content[0].text;
        }

        return '⚠️ No se pudo extraer la respuesta del modelo Gemini.';
      } catch (err: any) {
        this.logger.warn(`Intento ${intento} Gemini API falló: ${err.message}`);
        if (intento === 1) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        this.logger.error(`Error consultando Gemini API: ${err.message}`, err.response?.data);
        return '⚠️ Servicio de análisis Gemini temporalmente no disponible. Intenta de nuevo en unos momentos.';
      }
    }
    return '⚠️ Servicio de análisis Gemini temporalmente no disponible.';
  }

  /**
   * Genera el dictamen de recomendación quirúrgica para un deporte analizado
   */
  async analizarCartelera(deporte: string, datosCartelera: string): Promise<string> {
    const prompt = `Analiza la cartelera de ${deporte.toUpperCase()} de Apex Analytics y entrega las selecciones directas sin ningún tecnicismo ni palabras como EV:
1. 🟢 BOLETO SEGURO: Las 2 selecciones de mayor certeza (probabilidad > 70%) para duplicar dinero.
2. 🟡 BOLETO MULTIPLICADOR: Las 3 mejores jugadas con cuotas más atractivas para multiplicar x3 o x4.
3. 💣 COMBINADA COMPLETA: Todas las selecciones con favorito claro combinadas, con cuota total, probabilidad real y advertencia.
4. 🚫 NO APOSTAR / TRAMPAS: Partidos o peleas 50/50 que hay que dejar fuera para salvar dinero.
Habla en lenguaje de apostador directo, sin tecnicismos ni fórmulas.`;
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
