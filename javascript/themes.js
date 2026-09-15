/* ---------- Theme system ---------- */
const THEMES = {
  blue:   { bg:'#0d1420', panel:'#131b2b', panel2:'#182338', border:'#26344d', accent:'#4d9fe8', text:'#dbe6f2', dim:'#6f8299' },
  amber:  { bg:'#12130d', panel:'#1a1c14', panel2:'#21231a', border:'#3a3c2c', accent:'#d9a441', text:'#e8e4d5', dim:'#8b8d78' },
  slate:  { bg:'#16181c', panel:'#1e2126', panel2:'#262a30', border:'#383d44', accent:'#c9ced6', text:'#e4e7ea', dim:'#7d848d' },
  forest: { bg:'#0f1712', panel:'#16211a', panel2:'#1c2921', border:'#2e402f', accent:'#6bbf7a', text:'#dcead9', dim:'#7b9a80' }
};
let currentTheme = loadState('theme', 'blue');

function applyTheme(name) {
  const t = THEMES[name];
  if (!t) return;
  const root = document.documentElement.style;
  root.setProperty('--bg', t.bg);
  root.setProperty('--panel', t.panel);
  root.setProperty('--panel-2', t.panel2);
  root.setProperty('--border', t.border);
  root.setProperty('--accent', t.accent);
  root.setProperty('--text', t.text);
  root.setProperty('--dim', t.dim);
  currentTheme = name;
  saveState('theme', name);
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === name));
}

function buildThemePicker() {
  const picker = document.getElementById('themePicker');
  Object.entries(THEMES).forEach(([name, t]) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (name === currentTheme ? ' active' : '');
    btn.style.background = t.accent;
    btn.dataset.theme = name;
    btn.title = name;
    btn.addEventListener('click', () => applyTheme(name));
    picker.appendChild(btn);
  });
}
buildThemePicker();
applyTheme(currentTheme); // apply the restored (or default) theme's CSS variables
