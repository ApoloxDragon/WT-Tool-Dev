#!/usr/bin/env node
/* Makes a Spanish chart report (PDF) from a sample log, using the tool itself.
 *
 *   node tools/make-chart-report.js [log file] [output.pdf]
 *   defaults: "example data/matches-large.txt"  ->  docs/examples/graficos-partidas-war-thunder.pdf
 *
 * Dev tool (needs Playwright + Chromium, like the tests; nothing here is shipped with the site, and nothing is sent anywhere).
 * Steps: open the real app, paste the log, click Analyze, and take the matches the tool itself counted (repeats removed).
 * Then draw five charts — line, radar, vertical bars, horizontal bars, pie — one per page, each page in the
 * built-in colour preset of the tool (all Blue, at the owner's request), using the tool's own stylesheet. Everything counted is MATCHES (partidas).
 * The page is exactly the paper size with no margin, so the theme covers the whole sheet (no white bars). */
const fs = require('fs'), path = require('path');
const { ROOT, startServer, launch } = require('../tests/harness');

const LOG = path.resolve(process.argv[2] || path.join(ROOT, 'example data', 'matches-large.txt'));
const OUT = path.resolve(process.argv[3] || path.join(ROOT, 'docs', 'examples', 'graficos-partidas-war-thunder.pdf'));
const PRESETS = ['blue', 'blue', 'blue', 'blue', 'blue'];                     // the tool's Blue theme on every page
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = n => n.toLocaleString('es-ES');
const pct = (n, t) => (n / t * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
const niceStep = max => { const raw = max / 5, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw); };

/* ---------------------------------------------------------------- charts (SVG strings; colours are the page's theme variables) */
const AX = 'stroke="var(--text)" stroke-width="1.5"', GRID = 'stroke="var(--border)" stroke-width="1"';
const T = (x, y, s, o = '') => `<text x="${x}" y="${y}" ${o}>${esc(s)}</text>`;
const FS = n => `font-size="${n}"`;

function lineChart(d) {                 // cumulative wins and defeats, by match order
  const W = 1000, H = 420, L = 74, R = 120, Tp = 22, B = 62, pw = W - L - R, ph = H - Tp - B, n = d.order.length;
  const ymax = Math.ceil(Math.max(d.wins, d.losses) / 20) * 20, x = i => L + i / n * pw, y = v => Tp + ph - v / ymax * ph;
  let w = 0, l = 0; const pw_ = [[0, 0]], pl_ = [[0, 0]];
  d.order.forEach((r, i) => { if (r === 'Victory') w++; else l++; pw_.push([i + 1, w]); pl_.push([i + 1, l]); });
  const pts = a => a.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  let s = '';
  for (let v = 0; v <= ymax; v += 20) s += `<line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" ${GRID}/>` + T(L - 10, y(v) + 5, v, `text-anchor="end" fill="var(--dim)" ${FS(14)}`);
  for (let i = 0; i <= n; i += 25) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${Tp + ph}" y2="${Tp + ph + 6}" ${AX}/>` + T(x(i), Tp + ph + 24, i, `text-anchor="middle" fill="var(--dim)" ${FS(14)}`);
  s += `<line x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}" ${AX}/><line x1="${L}" x2="${L + pw}" y1="${Tp + ph}" y2="${Tp + ph}" ${AX}/>`;
  s += `<polyline points="${pts(pl_)}" fill="none" stroke="var(--loss)" stroke-width="3.2" stroke-linejoin="round"/><polyline points="${pts(pw_)}" fill="none" stroke="var(--win)" stroke-width="3.2" stroke-linejoin="round"/>`;
  s += T(x(n) + 8, y(d.wins) + 5, `${d.wins} victorias`, `fill="var(--win)" font-weight="700" ${FS(15)}`) + T(x(n) + 8, y(d.losses) + 5, `${d.losses} derrotas`, `fill="var(--loss)" font-weight="700" ${FS(15)}`);
  s += T(L + pw / 2, H - 14, 'Número de partida (orden en el registro)', `text-anchor="middle" fill="var(--text)" ${FS(15)}`);
  s += `<text transform="translate(20 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" fill="var(--text)" ${FS(15)}>Partidas acumuladas</text>`;
  s += `<rect x="${L + 18}" y="${Tp + 12}" width="26" height="4" fill="var(--win)"/>` + T(L + 52, Tp + 18, 'Victorias acumuladas', `fill="var(--text)" ${FS(14)}`) + `<rect x="${L + 18}" y="${Tp + 36}" width="26" height="4" fill="var(--loss)"/>` + T(L + 52, Tp + 42, 'Derrotas acumuladas', `fill="var(--text)" ${FS(14)}`);
  return s;
}

