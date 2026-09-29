import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY || '';
  private readonly endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  private readonly models = [
    'models/gemini-3.5-flash-lite',
    'models/gemini-flash-lite-latest',
    'models/gemini-3-flash-preview',
    'models/gemini-flash-latest',
  ];

  private readonly systemPrompt = `INSTRUCCIÓN DE SISTEMA:
Eres el Asesor Personal de Apuestas Deportivas de Apex Analytics.
REGLAS OBLIGATORIAS:
1. PROHIBIDO TOTALMENTE usar lenguaje técnico de finanzas, matemáticas o estadísticas como: "+EV", "EV", "ventaja matemática", "algorítmico", "varianza", "exposición a underdogs", "disparidad", "cuota implícita", "probabilidad implícita". Habla como un apostador experimentado y callejero: claro, honesto y directo ("la jugada es...", "ve a lo seguro con...", "es una trampa").
2. FORMATO LIMPIO PARA TELEGRAM (SIN BASURA NI SÍMBOLOS RAROS):
   - PROHIBIDO TERMINANTEMENTE usar encabezados de Markdown como '###' o '##'.
   - PROHIBIDO usar asteriscos '*' para viñetas o listas. Usa viñetas limpias '•' o números '1.', '2.'.
   - Usa emojis directos (🟢, 🟡, 💣, 🚫, 🎯) y títulos limpios en MAYÚSCULAS sin símbolos raros.
3. REGLA CRÍTICA PARA PREGUNTAS PUNTUALES:
   - Si el usuario pregunta por un peleador, equipo, jugador o partido en particular (por ejemplo: "¿por qué McGhee?", "¿vale la pena apostar al Real Madrid?", "¿qué opinas de Talbott?"), RESPONDE ÚNICAMENTE sobre ese peleador/equipo en 2 a 4 líneas directas y contundentes.
   - ESTÁ ESTRICTAMENTE PROHIBIDO enviar la cartelera completa, otros deportes o los 3 boletos si el usuario NO los pidió explícitamente.
4. Cero rodeos, cero saludos largos y cero preguntas de cierre como "¿Deseas algo más?".
5. SI EL USUARIO PIDE LA CARTELERA COMPLETA:
   - Debes listar CADA UNO de los partidos o peleas del contexto en orden numerado (1, 2, 3...).
   - Para cada uno, indica la jugada exacta (quién gana directo o el runline/hándicap/altas) y el porcentaje (%) de probabilidad.
   - Si un partido/pelea está muy parejo (50/50 o volado), di claramente: "🚫 NO METER, es una trampa 50/50".
6. AL FINAL DE LA CARTELERA COMPLETA O SI PIDE BOLETOS, PRESENTA SIEMPRE LOS 3 BOLETOS CLAVE:
   🟢 BOLETO SEGURO (x2): Las 2 mejores jugadas de alta certeza para duplicar el dinero.
   🟡 BOLETO MULTIPLICADOR (x3 a x5): 3 selecciones de gran valor para triplicar la apuesta.
   💣 BOLETO BOMBA (TODA LA CARTELERA): Todas las selecciones sólidas combinadas, con su cuota total, probabilidad real estimada (~1% a 3%) y la advertencia: "Solo monedas sueltas por diversión, riesgo extremo".`;

  /**
   * Sanitiza cualquier respuesta eliminando símbolos de markdown molestos (# y *)
   * y adaptándola para su lectura perfecta en modo HTML de Telegram.
   */
  sanitizarParaTelegram(raw: string): string {
    if (!raw) return '';
    let t = raw;

    // 1. Quitar encabezados markdown (### Titulo -> <b>Titulo</b>)
    t = t.replace(/^#{1,6}\s*(.*)$/gm, (_, title) => `<b>${title.trim()}</b>`);

    // 2. Viñetas con asterisco a viñeta limpia de texto
    t = t.replace(/^\s*\*\s+/gm, '• ');

    // 3. Negrita markdown **texto** -> <b>texto</b>
    t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

    // 4. Quitar cualquier asterisco suelto restante
    t = t.replace(/\*/g, '');

    // 5. Quitar hashtags residuales al inicio de línea
    t = t.replace(/^#+\s*/gm, '');

    return t.trim();
  }

  /**
   * Envía una solicitud a Gemini con rotación automática de modelos (fallback)
   */
  async consultarGemini(inputPrompt: string, contextoDeportivo?: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY no está configurada en las variables de entorno.');
      return '⚠️ La clave de API de Gemini no está configurada en el servidor.';
    }

    const fullInput = `${this.systemPrompt}\n\n` +
      (contextoDeportivo ? `DATOS CUANTITATIVOS EN TIEMPO REAL (APEX ENGINE):\n${contextoDeportivo}\n\n` : '') +
      `CONSULTA / SOLICITUD:\n${inputPrompt}`;

    for (const model of this.models) {
      const payload = {
        model,
        input: fullInput,
        generation_config: {
          temperature: 0.15,
          max_output_tokens: 4096,
          thinking_level: 'low',
        },
      };

      try {
        const res = await axios.post(`${this.endpoint}?key=${this.apiKey}`, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000,
        });

        const data = res.data;
        const outputStep = data.steps?.find((s: any) => s.type === 'model_output');
        if (outputStep && outputStep.content && outputStep.content.length > 0) {
          const rawText = outputStep.content[0].text;
          return this.sanitizarParaTelegram(rawText);
        }
      } catch (err: any) {
        this.logger.warn(`Modelo ${model} no respondió (${err.response?.data?.error?.message || err.message}). Probando fallback...`);
      }
    }

    this.logger.error('Todos los modelos de Gemini fallaron en esta solicitud.');
    return '⚠️ El servicio de análisis Gemini está experimentando alta demanda momentánea. Por favor intenta de nuevo en unos segundos.';
  }

  /**
   * Genera el dictamen de recomendación para un deporte analizado
   */
  async analizarCartelera(deporte: string, datosCartelera: string): Promise<string> {
    const prompt = `Analiza la cartelera de ${deporte.toUpperCase()} de Apex Analytics y entrega las selecciones directas sin ningún tecnicismo ni palabras como EV, sin usar símbolos ### ni asteriscos:
1. 🟢 BOLETO SEGURO (x2): Las 2 selecciones de mayor certeza (probabilidad > 70%) para duplicar dinero.
2. 🟡 BOLETO MULTIPLICADOR (x3 a x5): Las 3 mejores jugadas con cuotas más atractivas para multiplicar x3 o x4.
3. 💣 COMBINADA BOMBA: Todas las selecciones con favorito claro combinadas, con cuota total, probabilidad real y advertencia de riesgo.
4. 🚫 NO APOSTAR / TRAMPAS: Partidos o peleas 50/50 que hay que dejar fuera para salvar dinero.
Habla en lenguaje de apostador directo, sin tecnicismos ni fórmulas.`;
    return this.consultarGemini(prompt, datosCartelera);
  }

  /**
   * Responde a una consulta en lenguaje natural del usuario (ej: "¿Por qué McGhee?", "¿Qué opinas del Arsenal?")
   */
  async responderPreguntaUsuario(pregunta: string, contextoGlobal?: string): Promise<string> {
    const prompt = `El usuario realiza la siguiente consulta: "${pregunta}".
Si es una pregunta puntual sobre un equipo, jugador o peleador, responde ÚNICAMENTE sobre él en 2 a 4 líneas, indicando si conviene meterle o dejarlo fuera. No agregues boletos ni cartelera si no los pidió.`;
    return this.consultarGemini(prompt, contextoGlobal);
  }
}
