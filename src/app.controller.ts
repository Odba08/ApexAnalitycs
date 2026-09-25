import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { UfcService } from './ai-engine/ufc.service';
import { F1Service } from './ai-engine/f1.service';
import { SportsApiService } from './sports-api/sports-api.service';

@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ufcService: UfcService,
    private readonly f1Service: F1Service,
    private readonly sportsApi: SportsApiService,
  ) {}

  @Get('api/resumen')
  async getResumenApi() {
    const alertas = await this.prisma.alertaValor.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const ufc = await this.ufcService.obtenerCarteleraUFC();
    const f1 = await this.f1Service.analizarProximoGP();
    const soccer = await this.sportsApi.obtenerPartidosTheOdds(152);

    return {
      status: 'online',
      brand: 'Apex Analytics',
      alertas,
      ufc: ufc.analisis_ufc || [],
      f1: f1.predicciones_top || null,
      f1_gp: f1.gp || null,
      soccer: soccer.slice(0, 10),
    };
  }

  @Get('dashboard')
  @Header('Content-Type', 'text/html')
  async getDashboard(): Promise<string> {
    const [alertas, ufcData, f1Data, premierMatches, f1Pilotos] = await Promise.all([
      this.prisma.alertaValor.findMany({ orderBy: { createdAt: 'desc' } }),
      this.ufcService.obtenerCarteleraUFC().catch(() => ({ analisis_ufc: [] })),
      this.f1Service.analizarProximoGP().catch(() => ({ gp: null, predicciones_top: null })),
      this.sportsApi.obtenerPartidosTheOdds(152).catch(() => []),
      this.f1Service.obtenerMundialPilotos().catch(() => []),
    ]);

    const ufcCombates = (ufcData as any)?.analisis_ufc || [];
    const f1Preds = (f1Data as any)?.predicciones_top || null;
    const f1Gp = (f1Data as any)?.gp || null;

    const ganadas = alertas.filter((a) => a.estado === 'GANADA').length;
    const perdidas = alertas.filter((a) => a.estado === 'PERDIDA').length;
    const pendientes = alertas.filter((a) => a.estado === 'PENDIENTE').length;
    const totalLiq = ganadas + perdidas;
    const winRate = totalLiq > 0 ? ((ganadas / totalLiq) * 100).toFixed(1) : '0.0';

    let stake = 0;
    let pnl = 0;
    alertas.filter((a) => a.estado === 'GANADA').forEach((a) => {
      stake += a.stakeRecomendado;
      pnl += a.stakeRecomendado * (a.cuotaCasa - 1);
    });
    alertas.filter((a) => a.estado === 'PERDIDA').forEach((a) => {
      stake += a.stakeRecomendado;
      pnl -= a.stakeRecomendado;
    });
    const roi = stake > 0 ? ((pnl / stake) * 100).toFixed(1) : '0.0';

    const futbolAlertas = alertas.filter((a) => a.deporte === 'FUTBOL');
    const ufcAlertas = alertas.filter((a) => a.deporte === 'UFC');
    const f1Alertas = alertas.filter((a) => a.deporte === 'F1');

    return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apex Analytics | Quantitative Sports Intelligence</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .glass-card { background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glass-card-hover { transition: all 0.2s ease; }
    .glass-card-hover:hover { border-color: rgba(16, 185, 129, 0.3); transform: translateY(-2px); }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen antialiased pb-16 selection:bg-emerald-500 selection:text-slate-950">

  <!-- Header con Branding Apex Analytics -->
  <header class="border-b border-slate-800/80 bg-slate-900/70 sticky top-0 z-50 backdrop-blur-xl">
    <div class="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
      <div class="flex items-center space-x-3.5">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center font-extrabold text-slate-950 text-lg shadow-lg shadow-emerald-500/25 tracking-tighter">
          ▲
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h1 class="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">Apex Analytics</h1>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PRO</span>
          </div>
          <p class="text-xs text-slate-400 font-medium">Quantitative Intelligence &bull; +EV Machine Learning</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span> Sistema 24/7 Activo
        </span>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-4 pt-6 space-y-6">

    <!-- KPI Summary Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      <div class="glass-card rounded-2xl p-4">
        <div class="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>Tasa de Acierto</span>
          <span class="text-emerald-400 font-mono text-[11px]">WinRate</span>
        </div>
        <p class="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1.5 tracking-tight font-mono">${winRate}%</p>
        <p class="text-[11px] text-slate-500 mt-1 font-medium">${ganadas} Ganadas &bull; ${perdidas} Perdidas</p>
      </div>

      <div class="glass-card rounded-2xl p-4">
        <div class="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>Rendimiento Global</span>
          <span class="text-cyan-400 font-mono text-[11px]">ROI</span>
        </div>
        <p class="text-2xl sm:text-3xl font-extrabold ${Number(roi) >= 0 ? 'text-cyan-400' : 'text-rose-400'} mt-1.5 tracking-tight font-mono">${Number(roi) >= 0 ? '+' : ''}${roi}%</p>
        <p class="text-[11px] text-slate-500 mt-1 font-medium">Balance: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} unidades</p>
      </div>

      <div class="glass-card rounded-2xl p-4">
        <div class="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>Pronósticos Activos</span>
          <span class="text-amber-400 font-mono text-[11px]">Live</span>
        </div>
        <p class="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1.5 tracking-tight font-mono">${pendientes}</p>
        <p class="text-[11px] text-slate-500 mt-1 font-medium">Pendientes de resultado</p>
      </div>

      <div class="glass-card rounded-2xl p-4">
        <div class="flex items-center justify-between text-slate-400 text-xs font-medium">
          <span>Total Selecciones</span>
          <span class="text-indigo-400 font-mono text-[11px]">Historial</span>
        </div>
        <p class="text-2xl sm:text-3xl font-extrabold text-indigo-300 mt-1.5 tracking-tight font-mono">${alertas.length}</p>
        <p class="text-[11px] text-slate-500 mt-1 font-medium">Fútbol, UFC y Fórmula 1</p>
      </div>
    </div>

    <!-- Pestañas Interactivas (Fútbol, UFC, F1, Todas) -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-3">
      <div class="flex space-x-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
        <button id="tab-btn-futbol" onclick="cambiarPestana('futbol')" class="tab-btn px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <span>⚽</span> <span>Fútbol</span>
        </button>
        <button id="tab-btn-ufc" onclick="cambiarPestana('ufc')" class="tab-btn px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 transition flex items-center space-x-1.5">
          <span>🥊</span> <span>UFC / MMA</span>
        </button>
        <button id="tab-btn-f1" onclick="cambiarPestana('f1')" class="tab-btn px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 transition flex items-center space-x-1.5">
          <span>🏎️</span> <span>Fórmula 1</span>
        </button>
        <button id="tab-btn-todas" onclick="cambiarPestana('todas')" class="tab-btn px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-200 transition flex items-center space-x-1.5">
          <span>📋</span> <span>Historial Completo</span>
        </button>
      </div>
    </div>

    <!-- SECCIÓN 1: FÚTBOL -->
    <div id="tab-content-futbol" class="tab-content space-y-6">
      <!-- Próximos Partidos (Premier League en 2 semanas & Ligas Top) -->
      <div class="glass-card rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-bold text-sm tracking-wide text-slate-200 flex items-center">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-sm shadow-emerald-400"></span>
              PRÓXIMOS ENCUENTROS OFICIALES (PREMIER LEAGUE & LIGAS TOP)
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Sincronizado vía The-Odds-API en tiempo real</p>
          </div>
          <span class="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">${premierMatches.length} partidos</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${premierMatches.slice(0, 6).map((m: any) => `
            <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Premier League</span>
                <p class="font-bold text-slate-200 text-sm mt-0.5">${m.event_home_team} vs ${m.event_away_team}</p>
                <p class="text-xs text-slate-400 mt-0.5 font-mono">📅 ${m.event_date} &bull; ${m.event_time || '11:30'} GMT</p>
              </div>
              <span class="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                1X2
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Registro de Selecciones Fútbol -->
      <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold text-xs tracking-wider uppercase text-slate-400 mb-3 flex items-center">
          ⚽ Pronósticos Registrados de Fútbol (${futbolAlertas.length})
        </h3>
        ${renderizarTablaAlertas(futbolAlertas)}
      </div>
    </div>

    <!-- SECCIÓN 2: UFC / MMA -->
    <div id="tab-content-ufc" class="tab-content hidden space-y-6">
      <div class="glass-card rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-bold text-sm tracking-wide text-slate-200 flex items-center">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-400 mr-2 shadow-sm shadow-rose-400"></span>
              CARTELERA UFC & MODELO CUANTITATIVO (+EV)
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">Tale of the Tape, ventajas físicas y probabilidades de finalización</p>
          </div>
          <span class="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">${ufcCombates.length} combates</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          ${ufcCombates.slice(0, 6).map((c: any) => {
            const isRedFav = c.prob_red >= c.prob_blue;
            const fav = isRedFav ? c.red_fighter : c.blue_fighter;
            const favProb = Math.round(Math.max(c.prob_red, c.prob_blue));
            const favOdds = isRedFav ? c.cuota_red : c.cuota_blue;
            const valBadge = c.has_value ? '<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">+EV</span>' : '';
            const p = c.props;

            return `
              <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">${c.weight_class || 'UFC MMA'}</span>
                  ${valBadge}
                </div>
                <div class="flex items-center justify-between font-bold text-sm">
                  <span class="${isRedFav ? 'text-emerald-400' : 'text-slate-200'}">${c.red_fighter}</span>
                  <span class="text-slate-500 text-xs font-normal">vs</span>
                  <span class="${!isRedFav ? 'text-emerald-400' : 'text-slate-200'}">${c.blue_fighter}</span>
                </div>
                <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60 text-xs space-y-1">
                  <div class="flex justify-between text-slate-300">
                    <span>Favorito IA: <b class="text-slate-100">${fav}</b></span>
                    <span class="font-mono text-emerald-400 font-bold">${favProb}% (Cuota ${favOdds})</span>
                  </div>
                  ${p ? `
                    <div class="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                      <span>KO: ${Math.round(p.metodos.ko_tko)}% | Sub: ${Math.round(p.metodos.sumision)}% | Dec: ${Math.round(p.metodos.decision)}%</span>
                      <span class="text-cyan-300 font-semibold">${p.jugada_alternativa}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Registro de Selecciones UFC -->
      <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold text-xs tracking-wider uppercase text-slate-400 mb-3 flex items-center">
          🥊 Pronósticos Registrados de UFC (${ufcAlertas.length})
        </h3>
        ${renderizarTablaAlertas(ufcAlertas)}
      </div>
    </div>

    <!-- SECCIÓN 3: FÓRMULA 1 -->
    <div id="tab-content-f1" class="tab-content hidden space-y-6">
      <div class="glass-card rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="font-bold text-sm tracking-wide text-slate-200 flex items-center">
              <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-2 shadow-sm shadow-cyan-400"></span>
              FÓRMULA 1: SIMULACIÓN MONTE CARLO & TELEMETRÍA
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">5,000 iteraciones estocásticas basadas en ritmo de carrera</p>
          </div>
          <span class="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
            ${f1Gp ? f1Gp.nombre : 'Próximo GP'}
          </span>
        </div>

        ${f1Preds ? `
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
            <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <p class="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Pole Position</p>
              <p class="text-lg font-bold text-slate-100 mt-1">${f1Preds.pole_position?.piloto || 'N/A'}</p>
              <p class="text-xs text-emerald-400 font-mono mt-0.5">${f1Preds.pole_position?.probabilidad || 0}% de probabilidad</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <p class="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Victoria Gran Premio</p>
              <p class="text-lg font-bold text-slate-100 mt-1">${f1Preds.probabilidad_victoria?.piloto || 'N/A'}</p>
              <p class="text-xs text-emerald-400 font-mono mt-0.5">${f1Preds.probabilidad_victoria?.probabilidad || 0}% (Cuota aprox: ${f1Preds.probabilidad_victoria?.cuota_estimada || 2.0})</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <p class="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Podio Top 3</p>
              <div class="text-xs text-slate-300 mt-1 space-y-0.5">
                ${(f1Preds.top3_podio || []).slice(0, 3).map((p: any, i: number) => `
                  <div class="flex justify-between font-medium">
                    <span>${i + 1}. ${p.piloto}</span>
                    <span class="font-mono text-cyan-400">${p.probabilidad}%</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : '<p class="text-xs text-slate-500 py-3">Inicia los entrenamientos libres para calibrar la telemetría.</p>'}
      </div>

      <!-- Clasificación Mundial de Pilotos F1 -->
      <div class="glass-card rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-xs tracking-wider uppercase text-slate-300 flex items-center">
            🏆 Clasificación Mundial de Pilotos (F1 2026)
          </h3>
          <span class="text-[11px] text-slate-500 font-mono">Calibrado con FIA & FastF1</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="text-slate-400 border-b border-slate-800 pb-2">
                <th class="py-2 font-semibold">Pos</th>
                <th class="py-2 font-semibold">Piloto</th>
                <th class="py-2 font-semibold">Escudería</th>
                <th class="py-2 font-semibold">Rating Elo</th>
                <th class="py-2 font-semibold text-right">Puntos Mundial</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              ${(f1Pilotos || []).slice(0, 6).map((piloto: any, idx: number) => `
                <tr class="hover:bg-slate-800/30 transition">
                  <td class="py-2.5 font-bold font-mono text-cyan-400">${idx + 1}</td>
                  <td class="py-2.5 font-bold text-slate-100">${piloto.nombre}</td>
                  <td class="py-2.5 text-slate-400">${piloto.escuderia}</td>
                  <td class="py-2.5 font-mono text-emerald-400">${Math.round(piloto.elo)}</td>
                  <td class="py-2.5 font-mono font-bold text-right text-amber-400">${piloto.puntosMundial} pts</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Registro de Selecciones F1 -->
      <div class="glass-card rounded-2xl p-5">
        <h3 class="font-bold text-xs tracking-wider uppercase text-slate-400 mb-3 flex items-center">
          🏎️ Pronósticos Registrados de F1 (${f1Alertas.length})
        </h3>
        ${renderizarTablaAlertas(f1Alertas)}
      </div>
    </div>

    <!-- SECCIÓN 4: TODAS LAS SELECCIONES -->
    <div id="tab-content-todas" class="tab-content hidden space-y-6">
      <div class="glass-card rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-sm tracking-wide uppercase text-slate-300 flex items-center">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-2 shadow-sm shadow-emerald-400"></span>
            HISTORIAL COMPLETO DE PRONÓSTICOS REGISTRADOS EN BASE DE DATOS
          </h2>
          <span class="text-xs font-mono text-slate-400">Total: ${alertas.length} registros</span>
        </div>
        ${renderizarTablaAlertas(alertas)}
      </div>
    </div>

  </main>

  <!-- Script de Interactividad de Pestañas & WebApp -->
  <script>
    function cambiarPestana(sport) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-emerald-500/20', 'text-emerald-400', 'border', 'border-emerald-500/30');
        btn.classList.add('text-slate-400');
      });
      const activeBtn = document.getElementById('tab-btn-' + sport);
      if (activeBtn) {
        activeBtn.classList.remove('text-slate-400');
        activeBtn.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border', 'border-emerald-500/30');
      }

      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      const activeContent = document.getElementById('tab-content-' + sport);
      if (activeContent) {
        activeContent.classList.remove('hidden');
      }
    }

    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  </script>
</body>
</html>`;
  }
}

function renderizarTablaAlertas(alertas: any[]): string {
  if (!alertas || alertas.length === 0) {
    return '<p class="text-center text-slate-500 py-6 text-xs">No hay pronósticos registrados en este apartado.</p>';
  }

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-800 pb-2">
            <th class="py-2.5 font-semibold">Deporte</th>
            <th class="py-2.5 font-semibold">Evento / Cruce</th>
            <th class="py-2.5 font-semibold">Selección IA</th>
            <th class="py-2.5 font-semibold">Cuota</th>
            <th class="py-2.5 font-semibold">Prob IA</th>
            <th class="py-2.5 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${alertas.map((a: any) => `
            <tr class="hover:bg-slate-800/30 transition">
              <td class="py-3 font-semibold text-slate-300">
                ${a.deporte === 'UFC' ? '🥊 UFC' : (a.deporte === 'F1' ? '🏎️ F1' : '⚽ Fútbol')}
              </td>
              <td class="py-3 text-slate-200 font-medium">${a.partido}</td>
              <td class="py-3 text-cyan-300 font-semibold">${a.mercadoRecomendado}</td>
              <td class="py-3 text-slate-300 font-mono">${Number(a.cuotaCasa || 1.8).toFixed(2)}</td>
              <td class="py-3 text-emerald-400 font-semibold font-mono">${Math.round(a.probabilidadIA || 50)}%</td>
              <td class="py-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold ${
                  a.estado === 'GANADA'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : a.estado === 'PERDIDA'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }">
                  ${a.estado}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