function radarChart(d) {                // wins and defeats for the most-played maps
  const W = 1000, H = 420, cx = 430, cy = 218, R = 135, n = d.maps.length;
  const max = Math.max(...d.maps.flatMap(m => [m.w, m.l])), step = Math.max(1, Math.ceil(max / 4)), top = step * 4;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n, pt = (i, v) => [cx + Math.cos(ang(i)) * R * v / top, cy + Math.sin(ang(i)) * R * v / top];
  let s = '';
  for (let k = 1; k <= 4; k++) { s += `<polygon points="${d.maps.map((_, i) => pt(i, k * step).join(',')).join(' ')}" fill="none" ${GRID}/>`; s += T(cx + 6, cy - R * k / 4 - 4, k * step, `fill="var(--dim)" ${FS(13)}`); }
  d.maps.forEach((m, i) => {
    const [ex, ey] = pt(i, top), c = Math.cos(ang(i)), off = R + (Math.abs(c) < 0.2 ? 32 : 16), lx = cx + c * off, ly = cy + Math.sin(ang(i)) * off;
    s += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" ${GRID}/>`;
    s += T(lx, ly + 5, m.name, `text-anchor="${Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end'}" fill="var(--text)" ${FS(15)}`);
  });
  const poly = (key, col) => `<polygon points="${d.maps.map((m, i) => pt(i, m[key]).join(',')).join(' ')}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="3" stroke-linejoin="round"/>` + d.maps.map((m, i) => { const [px, py] = pt(i, m[key]); return `<circle cx="${px}" cy="${py}" r="4.5" fill="${col}"/>`; }).join('');
  s += poly('l', 'var(--loss)') + poly('w', 'var(--win)');
  s += `<rect x="770" y="130" width="26" height="14" fill="var(--win)"/>` + T(806, 142, 'Victorias', `fill="var(--text)" ${FS(15)}`) + `<rect x="770" y="158" width="26" height="14" fill="var(--loss)"/>` + T(806, 170, 'Derrotas', `fill="var(--text)" ${FS(15)}`);
  ['Cada eje es un mapa.', 'Escala radial: número', 'de partidas (anillos', `de ${step} en ${step}).`].forEach((ln, k) => { s += T(770, 212 + k * 22, ln, `fill="var(--dim)" ${FS(14)}`); });
  return s;
}

function barsV(d) {                     // matches per game mode
  const W = 1000, H = 420, L = 84, R = 30, Tp = 30, B = 76, pw = W - L - R, ph = H - Tp - B, n = d.bars.length;
  const step = niceStep(Math.max(...d.bars.map(b => b[1]))), ymax = Math.ceil(Math.max(...d.bars.map(b => b[1])) / step) * step, y = v => Tp + ph - v / ymax * ph, slot = pw / n, bw = slot * 0.5;
  let s = '';
  for (let v = 0; v <= ymax; v += step) s += `<line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" ${GRID}/>` + T(L - 10, y(v) + 5, v, `text-anchor="end" fill="var(--dim)" ${FS(14)}`);
  d.bars.forEach(([name, v], i) => { const bx = L + slot * i + (slot - bw) / 2; s += `<rect x="${bx}" y="${y(v)}" width="${bw}" height="${Tp + ph - y(v)}" fill="var(--accent)"/>` + T(bx + bw / 2, y(v) - 9, num(v), `text-anchor="middle" fill="var(--text)" font-weight="700" ${FS(17)}`) + T(bx + bw / 2, Tp + ph + 27, name, `text-anchor="middle" fill="var(--text)" ${FS(16)}`); });
  s += `<line x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}" ${AX}/><line x1="${L}" x2="${L + pw}" y1="${Tp + ph}" y2="${Tp + ph}" ${AX}/>`;
  s += T(L + pw / 2, H - 16, 'Modo de juego', `text-anchor="middle" fill="var(--text)" ${FS(15)}`) + `<text transform="translate(22 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" fill="var(--text)" ${FS(15)}>Número de partidas</text>`;
  return s;
}

