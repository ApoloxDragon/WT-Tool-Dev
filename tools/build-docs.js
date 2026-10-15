#!/usr/bin/env node
/* Builds docs/index.html — one static page with a sidebar — from the Markdown files in docs/.
 *
 *   node tools/build-docs.js            write docs/index.html
 *   node tools/build-docs.js --check    change nothing; exit 1 if docs/index.html is out of date
 *
 * Plain Node, no packages. The page has NO scripts: it only serves the documentation (navigation is ordinary
 * links). It understands just the Markdown the docs use: headings, paragraphs, bullet / numbered lists, tables,
 * block quotes, bold, italic, inline code and links. Everything is HTML-escaped. */
const fs = require('fs'), path = require('path');
const DOCS = path.resolve(__dirname, '..', 'docs');
// Order of the pages in the sidebar. A page is listed here by file name.
const PAGES = [
  ['README.md', 'Overview'],
  ['getting-started.md', 'Getting started'],
  ['concepts.md', 'Key concepts'],
  ['first-session-walkthrough.md', 'Walkthrough: your first session'],
  ['reading-your-logs.md', 'Reading your logs'],
  ['basic-view.md', 'The Basic view'],
  ['goal-calculator-guide.md', 'The goal calculator in depth'],
  ['categories-guide.md', 'Battle-type categories'],
  ['advanced-view.md', 'The Advanced view'],
  ['match-detail-guide.md', 'Reading a match\'s detail'],
  ['insights-guide.md', 'Insights explained'],
  ['backups-import-export.md', 'Backups, import and export'],
  ['data-lifecycle.md', 'Where your data goes'],
  ['colours-and-text.md', 'Colours and text'],
  ['phone-offline-and-slow-devices.md', 'Phone, offline and slow devices'],
  ['tutorials.md', 'The guided tours'],
  ['recipes.md', 'Recipes: how do I…?'],
  ['tips-and-tricks.md', 'Tips and tricks'],
  ['controls-reference.md', 'Controls reference'],
  ['accessibility.md', 'Accessibility'],
  ['faq.md', 'Frequently asked questions'],
  ['troubleshooting.md', 'Troubleshooting'],
  ['limitations.md', 'What the site does not do'],
  ['privacy-and-safety.md', 'Privacy and safety'],
  ['project-rules.md', 'Project rules'],
  ['security-practices.md', 'Security practices'],
  ['how-it-works.md', 'How it works'],
  ['glossary.md', 'Glossary'],
  ['colour-customisation.md', 'Design record: colours'],
  ['DRAFT-docs-link-in-app.md', 'Draft: docs link in the app']
];
const slugOf = f => f.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const headSlug = t => t.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/ /g, '-');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text, page) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const raw = href.replace(/&amp;/g, '&');
    let to = raw;
    const md = raw.match(/^([\w.-]+\.md)(#(.*))?$/);
    if (md) to = '#' + slugOf(md[1]) + (md[3] ? '-' + md[3] : '');
    else if (raw.startsWith('#')) to = '#' + page + '-' + raw.slice(1);
    else if (!/^https?:\/\//.test(raw)) to = '#';           // nothing else is linked
    const ext = /^https?:/.test(to) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${esc(to)}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[i]}</code>`);
}

function render(md, page) {
  const lines = md.replace(/\r\n/g, '\n').split('\n'), out = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const n = m[1].length, id = n === 1 ? page : page + '-' + headSlug(m[2]);
      out.push(`<h${n} id="${id}">${inline(m[2], page)}</h${n}>`); i++;
    } else if (l.startsWith('>')) {
      const buf = []; while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${render(buf.join('\n'), page)}</blockquote>`);
    } else if (l.startsWith('|') && /^\|?[\s:|-]+\|?$/.test(lines[i + 1] || '')) {
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      out.push(`<div class="scroll"><table><thead><tr>${head.map(c => `<th>${inline(c, page)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c, page)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let t = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) t += ' ' + lines[i++].trim();
        items.push(t);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t, page)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|\||\s*([-*]|\d+\.)\s+)/.test(lines[i])) buf.push(lines[i++].trim());
      out.push(`<p>${inline(buf.join(' '), page)}</p>`);
    }
  }
  return out.join('\n');
}

const CSS = `:root{--bg:#f6f7f9;--panel:#fff;--text:#1d232b;--dim:#5b6673;--border:#d9dee5;--accent:#1f6fbf;--code:#eef1f5}
@media (prefers-color-scheme:dark){:root{--bg:#0d1420;--panel:#141d2b;--text:#dbe6f2;--dim:#93a3b5;--border:#27364a;--accent:#6ab0f3;--code:#1b2738}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:12px}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
a{color:var(--accent)}
.layout{display:flex;align-items:flex-start;max-width:1180px;margin:0 auto}
nav{position:sticky;top:0;flex:0 0 270px;max-height:100vh;overflow:auto;padding:22px 16px;border-right:1px solid var(--border)}
nav .brand{font-weight:700;margin-bottom:2px}nav .sub{color:var(--dim);font-size:.85rem;margin-bottom:14px}
nav a{display:block;padding:6px 10px;border-radius:6px;text-decoration:none;color:var(--text);font-size:.93rem}
nav a:hover{background:var(--panel)}
main{flex:1;min-width:0;padding:8px 28px 80px}
section{padding:26px 0;border-bottom:1px solid var(--border)}
h1{font-size:1.9rem;line-height:1.25;margin:.2em 0 .5em}h2{font-size:1.35rem;margin:1.6em 0 .4em}h3{font-size:1.1rem;margin:1.4em 0 .3em}h4{margin:1.2em 0 .3em}
p,li{max-width:74ch}code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.9em}
blockquote{margin:1em 0;padding:.2em 1em;border-left:4px solid var(--accent);background:var(--panel);border-radius:0 6px 6px 0}
.scroll{overflow-x:auto;margin:1em 0}table{border-collapse:collapse;width:100%;font-size:.93rem;background:var(--panel)}
th,td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}th{background:var(--code)}
@media (max-width:820px){.layout{display:block}nav{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--border)}main{padding:8px 16px 60px}}
@media print{nav{display:none}main{padding:0}section{break-inside:auto}}`;

function build() {
  const nav = [], body = [];
  for (const [file, title] of PAGES) {
    const slug = slugOf(file), md = fs.readFileSync(path.join(DOCS, file), 'utf8');
    nav.push(`<a href="#${slug}">${esc(title)}</a>`);
    body.push(`<section>\n${render(md, slug)}\n</section>`);
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>WT Session Readout — Documentation</title>
<style>${CSS}</style>
</head>
<body>
<!-- GENERATED by tools/build-docs.js from the .md files in this folder. Edit those, then run the script. -->
<div class="layout">
<nav aria-label="Documentation pages"><div class="brand">WT Session Readout</div><div class="sub">Documentation</div>
${nav.join('\n')}
</nav>
<main>
${body.join('\n')}
</main>
</div>
</body>
</html>
`;
}

if (require.main === module) {
  const target = path.join(DOCS, 'index.html'), html = build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (cur !== html) { console.log('docs/index.html is out of date (run `node tools/build-docs.js`).'); process.exit(1); }
    console.log('docs/index.html is up to date.');
  } else { fs.writeFileSync(target, html); console.log('Wrote docs/index.html (' + (html.length / 1024).toFixed(0) + ' KB, ' + PAGES.length + ' pages).'); }
}
module.exports = { build, PAGES, slugOf };
