import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const read = name => readFileSync(new URL('src/' + name, import.meta.url), 'utf8');
const out = (name, value) => writeFileSync(new URL('docs/' + name, import.meta.url), value);
const groups = JSON.parse(read('emotions.json'));
mkdirSync(new URL('docs/', import.meta.url), {recursive: true});
out('index.html', read('index.html')
  .replace('data-reset-disabled hidden', '')
  .replace('<main>', '<p id="connection-status" role="status" hidden></p>\n<main>')
  .replace('<script src="/app.js" defer></script>', '<script src="./config.js" defer></script>\n<script src="./app.js" defer></script>')
  .replace('</style>', '#connection-status { margin: 16px auto 0; width: min(calc(100% - 32px), 1176px); color: var(--muted); }\n</style>'));
out('app.js', 'const EMOTIONS = ' + JSON.stringify(groups) + ';\n' + read('pages-api.js') + '\n' +
  read('app.js')
    .replace("fetch('/api/vote'", "dataRequest('/api/vote'")
    .replace("fetch('/api/stats'", "dataRequest('/api/stats'")
    .replace("fetch('/api/stats'", "dataRequest('/api/stats'")
    .replace("async function loadStats() {", "async function loadStats() {\n  if (!hasBackend) { statsStatus.textContent = 'Очікуємо підключення бази даних.'; return; }")
    .replace("voteButton.disabled = !selected.size || submitting;", "voteButton.disabled = !hasBackend || !selected.size || submitting;"));
out('.nojekyll', '');