function barsH(d) {                     // matches per map (top 10)
  const W = 1000, H = 420, L = 190, R = 70, Tp = 14, B = 64, pw = W - L - R, ph = H - Tp - B, n = d.bars.length;
  const max = Math.max(...d.bars.map(b => b[1])), step = niceStep(max), xmax = Math.ceil(max / step) * step, x = v => L + v / xmax * pw, slot = ph / n, bh = slot * 0.62;
  let s = '';
  for (let v = 0; v <= xmax; v += step) s += `<line x1="${x(v)}" x2="${x(v)}" y1="${Tp}" y2="${Tp + ph}" ${GRID}/>` + T(x(v), Tp + ph + 22, v, `text-anchor="middle" fill="var(--dim)" ${FS(14)}`);
  d.bars.forEach(([name, v], i) => { const by = Tp + slot * i + (slot - bh) / 2; s += `<rect x="${L}" y="${by}" width="${x(v) - L}" height="${bh}" fill="var(--accent)"/>` + T(x(v) + 8, by + bh / 2 + 6, num(v), `fill="var(--text)" font-weight="700" ${FS(16)}`) + T(L - 10, by + bh / 2 + 5, name, `text-anchor="end" fill="var(--text)" ${FS(15)}`); });
  s += `<line x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}" ${AX}/><line x1="${L}" x2="${L + pw}" y1="${Tp + ph}" y2="${Tp + ph}" ${AX}/>`;
  s += T(L + pw / 2, H - 14, 'Número de partidas', `text-anchor="middle" fill="var(--text)" ${FS(15)}`) + `<text transform="translate(20 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" fill="var(--text)" ${FS(15)}>Mapa</text>`;
  return s;
}

function pieChart(d) {                  // share of matches by battle type and result
  const cx = 300, cy = 210, R = 172, total = d.slices.reduce((a, s) => a + s.n, 0), cols = ['var(--win)', 'var(--loss)', 'var(--accent)', 'var(--dim)'];
  let a0 = -Math.PI / 2, s = '';
  d.slices.forEach((sl, i) => {
    const a1 = a0 + sl.n / total * 2 * Math.PI, big = a1 - a0 > Math.PI ? 1 : 0, p = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r], [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [tx, ty] = p((a0 + a1) / 2, R * 0.64);
    s += `<path d="M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} Z" fill="${cols[i]}" stroke="var(--bg)" stroke-width="3"/>`;
    const small = sl.n / total < 0.08, mid = (a0 + a1) / 2, [ox, oy] = p(mid, R + 14);   // a narrow slice gets its label outside, in the text colour
    s += small ? T(ox, oy + 6, pct(sl.n, total), `text-anchor="${Math.cos(mid) >= 0 ? 'start' : 'end'}" fill="var(--text)" font-weight="700" ${FS(19)}`)
               : T(tx, ty + 6, pct(sl.n, total), `text-anchor="middle" fill="var(--bg)" font-weight="700" ${FS(19)}`);
    a0 = a1;
  });
  s += T(560, 110, 'Tipo de combate · resultado', `fill="var(--text)" font-weight="700" ${FS(16)}`);
  d.slices.forEach((sl, i) => { const y = 148 + i * 44; s += `<rect x="560" y="${y - 16}" width="22" height="22" fill="${cols[i]}"/>` + T(594, y, sl.name, `fill="var(--text)" ${FS(16)}`) + T(594, y + 20, `${num(sl.n)} partidas (${pct(sl.n, total)})`, `fill="var(--dim)" ${FS(14)}`); });
  s += T(560, 148 + d.slices.length * 44 + 20, `Total: ${num(total)} partidas = 100 %`, `fill="var(--text)" ${FS(15)}`);
  return s;
}

