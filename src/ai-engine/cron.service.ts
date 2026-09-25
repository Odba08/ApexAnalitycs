import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiEngineService, PartidoInput } from './ai-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { InjectBot, Update, Command, Ctx, Action, On } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { SportsApiService } from '../sports-api/sports-api.service';

import { F1Service } from './f1.service';

@Update()
@Injectable()
export class ApuestasCronService {
  private readonly logger = new Logger(ApuestasCronService.name);

  // Fallback de fechas para pruebas históricas
  private readonly fechaPruebaDesde = '2026-09-18';
  private readonly fechaPruebaHasta = '2026-09-21';

  // IDs Numéricos Oficiales de AllSportsAPI para las 13 competiciones top
  private readonly targetLeagueKeys = [152, 302, 175, 207, 153, 168, 266, 244, 322, 99, 278, 3, 18];

  constructor(
    private readonly aiEngine: AiEngineService,
    private readonly prisma: PrismaService,
    @InjectBot() private readonly bot: Telegraf,
    private readonly sportsApi: SportsApiService,
    private readonly f1Service: F1Service,
  ) {}

  // Helper para generar fechas vivas en tiempo real (por defecto 2 días atrás -> 7 días adelante, máximo 1 semana)
  private getRangoFechasDinamico(
    diasAtras: number = 2,
    diasAdelante: number = 7,
  ): { desde: string; hasta: string } {
    const hoy = new Date();
    const dDate = new Date(hoy);
    dDate.setDate(hoy.getDate() - diasAtras);
    const hDate = new Date(hoy);
    hDate.setDate(hoy.getDate() + diasAdelante);

    const format = (d: Date) => d.toISOString().split('T')[0];
    return { desde: format(dDate), hasta: format(hDate) };
  }

  private resolverLigaKey(input: string): { id: number; nombre: string } | null {
    const q = (input || '').toLowerCase().trim();
    if (!q) return null;

    if (q.includes('premier') || q.includes('inglaterra') || q === 'e0') {
      return { id: 152, nombre: 'Premier' };
    }
    if (
      q.includes('laliga') ||
      q.includes('la liga') ||
      q.includes('primera') ||
      q.includes('españa') ||
      q === 'sp1'
    ) {
      return { id: 302, nombre: 'LaLiga' };
    }
    if (q.includes('bundesliga') || q.includes('alemania') || q === 'd1') {
      return { id: 175, nombre: 'Bundesliga' };
    }
    if (
      q.includes('seriea') ||
      q.includes('serie a') ||
      q.includes('seriaa') ||
      q.includes('italia') ||
      q === 'i1'
    ) {
      return { id: 207, nombre: 'SerieA' };
    }
    if (q.includes('championship') || q === 'e1') {
      return { id: 153, nombre: 'Championship' };
    }
    if (q.includes('ligue') || q.includes('francia') || q === 'f1') {
      return { id: 168, nombre: 'Ligue1' };
    }
    if (q.includes('portugal') || q.includes('primeira') || q === 'p1') {
      return { id: 266, nombre: 'Portugal' };
    }
    if (q.includes('eredivisie') || q.includes('holanda') || q.includes('netherlands') || q === 'n1') {
      return { id: 244, nombre: 'Eredivisie' };
    }
    if (q.includes('super') || q.includes('süper') || q.includes('turquia') || q.includes('turkey') || q === 't1') {
      return { id: 322, nombre: 'SuperLig' };
    }
    if (q.includes('brasil') || q.includes('brasileirao') || q === 'b1') {
      return { id: 99, nombre: 'Brasileirao' };
    }
    if (q.includes('saudi') || q.includes('arabia') || q.includes('pro league')) {
      return { id: 278, nombre: 'Saudi' };
    }
    if (q.includes('champions') || q.includes('uefa') || q.includes('cl')) {
      return { id: 3, nombre: 'Champions' };
    }
    if (q.includes('libertadores') || q.includes('conmebol') || q.includes('copa libertadores')) {
      return { id: 18, nombre: 'Libertadores' };
    }
    return null;
  }

  // ------------------------------------------------------------------
  // COMANDOS DE MENÚ CON BOTONES INTERACTIVOS (MENÚ PÚBLICO LIMPIO)
  // ------------------------------------------------------------------

