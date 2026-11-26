import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const read = name => readFileSync(new URL('src/' + name, import.meta.url), 'utf8');
const out = (name, value) => writeFileSync(new URL('docs/' + name, import.meta.url), value);
const groups = JSON.parse(read('emotions.json'));
const englishGroups = groups.map(([key, , color, children]) => [
  key, key, color, children.map(row => row.map(([emotion]) => [emotion, emotion]))
]);
const dictionary = Object.entries(JSON.parse(read('pages-en.json'))).sort(([a], [b]) => b.length - a.length);
const english = source => dictionary.reduce((result, [from, to]) => result.replaceAll(from, to), source);
const html = read('index.html')
  .replace('data-reset-disabled hidden', '')
  .replace('<main>', '<p id="connection-status" role="status" hidden></p>\n<main>')
  .replace('</style>', `
#connection-status { margin: 16px auto 0; width: min(calc(100% - 32px), 1176px); color: var(--muted); }
.header-inner { position: relative; }
.language-link { position: absolute; inset-inline-end: var(--inset); top: 29px; color: var(--ink); text-underline-offset: .22em; }
@media (max-width: 760px) { .language-link { top: 22px; inset-inline-end: 4px; } }
</style>`);
const app = read('pages-api.js') + '\n' + read('app.js')
  .replaceAll("fetch('/api/", "dataRequest('/api/")
  .replace("async function loadStats() {", "async function loadStats() {\n  if (!hasBackend) { statsStatus.textContent = 'Очікуємо підключення бази даних.'; return; }")
  .replace("voteButton.disabled = !selected.size || submitting;", "voteButton.disabled = !hasBackend || !selected.size || submitting;");

mkdirSync(new URL('docs/en/', import.meta.url), {recursive: true});
for (const isEnglish of [false, true]) {
  const dest = isEnglish ? 'en/' : '';
  const parent = isEnglish ? '../' : './';
  const page = (isEnglish ? english(html).replace('lang="uk"', 'lang="en"') : html)
    .replace('</title>', '</title>\n<link rel="alternate" hreflang="uk" href="' + parent + '">\n' +
      '<link rel="alternate" hreflang="en" href="' + parent + 'en/">')
    .replace('<nav class="switch"', (isEnglish
      ? '<a class="language-link" href="../" hreflang="uk" lang="uk" aria-label="Українська">UA</a>'
      : '<a class="language-link" href="./en/" hreflang="en" lang="en" aria-label="English">ENG</a>') + '\n    <nav class="switch"')
    .replace('<script src="/app.js" defer></script>', '<script src="' + parent + 'config.js" defer></script>\n<script src="./app.js" defer></script>');
  out(dest + 'index.html', page);
  out(dest + 'app.js', 'const EMOTIONS = ' + JSON.stringify(isEnglish ? englishGroups : groups) + ';\n' +
    (isEnglish ? english(app).replaceAll("'uk-UA'", "'en'") : app));
}
out('.nojekyll', '');