/* ---------------------------------------------------------------- page */
const table = rows => `<table>${rows.map((r, i) => `<tr>${r.map((c, j) => (i === 0 ? '<th' : '<td') + (j ? ' class="n"' : '') + '>' + esc(c) + (i === 0 ? '</th>' : '</td>')).join('')}</tr>`).join('')}</table>`;
const list = items => `<ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
function page(i, p, theme, chartSvg, d) {
  const vars = Object.entries({ bg: 'bg', panel: 'panel', 'panel-2': 'panel2', border: 'border', accent: 'accent', text: 'text', dim: 'dim', win: 'win', loss: 'loss' }).map(([css, k]) => `--${css}:${theme.colours[k]}`).join(';');
  return `<section class="page" style="${vars}">
  <div class="brief"><h1><span class="badge">Gráfico ${i + 1}</span> ${esc(p.title)}</h1><p>${esc(p.subtitle)}</p><p class="scope">Unidad de conteo: partidas (cada partida única, por ID de sesión). Muestra: ${num(d.total)} partidas únicas de ${num(d.pasted)} informes pegados (${num(d.repeated)} repetidos excluidos) · archivo ${esc(d.file)}.</p></div>
  <div class="chart"><svg viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(p.title)}">${chartSvg}</svg></div>
  <div class="cols">
    <div class="col"><h2>Datos exactos</h2>${table(p.table)}</div>
    <div class="col"><h2>Qué indica</h2>${list(p.reads)}</div>
    <div class="col"><h2>Cómo leerlo y qué no indica</h2>${list(p.limits)}</div>
  </div>
  <div class="caption">Gráfico ${i + 1}. ${esc(p.title)}. Fuente: elaboración propia con WT Session Readout, a partir de ${num(d.total)} partidas únicas de ${esc(d.file)}; los conteos son partidas, no puntos, tiempo ni Leones de Plata.</div>
  <div class="usage"><strong>Uso de este tipo de gráfico (${esc(p.kind)}).</strong> ${esc(p.use)}</div>
  <div class="foot"><span>Fuente: partidas jugadas en War Thunder.</span><span>Hecho con WT Session Readout · tema ${esc(theme.name)} · ${i + 1} de ${p.of}</span></div>
