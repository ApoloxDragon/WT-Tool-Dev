#!/usr/bin/env node
/* Makes a chart report (PDF) in Spanish (default) or English (--en) from a sample log, using the tool itself.
 *
 *   node tools/make-chart-report.js [--en] [log file] [output.pdf]
 *   defaults: "example data/matches-large.txt"  ->  docs/examples/graficos-partidas-war-thunder.pdf
 *             with --en (English, watermarked as Apolox's data)  ->  docs/examples/war-thunder-match-charts.pdf
 *
 * Dev tool (needs Playwright + Chromium, like the tests; nothing here is shipped with the site, and nothing is sent anywhere).
 * Steps: open the real app, paste the log, click Analyze, and take the matches the tool itself counted (repeats removed).
 * Then draw five charts — line, radar, vertical bars, horizontal bars, pie — one per page, each page in the
 * built-in colour preset of the tool (all Blue, at the owner's request), using the tool's own stylesheet. Everything counted is MATCHES (partidas).
 * The page is exactly the paper size with no margin, so the theme covers the whole sheet (no white bars). */
const fs = require('fs'), path = require('path');
const { ROOT, startServer, launch } = require('../tests/harness');

const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const EN = process.argv.includes('--en');                                   // English edition (default: Spanish)
const t = (es, en) => (EN ? en : es);
const LOC = t('es-ES', 'en-US');
const LOG = path.resolve(ARGS[0] || path.join(ROOT, 'example data', 'matches-large.txt'));
const OUT = path.resolve(ARGS[1] || path.join(ROOT, 'docs', 'examples', t('graficos-partidas-war-thunder.pdf', 'war-thunder-match-charts.pdf')));
const WATERMARK = EN ? 'Data source: Apolox_Dragon on War Thunder' : '';   // the English edition is marked as the owner's data (their War Thunder username)
const PRESETS = ['blue', 'blue', 'blue', 'blue', 'blue'];                     // the tool's Blue theme on every page
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = n => n.toLocaleString(LOC);
const pct = (n, tot) => (n / tot * 100).toLocaleString(LOC, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + t(' %', '%');
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
  s += T(x(n) + 8, y(d.wins) + 5, t(`${d.wins} victorias`, `${d.wins} victories`), `fill="var(--win)" font-weight="700" ${FS(15)}`) + T(x(n) + 8, y(d.losses) + 5, t(`${d.losses} derrotas`, `${d.losses} defeats`), `fill="var(--loss)" font-weight="700" ${FS(15)}`);
  s += T(L + pw / 2, H - 14, t('Número de partida (orden en el registro)', 'Match number (order in the log)'), `text-anchor="middle" fill="var(--text)" ${FS(15)}`);
  s += `<text transform="translate(20 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" fill="var(--text)" ${FS(15)}>${t('Partidas acumuladas', 'Cumulative matches')}</text>`;
  s += `<rect x="${L + 18}" y="${Tp + 12}" width="26" height="4" fill="var(--win)"/>` + T(L + 52, Tp + 18, t('Victorias acumuladas', 'Cumulative victories'), `fill="var(--text)" ${FS(14)}`) + `<rect x="${L + 18}" y="${Tp + 36}" width="26" height="4" fill="var(--loss)"/>` + T(L + 52, Tp + 42, t('Derrotas acumuladas', 'Cumulative defeats'), `fill="var(--text)" ${FS(14)}`);
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
  s += `<rect x="770" y="130" width="26" height="14" fill="var(--win)"/>` + T(806, 142, t('Victorias', 'Victories'), `fill="var(--text)" ${FS(15)}`) + `<rect x="770" y="158" width="26" height="14" fill="var(--loss)"/>` + T(806, 170, t('Derrotas', 'Defeats'), `fill="var(--text)" ${FS(15)}`);
  t(['Cada eje es un mapa.', 'Escala radial: número', 'de partidas (anillos', `de ${step} en ${step}).`], ['Each axis is a map.', 'Radial scale: number', 'of matches (rings every', `${step}).`]).forEach((ln, k) => { s += T(770, 212 + k * 22, ln, `fill="var(--dim)" ${FS(14)}`); });
  return s;
}

function barsV(d) {                     // matches per game mode
  const W = 1000, H = 420, L = 84, R = 30, Tp = 30, B = 76, pw = W - L - R, ph = H - Tp - B, n = d.bars.length;
  const step = niceStep(Math.max(...d.bars.map(b => b[1]))), ymax = Math.ceil(Math.max(...d.bars.map(b => b[1])) / step) * step, y = v => Tp + ph - v / ymax * ph, slot = pw / n, bw = slot * 0.5;
  let s = '';
  for (let v = 0; v <= ymax; v += step) s += `<line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" ${GRID}/>` + T(L - 10, y(v) + 5, v, `text-anchor="end" fill="var(--dim)" ${FS(14)}`);
  d.bars.forEach(([name, v], i) => { const bx = L + slot * i + (slot - bw) / 2; s += `<rect x="${bx}" y="${y(v)}" width="${bw}" height="${Tp + ph - y(v)}" fill="var(--accent)"/>` + T(bx + bw / 2, y(v) - 9, num(v), `text-anchor="middle" fill="var(--text)" font-weight="700" ${FS(17)}`) + T(bx + bw / 2, Tp + ph + 27, name, `text-anchor="middle" fill="var(--text)" ${FS(16)}`); });
  s += `<line x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}" ${AX}/><line x1="${L}" x2="${L + pw}" y1="${Tp + ph}" y2="${Tp + ph}" ${AX}/>`;
  s += T(L + pw / 2, H - 16, t('Modo de juego', 'Game mode'), `text-anchor="middle" fill="var(--text)" ${FS(15)}`) + `<text transform="translate(22 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" fill="var(--text)" ${FS(15)}>${t('Número de partidas', 'Number of matches')}</text>`;
  return s;
}

function barsH(d) {                     // matches per map (top 10)
  const W = 1000, H = 420, L = 190, R = 70, Tp = 14, B = 64, pw = W - L - R, ph = H - Tp - B, n = d.bars.length;
  const max = Math.max(...d.bars.map(b => b[1])), step = niceStep(max), xmax = Math.ceil(max / step) * step, x = v => L + v / xmax * pw, slot = ph / n, bh = slot * 0.62;
  let s = '';
  for (let v = 0; v <= xmax; v += step) s += `<line x1="${x(v)}" x2="${x(v)}" y1="${Tp}" y2="${Tp + ph}" ${GRID}/>` + T(x(v), Tp + ph + 22, v, `text-anchor="middle" fill="var(--dim)" ${FS(14)}`);
  d.bars.forEach(([name, v], i) => { const by = Tp + slot * i + (slot - bh) / 2; s += `<rect x="${L}" y="${by}" width="${x(v) - L}" height="${bh}" fill="var(--accent)"/>` + T(x(v) + 8, by + bh / 2 + 6, num(v), `fill="var(--text)" font-weight="700" ${FS(16)}`) + T(L - 10, by + bh / 2 + 5, name, `text-anchor="end" fill="var(--text)" ${FS(15)}`); });
  s += `<line x1="${L}" x2="${L}" y1="${Tp}" y2="${Tp + ph}" ${AX}/><line x1="${L}" x2="${L + pw}" y1="${Tp + ph}" y2="${Tp + ph}" ${AX}/>`;
  s += T(L + pw / 2, H - 14, t('Número de partidas', 'Number of matches'), `text-anchor="middle" fill="var(--text)" ${FS(15)}`) + `<text transform="translate(20 ${Tp + ph / 2}) rotate(-90)" text-anchor="middle" fill="var(--text)" ${FS(15)}>${t('Mapa', 'Map')}</text>`;
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
  s += T(560, 110, t('Tipo de combate · resultado', 'Battle type · result'), `fill="var(--text)" font-weight="700" ${FS(16)}`);
  d.slices.forEach((sl, i) => { const y = 148 + i * 44; s += `<rect x="560" y="${y - 16}" width="22" height="22" fill="${cols[i]}"/>` + T(594, y, sl.name, `fill="var(--text)" ${FS(16)}`) + T(594, y + 20, t(`${num(sl.n)} partidas (${pct(sl.n, total)})`, `${num(sl.n)} matches (${pct(sl.n, total)})`), `fill="var(--dim)" ${FS(14)}`); });
  s += T(560, 148 + d.slices.length * 44 + 20, t(`Total: ${num(total)} partidas = 100 %`, `Total: ${num(total)} matches = 100%`), `fill="var(--text)" ${FS(15)}`);
  return s;
}

