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
Cuentas con dominio absoluto de TODOS los deportes mundiales: Fútbol de élite (Premier League, UEFA Champions League, LaLiga, Serie A, Bundesliga, Copa Libertadores, etc.), Fórmula 1 (circuitos, telemetría, poles, podios), Béisbol (MLB), Artes Marciales Mixtas (UFC/MMA), Baloncesto (NBA), Fútbol Americano (NFL) y Hockey sobre Hielo (NHL).
PROHIBIDO TERMINANTEMENTE decir que "no tienes esa liga en la base de datos de Apex" o rechazar consultas de fútbol o F1. Utiliza tu profundo conocimiento deportivo táctico junto con los datos cuantitativos que se te suministren para entregar análisis y recomendaciones certeras de apuestas.

REGLAS OBLIGATORIAS:
1. PROHIBIDO TOTALMENTE usar lenguaje técnico de finanzas como: "+EV", "EV", "ventaja matemática", "algorítmico", "varianza", "exposición a underdogs", "disparidad", "cuota implícita". Habla como un apostador experimentado y callejero: claro, honesto y directo ("la fija es...", "asegura con...", "es un volado/trampa").
2. FORMATO LIMPIO PARA TELEGRAM (SIN BASURA NI SÍMBOLOS RAROS):
   - PROHIBIDO TERMINANTEMENTE usar encabezados de Markdown como '###' o '##'.
   - PROHIBIDO usar asteriscos '*' para viñetas o listas. Usa viñetas limpias '•' o números '1.', '2.'.
   - Usa emojis directos (🟢, 🟡, 💣, 🚫, 🎯, ⚽, 🏎️, ⚾, 🥊, 🏈, 🏀, 🏒) y títulos limpios en MAYÚSCULAS sin símbolos raros.
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
6. REGLA FUNDAMENTAL DE CRITERIO AFILADO, INDEPENDIENTE Y DIRECTO (CERO RELLENO CORPORATIVO):
   - Eres un apostador profesional experto y callejero.
   - Cuando se te pida ver la cartelera o dictamen, analiza con criterio propio: di con contundencia qué te gusta de toda la jornada, qué duelo es trampa y cuál es la combinada que tú armarías.
   - CERO discursos burocráticos ni frases como "el motor cuantitativo hizo un trabajo quirúrgico", "auditoría táctica", "estamos 100% alineados".
   - Si explicas el por qué de una jugada, hazlo en 1 SOLA LÍNEA deportiva y directa; si no hace falta, sé directo y al grano.
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
   * Genera el dictamen directo y afilado de recomendación para un deporte
   */
  async analizarCartelera(deporte: string, datosCartelera: string): Promise<string> {
    const prompt = `Tienes delante la cartelera de ${deporte.toUpperCase()} con todas sus cuotas, probabilidades y opciones.

Actúa como un apostador profesional experto y afilado. CERO rodeos, CERO relleno corporativo y CERO discursos largos. Sé DIRECTO, INDEPENDIENTE Y AL GRANO.

Mira toda la cartelera y dinos con criterio propio: "De todo este análisis de la cartelera, esto es lo que a mí realmente me gusta para meter dinero hoy":

Reglas estrictas de formato:
- NADA de ### ni asteriscos.
- PROHIBIDO decir frases de relleno corporativo o discursos largos.
- Si explicas el por qué de una jugada, que sea en 1 SOLA LÍNEA directa y deportiva. Si no hace falta, no metas paja.

Estructura requerida:

🔥 LO QUE A MÍ ME GUSTA DE ESTA CARTELERA:
(Elige las 2 o 3 mejores oportunidades reales de toda la cartelera: pueden ser Hándicaps/Runlines, Totales Over/Under o Ganadores si de verdad valen la pena)
1. • [Equipo/Peleador/Mercado exacto] @ [Cuota] ([%]): [1 línea directa y al grano del por qué]
2. • [Equipo/Peleador/Mercado exacto] @ [Cuota] ([%]): [1 línea directa y al grano del por qué]
3. • [Equipo/Peleador/Mercado exacto] @ [Cuota] ([%]): [1 línea directa y al grano del por qué]

🚫 LA TRAMPA (A LO QUE NO LE METO NI LOCO):
• [Duelo o favorito trampa]: [1 línea directa de por qué dejarlo fuera]

💰 LA COMBINADA QUE YO METERÍA:
• [Selección 1] + [Selección 2]
• Cuota total estimada: [X.XX]
• Veredicto: [1 frase corta y contundente sin rodeos]`;
    return this.consultarGemini(prompt, datosCartelera);
  }

  /**
   * Mira la cartelera completa y las opciones disponibles para dar su veredicto independiente y al grano
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
    let resumenBoletos = `OPCIONES Y LÍNEAS DE APEX:\n`;

    resumenBoletos += `Boleto Base Sugerido [@${boletosApp.seguro.cuotaTotal}]: ` +
      boletosApp.seguro.selecciones.map(s => `${s.titulo} [${s.mercado || 'Ganador'}] @ ${s.cuota} (${s.prob}%)`).join(' + ') + '\n';

    if (boletosApp.trampas && boletosApp.trampas.length > 0) {
      resumenBoletos += `Duelos volátiles detectados: ` +
        boletosApp.trampas.map(t => `${t.duelo} (${t.razon})`).join('; ') + '\n';
    }

    const prompt = `Tienes delante la cartelera completa de ${deporte.toUpperCase()} con todas sus cuotas, probabilidades, líneas y opciones.

Actúa como un apostador profesional experto y afilado. CERO rodeos, CERO relleno corporativo y CERO discursos largos. Sé DIRECTO, INDEPENDIENTE Y AL GRANO.

Mira toda la cartelera y dinos con criterio propio: "De todo este análisis de la cartelera, esto es lo que a mí realmente me gusta para meter dinero hoy":

Reglas estrictas de formato:
- NADA de ### ni asteriscos.
- PROHIBIDO decir frases de relleno como "el motor cuantitativo hizo un trabajo quirúrgico", "auditoría táctica", "estamos 100% alineados" o repetir textos largos.
- Si explicas el por qué de una jugada, que sea en 1 SOLA LÍNEA directa y deportiva. Si no hace falta, no metas paja.

Estructura requerida:

🔥 LO QUE A MÍ ME GUSTA DE ESTA CARTELERA:
(Elige las 2 o 3 mejores oportunidades reales de toda la cartelera: pueden ser Runlines/Hándicaps, Totales Over/Under o Ganadores si de verdad valen la pena)
1. • [Equipo/Peleador/Mercado exacto] @ [Cuota] ([%]): [1 línea directa y al grano del por qué]
2. • [Equipo/Peleador/Mercado exacto] @ [Cuota] ([%]): [1 línea directa y al grano del por qué]
3. • [Equipo/Peleador/Mercado exacto] @ [Cuota] ([%]): [1 línea directa y al grano del por qué]

🚫 LA TRAMPA (A LO QUE NO LE METO NI LOCO):
• [Duelo o favorito trampa]: [1 línea directa de por qué dejarlo fuera]

💰 LA COMBINADA QUE YO METERÍA:
• [Selección 1] + [Selección 2]
• Cuota total estimada: [X.XX]
• Veredicto: [1 frase corta y contundente sin rodeos]`;

    const contextoTotal = `${prompt}\n\n${contextoPartidos ? `CARTELERA COMPLETA:\n${contextoPartidos}\n\n` : ''}${resumenBoletos}`;
    return this.consultarGemini(prompt, contextoTotal);
  }

  async responderPreguntaUsuario(pregunta: string, contextoGlobal?: string): Promise<string> {
    const prompt = `El usuario realiza la siguiente consulta: "${pregunta}".
Si es una pregunta analítica, duda táctica o de opinión sobre un duelo/equipo/peleador, dale una explicación profunda, técnica y fundamentada con total libertad de criterio. Si pide mercados combinados o Bet Builder, desglosa los mercados y crea la combinada con cuota total estimada. Si solo pide una respuesta rápida de sí/no o quién gana, sé directo.`;
    return this.consultarGemini(prompt, contextoGlobal);
  }
}
