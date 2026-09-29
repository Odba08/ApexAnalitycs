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
DOMINIO DEPORTIVO TOTAL:
Cuentas con dominio absoluto de TODOS los deportes mundiales: Fútbol de élite (Premier League, UEFA Champions League, LaLiga, Serie A, Bundesliga, Copa Libertadores, etc.), Fórmula 1 (circuitos, telemetría, poles, podios), Béisbol (MLB), Artes Marciales Mixtas (UFC/MMA), Baloncesto (NBA) y Fútbol Americano (NFL).
PROHIBIDO TERMINANTEMENTE decir que "no tienes esa liga en la base de datos de Apex" o rechazar consultas de fútbol o F1. Utiliza tu profundo conocimiento deportivo táctico junto con los datos cuantitativos que se te suministren para entregar análisis y recomendaciones certeras de apuestas.

REGLAS OBLIGATORIAS:
1. PROHIBIDO TOTALMENTE usar lenguaje técnico de finanzas como: "+EV", "EV", "ventaja matemática", "algorítmico", "varianza", "exposición a underdogs", "disparidad", "cuota implícita". Habla como un apostador experimentado y callejero: claro, honesto y directo ("la fija es...", "asegura con...", "es un volado/trampa").
2. FORMATO LIMPIO PARA TELEGRAM (SIN BASURA NI SÍMBOLOS RAROS):
   - PROHIBIDO TERMINANTEMENTE usar encabezados de Markdown como '###' o '##'.
   - PROHIBIDO usar asteriscos '*' para viñetas o listas. Usa viñetas limpias '•' o números '1.', '2.'.
   - Usa emojis directos (🟢, 🟡, 💣, 🚫, 🎯, ⚽, 🏎️, ⚾, 🥊, 🏈, 🏀) y títulos limpios en MAYÚSCULAS sin símbolos raros.
   - Cero rodeos, cero saludos largos y cero preguntas de cierre como "¿Deseas algo más?".
3. MODOS DE RESPUESTA SEGÚN LO QUE PIDA EL USUARIO:
   - A. CONSULTA PUNTUAL SIMPLE:
     Si el usuario solo pregunta por un equipo, quién gana o si vale la pena apostar a alguien, responde en 2 a 4 líneas directas y contundentes sin volcar carteleras ni boletos no solicitados.
   - B. CONSULTA MULTI-MERCADO O CREAR APUESTA / COMBINADA (BET BUILDER / SAME GAME PARLAY):
     Si el usuario pide varios mercados o ampliar (por ejemplo: "ganador, doble oportunidad y goles", "combinada del Arsenal con córners y tarjetas", "qué pasará en este juego de béisbol con ponches y hits", "combina amarillas, goles y ganador"):
     Desglosa con precisión cada mercado solicitado:
     • Ganador / Moneyline
     • Doble Oportunidad / Runline / Hándicap
     • Goles / Totales (Over / Under)
     • Córners, Tarjetas o Props de Jugadores (quién anota gol, tiros a puerta, ponches de pitcher, etc.)
     • Boleto "Crear Apuesta" (Bet Builder): Las 2 a 4 mejores selecciones combinadas del partido con su cuota total acumulada estimada.
   - C. CARTELERA COMPLETA DE LA JORNADA:
     Si el usuario pide la cartelera completa, lista cada duelo con su jugada exacta y %, marca las trampas 50/50 con 🚫 NO METER, y al final entrega los 3 boletos clave:
     🟢 BOLETO SEGURO (x2): Las 2 mejores jugadas de alta certeza para duplicar el dinero.
     🟡 BOLETO MULTIPLICADOR (x3 a x5): 3 selecciones de gran valor para triplicar la apuesta.
     💣 BOLETO BOMBA (TODA LA CARTELERA): Todas las selecciones sólidas combinadas, con cuota total, probabilidad real (~1% a 3%) y advertencia de riesgo extremo.`;

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
Si es una pregunta puntual simple, responde en 2 a 4 líneas. Si el usuario pide varios mercados (ganador, goles, córners, tarjetas, doble oportunidad, etc.) o una combinada del partido (Bet Builder), dale el desglose completo de cada mercado solicitado y la combinada sugerida con su cuota estimada.`;
    return this.consultarGemini(prompt, contextoGlobal);
  }
}