</section>`;
}

(async () => {
  const srv = await startServer({}), browser = await launch(), ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('wtSessionReadout.tutorialSeen.basic', 'true'); }); // no first-visit tour in the way
  const app = await ctx.newPage();
  await app.goto(srv.url + 'wt-log-analyzer.html'); await app.waitForFunction(() => window.__wtReady === true);
  await app.evaluate(t => { document.getElementById('input').value = t; }, fs.readFileSync(LOG, 'utf8'));
  await app.click('#analyzeBtn'); await app.waitForTimeout(800);
  const data = await app.evaluate(() => ({ pasted: lastMatches.all.length, matches: lastMatches.matches.map(m => ({ result: m.result, mode: m.mode, category: m.category, mission: m.mission })), presets: BUILTIN_PRESETS }));
  const M = data.matches, count = (f, k) => M.filter(f).reduce((a, m) => (a[k(m)] = (a[k(m)] || 0) + 1, a), {});
  const byMap = Object.entries(count(() => true, m => m.mission)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const radarMaps = byMap.slice(0, 8).map(([name]) => ({ name, w: M.filter(m => m.mission === name && m.result === 'Victory').length, l: M.filter(m => m.mission === name && m.result === 'Defeat').length }));
  const modes = Object.entries(count(() => true, m => m.mode)).sort((a, b) => b[1] - a[1]);
  const cats = [...new Set(M.map(m => m.category))].sort((a, b) => M.filter(m => m.category === b).length - M.filter(m => m.category === a).length);
  const slices = cats.flatMap(c => [['Victory', 'victoria'], ['Defeat', 'derrota']].map(([r, es]) => ({ name: `${c} · ${es}`, n: M.filter(m => m.category === c && m.result === r).length }))).filter(s => s.n > 0);
  const wins = M.filter(m => m.result === 'Victory').length, losses = M.length - wins, N = M.length;
  const d = { total: N, pasted: data.pasted, repeated: data.pasted - N, file: path.basename(LOG) };
  const share = (n, t = N) => `${num(n)} (${pct(n, t)})`;
  // facts for chart 1: running totals, biggest lead, longest streaks
  let w = 0, l = 0, lead = { v: -1e9, at: 0 }, run = 0, prev = '', sw = 0, sl = 0; const at = {};
  M.forEach((m, i) => { if (m.result === 'Victory') w++; else l++; if (w - l > lead.v) lead = { v: w - l, at: i + 1 }; if ([49, 99, 149].includes(i)) at[i + 1] = [w, l]; run = m.result === prev ? run + 1 : 1; prev = m.result; if (m.result === 'Victory') sw = Math.max(sw, run); else sl = Math.max(sl, run); });
  const cp = [50, 100, 150].map(k => [k, ...at[k]]);
  // facts for chart 2: the 8 maps
  const rm = radarMaps.map(m => ({ ...m, t: m.w + m.l })), rmTotal = rm.reduce((a, m) => a + m.t, 0);
  const best = rm.reduce((a, m) => (m.w / m.t > a.w / a.t ? m : a)), worst = rm.reduce((a, m) => (m.w / m.t < a.w / a.t ? m : a));
  const mostW = rm.reduce((a, m) => (m.w > a.w ? m : a));
  // facts for chart 4
  const top10 = byMap.slice(0, 10), top10n = top10.reduce((a, [, n]) => a + n, 0), tied8 = byMap.filter(([, n]) => n === top10[9][1]).length;
  // facts for chart 5
  const byCat = c => ({ n: M.filter(m => m.category === c).length, w: M.filter(m => m.category === c && m.result === 'Victory').length });
  const catFacts = cats.map(c => ({ c, ...byCat(c) }));
  const pages = [
    { kind: 'líneas', title: 'Evolución acumulada de victorias y derrotas', subtitle: 'Cuántas partidas ganadas y perdidas se han acumulado al avanzar por el registro',
      table: [['Hasta la partida n.º', 'Victorias', 'Derrotas'], ...cp.map(([k, a, b]) => [k, a, b]), [N, wins, losses]],
      reads: [`Se ganaron ${share(wins)} de las ${num(N)} partidas y se perdieron ${share(losses)}.`, `La ventaja máxima de victorias sobre derrotas fue de +${lead.v}, alcanzada en la partida n.º ${lead.at}; al final es de +${wins - losses}.`, `Racha más larga: ${sw} victorias seguidas; ${sl} derrotas seguidas.`, 'Una línea más empinada significa que ese resultado se acumuló más rápido en ese tramo.'],
      limits: ['Eje horizontal: posición de la partida en el registro (la primera pegada es la 1). No es una fecha: el registro no incluye fechas.', 'Eje vertical: total acumulado de partidas, no de la partida concreta.', 'Cada paso de una línea es exactamente una partida. Solo cuenta resultados: no dice nada de Leones de Plata, puntos de investigación ni duración.'],
      use: 'El gráfico de líneas sirve para ver cómo cambia una cantidad a lo largo de una secuencia ordenada: aquí, la secuencia de partidas del registro.', svg: lineChart({ order: M.map(m => m.result), wins, losses }) },
    { kind: 'araña o radar', title: 'Victorias y derrotas en los 8 mapas más jugados', subtitle: 'Partidas ganadas y perdidas en cada uno de los 8 mapas con más partidas',
      table: [['Mapa', 'Vict.', 'Derr.', 'Total', '% vict.'], ...rm.map(m => [m.name, m.w, m.l, m.t, pct(m.w, m.t)])],
      reads: [`Estos 8 mapas suman ${share(rmTotal)} de las ${num(N)} partidas; los otros ${byMap.length - 8} mapas suman ${share(N - rmTotal)}.`, `Más victorias: ${mostW.name} (${mostW.w}). Mayor porcentaje de victorias: ${best.name} (${pct(best.w, best.t)}, ${best.w} de ${best.t}). Menor: ${worst.name} (${pct(worst.w, worst.t)}, ${worst.w} de ${worst.t}).`, 'Un polígono verde más alejado del centro en un eje = más victorias en ese mapa; el rojo, más derrotas.'],
      limits: [`Cada eje es un mapa, de mayor a menor número de partidas en sentido horario desde arriba (los empates en el 8.º lugar se ordenan alfabéticamente). Los anillos cuentan partidas, de ${Math.max(1, Math.ceil(Math.max(...rm.flatMap(m => [m.w, m.l])) / 4))} en ${Math.max(1, Math.ceil(Math.max(...rm.flatMap(m => [m.w, m.l])) / 4))}.`, `Cada mapa tiene pocas partidas (entre ${Math.min(...rm.map(m => m.t))} y ${Math.max(...rm.map(m => m.t))}): los porcentajes cambian mucho con una sola partida, así que no son una medida fiable de «mapa bueno» o «mapa malo».`, 'El radar muestra la forma; los valores exactos están en la tabla.'],
      use: 'El gráfico de araña (radar) compara varias categorías con una misma escala desde un centro común y sirve para ver el «perfil» de cada serie. Funciona mejor con 5 a 8 ejes; no es adecuado para leer valores exactos.', svg: radarChart({ maps: radarMaps }) },
    { kind: 'barras verticales', title: 'Partidas por modo de juego', subtitle: 'Número de partidas de cada modo, tal como aparece en el registro',
      table: [['Modo de juego', 'Partidas', '% total'], ...modes.map(([n, v]) => [n, v, pct(v, N)]), ['Total', N, pct(N, N)]],
      reads: [`${modes[0][0]} es el modo más repetido: ${share(modes[0][1])}.`, `Los ${modes.length} modos suman ${num(modes.reduce((a, [, v]) => a + v, 0))} partidas, el total de la muestra.`, `«Tank Assault» aquí es el modo, y coincide con la categoría del mismo nombre de la herramienta.`],
      limits: ['La altura de cada barra es el número de partidas de ese modo (eje vertical, desde 0). El nombre del modo es el que figura entre corchetes en cada informe, sin traducir.', 'No dice quién ganó en cada modo, ni cuánto se ganó: solo cuántas partidas hay.'],
      use: 'Las barras verticales comparan cantidades entre pocas categorías con nombres cortos: la altura de cada barra es el valor y el cero siempre es la base.', svg: barsV({ bars: modes }) },
    { kind: 'barras horizontales', title: 'Los 10 mapas más jugados', subtitle: 'Número de partidas por mapa, ordenado de mayor a menor',
      table: [['Concepto', 'Partidas', '% total'], ['Los 10 mapas del gráfico', top10n, pct(top10n, N)], [`Los otros ${byMap.length - 10} mapas`, N - top10n, pct(N - top10n, N)], [`Mapas distintos en total`, byMap.length, '—']],
      reads: [`El mapa más jugado es ${top10[0][0]}, con ${top10[0][1]} partidas (${pct(top10[0][1], N)}).`, `Los 10 mapas del gráfico reúnen ${share(top10n)} de las ${num(N)} partidas.`, `${tied8} mapas empatan con ${top10[9][1]} partidas, el valor del último lugar: todos entran en el gráfico; entre iguales, el orden es alfabético.`],
      limits: ['La longitud de cada barra es el número de partidas en ese mapa (eje horizontal, desde 0); cada barra es un mapa (eje vertical).', 'El «mapa» es el nombre de la misión que figura en el informe. No indica resultado, puntos ni tiempo en cada mapa.'],
      use: 'Las barras horizontales son ideales cuando las categorías tienen nombres largos o son muchas, y permiten ordenarlas de mayor a menor para leer un ranking de un vistazo.', svg: barsH({ bars: top10 }) },
    { kind: 'circular', title: 'Reparto de las partidas por tipo de combate y resultado', subtitle: 'Qué parte de las partidas corresponde a cada combinación de tipo de combate y resultado',
      table: [['Grupo', 'Partidas', '% total'], ...slices.map(s => [s.name, s.n, pct(s.n, N)]), ['Total', N, pct(N, N)]],
      reads: [...catFacts.map(f => `${f.c}: ${num(f.n)} partidas, de las que se ganaron ${f.w} (${pct(f.w, f.n)}).`), `En conjunto: ${wins} victorias de ${N} partidas (${pct(wins, N)}).`],
      limits: ['Cada sector es una porción del total: todos los sectores suman las 206 partidas (100 %). Su tamaño es proporcional al número de partidas; el porcentaje está escrito dentro.', '«Random Battles» es la categoría que la herramienta asigna a toda partida cuyo modo no coincide con una regla (la regla por defecto es «Tank Assault»), no un modo concreto del juego.', 'No tiene ejes. No pondera por puntos, tiempo ni Leones de Plata.'],
      use: 'El gráfico circular muestra cómo se reparte un total en partes; solo conviene con pocas partes. No tiene ejes: cada sector es la porción del total.', svg: pieChart({ slices }) }
  ];
  pages.forEach(p => { p.of = pages.length; });
  const themes = PRESETS.map(id => data.presets.find(p => p.id === id));
  const css = `@page{size:297mm 210mm;margin:0}
