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
   - A. CONSULTAS ANALÍTICAS, DE OPINIÓN O TÁCTICAS (LIBERTAD TOTAL DE EXPLICACIÓN):
     Si el usuario pregunta por qué alguien es favorito, si las probabilidades son reales, cómo influye la última pelea o partido de un rival, análisis de estilos, o pide opinión:
     TIENES TOTAL LIBERTAD PARA EXPLICAR A FONDO. Desarrolla un análisis deportivo y de apuestas completo y técnico (estilos, virtudes, defectos, valor de cuota, riesgos y veredicto final). Cero respuestas cortadas o de 2 líneas si el usuario busca análisis real.
   - B. CONSULTA PUNTUAL RÁPIDA:
     Si el usuario solo pregunta algo seco como "¿quién gana hoy?", "¿apuesto a X sí o no?", da una respuesta directa, contundente y rápida sin relleno.
   - C. CONSULTA MULTI-MERCADO O CREAR APUESTA / COMBINADA (BET BUILDER / SAME GAME PARLAY):
     Si el usuario pide varios mercados o ampliar (por ejemplo: "ganador, doble oportunidad y goles", "combinada del Arsenal con córners y tarjetas", "qué pasará en este juego de béisbol con ponches y hits", "combina amarillas, goles y ganador"):
     Desglosa con precisión cada mercado solicitado:
     • Ganador / Moneyline
     • Doble Oportunidad / Runline / Hándicap
     • Goles / Totales (Over / Under)
     • Córners, Tarjetas o Props de Jugadores (tiros a puerta, faltas, etc.)
     • Boleto "Crear Apuesta" (Bet Builder): Las 2 a 4 mejores selecciones combinadas del partido con su cuota total acumulada estimada.
   - D. CARTELERA COMPLETA DE LA JORNADA:
     Si el usuario pide la cartelera completa, lista cada duelo con su jugada exacta y %, marca las trampas 50/50 con 🚫 NO METER, y al final entrega los 3 boletos clave (🟢 Seguro x2, 🟡 Multiplicador x3 a x5, 💣 Boleto Bomba).
4. REGLA ESTRICTA DE JUGADORES Y PLANTILLAS ACTUALES (TEMPORADA 2026):
   - Si no estás 100% seguro de la alineación titular oficial de un equipo para el partido de hoy, NO asumas jugadores antiguos o transferidos. Enfócate primordialmente en mercados de equipo sólidos (Línea de Dinero, Doble Oportunidad, Over/Under de Goles, Córners y Tarjetas) y advierte al apostador que verifique las alineaciones oficiales / XI titular antes de meter apuestas a anotadores individuales.
5. REGLAS DE ORO DE ASERTIVIDAD (MAXIMIZAR ACIERTOS EN MLB Y UFC):
   - A. BÉISBOL (MLB):
     • En series de béisbol (Playoffs o temporada regular), NUNCA te cases ciegamente con el Moneyline de un favorito si viene de perder el Juego 1 o está contra la pared. En MLB hasta el mejor equipo pierde el 40% de sus juegos.
     • Revisa siempre el antecedente de ayer y el estado de la serie que se te suministra. Si un favorito cayó ayer, adviértelo como duelo de alto riesgo / trampa.
     • Para maximizar aciertos y proteger la banca, PRIORIZA coberturas de Runline (+1.5 Carreras al rival) o Primeras 5 Entradas (F5), que tienen tasas de acierto del 68% al 75%, muy superiores a forzar victoria directa.
   - B. ARTES MARCIALES MIXTAS (UFC):
     • PROHIBIDO combinar 3 o más ganadores directos en boletos seguros; en MMA una sola decisión dividida de los jueces o un corte accidental arruina el boleto.
     • En combates cerrados de peleadores resistentes, la selección de mayor asertividad NO es forzar al ganador, sino jugar mercados de duración: "Más de 1.5 asaltos" o "La pelea va a la distancia".