/* ---------------------------------------------------------------- page */
const table = rows => `<table>${rows.map((r, i) => `<tr>${r.map((c, j) => (i === 0 ? '<th' : '<td') + (j ? ' class="n"' : '') + '>' + esc(c) + (i === 0 ? '</th>' : '</td>')).join('')}</tr>`).join('')}</table>`;
const list = items => `<ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
const wm = () => (WATERMARK ? `<div class="wm">${esc(WATERMARK)}</div>` : '');
function page(i, p, theme, chartSvg, d) {
  const vars = Object.entries({ bg: 'bg', panel: 'panel', 'panel-2': 'panel2', border: 'border', accent: 'accent', text: 'text', dim: 'dim', win: 'win', loss: 'loss' }).map(([css, k]) => `--${css}:${theme.colours[k]}`).join(';');
  return `<section class="page" style="${vars}">
  <div class="brief"><h1><span class="badge">${t('Gráfico', 'Chart')} ${i + 1}</span> ${esc(p.title)}</h1><p>${esc(p.subtitle)}</p><p class="scope">${t(`Unidad de conteo: partidas (cada partida única, por ID de sesión). Muestra: ${num(d.total)} partidas únicas de ${num(d.pasted)} informes pegados (${num(d.repeated)} repetidos excluidos) · archivo ${esc(d.file)}. Enfoque: Random Battles (${num(d.rb)} partidas; Tank Assault: ${num(d.ta)}).${p.rb ? ` ESTE GRÁFICO: solo Random Battles (${num(d.rb)} de ${num(d.total)}); Tank Assault no está incluido.` : ' Este gráfico incluye Random Battles y Tank Assault.'}`, `Counting unit: matches (each unique match, by session ID). Sample: ${num(d.total)} unique matches from ${num(d.pasted)} pasted reports (${num(d.repeated)} repeats excluded) · file ${esc(d.file)}. Focus: Random Battles (${num(d.rb)} matches; Tank Assault: ${num(d.ta)}).${p.rb ? ` THIS CHART: Random Battles only (${num(d.rb)} of ${num(d.total)}); Tank Assault is not included.` : ' This chart includes Random Battles and Tank Assault.'}`)}</p></div>
  <div class="chart"><svg viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(p.title)}">${chartSvg}</svg></div>
  <div class="cols">
    <div class="col"><h2>${t('Datos exactos', 'Exact data')}</h2>${table(p.table)}</div>
    <div class="col"><h2>${t('Qué indica', 'What it shows')}</h2>${list(p.reads)}</div>
    <div class="col"><h2>${t('Cómo leerlo y qué no indica', 'How to read it and what it does not show')}</h2>${list(p.limits)}</div>
  </div>
  <div class="caption">${t(`Gráfico ${i + 1}. ${esc(p.title)}. Fuente: elaboración propia con WT Session Readout, a partir de ${num(p.rb ? d.rb : d.total)} partidas únicas${p.rb ? ' de Random Battles' : ''} de ${esc(d.file)}; los conteos son partidas, no puntos, tiempo ni Leones de Plata.`, `Chart ${i + 1}. ${esc(p.title)}. Source: own work made with WT Session Readout, from ${num(p.rb ? d.rb : d.total)} unique${p.rb ? ' Random Battles' : ''} matches in ${esc(d.file)}; counts are matches, not points, time or Silver Lions.`)}</div>
  <div class="usage"><strong>${t('Uso de este tipo de gráfico', 'When to use this chart type')} (${esc(p.kind)}).</strong> ${esc(p.use)}</div>
  <div class="foot"><span>${t('Fuente: partidas jugadas en War Thunder.', 'Source: matches played in War Thunder.')}</span><span>${t('Hecho con WT Session Readout · tema', 'Made with WT Session Readout · theme')} ${esc(theme.name)} · ${i + 1} ${t('de', 'of')} ${p.of}</span></div>
  ${wm()}
