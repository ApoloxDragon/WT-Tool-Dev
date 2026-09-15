/* ---------- Category rules ---------- */
// Each rule: { keyword, label }. First match (case-insensitive substring) wins.
// Anything unmatched falls back to "Random Battles".
let categoryRules = [
  { keyword: 'Tank Assault', label: 'Tank Assault' }
];

function classify(modeBase) {
  for (const rule of categoryRules) {
    if (modeBase.toLowerCase().includes(rule.keyword.toLowerCase())) return rule.label;
  }
  return 'Random Battles';
}

function renderRules() {
  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  categoryRules.forEach((rule, idx) => {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.innerHTML = `
      <input type="text" value="${rule.keyword}" data-idx="${idx}" data-field="keyword">
      <input type="text" value="${rule.label}" data-idx="${idx}" data-field="label">
      <button class="remove" data-idx="${idx}">Remove</button>
    `;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      categoryRules[idx][e.target.dataset.field] = e.target.value;
    });
  });
  list.querySelectorAll('button.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      categoryRules.splice(+e.target.dataset.idx, 1);
      renderRules();
    });
  });
}
renderRules();

document.getElementById('addRuleBtn').addEventListener('click', () => {
  const kw = document.getElementById('newKeyword').value.trim();
  const lbl = document.getElementById('newLabel').value.trim();
  if (!kw || !lbl) return;
  categoryRules.push({ keyword: kw, label: lbl });
  document.getElementById('newKeyword').value = '';
  document.getElementById('newLabel').value = '';
  renderRules();
});