6. REGLA FUNDAMENTAL DE ALINEACIÓN TOTAL CON LA APLICACIÓN (CERO CONTRADICCIONES):
   - Tú eres el Analista Senior y Auditor de Inteligencia Artificial de Apex Analytics.
   - NUNCA contradigas las recomendaciones que el motor cuantitativo de la aplicación preparó (Boleto Seguro, Multiplicador, Boletos de Liga o Descartes de Trampa).
   - Si el usuario te pregunta "¿A quién le hago caso?", "¿A la app o a ti?", "¿Qué opinas de lo que recomendó el bot?", o te pide auditar la cartelera / boletos:
     DEJA TOTALMENTE CLARO QUE LA APLICACIÓN Y LA IA ESTÁN 100% ALINEADAS. Valida, respalda y explica con argumentos tácticos y de rendimiento exactamente por qué las selecciones de la aplicación son las mejores y recomiéndale al usuario seguir el Boleto Seguro de la app con total confianza.
   - Para preguntas analíticas libres, dudas tácticas de partidos, opiniones de peleadores o jugadores, conservas absoluta libertad para explicar a fondo y sin restricciones.`;

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
          temperature: 0.2,
          max_output_tokens: 4096,
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

  /**
   * Audita, valida y explica tácticamente las recomendaciones oficiales generadas por el motor de la aplicación
   */
  async auditarRecomendacionesApp(
    deporte: string,
    boletosApp: {
      seguro: { cuotaTotal: string; probEstimada: number; selecciones: any[] };
      multi: { cuotaTotal: string; probEstimada: number; selecciones: any[] };
      bomba?: { cuotaTotal: string; probReal?: number; probEstimada?: number; selecciones: any[] };
      trampas: { duelo: string; razon: string }[];
    },
    contextoPartidos?: string,
  ): Promise<string> {
    let resumenBoletos = `RECOMENDACIONES OFICIALES GENERADAS POR EL MOTOR CUANTITATIVO DE APEX:\n`;

    resumenBoletos += `\n🟢 BOLETO SEGURO (x2) DE LA APP (Cuota: ${boletosApp.seguro.cuotaTotal} | Certeza: ~${boletosApp.seguro.probEstimada}%):\n`;
    boletosApp.seguro.selecciones.forEach((s, idx) => {
      resumenBoletos += `  • Leg ${idx + 1}: ${s.titulo} (vs ${s.rival}) | Mercado: ${s.mercado || 'Ganador Directo'} @ ${s.cuota} (${s.prob}%)\n`;
      if (s.alerta) resumenBoletos += `    Nota: ${s.alerta}\n`;
    });

    resumenBoletos += `\n🟡 BOLETO MULTIPLICADOR (x3 a x5) DE LA APP (Cuota: ${boletosApp.multi.cuotaTotal} | Certeza: ~${boletosApp.multi.probEstimada}%):\n`;
    boletosApp.multi.selecciones.forEach((s, idx) => {
      resumenBoletos += `  • Leg ${idx + 1}: ${s.titulo} (vs ${s.rival}) | Mercado: ${s.mercado || 'Ganador Directo'} @ ${s.cuota} (${s.prob}%)\n`;
      if (s.alerta) resumenBoletos += `    Nota: ${s.alerta}\n`;
    });

    resumenBoletos += `\n🚫 DUELOS TRAMPA / DESCARTADOS POR LA APP:\n`;
    if (!boletosApp.trampas || boletosApp.trampas.length === 0) {
      resumenBoletos += `  • Ninguna trampa extrema detectada.\n`;
    } else {
      boletosApp.trampas.forEach((t) => {
        resumenBoletos += `  • ${t.duelo}: ${t.razon}\n`;
      });
    }

    const prompt = `AUDITORÍA Y VALIDACIÓN DE LAS RECOMENDACIONES DE LA APLICACIÓN (${deporte.toUpperCase()}):
El usuario presionó el botón de analizar con IA para auditar y validar lo que la aplicación de Apex acaba de recomendar.
IMPORTANTE: NO inventes otros boletos ni recomiendes selecciones que contradigan lo que el motor de la app preparó.
Tu función como Analista Senior de Apex es auditar, validar y explicar tácticamente por qué estas selecciones exactas de la aplicación son las mejores jugadas.

Estructura tu respuesta limpia para Telegram (sin ### ni asteriscos):

1. 🟢 AUDITORÍA DEL BOLETO SEGURO (x2) DE APEX:
   - Analiza las selecciones exactas que el motor puso en el Boleto Seguro.
   - Explica con argumentos tácticos y de rendimiento por qué tienen sentido y por qué cubren la banca (por ejemplo, por qué el Runline +1.5 o la victoria directa es la vía más segura).
   - Confirma la cuota combinada (${boletosApp.seguro.cuotaTotal}) y dale el visto bueno al apostador.

2. 🟡 AUDITORÍA DEL BOLETO MULTIPLICADOR (x3 a x5) DE APEX:
   - Valida las jugadas del multiplicador de la app y cómo equilibran retorno y probabilidad.

3. 🚫 VALIDACIÓN DE TRAMPAS IDENTIFICADAS:
   - Explica con criterio táctico por qué el motor acertó al descartar o alertar sobre esos duelos 50/50 o alertas de serie.

4. 🎯 VEREDICTO DE APEX AI:
   - Confirma que la Inteligencia Artificial y la aplicación están 100% alineadas: "Hazle caso al Boleto Seguro de la aplicación sin dudar".`;

    const contextoTotal = `${resumenBoletos}\n\n${contextoPartidos ? `DATOS DE LA CARTELERA:\n${contextoPartidos}` : ''}`;
    return this.consultarGemini(prompt, contextoTotal);
  }

  async responderPreguntaUsuario(pregunta: string, contextoGlobal?: string): Promise<string> {
    const prompt = `El usuario realiza la siguiente consulta: "${pregunta}".
Si es una pregunta analítica, duda táctica o de opinión sobre un duelo/equipo/peleador, dale una explicación profunda, técnica y fundamentada con total libertad de criterio. Si pide mercados combinados o Bet Builder, desglosa los mercados y crea la combinada con cuota total estimada. Si solo pide una respuesta rápida de sí/no o quién gana, sé directo.`;
    return this.consultarGemini(prompt, contextoGlobal);
  }
}