</section>`;
}

/* ---------------------------------------------------------------- glossary pages (in Spanish) */
// ✔ = the Spanish name is confirmed in War Thunder's own Spanish pages; ≈ = descriptive translation (not checked against the Spanish game client).
const OK = '✔', APPROX = '≈';
const MODES = { 'Domination': 'Dominación', 'Tank Assault': 'Asalto de tanques', 'Conquest': 'Conquista', 'Battle': 'Batalla' };
const SECTIONS = {
  'Activity Time': ['Tiempo de actividad', 'Tiempo en el que se estuvo activo en la partida'], 'Time Played': ['Tiempo jugado', 'Duración jugada con cada vehículo'],
  'Damage to the enemy': ['Daño al enemigo', 'Recompensas por el daño causado'], 'Critical damage to the enemy': ['Daño crítico al enemigo', 'Recompensas por daños críticos'], 'Severe damage to the enemy': ['Daño grave al enemigo', 'Recompensas por daños graves'],
  'Awards': ['Premios', 'Condecoraciones de la partida (ver lista de premios)'], 'Reward for winning': ['Recompensa por ganar', 'Recompensa por la victoria'], 'Reward for participating in the mission': ['Recompensa por participar en la misión', 'Recompensa por participar en la misión'],
  'Destruction of ground targets': ['Destrucción de objetivos terrestres', 'Recompensas por destruir vehículos o blancos en tierra'], 'Destruction of aircraft': ['Destrucción de aeronaves', 'Recompensas por derribar aviones'],
  'Scouting of the enemy': ['Reconocimiento del enemigo', 'Recompensas por detectar enemigos'], 'Damage taken by scouted enemies': ['Daño recibido por enemigos detectados', 'Por el daño que otros hacen a enemigos que se detectaron'], 'Destruction by allies of scouted enemies': ['Destrucción, por aliados, de enemigos detectados', 'Por enemigos detectados que luego destruyen los aliados'],
  'Assistance in destroying the enemy': ['Asistencia en la destrucción del enemigo', 'Recompensas por ayudar a destruir enemigos'], 'Capture of zones': ['Captura de zonas', 'Recompensas por capturar zonas'],
  'Skill Bonus': ['Bonificación por habilidad', 'Bonificación ligada al nivel de habilidad'], 'Automatic repair of all vehicles free.': ['Reparación automática gratuita de todos los vehículos', 'Aviso de que la reparación no tuvo coste'], 'Munitions eliminations': ['Eliminación de municiones', 'Sección poco frecuente; se muestra con el nombre del registro']
};
const AWARDS = { 'Tank Rescuer': 'Rescatador de tanques', 'Intelligence': 'Inteligencia', 'Teamwork': 'Trabajo en equipo', 'Adamant': 'Inquebrantable', 'Avenger': 'Vengador', 'Help with Repairing': 'Ayuda con las reparaciones', 'According to Intelligence': 'Según la inteligencia', 'Multi strike!': '¡Golpe múltiple!', 'The Best Squad': 'El mejor escuadrón', 'Eye for Eye': 'Ojo por ojo', 'Rank does not matter': 'El rango no importa', 'Supporting Fire': 'Fuego de apoyo', 'Shadow strike streak!': '¡Racha de golpes en la sombra!', 'Professional': 'Profesional', 'Without a miss': 'Sin fallar', 'Base capturer streak!': '¡Racha de captura de bases!', 'Sniper': 'Francotirador', 'Assists streak!': '¡Racha de asistencias!', 'On Hand': 'A mano', 'Final blow!': '¡Golpe final!', 'Base defender!': '¡Defensor de la base!', 'Balancer': 'Equilibrador', 'First strike!': '¡Primer golpe!', 'God Mode!': '¡Modo dios!', 'Wingman': 'Escolta' };
const MAPS = { 'Ardennes': 'Ardenas', 'Sinai': 'Sinaí', 'Japan': 'Japón', 'Cargo port': 'Puerto de carga', 'Port Novorossiysk': 'Puerto de Novorosíisk', 'Tunisia': 'Túnez', 'Maginot Line': 'Línea Maginot', 'Middle East': 'Oriente Medio', 'Iberian Castle': 'Castillo ibérico', 'American Desert': 'Desierto americano', 'Aral Sea': 'Mar de Aral', 'Normandy': 'Normandía', 'Abandoned Town': 'Pueblo abandonado', 'Carpathians': 'Cárpatos', 'North Holland': 'Holanda del Norte', 'Fields of Normandy': 'Campos de Normandía', 'Finland': 'Finlandia', 'Battle of Hürtgen Forest': 'Batalla del bosque de Hürtgen', 'Second battle of El Alamein': 'Segunda batalla de El Alamein', 'Eastern Europe': 'Europa del Este', 'Test Site-2271': 'Polígono de pruebas 2271', 'Golden Quarry': 'Cantera dorada', 'Attica': 'Ática', 'Sweden': 'Suecia', 'Arctic. Polar Base': 'Ártico. Base polar', 'Red Desert': 'Desierto rojo', 'Poland (winter)': 'Polonia (invierno)', 'Sands of Sinai': 'Arenas del Sinaí', 'Surroundings of Volokolamsk': 'Alrededores de Volokolamsk', 'Abandoned Factory': 'Fábrica abandonada', 'Abandoned factory': 'Fábrica abandonada', 'Maginot Line (winter)': 'Línea Maginot (invierno)', 'Ardennes (winter)': 'Ardenas (invierno)', 'European Province': 'Provincia europea', 'Arctic. Pier': 'Ártico. Muelle', 'Spaceport': 'Cosmódromo', 'Seversk-13 (winter)': 'Seversk-13 (invierno)', 'Jungle': 'Selva', 'Fields of Poland (winter)': 'Campos de Polonia (invierno)', 'Fields of Poland': 'Campos de Polonia', 'Flanders': 'Flandes', 'Poland': 'Polonia', 'Karelia': 'Carelia', 'Advance to the Rhine': 'Avance hacia el Rin', 'Stalingrad': 'Stalingrado' };
const SAME = new Set(['Mozdok', 'Fulda', 'Kursk', 'Campania', 'Sun City', 'Alaska', 'Darwin Hill', 'Vietnam', 'Breslau', 'Seversk-13', 'Pradesh']);  // proper names left as they are

function glossPages(d, data) {
  const N = d.total, row = (cells) => cells, byCount = o => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maps = byCount(data.mapCounts), secs = byCount(data.secs).map(([n, c]) => [n, c]), evs = byCount(data.evs);
  const pages = [];
  // 1 — the terms of this report
  pages.push({ title: 'Cómo leer este informe: qué significa cada término', sub: 'Definiciones de las palabras y medidas que aparecen en los gráficos', cols: 2, blocks: [
    { h: 'Qué se cuenta y de dónde sale', head: ['Término', 'Qué significa en este informe'], rows: [
      ['Partida', 'Una batalla jugada, tal como figura en un informe del registro. Es la unidad de todos los conteos de este documento.'],
      ['Informe pegado', `Cada bloque de texto de una partida que se pegó en la herramienta (${num(d.pasted)} en total).`],
      ['Partida única', `Partida contada una sola vez, identificada por su ID de sesión (${num(N)} en total).`],
      ['Partida repetida', `Informe cuyo ID de sesión ya se había contado; no se cuenta otra vez (${num(d.repeated)} en total).`],
      ['ID de sesión', 'Código único que acompaña a cada partida en la línea «Session» del informe.'],
      ['Muestra', `Conjunto de partidas analizado: ${num(N)} partidas únicas del archivo ${d.file}, partidas jugadas por el propietario del proyecto (Apolox). El enfoque es Random Battles (${num(d.rb)} partidas); Tank Assault (${num(d.ta)}) está en los gráficos generales y queda fuera de los dos gráficos de mapas (y de los mapas de este glosario).`],
      ['Orden en el registro', 'Posición en la que aparecen las partidas pegadas (la primera es la 1). No es una fecha: el registro no incluye fechas.'],
      ['Victoria / Derrota', 'Resultado de la partida según el encabezado del informe («Victory» / «Defeat»).'] ] },
    { h: 'Cómo se calculan las medidas', head: ['Término', 'Qué significa en este informe'], rows: [
      ['Porcentaje (%)', 'Partidas del grupo ÷ partidas de referencia × 100. La referencia se indica en cada tabla: «% total» es sobre todas las partidas únicas; «% vict.» es victorias ÷ partidas de ese mapa.'],
      ['Acumulado', 'Suma progresiva: cada punto de la línea incluye todas las partidas anteriores.'],
      ['Ventaja', 'Victorias acumuladas menos derrotas acumuladas.'],
      ['Racha', 'Partidas consecutivas con el mismo resultado.'],
      ['Modo de juego', 'Texto entre corchetes del encabezado del informe (por ejemplo Domination).'],
      ['Tipo de combate (categoría)', 'Grupo que asigna la herramienta según el modo: «Tank Assault» si el modo lo contiene (regla por defecto); todo lo demás es «Random Battles» (batallas aleatorias).'],
      ['Mapa', 'Nombre de la misión en el encabezado del informe.'],
      ['Tema Blue', 'Uno de los 8 temas de color de la herramienta; define los colores de todo el documento.'] ] },
    { h: 'Cómo se leen los gráficos', head: ['Elemento', 'Qué significa'], rows: [
      ['Eje horizontal / vertical', 'Líneas con marcas numeradas. En cada gráfico, el título del eje dice qué mide y en qué unidad (siempre partidas, salvo en el gráfico 1: posición en el registro).'],
      ['Líneas (gráfico 1)', 'Muestra cómo cambia una cantidad en una secuencia ordenada; más empinada = más rápido se acumula.'],
      ['Araña o radar (gráfico 2)', 'Cada eje sale de un centro común y representa un mapa; los anillos son la escala en partidas; cada color es una serie.'],
      ['Barras (gráficos 3 y 4)', 'La longitud de la barra es el número de partidas; siempre parte de 0.'],
      ['Circular (gráfico 5)', 'Cada sector es una parte del total (100 %); no tiene ejes.'] ] },
    { h: 'Qué no mide este informe', head: ['Dato', 'Estado'], rows: [
      ['Leones de Plata (SL) y puntos de investigación (RP)', 'No se grafican: todos los conteos son partidas.'],
      ['Tiempo de juego y fechas', 'No se grafican; el registro no trae fechas.'],
      ['Vehículos y premios', 'Solo se enumeran en el glosario con su frecuencia; no se graficaron.'],
      ['Nombres de vehículos (TAM 2C, Leopard 2K…)', 'Son nombres propios y no se traducen.'] ] }
  ] });
  // 2 — War Thunder terms: economy and the log
  pages.push({ title: 'Glosario de War Thunder (1): economía y líneas del registro', sub: `${OK} confirmado en las páginas oficiales en español de War Thunder · ${APPROX} traducción descriptiva, no comprobada con el cliente del juego en español`, cols: 2, blocks: [
    { h: 'Economía', head: ['En el registro', 'En español', '', 'Qué significa'], rows: [
      ['SL (Silver Lions)', 'Leones de Plata', OK, 'Moneda principal del juego: se usa para comprar vehículos, tripulaciones y módulos, reparar y reponer munición.'],
      ['RP (Research Points)', 'Puntos de investigación', OK, 'Puntos para investigar nuevos vehículos y módulos.'],
      ['CRP', 'CRP (sigla del registro)', APPROX, 'Cifra de la línea «Total» que la herramienta usa como los puntos de investigación de la partida. No se desarrolla la sigla porque no se ha podido confirmar; la cifra final «RP» del registro suma además el progreso de investigación, por eso no se usa.'],
      ['Net SL / Earned SL', 'SL netos / SL ganados', APPROX, 'Neto = ganado menos los costes (reparación, munición y tripulación, reapariciones). Definición de la herramienta.'],
      ['PA (premium account)', 'Cuenta premium', OK, 'Cuenta de pago que aumenta lo que se gana; el registro la desglosa como «(PA)».'],
      ['Booster', 'Potenciador', APPROX, 'Bonificación temporal; el registro la desglosa como «(Booster)».'],
      ['mission points', 'Puntos de misión', OK, 'Puntos que se suman a la puntuación de la misión; aparecen junto a cada evento.'] ] },
    { h: 'Costes y cierre del informe', head: ['En el registro', 'En español', '', 'Qué significa'], rows: [
      ['Automatic repair', 'Reparación automática', APPROX, 'Coste de reparar los vehículos tras la partida.'],
      ['Ammo & crew replenishment', 'Munición y reposición de tripulación', APPROX, 'Coste de reponer munición y tripulantes.'],
      ['Respawns in battle', 'Reapariciones en la batalla', APPROX, 'Coste de volver a aparecer en la misma partida.'],
      ['Researched unit', 'Unidad investigada', APPROX, 'RP que fueron a desbloquear un vehículo nuevo («objetivo de investigación»).'],
      ['Researching progress', 'Progreso de investigación', APPROX, 'RP que fueron a módulos o progreso de otro vehículo («Otros RP»).'],
      ['Used items', 'Objetos usados', APPROX, 'Consumibles y objetos gastados en la partida.'],
      ['Session', 'Sesión', APPROX, 'Línea con el ID de sesión, único por partida.'],
      ['Total', 'Total', APPROX, 'Línea final con los SL, CRP y RP de la partida.'],
      ['Activity', 'Actividad', APPROX, 'Porcentaje de actividad que informa el juego (global o por vehículo).'],
      ['Skill Bonus', 'Bonificación por habilidad', APPROX, 'RP extra ligados al nivel de habilidad del vehículo.'],
      ['damaged / backup', 'dañado / de reserva', APPROX, 'Etiquetas que el registro pone a un vehículo dañado o de reserva.'] ] }
  ] });
  // 3 — sections and modes
  const secRows = secs.map(([n, c]) => { const t = SECTIONS[n]; return [n, t ? t[0] : '(sin traducir)', APPROX, t ? t[1] : '', `${num(c)} de ${num(N)}`]; });
  pages.push({ title: 'Glosario de War Thunder (2): secciones del informe, modos y tipos de combate', sub: 'Las secciones agrupan las recompensas de cada partida; el recuento indica en cuántas de las partidas únicas aparece', cols: 2, blocks: [
    { h: 'Secciones de recompensa del informe', head: ['En el registro', 'En español', '', 'Qué agrupa', 'Partidas'], rows: secRows },
    { h: 'Modos de juego y tipos de combate', head: ['En el registro', 'En español', '', 'Partidas'], rows: [
      ...Object.keys(MODES).filter(m => data.modeCounts[m]).map(m => [m, MODES[m], APPROX, num(data.modeCounts[m])]),
      ...Object.keys(data.modeCounts).filter(m => !MODES[m]).map(m => [m, '(sin traducir)', APPROX, num(data.modeCounts[m])]),
      ['Random Battles (categoría)', 'Batallas aleatorias', APPROX, num(data.catCounts['Random Battles'] || 0)],
      ['Tank Assault (categoría)', 'Asalto de tanques', APPROX, num(data.catCounts['Tank Assault'] || 0)] ] }
  ] });
  // 4 — awards
  const awRows = evs.map(([n, c]) => [n, AWARDS[n] || '(sin traducir)', APPROX, num(c)]);
  pages.push({ title: 'Glosario de War Thunder (3): premios del informe', sub: `Premios que aparecen en las partidas de la muestra, de más a menos frecuentes (apariciones = veces que figura el premio, no partidas)`, cols: 2, blocks: [
    { h: 'Premios', head: ['En el registro', 'En español', '', 'Apariciones'], rows: awRows.slice(0, Math.ceil(awRows.length / 2)) },
    { h: 'Premios (continuación)', head: ['En el registro', 'En español', '', 'Apariciones'], rows: awRows.slice(Math.ceil(awRows.length / 2)) },
    { h: 'Nota', head: ['Sobre los premios', ''], rows: [['Condición exacta', 'La condición para ganar cada premio la define el juego; aquí solo se indica su nombre y cuántas veces aparece.'], ['«Ayuda con las reparaciones»', 'Corresponde a ayudar a un aliado a reparar su vehículo; el resto se identifica por su nombre.']] }
  ] });
  // 5 — maps
  const mapRows = maps.map(([n, c]) => [n, MAPS[n] || (SAME.has(n) ? n + ' (nombre propio)' : '(sin traducir)'), num(c), pct(c, N)]);
  const third = Math.ceil(mapRows.length / 3);
  pages.push({ title: 'Glosario de War Thunder (4): mapas', sub: `${mapRows.length} mapas distintos en la muestra, ordenados por número de partidas (${APPROX} traducciones descriptivas; los nombres propios se dejan igual)`, cols: 3, blocks: [0, 1, 2].map(k => ({ h: k === 0 ? 'Mapas' : 'Mapas (continuación)', head: ['En el registro', 'En español', 'Partidas', '%'], rows: mapRows.slice(k * third, (k + 1) * third) })) });
  return pages;
}

function glossPagesEn(d, data) {
  const N = d.total, byCount = o => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maps = byCount(data.mapCounts), secs = byCount(data.secs), evs = byCount(data.evs);
  const SEC_EN = { 'Activity Time': 'Time during which you were active in the match', 'Time Played': 'Time played with each vehicle', 'Damage to the enemy': 'Rewards for damage dealt', 'Critical damage to the enemy': 'Rewards for critical damage', 'Severe damage to the enemy': 'Rewards for severe damage', 'Awards': 'Medals of the match (see the awards list)', 'Reward for winning': 'Reward for the victory', 'Reward for participating in the mission': 'Reward for taking part in the mission', 'Destruction of ground targets': 'Rewards for destroying ground vehicles or targets', 'Destruction of aircraft': 'Rewards for shooting down aircraft', 'Scouting of the enemy': 'Rewards for spotting enemies', 'Damage taken by scouted enemies': 'For damage others deal to enemies you spotted', 'Destruction by allies of scouted enemies': 'For spotted enemies later destroyed by allies', 'Assistance in destroying the enemy': 'Rewards for helping destroy enemies', 'Capture of zones': 'Rewards for capturing zones', 'Skill Bonus': 'Bonus tied to skill level', 'Automatic repair of all vehicles free.': 'Notice that the repair had no cost', 'Munitions eliminations': 'Rare section; shown under its log name' };
  const pages = [];
  pages.push({ title: 'How to read this report: what each term means', sub: 'Definitions of the words and measures used in the charts', cols: 2, blocks: [
    { h: 'What is counted and where it comes from', head: ['Term', 'What it means in this report'], rows: [
      ['Match', 'One battle played, as it appears in one report of the log. It is the unit of every count in this document.'],
      ['Pasted report', `Each block of text for one match that was pasted into the tool (${num(d.pasted)} in total).`],
      ['Unique match', `A match counted only once, identified by its session ID (${num(N)} in total).`],
      ['Repeated match', `A report whose session ID had already been counted; it is not counted again (${num(d.repeated)} in total).`],
      ['Session ID', 'The unique code that goes with each match on the "Session" line of the report.'],
      ['Sample', `The set of matches analysed: ${num(N)} unique matches from the file ${d.file}, matches played by the project owner (Apolox). The focus is Random Battles (${num(d.rb)} matches); Tank Assault (${num(d.ta)}) is in the overall charts and left out of the two map charts (and of the maps in this glossary).`],
      ['Order in the log', 'The position in which the pasted matches appear (the first is 1). It is not a date: the log has no dates.'],
      ['Victory / Defeat', 'Result of the match according to the report headline ("Victory" / "Defeat").'] ] },
    { h: 'How the measures are calculated', head: ['Term', 'What it means in this report'], rows: [
      ['Percentage (%)', 'Matches in the group ÷ reference matches × 100. The reference is stated in each table: "% total" is over all unique matches; "% wins" is victories ÷ matches on that map.'],
      ['Cumulative', 'A running sum: each point on the line includes all the earlier matches.'],
      ['Lead', 'Cumulative victories minus cumulative defeats.'],
      ['Streak', 'Consecutive matches with the same result.'],
      ['Game mode', 'The text in square brackets in the report headline (for example Domination).'],
      ['Battle type (category)', 'A group the tool assigns from the mode: "Tank Assault" if the mode contains it (the default rule); everything else is "Random Battles".'],
      ['Map', 'The mission name in the report headline.'],
      ['Blue theme', 'One of the tool\'s 8 colour themes; it sets the colours of the whole document.'] ] },
    { h: 'How to read the charts', head: ['Element', 'What it means'], rows: [
      ['Horizontal / vertical axis', 'Lines with numbered marks. In each chart the axis title says what it measures and in what unit (always matches, except chart 1: position in the log).'],
      ['Line (chart 1)', 'Shows how a quantity changes along an ordered sequence; steeper = it piles up faster.'],
      ['Radar or spider (chart 2)', 'Each axis leaves a common centre and stands for a map; the rings are the scale in matches; each colour is a series.'],
      ['Bars (charts 3 and 4)', 'The length of the bar is the number of matches; it always starts at 0.'],
      ['Pie (chart 5)', 'Each slice is a part of the total (100%); it has no axes.'] ] },
    { h: 'What this report does not measure', head: ['Item', 'Status'], rows: [
      ['Silver Lions (SL) and research points (RP)', 'Not charted: every count is matches.'],
      ['Play time and dates', 'Not charted; the log has no dates.'],
      ['Vehicles and awards', 'Only listed in the glossary with their frequency; not charted.'],
      ['Vehicle names (TAM 2C, Leopard 2K…)', 'They are proper names.'] ] }
  ] });
  pages.push({ title: 'War Thunder glossary (1): economy and log lines', sub: 'Terms as they appear in the log (the game\'s own English names); the meanings are explanations written for this report', cols: 2, blocks: [
    { h: 'Economy', head: ['In the log', 'What it means'], rows: [
      ['SL (Silver Lions)', 'The game\'s main currency: used to buy vehicles, crews and modules, to repair, and to restock ammunition.'],
      ['RP (Research Points)', 'Points used to research new vehicles and modules.'],
      ['CRP', 'Figure on the "Total" line that the tool uses as the match\'s research points. The abbreviation is not expanded because that could not be confirmed; the final "RP" figure of the log also adds research progress, which is why it is not used.'],
      ['Net SL / Earned SL', 'Net = earned minus costs (repair, ammunition and crew, respawns). Definition used by the tool.'],
      ['PA (premium account)', 'A paid account that increases what you earn; the log breaks it out as "(PA)".'],
      ['Booster', 'A temporary bonus; the log breaks it out as "(Booster)".'],
      ['mission points', 'Points added to the mission score; they appear next to each event.'] ] },
    { h: 'Costs and the end of the report', head: ['In the log', 'What it means'], rows: [
      ['Automatic repair', 'Cost of repairing the vehicles after the match.'],
      ['Ammo & crew replenishment', 'Cost of restocking ammunition and crew members.'],
      ['Respawns in battle', 'Cost of spawning again in the same match.'],
      ['Researched unit', 'RP that went to unlocking a new vehicle (a "research target").'],
      ['Researching progress', 'RP that went to modules or progress on another vehicle ("Other RP").'],
      ['Used items', 'Consumables and items spent in the match.'],
      ['Session', 'Line with the session ID, unique per match.'],
      ['Total', 'Final line with the match\'s SL, CRP and RP.'],
      ['Activity', 'Activity percentage reported by the game (overall or per vehicle).'],
      ['Skill Bonus', 'Extra RP tied to the vehicle\'s skill level.'],
      ['damaged / backup', 'Tags the log puts on a damaged or reserve vehicle.'] ] }
  ] });
  pages.push({ title: 'War Thunder glossary (2): report sections, game modes and battle types', sub: 'Sections group the rewards of each match; the count shows in how many of the unique matches each one appears', cols: 2, blocks: [
    { h: 'Reward sections of the report', head: ['In the log', 'What it groups', 'Matches'], w: [34, 46, 20], rows: secs.map(([n, c]) => [n, SEC_EN[n] || '', `${num(c)} of ${num(N)}`]) },
    { h: 'Game modes and battle types', head: ['In the log', 'Matches'], w: [70, 30], rows: [
      ...Object.keys(data.modeCounts).sort((a, b) => data.modeCounts[b] - data.modeCounts[a]).map(m => [m + ' (mode)', num(data.modeCounts[m])]),
      ...['Random Battles', 'Tank Assault'].map(c => [c + ' (category)', num(data.catCounts[c] || 0)]) ] }
  ] });
  const half = Math.ceil(evs.length / 2);
  pages.push({ title: 'War Thunder glossary (3): awards', sub: 'Awards that appear in the sample\'s matches, from most to least frequent (appearances = times the award shows up, not matches)', cols: 2, blocks: [
    { h: 'Awards', head: ['In the log', 'Appearances'], w: [70, 30], rows: evs.slice(0, half).map(([n, c]) => [n, num(c)]) },
    { h: 'Awards (continued)', head: ['In the log', 'Appearances'], w: [70, 30], rows: evs.slice(half).map(([n, c]) => [n, num(c)]) },
    { h: 'Note', head: ['About awards', ''], rows: [['Exact condition', 'The condition for earning each award is defined by the game; here only its name and how many times it appears are given.'], ['"Help with Repairing"', 'Corresponds to helping an ally repair their vehicle; the rest are identified by their name.']] }
  ] });
  const mapRows = maps.map(([n, c]) => [n, num(c), pct(c, N)]), third = Math.ceil(mapRows.length / 3);
  pages.push({ title: 'War Thunder glossary (4): maps', sub: `${mapRows.length} different maps in the sample, sorted by number of matches`, cols: 3, blocks: [0, 1, 2].map(k => ({ h: k === 0 ? 'Maps' : 'Maps (continued)', head: ['In the log', 'Matches', '%'], w: [58, 24, 18], rows: mapRows.slice(k * third, (k + 1) * third) })) });
  return pages;
}

function glossHtml(i, g, theme, total) {
  const vars = Object.entries({ bg: 'bg', panel: 'panel', 'panel-2': 'panel2', border: 'border', accent: 'accent', text: 'text', dim: 'dim', win: 'win', loss: 'loss' }).map(([css, k]) => `--${css}:${theme.colours[k]}`).join(';');
  const widths = (h, w) => w || (h.length === 2 ? [30, 70] : h.length === 5 ? [25, 22, 4, 38, 11] : h[3] === 'Qué significa' ? [21, 21, 4, 54] : h[2] === 'Partidas' ? [34, 40, 14, 12] : [38, 45, 4, 13]);
  const tbl = b => `<div class="gb"><h2>${esc(b.h)}</h2><table><colgroup>${widths(b.head, b.w).map(w => `<col style="width:${w}%">`).join('')}</colgroup><tr>${b.head.map((c, j) => `<th${/^(Partidas|%|Apariciones|Matches|Appearances)$/.test(c) ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr>${b.rows.map(r => `<tr>${r.map((c, j) => `<td${/^(Partidas|%|Apariciones|Matches|Appearances)$/.test(b.head[j]) ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  return `<section class="page" style="${vars}">
  <div class="brief"><h1><span class="badge">${t('Glosario', 'Glossary')}</span> ${esc(g.title)}</h1><p>${esc(g.sub)}</p></div>
  <div class="gloss cols${g.cols}">${g.blocks.map(tbl).join('')}</div>
  <div class="foot"><span>${t('Fuente: partidas jugadas en War Thunder.', 'Source: matches played in War Thunder.')}</span><span>${t('Hecho con WT Session Readout · tema', 'Made with WT Session Readout · theme')} ${esc(theme.name)} · ${i + 1} ${t('de', 'of')} ${total}</span></div>
  ${wm()}
</section>`;
}

(async () => {
  const srv = await startServer({}), browser = await launch(), ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('wtSessionReadout.tutorialSeen.basic', 'true'); }); // no first-visit tour in the way
  const app = await ctx.newPage();
  await app.goto(srv.url + 'wt-log-analyzer.html'); await app.waitForFunction(() => window.__wtReady === true);
  await app.evaluate(t => { document.getElementById('input').value = t; }, fs.readFileSync(LOG, 'utf8'));
  await app.click('#analyzeBtn'); await app.waitForTimeout(800);
  const data = await app.evaluate(() => {
    const secs = {}, evs = {};                     // sections: matches that have one; awards: how many times each appears
    lastMatches.matches.forEach(m => { if (!m.raw) return; const d = parseDetail(m.raw); d.sections.forEach(sc => { secs[sc.name] = (secs[sc.name] || 0) + 1; sc.events.forEach(e => { if (e.name) evs[e.name] = (evs[e.name] || 0) + 1; }); }); });
    return { pasted: lastMatches.all.length, matches: lastMatches.matches.map(m => ({ result: m.result, mode: m.mode, category: m.category, mission: m.mission })), presets: BUILTIN_PRESETS, secs, evs };
  });
  const M = data.matches, R = M.filter(m => m.category === 'Random Battles'), RN = R.length; // M = every unique match (overall charts); R = Random Battles only (the two map charts)
  const count = (f, k) => M.filter(f).reduce((a, m) => (a[k(m)] = (a[k(m)] || 0) + 1, a), {});
  const byMap = Object.entries(R.reduce((a, m) => (a[m.mission] = (a[m.mission] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const radarMaps = byMap.slice(0, 8).map(([name]) => ({ name, w: R.filter(m => m.mission === name && m.result === 'Victory').length, l: R.filter(m => m.mission === name && m.result === 'Defeat').length }));
  const modes = Object.entries(count(() => true, m => m.mode)).sort((a, b) => b[1] - a[1]);
  const cats = [...new Set(M.map(m => m.category))].sort((a, b) => M.filter(m => m.category === b).length - M.filter(m => m.category === a).length);
  const slices = cats.flatMap(c => [['Victory', t('victoria', 'victory')], ['Defeat', t('derrota', 'defeat')]].map(([r, es]) => ({ name: `${c} · ${es}`, n: M.filter(m => m.category === c && m.result === r).length }))).filter(s => s.n > 0);
  const wins = M.filter(m => m.result === 'Victory').length, losses = M.length - wins, N = M.length;
  const d = { total: N, rb: RN, ta: N - RN, pasted: data.pasted, repeated: data.pasted - N, file: path.basename(LOG) };
  const share = (n, t = N) => `${num(n)} (${pct(n, t)})`;
  // facts for chart 1: running totals, biggest lead, longest streaks
  let w = 0, l = 0, lead = { v: -1e9, at: 0 }, run = 0, prev = '', sw = 0, sl = 0; const at = {};
  M.forEach((m, i) => { if (m.result === 'Victory') w++; else l++; if (w - l > lead.v) lead = { v: w - l, at: i + 1 }; if ([49, 99, 149].includes(i)) at[i + 1] = [w, l]; run = m.result === prev ? run + 1 : 1; prev = m.result; if (m.result === 'Victory') sw = Math.max(sw, run); else sl = Math.max(sl, run); });
  const cp = [50, 100, 150].map(k => [k, ...at[k]]);
  // facts for chart 2: the 8 maps
  const rm = radarMaps.map(m => ({ ...m, t: m.w + m.l })), rmTotal = rm.reduce((a, m) => a + m.t, 0);
  const tieCut = byMap.filter(([, n]) => n === byMap[7][1]).length > rm.filter(m => m.t === byMap[7][1]).length;
  const ring = Math.max(1, Math.ceil(Math.max(...rm.flatMap(m => [m.w, m.l])) / 4));
  const best = rm.reduce((a, m) => (m.w / m.t > a.w / a.t ? m : a)), worst = rm.reduce((a, m) => (m.w / m.t < a.w / a.t ? m : a));
  const mostW = rm.reduce((a, m) => (m.w > a.w ? m : a));
  // facts for chart 4
  const top10 = byMap.slice(0, 10), top10n = top10.reduce((a, [, n]) => a + n, 0), tiedAll = byMap.filter(([, n]) => n === top10[9][1]), tiedIn = top10.filter(([, n]) => n === top10[9][1]);
  // facts for chart 5
  const byCat = c => ({ n: M.filter(m => m.category === c).length, w: M.filter(m => m.category === c && m.result === 'Victory').length });
  const catFacts = cats.map(c => ({ c, ...byCat(c) }));
  const pages = [
    { kind: t('líneas', 'line'), title: t('Evolución acumulada de victorias y derrotas', 'Cumulative victories and defeats'), subtitle: t('Cuántas partidas ganadas y perdidas se han acumulado al avanzar por el registro', 'How many won and lost matches have piled up as you move through the log'),
      table: [[t('Hasta la partida n.º', 'Up to match no.'), t('Victorias', 'Victories'), t('Derrotas', 'Defeats')], ...cp.map(([k, a, b]) => [k, a, b]), [N, wins, losses]],
      reads: [t(`Se ganaron ${share(wins)} de las ${num(N)} partidas y se perdieron ${share(losses)}.`, `${share(wins)} of the ${num(N)} matches were won and ${share(losses)} were lost.`), t(`La ventaja máxima de victorias sobre derrotas fue de +${lead.v}, alcanzada en la partida n.º ${lead.at}; al final es de +${wins - losses}.`, `The largest lead of victories over defeats was +${lead.v}, reached at match no. ${lead.at}; at the end it is +${wins - losses}.`), t(`Racha más larga: ${sw} victorias seguidas; ${sl} derrotas seguidas.`, `Longest streak: ${sw} victories in a row; ${sl} defeats in a row.`), t('Una línea más empinada significa que ese resultado se acumuló más rápido en ese tramo.', 'A steeper line means that result piled up faster in that stretch.')],
      limits: [t('Eje horizontal: posición de la partida en el registro (la primera pegada es la 1). No es una fecha: el registro no incluye fechas.', 'Horizontal axis: position of the match in the log (the first one pasted is 1). It is not a date: the log has no dates.'), t('Eje vertical: total acumulado de partidas, no de la partida concreta.', 'Vertical axis: running total of matches, not the single match.'), t('Cada paso de una línea es exactamente una partida. Solo cuenta resultados: no dice nada de Leones de Plata, puntos de investigación ni duración.', 'Each step of a line is exactly one match. It only counts results: it says nothing about Silver Lions, research points or duration.')],
      use: t('El gráfico de líneas sirve para ver cómo cambia una cantidad a lo largo de una secuencia ordenada: aquí, la secuencia de partidas del registro.', 'A line chart shows how a quantity changes along an ordered sequence: here, the sequence of matches in the log.'), svg: lineChart({ order: M.map(m => m.result), wins, losses }) },
    { rb: true, kind: t('araña o radar', 'radar'), title: t('Victorias y derrotas en los 8 mapas más jugados', 'Victories and defeats on the 8 most played maps'), subtitle: t('Partidas ganadas y perdidas en cada uno de los 8 mapas con más partidas', 'Matches won and lost on each of the 8 maps with the most matches'),
      table: [[t('Mapa', 'Map'), t('Vict.', 'Wins'), t('Derr.', 'Losses'), 'Total', t('% vict.', '% wins')], ...rm.map(m => [m.name, m.w, m.l, m.t, pct(m.w, m.t)])],
      reads: [t(`Estos 8 mapas suman ${share(rmTotal)} de las ${num(RN)} partidas; los otros ${byMap.length - 8} mapas suman ${share(RN - rmTotal)}.`, `These 8 maps add up to ${share(rmTotal)} of the ${num(RN)} matches; the other ${byMap.length - 8} maps add up to ${share(RN - rmTotal)}.`), t(`Más victorias: ${mostW.name} (${mostW.w}). Mayor porcentaje de victorias: ${best.name} (${pct(best.w, best.t)}, ${best.w} de ${best.t}). Menor: ${worst.name} (${pct(worst.w, worst.t)}, ${worst.w} de ${worst.t}).`, `Most victories: ${mostW.name} (${mostW.w}). Highest win percentage: ${best.name} (${pct(best.w, best.t)}, ${best.w} of ${best.t}). Lowest: ${worst.name} (${pct(worst.w, worst.t)}, ${worst.w} of ${worst.t}).`), t('Un polígono verde más alejado del centro en un eje = más victorias en ese mapa; el rojo, más derrotas.', 'A green polygon farther from the centre on an axis = more victories on that map; the red one, more defeats.')],
      limits: [t(`Cada eje es un mapa, de mayor a menor número de partidas en sentido horario desde arriba${tieCut ? ' (los empates en el 8.º lugar se ordenan alfabéticamente)' : ''}. Los anillos cuentan partidas, de ${ring} en ${ring}.`, `Each axis is a map, from most to fewest matches, clockwise from the top${tieCut ? ' (ties for 8th place are sorted alphabetically)' : ''}. The rings count matches, every ${ring}.`), t(`Cada mapa tiene pocas partidas (entre ${Math.min(...rm.map(m => m.t))} y ${Math.max(...rm.map(m => m.t))}): los porcentajes cambian mucho con una sola partida, así que no son una medida fiable de «mapa bueno» o «mapa malo».`, `Each map has few matches (between ${Math.min(...rm.map(m => m.t))} and ${Math.max(...rm.map(m => m.t))}): the percentages change a lot with a single match, so they are not a reliable measure of a "good" or "bad" map.`), t('El radar muestra la forma; los valores exactos están en la tabla.', 'The radar shows the shape; the exact values are in the table.')],
      use: t('El gráfico de araña (radar) compara varias categorías con una misma escala desde un centro común y sirve para ver el «perfil» de cada serie. Funciona mejor con 5 a 8 ejes; no es adecuado para leer valores exactos.', 'A radar (spider) chart compares several categories on one scale from a common centre and shows the "profile" of each series. It works best with 5 to 8 axes; it is not suited to reading exact values.'), svg: radarChart({ maps: radarMaps }) },
    { kind: t('barras verticales', 'vertical bars'), title: t('Partidas por modo de juego', 'Matches per game mode'), subtitle: t('Número de partidas de cada modo, tal como aparece en el registro', 'Number of matches in each mode, as it appears in the log'),
      table: [[t('Modo de juego', 'Game mode'), t('Partidas', 'Matches'), '% total'], ...modes.map(([n, v]) => [n, v, pct(v, N)]), ['Total', N, pct(N, N)]],
      reads: [t(`${modes[0][0]} es el modo más repetido: ${share(modes[0][1])}.`, `${modes[0][0]} is the most frequent mode: ${share(modes[0][1])}.`), t(`Los ${modes.length} modos suman ${num(modes.reduce((a, [, v]) => a + v, 0))} partidas, el total de la muestra.`, `The ${modes.length} modes add up to ${num(modes.reduce((a, [, v]) => a + v, 0))} matches, the whole sample.`), t('«Tank Assault» aquí es el modo, y coincide con la categoría del mismo nombre de la herramienta.', '"Tank Assault" here is the mode, and it matches the tool\'s category of the same name.')],
      limits: [t('La altura de cada barra es el número de partidas de ese modo (eje vertical, desde 0). El nombre del modo es el que figura entre corchetes en cada informe, sin traducir.', 'The height of each bar is the number of matches in that mode (vertical axis, from 0). The mode name is the one in square brackets in each report.'), t('No dice quién ganó en cada modo, ni cuánto se ganó: solo cuántas partidas hay.', 'It does not say who won in each mode, nor how much was earned: only how many matches there are.')],
      use: t('Las barras verticales comparan cantidades entre pocas categorías con nombres cortos: la altura de cada barra es el valor y el cero siempre es la base.', 'Vertical bars compare quantities across a few categories with short names: the height of each bar is the value, and zero is always the base.'), svg: barsV({ bars: modes }) },
    { rb: true, kind: t('barras horizontales', 'horizontal bars'), title: t('Los 10 mapas más jugados', 'The 10 most played maps'), subtitle: t('Número de partidas por mapa, ordenado de mayor a menor', 'Number of matches per map, sorted from most to fewest'),
      table: [[t('Concepto', 'Item'), t('Partidas', 'Matches'), '% total'], [t('Los 10 mapas del gráfico', 'The 10 maps in the chart'), top10n, pct(top10n, RN)], [t(`Los otros ${byMap.length - 10} mapas`, `The other ${byMap.length - 10} maps`), RN - top10n, pct(RN - top10n, RN)], [t('Mapas distintos en total', 'Different maps in total'), byMap.length, '—']],
      reads: [t(`El mapa más jugado es ${top10[0][0]}, con ${top10[0][1]} partidas (${pct(top10[0][1], RN)}).`, `The most played map is ${top10[0][0]}, with ${top10[0][1]} matches (${pct(top10[0][1], RN)}).`), t(`Los 10 mapas del gráfico reúnen ${share(top10n)} de las ${num(RN)} partidas.`, `The 10 maps in the chart hold ${share(top10n)} of the ${num(RN)} matches.`), t(`${tiedAll.length} mapas tienen ${top10[9][1]} partidas, el valor del último lugar: ${tiedAll.length === tiedIn.length ? 'todos entran en el gráfico' : tiedIn.length + ' entran en el gráfico y ' + (tiedAll.length - tiedIn.length) + ' quedan fuera'}; entre iguales, el orden es alfabético.`, `${tiedAll.length} maps have ${top10[9][1]} matches, the value of the last place: ${tiedAll.length === tiedIn.length ? 'all of them are in the chart' : tiedIn.length + ' are in the chart and ' + (tiedAll.length - tiedIn.length) + ' are left out'}; among equals, the order is alphabetical.`)],
      limits: [t('La longitud de cada barra es el número de partidas en ese mapa (eje horizontal, desde 0); cada barra es un mapa (eje vertical).', 'The length of each bar is the number of matches on that map (horizontal axis, from 0); each bar is a map (vertical axis).'), t('El «mapa» es el nombre de la misión que figura en el informe. No indica resultado, puntos ni tiempo en cada mapa.', 'The "map" is the mission name in the report. It does not show results, points or time on each map.')],
      use: t('Las barras horizontales son ideales cuando las categorías tienen nombres largos o son muchas, y permiten ordenarlas de mayor a menor para leer un ranking de un vistazo.', 'Horizontal bars are ideal when category names are long or there are many categories, and sorting them from largest to smallest makes a ranking readable at a glance.'), svg: barsH({ bars: top10 }) },
    { kind: t('circular', 'pie'), title: t('Reparto de las partidas por tipo de combate y resultado', 'Matches by battle type and result'), subtitle: t('Qué parte de las partidas corresponde a cada combinación de tipo de combate y resultado', 'What share of the matches belongs to each combination of battle type and result'),
      table: [[t('Grupo', 'Group'), t('Partidas', 'Matches'), '% total'], ...slices.map(sl => [sl.name, sl.n, pct(sl.n, N)]), ['Total', N, pct(N, N)]],
      reads: [...catFacts.map(f => t(`${f.c}: ${num(f.n)} partidas, de las que se ganaron ${f.w} (${pct(f.w, f.n)}).`, `${f.c}: ${num(f.n)} matches, of which ${f.w} were won (${pct(f.w, f.n)}).`)), t(`En conjunto: ${wins} victorias de ${N} partidas (${pct(wins, N)}).`, `Overall: ${wins} victories out of ${N} matches (${pct(wins, N)}).`)],
      limits: [t(`Cada sector es una porción del total: todos los sectores suman las ${num(N)} partidas (100 %). Su tamaño es proporcional al número de partidas; el porcentaje está escrito dentro.`, `Each slice is a share of the total: all slices add up to the ${num(N)} matches (100%). Its size is proportional to the number of matches; the percentage is written on it.`), t('«Random Battles» es la categoría que la herramienta asigna a toda partida cuyo modo no coincide con una regla (la regla por defecto es «Tank Assault»), no un modo concreto del juego.', '"Random Battles" is the category the tool gives to every match whose mode does not match a rule (the default rule is "Tank Assault"); it is not one specific game mode.'), t('No tiene ejes. No pondera por puntos, tiempo ni Leones de Plata.', 'It has no axes. It does not weight by points, time or Silver Lions.')],
      use: t('El gráfico circular muestra cómo se reparte un total en partes; solo conviene con pocas partes. No tiene ejes: cada sector es la porción del total.', 'A pie chart shows how a total is split into parts; it only works with a few parts. It has no axes: each slice is a share of the total.'), svg: pieChart({ slices }) }
  ];
  const mapCounts = R.reduce((a, m) => (a[m.mission] = (a[m.mission] || 0) + 1, a), {}), modeCounts = count(() => true, m => m.mode), catCounts = count(() => true, m => m.category);
  const gp = (EN ? glossPagesEn : glossPages)(d, { secs: data.secs, evs: data.evs, mapCounts, modeCounts, catCounts });
  const TOTAL = pages.length + gp.length;
  pages.forEach(p => { p.of = TOTAL; });
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
.gloss{flex:1;min-height:0;display:grid;gap:3mm;align-content:start}.gloss.cols2{grid-template-columns:1fr 1fr}.gloss.cols3{grid-template-columns:1fr 1fr 1fr}
.gb{background:var(--panel);border:1px solid var(--border);padding:5px 9px;font-size:.58rem;line-height:1.3;overflow:hidden;break-inside:avoid}.gb h2{margin:0 0 3px;font-size:.64rem;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}
.gb table{border-collapse:collapse;width:100%;font-size:.58rem;table-layout:fixed}.gb th{font-size:.58rem}.gb th,.gb td{padding:1.5px 4px;text-align:left;vertical-align:top;border-bottom:1px solid var(--border);white-space:normal;overflow-wrap:anywhere}.gb th{color:var(--dim);font-weight:400}.gb th.n,.gb td.n{text-align:right;white-space:nowrap}
.usage{font-size:.64rem;color:var(--text);border-left:3px solid var(--accent);padding:5px 12px;background:var(--panel)}
.wm{position:absolute;top:3mm;right:12mm;z-index:5;font-size:.64rem;letter-spacing:.03em;color:var(--text);opacity:.8;border:1px solid var(--border);background:var(--panel);padding:.6mm 3mm;border-radius:999px;white-space:nowrap}
.page{position:relative}
.foot{display:flex;justify-content:space-between;gap:12px;font-size:.66rem;color:var(--dim);border-top:1px solid var(--border);padding-top:5px}`;
  const html = `<!DOCTYPE html><html lang="${t('es', 'en')}"><head><meta charset="UTF-8"><title>${t('Gráficos de partidas', 'Match charts')} — WT Session Readout</title><link rel="stylesheet" href="${srv.url}css/styles.css"><style>${css}</style></head><body>${pages.map((p, i) => page(i, p, themes[i], p.svg, d)).join('\n')}${gp.map((g, k) => glossHtml(pages.length + k, g, themes[0], TOTAL)).join('\n')}</body></html>`;
  const doc = await (await browser.newContext()).newPage();
  await doc.goto(srv.url + 'css/styles.css'); await doc.setContent(html, { waitUntil: 'load' });
  await doc.emulateMedia({ media: 'print' });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, await doc.pdf({ width: '297mm', height: '210mm', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true }));
  if (EN) { const txt = await (async () => doc.evaluate(() => document.body.innerText))(); const left = txt.match(/[áéíóúñ¿¡«»]|\b(partidas?|victorias?|derrotas?|mapas?|Fuente|Hecho con)\b/gi); if (left) { console.error('Spanish text left in the English edition:', [...new Set(left)].join(', ')); process.exit(1); } }
  console.log(`Wrote ${path.relative(ROOT, OUT)} — ${M.length} unique matches (${data.pasted} pasted), themes: ${themes.map(t => t.name).join(', ')}`);
  await browser.close(); srv.close();
})();
