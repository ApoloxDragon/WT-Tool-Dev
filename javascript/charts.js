/* ---------- Simple graph (Basic view) ---------- */
// One graph at a time on a <canvas>: no library, no markup built from log text, nothing stored or sent.
// It graphs the matches the tool already counted (repeats removed), in the order of the pasted log.
const GRAPH_VARS = {
  result:  { label: 'Wins vs defeats', count: true },
  totalRP: { label: 'RP per match', unit: 'RP', get: m => m.totalRP },
  netSL:   { label: 'Net SL per match', unit: 'SL', get: m => m.netSL },
  timeMin: { label: 'Time played (min)', unit: 'min', get: m => (m.timeSec > 0 ? m.timeSec / 60 : null) }
};
let graphMatches = [];
const gFmt = v => (Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v) : +v.toFixed(2)).toLocaleString();
function gStep(range) { const raw = (range || 1) / 5, p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map(f => f * p).find(s => s >= raw); }

// Histogram classes: k = ceil(1 + 3.322·log10 n) (Sturges); width c = A ÷ k is NOT rounded; the last class runs up to the maximum.
function graphClasses(values) {
  const n = values.length, mn = Math.min(...values), mx = Math.max(...values), A = mx - mn;
  const k = A === 0 ? 1 : Math.max(2, Math.ceil(1 + 3.322 * Math.log10(n))), c = A / k, fi = new Array(k).fill(0);
  values.forEach(v => { fi[A === 0 ? 0 : Math.min(k - 1, Math.floor((v - mn) / c))]++; });
  return { n, mn, mx, A, k, c, fi };
}

function drawGraph() {
  const cv = document.getElementById('graphCanvas'), note = document.getElementById('graphNote');
  const varKey = document.getElementById('graphVar').value, spec = GRAPH_VARS[varKey] || GRAPH_VARS.result;
  const typeSel = document.getElementById('graphType'); typeSel.disabled = !!spec.count;
  const dpr = window.devicePixelRatio || 1, W = Math.max(320, cv.clientWidth), H = Math.round(W * (W < 520 ? 0.8 : 0.44));
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const text = css('--text'), line = css('--border'), accent = css('--accent');
  const L = 62, R = 14, T = 14, B = 46, pw = W - L - R, ph = H - T - B, fs = W < 520 ? 10 : 12;
  g.font = fs + 'px sans-serif'; g.lineWidth = 1;
  const put = (s, x, y, al) => { g.fillStyle = text; g.textAlign = al || 'center'; g.fillText(s, x, y); };
  const frame = (lo, hi, step, xLabel) => {
    g.strokeStyle = line;
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const y = T + ph - (v - lo) / (hi - lo) * ph;
      g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); put(gFmt(v), L - 6, y + 4, 'right');
    }
    g.strokeStyle = text; g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + ph); g.lineTo(L + pw, T + ph); g.stroke();
    put(xLabel, L + pw / 2, H - 6);
  };
  const bar = (x, w, v, hi, lo, color, label) => {
    const h = (v - lo) / (hi - lo) * ph; g.fillStyle = color; g.fillRect(x, T + ph - h, w, h);
    if (label) put(label, x + w / 2, T + ph - h - 4);
  };
  g.clearRect(0, 0, W, H); note.textContent = '';
  if (!graphMatches.length) return;

  if (spec.count) {
    const w = graphMatches.filter(m => m.result === 'Victory').length, l = graphMatches.length - w, st = gStep(Math.max(w, l)), hi = st * Math.ceil(Math.max(w, l, 1) / st);
    frame(0, hi, st, 'Result (number of matches)');
    bar(L + pw * 0.15, pw * 0.3, w, hi, 0, css('--win'), w); bar(L + pw * 0.55, pw * 0.3, l, hi, 0, css('--loss'), l);
    put('Victory', L + pw * 0.3, T + ph + 18); put('Defeat', L + pw * 0.7, T + ph + 18);
    note.textContent = `n = ${graphMatches.length.toLocaleString()} matches · victories ${w.toLocaleString()} · defeats ${l.toLocaleString()}`;
    cv.setAttribute('aria-label', note.textContent); return;
  }
  const vals = graphMatches.map(spec.get).filter(v => v !== null && isFinite(v));
  if (!vals.length) { note.textContent = 'This log has no values for that choice.'; return; }
  const n = vals.length, mean = vals.reduce((a, v) => a + v, 0) / n, hist = typeSel.value === 'hist';
  let extra = '';
  if (hist) {
    const c = graphClasses(vals), st = gStep(Math.max(...c.fi)), hi = st * Math.ceil(Math.max(...c.fi) / st), bw = pw / c.k;
    frame(0, hi, st, `${spec.label}, in ${c.k} classes`);
    c.fi.forEach((f, i) => {
      bar(L + i * bw + 1, bw - 2, f, hi, 0, accent, f || '');
      if (c.k <= 10 || i % Math.ceil(c.k / 10) === 0) put(gFmt(c.mn + i * c.c), L + i * bw, T + ph + 16);
    });
    put(gFmt(c.mx), L + pw, T + ph + 16);
    extra = ` · ${c.k} classes of width ${gFmt(c.c)} (A ÷ k, not rounded)`;
  } else {
    const lo = Math.min(0, ...vals), st = gStep(Math.max(...vals) - lo), hi = lo + st * Math.ceil((Math.max(...vals) - lo || 1) / st), skip = Math.ceil(n / 3000);
    frame(lo, hi, st, 'Match number (order in the log)');
    g.strokeStyle = accent; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < n; i += skip) { const x = L + (n === 1 ? 0.5 : i / (n - 1)) * pw, y = T + ph - (vals[i] - lo) / (hi - lo) * ph; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let t = 0; t < Math.min(n, 6); t++) { const i = Math.round(t * (n - 1) / Math.max(1, Math.min(n, 6) - 1)); put(i + 1, L + (n === 1 ? 0.5 : i / (n - 1)) * pw, T + ph + 16); }
    if (skip > 1) extra = ` · drawing every ${skip}th match`;
  }
  note.textContent = `n = ${n.toLocaleString()} · min ${gFmt(Math.min(...vals))} · max ${gFmt(Math.max(...vals))} · mean ${gFmt(mean)} ${spec.unit}${extra}`;
  cv.setAttribute('aria-label', `${hist ? 'Histogram' : 'Line graph'} of ${spec.label}. ${note.textContent}`);
}
function setGraphMatches(matches) { graphMatches = matches; drawGraph(); }
function clearGraph() { graphMatches = []; drawGraph(); }
(function () {
  const v = document.getElementById('graphVar'), t = document.getElementById('graphType');
  if (!v || !t) return;
  let timer = null; const later = () => { clearTimeout(timer); timer = setTimeout(() => { if (graphMatches.length) drawGraph(); }, 120); };
  v.addEventListener('change', drawGraph); t.addEventListener('change', drawGraph);
  window.addEventListener('resize', later);
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] }); // colour changes
})();