html,body{margin:0!important;padding:0!important}
.page{width:297mm;height:210mm;box-sizing:border-box;overflow:hidden;break-after:page;page-break-after:always;display:flex;flex-direction:column;gap:2.4mm;padding:8mm 12mm 6mm;
  background-color:var(--bg);background-image:radial-gradient(var(--border) 1px,transparent 1px);background-size:24px 24px;background-position:-12px -12px;color:var(--text);font-family:'SF Mono',Consolas,Menlo,'Courier New',monospace;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page:last-child{break-after:auto;page-break-after:auto}
.page .brief{margin-bottom:0;flex:0 0 auto}.page .brief h1{font-size:1.2rem}
.chart{flex:1;min-height:0;background:var(--panel);border:1px solid var(--border);padding:6px}.chart svg{width:100%;height:100%;display:block}.chart svg text{font-family:inherit}
.page .brief p.scope{margin-top:3px;font-size:.68rem}
.cols{display:grid;grid-template-columns:1.1fr 1.25fr 1.25fr;gap:3mm}.col{background:var(--panel);border:1px solid var(--border);padding:5px 9px;font-size:.62rem;line-height:1.35;overflow:hidden}
.col h2{margin:0 0 3px;font-size:.66rem;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}.col ul{margin:0;padding-left:14px}.col li{margin:0 0 2px}
.col table{border-collapse:collapse;width:100%;font-size:.62rem}.col th,.col td{padding:1px 4px;text-align:left;border-bottom:1px solid var(--border)}.col th{color:var(--dim);font-weight:400}.col .n{text-align:right}
.caption{font-size:.62rem;color:var(--dim)}
.usage{font-size:.64rem;color:var(--text);border-left:3px solid var(--accent);padding:5px 12px;background:var(--panel)}
.foot{display:flex;justify-content:space-between;gap:12px;font-size:.66rem;color:var(--dim);border-top:1px solid var(--border);padding-top:5px}`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Gráficos de partidas — WT Session Readout</title><link rel="stylesheet" href="${srv.url}css/styles.css"><style>${css}</style></head><body>${pages.map((p, i) => page(i, p, themes[i], p.svg, d)).join('\n')}</body></html>`;
  const doc = await (await browser.newContext()).newPage();
  await doc.goto(srv.url + 'css/styles.css'); await doc.setContent(html, { waitUntil: 'load' });
  await doc.emulateMedia({ media: 'print' });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, await doc.pdf({ width: '297mm', height: '210mm', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true }));
  console.log(`Wrote ${path.relative(ROOT, OUT)} — ${M.length} unique matches (${data.pasted} pasted), themes: ${themes.map(t => t.name).join(', ')}`);
  await browser.close(); srv.close();
})();
