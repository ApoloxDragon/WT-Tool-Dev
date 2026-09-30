/* ---------- Category rules ---------- */
// Each rule: { keyword, label }. First match (case-insensitive substring) wins.
// Anything unmatched falls back to "Random Battles".
function sanitizeRules(v) {
  if (!Array.isArray(v)) return undefined;
  return v.slice(0, 100)
    .filter(r => r && typeof r.keyword === 'string' && typeof r.label === 'string')
    .map(r => ({ keyword: r.keyword.slice(0, 100), label: r.label.slice(0, 100) }));
}
let categoryRules = loadState('categoryRules', [
  { keyword: 'Tank Assault', label: 'Tank Assault' }
], sanitizeRules);

function classify(modeBase) {
  for (const rule of categoryRules) {
    if (modeBase.toLowerCase().includes(rule.keyword.toLowerCase())) return rule.label;
  }
  return 'Random Battles';
}

function renderRules() {
  const list = document.getElementById('rulesList');
  if (!list) return; // page has no rules editor (e.g. the Advanced view)
  list.textContent = '';
  categoryRules.forEach((rule, idx) => {
    // Values are set as properties (never spliced into HTML), so any text is safe.
    const row = document.createElement('div');
    row.className = 'rule-row';
    [['keyword', rule.keyword], ['label', rule.label]].forEach(([field, value]) => {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = value;
      inp.addEventListener('input', () => {
        categoryRules[idx][field] = inp.value;
        saveState('categoryRules', categoryRules);
      });
      row.appendChild(inp);
    });
    const rm = document.createElement('button');
    rm.className = 'remove';
    rm.textContent = 'Remove';
    rm.addEventListener('click', () => {
      categoryRules.splice(idx, 1);
      saveState('categoryRules', categoryRules);
      renderRules();
    });
    row.appendChild(rm);
    list.appendChild(row);
  });
}
renderRules();

const addRuleBtn = document.getElementById('addRuleBtn');
if (addRuleBtn) addRuleBtn.addEventListener('click', () => {
  const kw = document.getElementById('newKeyword').value.trim();
  const lbl = document.getElementById('newLabel').value.trim();
  if (!kw || !lbl) return;
  categoryRules.push({ keyword: kw, label: lbl });
  saveState('categoryRules', categoryRules);
  document.getElementById('newKeyword').value = '';
  document.getElementById('newLabel').value = '';
  renderRules();
});