  @Command('start')
  @Command('menu')
  @Command('ayuda')
  async comandoMenuPrincipal(@Ctx() ctx: Context) {
    const usuario = ctx.from?.first_name || 'Inversionista';
    await ctx.reply(
      `🤖 <b>CENTRO CUANTITATIVO Y DEPORTIVO DE ÉLITE</b> 🤖\n\n` +
        `¡Hola <b>${usuario.toUpperCase()}</b>! Selecciona la disciplina deportiva que deseas consultar:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('⚽ FÚTBOL (13 Torneos Top)', 'menu_futbol'),
            Markup.button.callback('🏎️ FÓRMULA 1 (Temporada 2026)', 'menu_f1'),
          ],
          [
            Markup.button.callback('🎯 Top Apuestas Globales', 'menu_hoy'),
            Markup.button.callback('⭐️ Ranking BD Equipos', 'top_todas'),
          ],
          [
            Markup.button.callback('📈 Rendimiento ROI / P&L', 'menu_roi'),
            Markup.button.callback('📊 Estadísticas IA', 'menu_stats'),
          ],
        ]),
      },
    );
  }

  @On('text')
  async mensajeTextoGenerico(@Ctx() ctx: Context) {
    const text = (ctx.message as any)?.text || '';
    if (text.startsWith('/')) return; // Ignorar si es un comando

    const usuario = ctx.from?.first_name || 'Amigo';
    await ctx.reply(
      `👋 <b>¡Hola ${usuario}!</b>\n\n` +
        `Para explorar el centro de Fútbol o la Fórmula 1, presiona o escribe <b>/start</b> para desplegar el panel principal.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🚀 Desplegar Menú Principal', 'menu_start_redirect'),
          ],
        ]),
      },
    );
  }

  @Action('menu_start_redirect')
  async accionRedirectMenu(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    return this.comandoMenuPrincipal(ctx);
  }

  @Command('liga')
  @Action('menu_ligas')
  @Action('menu_futbol')
  async comandoSeleccionarLigaMenu(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    await ctx.reply(
      '⚽ <b>FÚTBOL: 13 COMPETICIONES TOP DE ÉLITE</b> ⚽\n\nElige la liga o torneo continental que deseas consultar:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🇪🇺 Champions League', 'liga_champions'),
            Markup.button.callback('🏆 Copa Libertadores', 'liga_libertadores'),
          ],
          [
            Markup.button.callback('🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier', 'liga_premier'),
            Markup.button.callback('🇪🇸 LaLiga', 'liga_laliga'),
            Markup.button.callback('🇩🇪 Bundesliga', 'liga_bundesliga'),
          ],
          [
            Markup.button.callback('🇮🇹 Serie A', 'liga_seriea'),
            Markup.button.callback('🇫🇷 Ligue 1', 'liga_ligue1'),
            Markup.button.callback('🇵🇹 Portugal', 'liga_portugal'),
          ],
          [
            Markup.button.callback('🇳🇱 Eredivisie', 'liga_eredivisie'),
            Markup.button.callback('🇹🇷 Süper Lig', 'liga_superlig'),
            Markup.button.callback('🇧🇷 Brasileirão', 'liga_brasileirao'),
          ],
          [
            Markup.button.callback('🇸🇦 Saudi Pro League', 'liga_saudi'),
            Markup.button.callback('🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship', 'liga_championship'),
          ],
          [Markup.button.callback('🔙 Volver al Menú Principal', 'menu_start_redirect')],
        ]),
      },
    );
  }

  // ------------------------------------------------------------------
  // MENÚ INTERACTIVO FÓRMULA 1 (IA, POLE, PODIO Y TELEMETRÍA 2026)
  // ------------------------------------------------------------------

  @Action('menu_f1')
  async accionMenuF1(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    const proximoGP = await this.f1Service.obtenerGranPremioActivo();
    const pilotos = await this.f1Service.obtenerMundialPilotos();
    const lider = pilotos && pilotos.length > 0 ? pilotos[0] : null;

    const nombreGP = proximoGP ? proximoGP.nombre : 'Próximo Gran Premio';
    const infoLider = lider ? `${lider.nombre} (${lider.puntosMundial} pts)` : 'Actualizando...';

    await ctx.reply(
      '🏎️ <b>FÓRMULA 1 (TEMPORADA 2026) - TELEMETRÍA & MOTOR IA</b> 🏎️\n\n' +
        `🏁 <b>Próxima Carrera:</b> ${nombreGP}\n` +
        `🏆 <b>Líder del Mundial:</b> ${infoLider}\n\n` +
        'Selecciona una opción a continuación:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(`⏱️ Pronósticos Pole & GP (${nombreGP})`, 'opt_f1_pronostico'),
          ],
          [
            Markup.button.callback('🏆 Mundial de Pilotos 2026', 'opt_f1_pilotos'),
            Markup.button.callback('🏎️ Mundial de Constructores', 'opt_f1_constructores'),
          ],
          [Markup.button.callback('🔙 Volver al Menú Principal', 'menu_start_redirect')],
        ]),
      },
    );
  }

  @Action('opt_f1_pronostico')
  async accionF1Pronostico(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    await ctx.reply('⏳ <b>Analizando telemetría oficial FastF1 (FP1/FP2) y ejecutando simulación Monte Carlo...</b>', { parse_mode: 'HTML' });

    const res = await this.f1Service.analizarProximoGP();

    if (res.error || !res.analisis_f1) {
      return ctx.reply('⚠️ No se pudo generar el informe de F1 en este momento.');
    }

    const gpNombre = res.gp ? res.gp.nombre : 'Gran Premio de Azerbaiyán (Bakú)';
    const circuito = res.gp ? res.gp.circuito : 'Baku City Circuit';
    const fecha = res.gp ? res.gp.fecha : '2026-09-26';
    const analisis = res.analisis_f1;

    const sortedPole = [...analisis].sort((a: any, b: any) => b.raw_pole - a.raw_pole);
    const sortedWin = [...analisis].sort((a: any, b: any) => b.raw_win - a.raw_win);
    const sortedPodium = [...analisis].sort((a: any, b: any) => b.raw_podium - a.raw_podium);

    const sesionReciente = res.sesion_mas_reciente || 'Practice 2';
    const esQualyHecha = !!res.qualy_completada;

    let msg = `🏎️ <b>FÓRMULA 1 - PRONÓSTICOS OFICIALES FIA</b> 🏎️\n` +
              `🏁 <b>${gpNombre}</b>\n` +
              `📍 <i>${circuito}</i> | 📅 <i>${fecha}</i>\n\n` +
              `📡 <b>Estado de la Telemetría FastF1:</b>\n` +
              `• <b>Última sesión procesada:</b> ${sesionReciente}\n` +
              `• <b>Líderes de ritmos:</b> Russell (Mercedes) 1º en FP1 y FP2.\n\n`;

    if (esQualyHecha) {
      const poleMan = sortedPole[0];
      msg += `🏁 <b>POLE POSITION CONFIRMADA (Q3):</b>\n` +
             `🥇 <b>${poleMan.piloto}</b> (${poleMan.escuderia}) saldrá 1º en parrilla.\n\n`;
    } else {
      msg += `⏱️ <b>FAVORITOS GANADOR POLE POSITION (Q3):</b>\n`;
      sortedPole.slice(0, 5).forEach((p: any, idx: number) => {
        const medalla = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
        const fpInfo = `(Última Posición: P${p.latest_pos})`;
        msg += `${medalla} <b>${p.piloto}</b> (${p.escuderia}) - Pole: <b>${p.prob_pole}</b> ${fpInfo}\n`;
      });
    }

    msg += `\n🏁 <b>FAVORITOS GANADOR DE CARRERA (P1):</b>\n`;
    sortedWin.slice(0, 5).forEach((p: any, idx: number) => {
      const medalla = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
      msg += `${medalla} <b>${p.piloto}</b> (${p.escuderia}) - Victoria: <b>${p.prob_victoria}</b> (${p.victorias} Wins en 2026)\n`;
    });

    msg += `\n🏆 <b>PROBABILIDAD DE PODIO (TOP 3):</b>\n`;
    sortedPodium.slice(0, 8).forEach((p: any) => {
      msg += `• <b>${p.piloto}</b> (${p.escuderia}): <b>${p.prob_podio}</b>\n`;
    });

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Ver Parrilla Completa (22 Pilotos)', 'opt_f1_parrilla_completa')],
        [Markup.button.callback('🔙 Volver al Menú F1', 'menu_f1')],
      ]),
    });
  }

  @Action('opt_f1_parrilla_completa')
  async accionF1ParrillaCompleta(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    const res = await this.f1Service.analizarProximoGP();
    if (res.error || !res.analisis_f1) {
      return ctx.reply('⚠️ No se pudieron cargar los datos.');
    }

    const analisis = res.analisis_f1;
    let msg = `📊 <b>PROBABILIDADES COMPLETAS DE LA PARRILLA (22 PILOTOS)</b>\n\n`;
    msg += `<i>Piloto | Pole % | Victoria % | Podio %</i>\n\n`;

    analisis.forEach((p: any, idx: number) => {
      msg += `<b>${idx + 1}. ${p.piloto}</b> (${p.escuderia})\n` +
             `   └ Pole: <b>${p.prob_pole}</b> | Win: <b>${p.prob_victoria}</b> | Podio: <b>${p.prob_podio}</b>\n`;
    });

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Volver a Pronósticos', 'opt_f1_pronostico')],
      ]),
    });
  }

  @Action('opt_f1_pilotos')
  async accionF1Pilotos(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const pilotos = await this.f1Service.obtenerMundialPilotos();

    let msg = `🏆 <b>MUNDIAL DE PILOTOS FÓRMULA 1 2026:</b>\n\n`;
    if (pilotos && pilotos.length > 0) {
      pilotos.forEach((p, idx) => {
        const racha = p.rachaReciente ? `\n   └ <i>${p.rachaReciente}</i>` : '';
        msg += `<b>${idx + 1}. ${p.nombre}</b> (${p.escuderia}) | Pts: <b>${p.puntosMundial}</b> | Wins: ${p.victorias}${racha}\n\n`;
      });
    } else {
      msg += `ℹ️ No hay datos cargados en el mundial de pilotos.`;
    }

    await ctx.reply(msg, { parse_mode: 'HTML' });
  }

  @Action('opt_f1_constructores')
  async accionF1Constructores(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    const escuderias = await this.f1Service.obtenerMundialConstructores();

    let msg = `🏎️ <b>MUNDIAL DE CONSTRUCTORES (ESCUDERÍAS 2026):</b>\n\n`;
    if (escuderias && escuderias.length > 0) {
      escuderias.forEach((e, idx) => {
        msg += `<b>${idx + 1}. ${e.nombre}</b> | Pts: <b>${e.puntosMundial}</b> | Wins: ${e.victorias}\n`;
      });
    } else {
      msg += `ℹ️ No hay datos cargados en el mundial de constructores.`;
    }

    await ctx.reply(msg, { parse_mode: 'HTML' });
  }

  @Action(/liga_(.*)/)
  async accionOpcionesLiga(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as Context & { match?: RegExpMatchArray }).match;
    if (!match || !match[1]) return;
    const ligaKey = match[1];
    const ligaInfo = this.resolverLigaKey(ligaKey);

    if (!ligaInfo) return;

    await ctx.reply(
      `⚽ <b>MENÚ COMPETICIÓN: ${ligaInfo.nombre.toUpperCase()}</b> ⚽\n\n¿Qué información deseas consultar?`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              '🎯 Apuestas Recomendadas',
              `opt_apuestas_${ligaKey}`,
            ),
            Markup.button.callback(
              '📊 Tabla de Posiciones',
              `opt_tabla_${ligaKey}`,
            ),
          ],
          [
            Markup.button.callback(
              '📅 Partidos del Fin de Semana',
              `opt_partidos_${ligaKey}`,
            ),
            Markup.button.callback(
              '📋 Marcadores Finales',
              `opt_resultados_${ligaKey}`,
            ),
          ],
          [Markup.button.callback('🔙 Volver a Torneos', 'menu_ligas')],
        ]),
      },
    );
  }

  @Action(/opt_apuestas_(.*)/)
  async accionApuestasLiga(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as Context & { match?: RegExpMatchArray }).match;
    if (!match || !match[1]) return;
    const ligaKey = match[1];
    const ligaInfo = this.resolverLigaKey(ligaKey);
    if (!ligaInfo) return;

    await this.procesarApuestasDeLiga(ligaInfo, ctx);
  }

  @Action(/opt_tabla_(.*)/)
  async accionTablaLiga(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as Context & { match?: RegExpMatchArray }).match;
    if (!match || !match[1]) return;
    const ligaKey = match[1];
    const ligaInfo = this.resolverLigaKey(ligaKey);
    if (!ligaInfo) return;

    const tablaAPI = await this.sportsApi.obtenerStandingsLiga(ligaInfo.id);
    let mensaje = `📊 <b>TABLA DE POSICIONES COMPLETA (${ligaInfo.nombre.toUpperCase()}):</b>\n\n`;

    if (tablaAPI && tablaAPI.length > 0) {
      tablaAPI.forEach((row: any) => {
        const name = row?.standing_team || row?.team_name || 'Equipo';
        mensaje += `<b>${row?.standing_place || '-'}. ${name}</b> | PJ: ${row?.standing_P || '0'} | PTS: <b>${row?.standing_PTS || '0'}</b> | DG: ${row?.standing_GD || '0'}\n`;
      });
    } else if (ligaKey === 'champions' || ligaKey === 'libertadores') {
      mensaje +=
        `⚔️ <b>FASE DE ELIMINACIÓN DIRECTA (IDA Y VUELTA):</b>\n\n` +
        `En etapas knockout (Octavos, Cuartos, Semifinales), no existe tabla de posiciones tradicional.\n\n` +
        `👉 Para ver los enfrentamientos directos de Ida y Vuelta:\n` +
        `• Selecciona <b>📅 Partidos de la Jornada</b> para ver los cruces programados.\n` +
        `• Selecciona <b>🎯 Apuestas Recomendadas</b> para ver las probabilidades IA de quién gana cada duelo.`;
    } else {
      mensaje += 'ℹ️ No se pudo cargar la tabla de posiciones en este momento.';
    }

    await ctx.reply(mensaje, { parse_mode: 'HTML' });
  }

  @Action(/opt_partidos_(.*)/)
  async accionPartidosLiga(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as Context & { match?: RegExpMatchArray }).match;
    if (!match || !match[1]) return;
    const ligaKey = match[1];
    const ligaInfo = this.resolverLigaKey(ligaKey);
    if (!ligaInfo) return;

    const fechas = this.getRangoFechasDinamico(2, 7);
    let partidos = await this.sportsApi.obtenerPartidosDelDia(fechas.desde, fechas.hasta, ligaInfo.id);
    if (!partidos || partidos.length === 0) {
      partidos = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta, ligaInfo.id);
    }

    // Filtrar estrictamente partidos pendientes / próximos (sin resultado final aún)
    const partidosPendientes = (partidos || []).filter(
      (p: any) =>
        parseInt(p?.league_key) === ligaInfo.id &&
        (!p?.event_final_result || p.event_final_result.trim().length === 0),
    );

    let mensaje = `📅 <b>PRÓXIMOS PARTIDOS DE LA JORNADA (${ligaInfo.nombre.toUpperCase()}):</b>\n\n`;
    if (partidosPendientes.length > 0) {
      partidosPendientes.forEach((p: any) => {
        const ronda = p?.league_round ? ` <i>[${p.league_round}]</i>` : '';
        const fecha = p?.event_date ? ` - ${p.event_date}` : '';
        mensaje += `• <b>${p?.event_home_team || 'Local'} vs ${p?.event_away_team || 'Visitante'}</b>${ronda}${fecha}\n`;
      });
    } else {
      mensaje += 'ℹ️ No hay partidos pendientes o por jugar en los próximos días para este torneo.';
    }

    await ctx.reply(mensaje, { parse_mode: 'HTML' });
  }

  @Action(/opt_resultados_(.*)/)
  async accionResultadosLiga(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as Context & { match?: RegExpMatchArray }).match;
    if (!match || !match[1]) return;
    const ligaKey = match[1];
    const ligaInfo = this.resolverLigaKey(ligaKey);
    if (!ligaInfo) return;

    const fechas = this.getRangoFechasDinamico(2, 7);
    let partidos = await this.sportsApi.obtenerPartidosDelDia(fechas.desde, fechas.hasta, ligaInfo.id);
    if (!partidos || partidos.length === 0) {
      partidos = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta, ligaInfo.id);
    }

    const partidosLiga = (partidos || []).filter(
      (p: any) => parseInt(p?.league_key) === ligaInfo.id && p?.event_final_result && p.event_final_result.trim().length > 0,
    );

    let mensaje = `📋 <b>MARCADORES FINALES (${ligaInfo.nombre.toUpperCase()}):</b>\n\n`;
    if (partidosLiga.length > 0) {
      partidosLiga.forEach((p: any) => {
        const res = p?.event_final_result || 'Finalizado';
        const ronda = p?.league_round ? ` [${p.league_round}]` : '';
        mensaje += `⚽ <b>${p?.event_home_team || 'Local'} ${res} ${p?.event_away_team || 'Visitante'}</b>${ronda} (Fecha: ${p?.event_date || ''})\n`;
      });
    } else {
      mensaje += 'ℹ️ No hay marcadores finalizados en este torneo para las fechas seleccionadas.';
    }

    await ctx.reply(mensaje, { parse_mode: 'HTML' });
  }

  @Command('equipo')
  @Action('menu_equipo')
  async comandoBuscarEquipoMenu(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    const text = (ctx.message as any)?.text || '';
    const query = text.replace('/equipo', '').trim();
    if (query.length > 0) {
      return this.ejecutarBusquedaEquipo(query, ctx);
    }

    await ctx.reply(
      '⚽ <b>BÚSQUEDA DE CLUB (13 COMPETICIONES TOP)</b> ⚽\n\n' +
        'Selecciona uno de los clubes populares o escribe <code>/equipo Nombre</code> (ej: <code>/equipo Real Madrid</code>, <code>/equipo River Plate</code>, <code>/equipo PSG</code>, <code>/equipo Flamengo</code>):',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🇪🇺 Real Madrid', 'eq_real madrid'),
            Markup.button.callback('🇪🇺 Man City', 'eq_manchester city'),
            Markup.button.callback('🇪🇺 Bayern', 'eq_bayern'),
          ],
          [
            Markup.button.callback('🏆 River Plate', 'eq_river plate'),
            Markup.button.callback('🏆 Flamengo', 'eq_flamengo'),
            Markup.button.callback('🏆 Palmeiras', 'eq_palmeiras'),
          ],
          [
            Markup.button.callback('🇫🇷 Paris SG', 'eq_psg'),
            Markup.button.callback('🇵🇹 Benfica', 'eq_benfica'),
            Markup.button.callback('🇸🇦 Al-Nassr', 'eq_al nassr'),
          ],
        ]),
      },
    );
  }

  @Action(/eq_(.*)/)
  async accionSeleccionarEquipo(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as any).match;
    const teamName = match[1];

    await this.ejecutarBusquedaEquipo(teamName, ctx);
  }

  @Command('top')
  async comandoTopMenu(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    await ctx.reply(
      '🏆 <b>TOP APUESTAS REGISTRADAS EN BASE DE DATOS</b> 🏆\n\n' +
        'Selecciona el torneo para filtrar las mejores apuestas de la base de datos:',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🌐 Todas las Competiciones', 'top_todas')],
          [
            Markup.button.callback('🇪🇺 Champions League', 'top_Champions'),
            Markup.button.callback('🏆 Copa Libertadores', 'top_Libertadores'),
          ],
          [
            Markup.button.callback('🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier', 'top_Premier'),
            Markup.button.callback('🇪🇸 LaLiga', 'top_LaLiga'),
            Markup.button.callback('🇫🇷 Ligue 1', 'top_Ligue1'),
          ],
          [
            Markup.button.callback('🇩🇪 Bundesliga', 'top_Bundesliga'),
            Markup.button.callback('🇮🇹 Serie A', 'top_SerieA'),
            Markup.button.callback('🇧🇷 Brasileirao', 'top_Brasileirao'),
          ],
        ]),
      },
    );
  }

  @Action(/top_(.*)/)
  async accionTopFiltro(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    const match = (ctx as any).match;
    const liga = match[1];

    try {
      let topAlertas: any[] = [];
      if (liga === 'todas') {
        topAlertas = await this.prisma.alertaValor.findMany({
          take: 5,
          orderBy: { ventajaPorcentaje: 'desc' },
        });
      } else {
        topAlertas = await this.prisma.alertaValor.findMany({
          where: { liga: { contains: liga, mode: 'insensitive' } },
          take: 5,
          orderBy: { ventajaPorcentaje: 'desc' },
        });
      }

      if (topAlertas.length === 0) {
        return ctx.reply(
          `ℹ️ No hay apuestas registradas para el filtro seleccionado (${liga}).`,
        );
      }

      let mensaje = `🏆 <b>TOP 5 APUESTAS REGISTRADAS (${liga.toUpperCase()})</b> 🏆\n\n`;
      topAlertas.forEach((a, i) => {
        mensaje +=
          `<b>${i + 1}. ${a.partido}</b> (${a.liga})\n` +
          `🎯 Apuesta Sugerida: <b>${a.mercadoRecomendado}</b>\n\n`;
      });

      await ctx.reply(mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error en top filtro', error);
      await ctx.reply('❌ Error al consultar las apuestas registradas.');
    }
  }

  // ------------------------------------------------------------------
  // COMANDOS OCULTOS DE ADMINISTRACIÓN (PRIVADOS - SOLO SLASH COMMANDS DIRECTOS)
  // ------------------------------------------------------------------

  @Command('actualizar')
  @Command('admin_actualizar')
  async comandoActualizarAdmin(@Ctx() ctx: Context) {
    await ctx.reply('⏳ Actualizando clasificaciones y recalculando Elo para los clubes de los 13 torneos...');
    try {
      await this.sportsApi.actualizarEstadisticasEquipos();
      await ctx.reply('✅ ¡Actualización completada con éxito en PostgreSQL!');
    } catch (error) {
      this.logger.error('Error en /actualizar', error);
      await ctx.reply('❌ Ocurrió un error al actualizar la base de datos.');
    }
  }

  @Command('limpiar')
  @Command('admin_limpiar')
  async comandoLimpiarAdmin(@Ctx() ctx: Context) {
    try {
      const borrados = await this.prisma.alertaValor.deleteMany({});
      await ctx.reply(
        `🧹 <b>Base de Datos Limpia</b>: Se eliminaron ${borrados.count} alertas en PostgreSQL.`,
        { parse_mode: 'HTML' },
      );
    } catch (error) {
      this.logger.error('Error en /limpiar', error);
      await ctx.reply('❌ Error al limpiar base de datos.');
    }
  }

  @Action('menu_stats')
  async accionEjecutarStats(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    await this.comandoEstadisticas(ctx);
  }

  @Action('menu_hoy')
  async accionEjecutarHoy(@Ctx() ctx: Context) {
    await ctx.answerCbQuery().catch(() => {});
    await this.comandoJornadaAcotada(ctx);
  }

  // ------------------------------------------------------------------
  // AUTOMATIZACIÓN DE CRONJOBS (ELO AUTOMÁTICO EN VIERNES Y LUNES)
  // ------------------------------------------------------------------

  // Cron 1: Viernes a las 8:00 AM (Actualización previa a la jornada)
  @Cron('0 8 * * 5')
  async cronActualizarEloViernes() {
    this.logger.log('⏰ Cronjob Viernes mañana: Actualizando clasificaciones y Elo de los 13 torneos...');
    await this.sportsApi.actualizarEstadisticasEquipos();
  }

  // Cron 2: Lunes a las 18:00 (6:00 PM) (Actualización posterior a la jornada)
  @Cron('0 18 * * 1')
  async cronActualizarEloLunes() {
    this.logger.log('⏰ Cronjob Lunes tarde: Actualizando clasificaciones y Elo tras jornada...');
    await this.sportsApi.actualizarEstadisticasEquipos();
  }

  // ------------------------------------------------------------------
  // LÓGICA DE NEGOCIO Y PROCESAMIENTO
  // ------------------------------------------------------------------

  private evaluarResultadoApuesta(
    mercado: string,
    finalResult: string,
    homeTeam: string,
    awayTeam: string,
  ): 'GANADA' | 'PERDIDA' | 'ANULADA' {
    if (!finalResult || !finalResult.includes('-')) return 'ANULADA';
    const parts = finalResult.split('-').map((s) => parseInt(s.trim()));
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1]))
      return 'ANULADA';

    const homeGoals = parts[0];
    const awayGoals = parts[1];
    const totalGoals = homeGoals + awayGoals;
    const mLower = mercado.toLowerCase();

    if (
      mLower.includes('victoria local') ||
      mLower.includes(homeTeam.toLowerCase())
    ) {
      return homeGoals > awayGoals ? 'GANADA' : 'PERDIDA';
    }
    if (
      mLower.includes('victoria visitante') ||
      mLower.includes(awayTeam.toLowerCase())
    ) {
      return awayGoals > homeGoals ? 'GANADA' : 'PERDIDA';
    }
    if (mLower.includes('empate')) {
      return homeGoals === awayGoals ? 'GANADA' : 'PERDIDA';
    }
    if (mLower.includes('over 2.5') || mLower.includes('over_2_5')) {
      return totalGoals > 2.5 ? 'GANADA' : 'PERDIDA';
    }
    if (mLower.includes('under 2.5') || mLower.includes('under_2_5')) {
      return totalGoals < 2.5 ? 'GANADA' : 'PERDIDA';
    }
    if (mLower.includes('btts') || mLower.includes('ambos anotan')) {
      return homeGoals > 0 && awayGoals > 0 ? 'GANADA' : 'PERDIDA';
    }
    return 'ANULADA';
  }

  async liquidarApuestasPendientes() {
    this.logger.log('Iniciando proceso de liquidación de apuestas pendientes...');
    try {
      const pendientes = await this.prisma.alertaValor.findMany({
        where: { estado: 'PENDIENTE' },
      });

      if (pendientes.length === 0) return 0;

      const fechas = this.getRangoFechasDinamico();
      let partidos = await this.sportsApi.obtenerPartidosDelDia(fechas.desde, fechas.hasta);
      if (!partidos || partidos.length === 0) {
        partidos = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta);
      }

      let liquidadas = 0;

      for (const alerta of pendientes) {
        const teams = alerta.partido.split(' vs ');
        if (teams.length < 2) continue;
        const hName = teams[0].trim().toLowerCase();
        const aName = teams[1].trim().toLowerCase();

        const fixture = (partidos || []).find((p: any) => {
          const pHome = (p?.event_home_team || '').toLowerCase();
          const pAway = (p?.event_away_team || '').toLowerCase();
          return pHome.includes(hName) || pAway.includes(aName);
        });

        if (fixture && fixture.event_final_result) {
          const resEst = this.evaluarResultadoApuesta(
            alerta.mercadoRecomendado,
            fixture.event_final_result,
            teams[0],
            teams[1],
          );
          if (resEst !== 'ANULADA') {
            await this.prisma.alertaValor.update({
              where: { id: alerta.id },
              data: {
                estado: resEst,
                resultadoFinal: fixture.event_final_result,
                ejecutada: true,
              },
            });
            liquidadas++;
          }
        }
      }
      this.logger.log(`¡Se liquidaron ${liquidadas} apuestas pendientes!`);
      return liquidadas;
    } catch (error) {
      this.logger.error('Error al liquidar apuestas pendientes', error);
      return 0;
    }
  }

  @Cron('0 */2 * * *')
  async cronLiquidarApuestas() {
    await this.liquidarApuestasPendientes();
  }

  @Command('roi')
  @Command('rendimiento')
  @Action('menu_roi')
  async comandoRoi(@Ctx() ctx: Context) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    await ctx.reply(
      '⏳ Calculando métricas de rendimiento cuantitativo y ROI...',
    );
    await this.liquidarApuestasPendientes();

    try {
      const todas = await this.prisma.alertaValor.findMany();
      const ganadas = todas.filter((a) => a.estado === 'GANADA');
      const perdidas = todas.filter((a) => a.estado === 'PERDIDA');
      const pendientes = todas.filter((a) => a.estado === 'PENDIENTE');

      const totalLiquidadas = ganadas.length + perdidas.length;
      let stakeTotal = 0;
      let gananciaNeta = 0;

      ganadas.forEach((a) => {
        stakeTotal += a.stakeRecomendado;
        gananciaNeta += a.stakeRecomendado * (a.cuotaCasa - 1);
      });

      perdidas.forEach((a) => {
        stakeTotal += a.stakeRecomendado;
        gananciaNeta -= a.stakeRecomendado;
      });

      const winRate =
        totalLiquidadas > 0 ? (ganadas.length / totalLiquidadas) * 100 : 0;
      const roiPct = stakeTotal > 0 ? (gananciaNeta / stakeTotal) * 100 : 0;
      const emoji = gananciaNeta >= 0 ? '📈' : '📉';

      let mensaje =
        `${emoji} <b>INFORME DE RENDIMIENTO FINANCIERO & ROI (P&L)</b> ${emoji}\n\n` +
        `📊 <b>Balance de Selección:</b>\n` +
        `• Alertas Totales: <b>${todas.length}</b>\n` +
        `• Liquidadas: <b>${totalLiquidadas}</b> (✅ Ganadas: ${ganadas.length} | ❌ Perdidas: ${perdidas.length})\n` +
        `• En Juego (Pendientes): <b>${pendientes.length}</b>\n` +
        `• Tasa de Acierto (Win Rate): <b>${winRate.toFixed(2)}%</b>\n\n` +
        `💰 <b>Métricas Financieras (Kelly Bankroll Management):</b>\n` +
        `• Stake Invertido: <b>${stakeTotal.toFixed(2)} u</b>\n` +
        `• P&L Neto: <b>${gananciaNeta >= 0 ? '+' : ''}${gananciaNeta.toFixed(2)} u</b>\n` +
        `• Yield / ROI Cuantitativo: <b>${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(2)}%</b>\n`;

      await ctx.reply(mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error en comando /roi', error);
      await ctx.reply('❌ Error al generar informe de ROI.');
    }
  }

  // ------------------------------------------------------------------
  // BÚSQUEDA ROBUSTA DE EQUIPOS (CHAMPIONS, LIBERTADORES, LIGAS TOP)
  // ------------------------------------------------------------------

  private async ejecutarBusquedaEquipo(query: string, ctx: Context) {
    try {
      await ctx.reply(`🔍 Buscando información de <b>${query}</b>...`, {
        parse_mode: 'HTML',
      });

      let queryNorm = query.toLowerCase().trim();

      // Normalizador de alias populares (ej: barca -> barcelona, real -> real madrid)
      if (queryNorm === 'barca' || queryNorm === 'barça' || queryNorm === 'fcb') queryNorm = 'barcelona';
      if (queryNorm === 'real' || queryNorm === 'rmcf' || queryNorm === 'merengues') queryNorm = 'real madrid';
      if (queryNorm === 'atleti' || queryNorm === 'atletico') queryNorm = 'atletico madrid';
      if (queryNorm === 'psg' || queryNorm === 'paris') queryNorm = 'paris sg';
      if (queryNorm === 'mancity' || queryNorm === 'city') queryNorm = 'manchester city';
      if (queryNorm === 'manutd' || queryNorm === 'united') queryNorm = 'manchester utd';
      if (queryNorm === 'juve') queryNorm = 'juventus';
      if (queryNorm === 'inter') queryNorm = 'inter';
      if (queryNorm === 'boca') queryNorm = 'boca juniors';
      if (queryNorm === 'river') queryNorm = 'river plate';

      // 1. Buscar en BD local
      let equiposBD = await this.prisma.equipo.findMany({
        where: { nombre: { contains: queryNorm, mode: 'insensitive' } },
      });

      // Si la BD no ha sido poblada o no encuentra el equipo, ejecutar sincronización automática de standings
      if (!equiposBD || equiposBD.length === 0) {
        await this.sportsApi.actualizarEstadisticasEquipos();
        equiposBD = await this.prisma.equipo.findMany({
          where: { nombre: { contains: queryNorm, mode: 'insensitive' } },
        });
      }

      const equipoPrincipal =
        equiposBD.find((e) => e.nombre.toLowerCase() === queryNorm) ||
        equiposBD.find((e) => e.nombre.toLowerCase().includes(queryNorm)) ||
        equiposBD.find(
          (e) =>
            !e.nombre.endsWith(' B') &&
            !e.nombre.includes('II') &&
            !e.nombre.includes('U23'),
        ) ||
        equiposBD[0];

      if (!equipoPrincipal) {
        return ctx.reply(
          `❌ No se encontró ningún club oficial registrado con el nombre "${query}".`,
        );
      }

      // 2. Obtener partidos en rango dinámico (hasta 21 días adelante para encontrar siempre su próximo cruce)
      const fechas = this.getRangoFechasDinamico(2, 21);
      const ligaInfo = this.resolverLigaKey(equipoPrincipal.liga);
      const leagueId = ligaInfo ? ligaInfo.id : undefined;

      let partidos = await this.sportsApi.obtenerPartidosDelDia(fechas.desde, fechas.hasta, leagueId);
      if (!partidos || partidos.length === 0) {
        partidos = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta, leagueId);
      }

      const partidosOficiales = (partidos || []).filter((p: any) =>
        this.targetLeagueKeys.includes(parseInt(p?.league_key)),
      );

      // Algoritmo de Coincidencia Flexible (Fuzzy Match Bidireccional)
      const isMatch = (apiTeam: string, targetName: string) => {
        const a = (apiTeam || '').toLowerCase();
        const t = (targetName || '').toLowerCase();
        const cleanA = a.replace(/fc|1907|united|city|club|sporting|psg/gi, '').trim();
        const cleanT = t.replace(/fc|1907|united|city|club|sporting|psg/gi, '').trim();

        return (
          a.includes(t) ||
          t.includes(a) ||
          (cleanT.length > 2 && (cleanA.includes(cleanT) || cleanT.includes(cleanA)))
        );
      };

      const hoyStr = new Date().toISOString().split('T')[0];
      const hoyMs = new Date().getTime();
      const partidosOrdenados = [...partidosOficiales].sort((a: any, b: any) => {
        const tA = a.event_date ? new Date(a.event_date).getTime() : 0;
        const tB = b.event_date ? new Date(b.event_date).getTime() : 0;
        return Math.abs(tA - hoyMs) - Math.abs(tB - hoyMs);
      });

      const proximosPartidos = partidosOrdenados.filter(
        (p: any) => !p?.event_final_result || p.event_date >= hoyStr,
      );
      const partidosAConsultar = proximosPartidos.length > 0 ? proximosPartidos : partidosOrdenados;

      const partidoEquipo = partidosAConsultar.find((p: any) => {
        const home = p?.event_home_team || '';
        const away = p?.event_away_team || '';
        return isMatch(home, queryNorm) || isMatch(away, queryNorm) ||
               isMatch(home, equipoPrincipal.nombre) || isMatch(away, equipoPrincipal.nombre);
      });

      let mensaje = `⚽ <b>${equipoPrincipal.nombre.toUpperCase()}</b> (${equipoPrincipal.liga})\n\n`;

      if (partidoEquipo) {
        const homeName = partidoEquipo?.event_home_team || 'Local';
        const awayName = partidoEquipo?.event_away_team || 'Visitante';
        const resultado = partidoEquipo?.event_final_result
          ? `(${partidoEquipo.event_final_result})`
          : '';

        mensaje +=
          `📅 <b>Partido Programado / Reciente:</b>\n` +
          `⚔️ <b>${homeName} vs ${awayName}</b> ${resultado}\n\n`;

        const localDB = await this.prisma.equipo.findFirst({
          where: { nombre: { contains: homeName, mode: 'insensitive' } },
        });
        const visitanteDB = await this.prisma.equipo.findFirst({
          where: { nombre: { contains: awayName, mode: 'insensitive' } },
        });

        const payload: PartidoInput = {
          Liga: equipoPrincipal.liga,
          HomeTeam: homeName,
          AwayTeam: awayName,
          HomeElo: localDB ? localDB.elo : 1500,
          AwayElo: visitanteDB ? visitanteDB.elo : 1500,
          Form5Home: localDB ? localDB.form5 : 50,
          Form5Away: visitanteDB ? visitanteDB.form5 : 50,
          Form3Home: localDB ? localDB.form3 : 50,
          Form3Away: visitanteDB ? visitanteDB.form3 : 50,
        };

        const resIA = await this.aiEngine.analizarJornada([payload]);
        if (resIA && resIA.length > 0) {
          const ia = resIA[0];
          const p1 = parseFloat(
            (ia?.probabilidades_1X2?.Victoria_Local || '0').replace('%', ''),
          );
          const pX = parseFloat(
            (ia?.probabilidades_1X2?.Empate || '0').replace('%', ''),
          );
          const p2 = parseFloat(
            (ia?.probabilidades_1X2?.Victoria_Visitante || '0').replace(
              '%',
              '',
            ),
          );

          let sugerida = `Victoria Local (${homeName})`;
          if (p2 > p1 && p2 > pX) sugerida = `Victoria Visitante (${awayName})`;
          else if (pX > p1 && pX > p2) sugerida = `Empate (X)`;

          const xgL = ia.xg_esperados?.xg_local ?? 1.4;
          const xgV = ia.xg_esperados?.xg_visitante ?? 1.1;

          let marcadoresStr = '';
          if (ia.marcadores_exactos && ia.marcadores_exactos.length > 0) {
            marcadoresStr = ia.marcadores_exactos
              .map((m) => `${m.marcador} (${m.probabilidad})`)
              .join(', ');
          }

          mensaje +=
            `🎯 <b>Apuesta Sugerida:</b> <b>${sugerida}</b>\n` +
            `⚽ <b>Goles Esperados (xG Poisson):</b> Local ${xgL} | Visitante ${xgV}\n` +
            `🎲 <b>Top Marcadores Exactos:</b> ${marcadoresStr || 'N/A'}\n\n` +
            `📊 <b>Probabilidades Calculadas:</b>\n` +
            `• <b>1X2:</b> Local ${ia?.probabilidades_1X2?.Victoria_Local || '0%'} | Empate ${ia?.probabilidades_1X2?.Empate || '0%'} | Visitante ${ia?.probabilidades_1X2?.Victoria_Visitante || '0%'}\n` +
            `• <b>Doble Oportunidad:</b> 1X ${ia?.doble_oportunidad?.['1X'] || '0%'} | X2 ${ia?.doble_oportunidad?.X2 || '0%'} | 12 ${ia?.doble_oportunidad?.['12'] || '0%'}\n` +
            `• <b>Goles Over 2.5:</b> Over ${ia?.mercado_goles?.Over_2_5 || '0%'} | Under ${ia?.mercado_goles?.Under_2_5 || '0%'}\n` +
            `• <b>Ambos Anotan:</b> Sí ${ia?.ambos_anotan?.Si || '0%'} | No ${ia?.ambos_anotan?.No || '0%'}\n`;
        }
      } else {
        mensaje +=
          `📊 <b>Estadísticas Cuantitativas del Club:</b>\n` +
          `• Rating Elo Actual: <b>${equipoPrincipal.elo.toFixed(1)}</b>\n` +
          `• Estado de Forma: <b>${equipoPrincipal.form5.toFixed(1)} / 100</b>\n\n` +
          `ℹ️ <i>Sin partido programado en las 13 competiciones para las fechas consultadas.</i>`;
      }

      await ctx.reply(mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error en busqueda equipo', error);
      await ctx.reply('❌ Error al consultar el equipo.');
    }
  }

  private async procesarApuestasDeLiga(
    ligaInfo: { id: number; nombre: string },
    ctx: Context,
  ) {
    try {
      const fechas = this.getRangoFechasDinamico(2, 7);
      let partidos = await this.sportsApi.obtenerPartidosDelDia(fechas.desde, fechas.hasta, ligaInfo.id);
      if (!partidos || partidos.length === 0) {
        partidos = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta, ligaInfo.id);
      }

      const partidosLigaAll = (partidos || []).filter(
        (p: any) => parseInt(p?.league_key) === ligaInfo.id,
      );

      // Priorizar partidos pendientes / próximos
      const pendientes = partidosLigaAll.filter((p: any) => !p?.event_final_result || p.event_final_result.trim().length === 0);
      const partidosLiga = pendientes.length > 0 ? pendientes : partidosLigaAll;

      let mensaje = `🏆 <b>APUESTAS DESTACADAS (${ligaInfo.nombre.toUpperCase()})</b> 🏆\n\n`;

      if (partidosLiga.length > 0) {
        const partidosInput: PartidoInput[] = [];
        for (const p of partidosLiga.slice(0, 10)) {
          const h = p?.event_home_team || '';
          const a = p?.event_away_team || '';
          if (!h || !a) continue;

          const lDB = await this.prisma.equipo.findFirst({
            where: { nombre: { contains: h, mode: 'insensitive' } },
          });
          const vDB = await this.prisma.equipo.findFirst({
            where: { nombre: { contains: a, mode: 'insensitive' } },
          });

          partidosInput.push({
            Liga: ligaInfo.nombre,
            HomeTeam: h,
            AwayTeam: a,
            HomeElo: lDB ? lDB.elo : 1500,
            AwayElo: vDB ? vDB.elo : 1500,
            Form5Home: lDB ? lDB.form5 : 50,
            Form5Away: vDB ? vDB.form5 : 50,
            Form3Home: lDB ? lDB.form3 : 50,
            Form3Away: vDB ? vDB.form3 : 50,
          });
        }

        if (partidosInput.length > 0) {
          const predicciones =
            await this.aiEngine.analizarJornada(partidosInput);

          predicciones.slice(0, 4).forEach((pred) => {
            if (!pred || !pred.probabilidades_1X2) return;
            const p1 = parseFloat(
              (pred.probabilidades_1X2.Victoria_Local || '0').replace('%', ''),
            );
            const pX = parseFloat(
              (pred.probabilidades_1X2.Empate || '0').replace('%', ''),
            );
            const p2 = parseFloat(
              (pred.probabilidades_1X2.Victoria_Visitante || '0').replace(
                '%',
                '',
              ),
            );

            const teams = pred.partido.split(' vs ');
            let recomendada = `Victoria Local (${teams[0]})`;
            if (p2 > p1 && p2 > pX)
              recomendada = `Victoria Visitante (${teams[1]})`;
            else if (pX > p1 && pX > p2) recomendada = `Empate`;

            const xgL = pred.xg_esperados?.xg_local ?? 1.4;
            const xgV = pred.xg_esperados?.xg_visitante ?? 1.1;

            let marcadoresStr = '';
            if (pred.marcadores_exactos && pred.marcadores_exactos.length > 0) {
              marcadoresStr = pred.marcadores_exactos
                .map((m) => `${m.marcador} (${m.probabilidad})`)
                .join(', ');
            }

            mensaje +=
              `⚽ <b>${pred.partido}</b>\n` +
              `🎯 <b>Apuesta Sugerida:</b> ${recomendada}\n` +
              `⚽ <b>xG:</b> ${xgL} vs ${xgV} | 🎲 <b>Top Marcadores:</b> ${marcadoresStr}\n` +
              `📊 <b>Probabilidades:</b> Local ${pred.probabilidades_1X2.Victoria_Local} | Empate ${pred.probabilidades_1X2.Empate} | Visitante ${pred.probabilidades_1X2.Victoria_Visitante}\n` +
              `• <b>Doble Op:</b> 1X ${pred.doble_oportunidad?.['1X'] || '0%'} | X2 ${pred.doble_oportunidad?.X2 || '0%'}\n` +
              `• <b>Goles:</b> Over 2.5: ${pred.mercado_goles?.Over_2_5 || '0%'} | <b>BTTS:</b> Sí ${pred.ambos_anotan?.Si || '0%'}\n\n`;
          });
        }
      } else {
        mensaje += `ℹ️ No hay partidos para esta competición en la jornada consultada.`;
      }

      await ctx.reply(mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error procesando apuestas liga', error);
      await ctx.reply('❌ Error al obtener las apuestas del torneo.');
    }
  }

  @Command('resultados')
  async comandoResultadosJornada(@Ctx() ctx: Context) {
    const text = (ctx.message as any)?.text || '';
    const query = text.replace('/resultados', '').trim();
    const ligaInfo = this.resolverLigaKey(query);

    try {
      const fechas = this.getRangoFechasDinamico();
      await ctx.reply(
        `⚽ Consultando marcadores de la jornada (${fechas.desde} al ${fechas.hasta})...`,
      );

      let partidos = await this.sportsApi.obtenerPartidosDelDia(fechas.desde, fechas.hasta);
      if (!partidos || partidos.length === 0) {
        partidos = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta);
      }

      let partidosFiltrados = (partidos || []).filter((p: any) =>
        this.targetLeagueKeys.includes(parseInt(p?.league_key)),
      );

      if (ligaInfo) {
        partidosFiltrados = partidosFiltrados.filter(
          (p: any) => parseInt(p?.league_key) === ligaInfo.id,
        );
      }

      if (partidosFiltrados.length === 0) {
        return ctx.reply('ℹ️ No se encontraron marcadores para ese filtro.');
      }

      let mensaje = `📋 <b>MARCADORES FINALES DE LA JORNADA</b> 📋\n\n`;
      partidosFiltrados.slice(0, 10).forEach((p: any) => {
        const res = p?.event_final_result || 'Pendiente';
        mensaje += `🏆 <b>${p?.league_name || 'Liga'}</b>\n⚽ <b>${p?.event_home_team || 'Local'} ${res} ${p?.event_away_team || 'Visitante'}</b>\n📅 ${p?.event_date || ''}\n\n`;
      });

      await ctx.reply(mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error en /resultados', error);
      await ctx.reply('❌ Error al obtener los resultados.');
    }
  }

  @Command('hoy')
  @Command('test')
  @Command('pasado')
  async comandoJornadaAcotada(@Ctx() ctx: Context) {
    const fechas = this.getRangoFechasDinamico();
    await ctx.reply(
      `🔍 Analizando la jornada cuantitativa en vivo (${fechas.desde} al ${fechas.hasta})...`,
    );
    await this.ejecutarAnalisisJornadaLimitado(fechas.desde, fechas.hasta, ctx);
  }

  @Command('stats')
  async comandoEstadisticas(@Ctx() ctx: Context) {
    try {
      const totalAlertas = await this.prisma.alertaValor.count();

      const mensaje =
        `📊 <b>RESUMEN DEL MOTOR DE INTELIGENCIA ARTIFICIAL</b> 📊\n\n` +
        `🔹 Alertas Registradas en BD: <b>${totalAlertas}</b>\n` +
        `⚙️ Algoritmo: <b>Calibrated Random Forest + Dixon-Coles Poisson (13 Torneos Top)</b>`;

      await ctx.reply(mensaje, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error('Error en comando /stats', error);
      await ctx.reply('❌ Error al obtener estadísticas.');
    }
  }

  @Cron('0 9 * * *')
  async cronJornadaDiaria() {
    this.logger.log('Cronjob diario activado...');
    const fechas = this.getRangoFechasDinamico();
    await this.ejecutarAnalisisJornadaLimitado(fechas.desde, fechas.hasta);
  }

  async ejecutarAnalisisJornadaLimitado(
    desde: string,
    hasta: string,
    ctx?: Context,
  ) {
    try {
      let partidosReales = await this.sportsApi.obtenerPartidosDelDia(
        desde,
        hasta,
      );

      if (!partidosReales || partidosReales.length === 0) {
        partidosReales = await this.sportsApi.obtenerPartidosDelDia(this.fechaPruebaDesde, this.fechaPruebaHasta);
      }

      const partidosOficiales = (partidosReales || []).filter((p: any) =>
        this.targetLeagueKeys.includes(parseInt(p?.league_key)),
      );

      if (!partidosOficiales || partidosOficiales.length === 0) {
        if (ctx)
          await ctx.reply(
            `ℹ️ No se encontraron partidos oficiales entre ${desde} y ${hasta}.`,
          );
        return;
      }

      this.logger.log(
        `Procesando ${partidosOficiales.length} partidos oficiales de las 13 competiciones...`,
      );

      const partidosParaAnalizar: PartidoInput[] = [];

      const normalizarLiga = (leagueKey: number): string | null => {
        if (leagueKey === 152) return 'Premier';
        if (leagueKey === 302) return 'LaLiga';
        if (leagueKey === 175) return 'Bundesliga';
        if (leagueKey === 207) return 'SerieA';
        if (leagueKey === 153) return 'Championship';
        if (leagueKey === 168) return 'Ligue1';
        if (leagueKey === 266) return 'Portugal';
        if (leagueKey === 244) return 'Eredivisie';
        if (leagueKey === 322) return 'SuperLig';
        if (leagueKey === 99) return 'Brasileirao';
        if (leagueKey === 278) return 'Saudi';
        if (leagueKey === 3) return 'Champions';
        if (leagueKey === 18) return 'Libertadores';
        return null;
      };

      for (const partido of partidosOficiales) {
        const nombreLocal = partido?.event_home_team || '';
        const nombreVisitante = partido?.event_away_team || '';
        if (!nombreLocal || !nombreVisitante) continue;

        const ligaNormalizada = normalizarLiga(parseInt(partido?.league_key));
        if (!ligaNormalizada) continue;

        const localDB = await this.prisma.equipo.findFirst({
          where: { nombre: { contains: nombreLocal, mode: 'insensitive' } },
        });
        const visitanteDB = await this.prisma.equipo.findFirst({
          where: { nombre: { contains: nombreVisitante, mode: 'insensitive' } },
        });

        const homeElo = localDB ? localDB.elo : 1500;
        const awayElo = visitanteDB ? visitanteDB.elo : 1500;

        partidosParaAnalizar.push({
          Liga: ligaNormalizada,
          HomeTeam: nombreLocal,
          AwayTeam: nombreVisitante,
          HomeElo: homeElo,
          AwayElo: awayElo,
          Form5Home: localDB ? localDB.form5 : 50,
          Form5Away: visitanteDB ? visitanteDB.form5 : 50,
          Form3Home: localDB ? localDB.form3 : 50,
          Form3Away: visitanteDB ? visitanteDB.form3 : 50,
        });
      }

      if (partidosParaAnalizar.length === 0) {
        if (ctx)
          await ctx.reply(
            `ℹ️ Ninguno de los partidos encontrados pertenece a las 13 competiciones soportadas.`,
          );
        return;
      }

      const resultados =
        await this.aiEngine.analizarJornada(partidosParaAnalizar);
      let mensaje = `🏆 <b>TOP APUESTAS RECOMENDADAS DE LA JORNADA (+EV)</b> 🏆\n\n`;
      let count = 0;

      for (const pred of resultados) {
        if (!pred || !pred.probabilidades_1X2 || count >= 5) continue;

        const p1 = parseFloat(
          (pred.probabilidades_1X2.Victoria_Local || '0').replace('%', ''),
        );
        const pX = parseFloat(
          (pred.probabilidades_1X2.Empate || '0').replace('%', ''),
        );
        const p2 = parseFloat(
          (pred.probabilidades_1X2.Victoria_Visitante || '0').replace('%', ''),
        );

        const teams = pred.partido.split(' vs ');
        let sugerida = `Victoria Local (${teams[0]})`;
        if (p2 > p1 && p2 > pX) sugerida = `Victoria Visitante (${teams[1]})`;
        else if (pX > p1 && pX > p2) sugerida = `Empate`;

        const xgL = pred.xg_esperados?.xg_local ?? 1.4;
        const xgV = pred.xg_esperados?.xg_visitante ?? 1.1;

        let marcadoresStr = '';
        if (pred.marcadores_exactos && pred.marcadores_exactos.length > 0) {
          marcadoresStr = pred.marcadores_exactos
            .map((m) => `${m.marcador} (${m.probabilidad})`)
            .join(', ');
        }

        const probBestPct = Math.max(p1, pX, p2);
        const pModel = probBestPct / 100;
        const cuotaEstimate = parseFloat(
          Math.max(1.35, Math.min(4.5, 1.05 / pModel)).toFixed(2),
        );
        const evPct = parseFloat(
          ((pModel * cuotaEstimate - 1) * 100).toFixed(2),
        );
        const kellyStake = parseFloat(
          Math.max(
            1.0,
            Math.min(
              5.0,
              ((pModel * cuotaEstimate - 1) / (cuotaEstimate - 1)) * 25,
            ),
          ).toFixed(1),
        );

        count++;
        mensaje +=
          `⚽ <b>${pred.partido}</b> (${pred.liga})\n` +
          `🎯 <b>Apuesta Sugerida:</b> ${sugerida}\n` +
          `⚽ <b>xG:</b> ${xgL} vs ${xgV} | 🎲 <b>Top Marcadores:</b> ${marcadoresStr}\n` +
          `💰 <b>Cuota Est.:</b> ${cuotaEstimate.toFixed(2)} | <b>Stake Kelly:</b> ${kellyStake}% (${evPct >= 0 ? '+' : ''}${evPct}% EV)\n` +
          `📊 <b>Probabilidades Calculadas:</b>\n` +
          `• <b>1X2:</b> Local ${pred.probabilidades_1X2.Victoria_Local} | Empate ${pred.probabilidades_1X2.Empate} | Visitante ${pred.probabilidades_1X2.Victoria_Visitante}\n` +
          `• <b>Doble Oportunidad:</b> 1X ${pred.doble_oportunidad?.['1X'] || '0%'} | X2 ${pred.doble_oportunidad?.X2 || '0%'}\n` +
          `• <b>Goles Over 2.5:</b> Over ${pred.mercado_goles?.Over_2_5 || '0%'} | <b>BTTS:</b> Sí ${pred.ambos_anotan?.Si || '0%'}\n\n`;

        await this.prisma.alertaValor
          .create({
            data: {
              partido: pred.partido,
              liga: pred.liga,
              mercadoRecomendado: sugerida,
              cuotaCasa: cuotaEstimate,
              probabilidadIA: probBestPct,
              ventajaPorcentaje: evPct > 0 ? evPct : 5.0,
              stakeRecomendado: kellyStake,
              estado: 'PENDIENTE',
            },
          })
          .catch((e) => this.logger.error('Error guardando alerta', e));
      }

      if (ctx) {
        await ctx.reply(mensaje, { parse_mode: 'HTML' });
      } else {
        await this.bot.telegram.sendMessage(
          process.env.TELEGRAM_CHAT_ID!,
          mensaje,
          { parse_mode: 'HTML' },
        );
      }
    } catch (error) {
      this.logger.error('Error en análisis de jornada acotado', error);
      if (ctx) await ctx.reply('❌ Error al procesar la jornada.');
    }
  }
}
