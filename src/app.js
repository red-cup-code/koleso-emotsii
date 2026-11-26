const wheel = document.querySelector('#wheel');
const nodes = new Map();
const select = document.querySelector('#emotion-select');
const voteButton = document.querySelector('#vote-button');
const selectionTitle = document.querySelector('#selection-title');
const selection = document.querySelector('#selection');
const voteStatus = document.querySelector('#vote-status');
const number = new Intl.NumberFormat('uk-UA');
const plural = new Intl.PluralRules('uk-UA');
const groups = EMOTIONS;
const slices = groups.reduce((sum, group) => sum + 2 * group[3].length, 0);
const angle = n => n * 360 / slices - 90;
const point = (radius, degrees) => {
  const rad = degrees * Math.PI / 180;
  return [400 + Math.cos(rad) * radius, 400 + Math.sin(rad) * radius];
};
const svg = (name, attributes = {}) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
};
const selected = new Set();
let statsMode = false;
let submitting = false;
let submissionId;
let loadId = 0;

function wedge(key, label, color, start, end, inner, outer) {
  const a = angle(start);
  const b = angle(end);
  const middle = (a + b) / 2;
  const [x, y] = point(inner ? (inner + outer) / 2 : 81, middle);
  const rotation = middle > 90 ? middle - 180 : middle;
  const path = [
    'M', ...point(outer, a), 'A', outer, outer, 0, 0, 1, ...point(outer, b),
    'L', ...point(inner, b),
    ...(inner ? ['A', inner, inner, 0, 0, 0, ...point(inner, a)] : []), 'Z'
  ].join(' ');
  const group = svg('g', { class: 'wedge', tabindex: 0, role: 'button',
    'aria-label': label, 'aria-pressed': false });
  const tooltip = svg('title');
  tooltip.textContent = label;
  group.append(tooltip, svg('path', { d: path, fill: color }));
  const text = svg('text', { x, y, 'font-size': inner ? 15 : 18, 'text-anchor': 'middle',
    'dominant-baseline': 'central', transform: 'rotate(' + rotation + ' ' + x + ' ' + y + ')' });
  text.textContent = label;
  group.append(text);
  group.addEventListener('click', () => toggleEmotion(key));
  group.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) toggleEmotion(key);
    }
  });
  wheel.append(group);
  nodes.set(key, { group, label, color, text, tooltip, labelWidth: inner ? outer - inner - 14 : 91 });
}

let index = 0;
for (const [family, translated, color, children] of groups) {
  wedge(family, translated, color, index, index + children.length * 2, 0, 131);
  const optgroup = document.createElement('optgroup');
  optgroup.label = translated;
  optgroup.append(new Option(translated, family));
  for (const [[middle, middleLabel], [first, firstLabel], [second, secondLabel]] of children) {
    wedge(middle, middleLabel, 'color-mix(in srgb,' + color + ' 88%, #f9f0e7)', index, index+2, 131, 258);
    wedge(first, firstLabel, color, index, index+1, 258, 399);
    wedge(second, secondLabel, color, index+1, index+2, 258, 399);
    optgroup.append(new Option(middleLabel, middle), new Option(firstLabel, first), new Option(secondLabel, second));
    index += 2;
  }
  select.append(optgroup);
  const legend = document.createElement('div');
  legend.className = 'legend';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.style.background = color;
  legend.append(dot, translated);
  document.querySelector('#legend').append(legend);
}

const longLabels = [...nodes.values()].filter(({text, labelWidth}) => text.getComputedTextLength() > labelWidth);
for (const {text, labelWidth} of longLabels) {
  text.setAttribute('textLength', labelWidth);
  text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
}

function syncWheel() {
  wheel.dataset.mode = statsMode ? 'stats' : 'pick';
  wheel.setAttribute('aria-busy', submitting);
  for (const [key, {group, label, tooltip}] of nodes) {
    group.classList.toggle('selected', !statsMode && selected.has(key));
    group.setAttribute('tabindex', statsMode ? -1 : 0);
    group.setAttribute('role', statsMode ? 'img' : 'button');
    if (statsMode) {
      group.removeAttribute('aria-pressed');
      group.removeAttribute('aria-disabled');
    } else {
      group.setAttribute('aria-pressed', selected.has(key));
      group.setAttribute('aria-disabled', submitting);
      group.querySelector('path').style.fillOpacity = 1;
    }
    group.setAttribute('aria-label', label);
    tooltip.textContent = label;
  }
}

function renderSelection() {
  selectionTitle.textContent = selected.size ? 'Вибрано: ' + number.format(selected.size) : 'Емоції ще не вибрано';
  selection.hidden = !selected.size;
  selection.replaceChildren();
  for (const key of selected) {
    const {label} = nodes.get(key);
    const item = document.createElement('li');
    const remove = document.createElement('button');
    remove.className = 'chip';
    remove.type = 'button';
    remove.disabled = submitting;
    remove.setAttribute('aria-label', 'Прибрати ' + label);
    const icon = document.createElement('span');
    icon.textContent = '×';
    icon.setAttribute('aria-hidden', true);
    remove.append(label, icon);
    remove.onclick = () => {
      const position = [...selected].indexOf(key);
      toggleEmotion(key);
      const remaining = selection.querySelectorAll('button');
      (remaining[Math.min(position, remaining.length - 1)] ?? nodes.get(key).group).focus();
    };
    item.append(remove);
    selection.append(item);
  }
  select.disabled = submitting;
  voteButton.disabled = !selected.size || submitting;
  voteButton.textContent = submitting ? 'Зараховуємо…' : 'Зарахувати голос';
  syncWheel();
}

function toggleEmotion(key) {
  if (statsMode || submitting || !nodes.has(key)) return;
  if (!selected.delete(key)) selected.add(key);
  submissionId = undefined;
  voteStatus.textContent = '';
  voteStatus.classList.remove('error');
  renderSelection();
}

async function submitVote() {
  if (statsMode || submitting || !selected.size) return;
  submissionId ??= crypto.randomUUID();
  const emotions = [...selected];
  submitting = true;
  voteStatus.textContent = '';
  voteStatus.classList.remove('error');
  renderSelection();
  try {
    const response = await fetch('/api/vote', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({submissionId, emotions})});
    if (!response.ok) throw new Error('vote failed');
    selected.clear();
    submissionId = undefined;
    const count = emotions.length;
    const word = {one:'голос', few:'голоси', many:'голосів'}[plural.select(count)] ?? 'голосів';
    voteStatus.textContent = 'Зараховано ' + number.format(count) + ' ' + word + '.';
  } catch {
    voteStatus.textContent = 'Не вдалося підтвердити голоси. Спробуй ще раз.';
    voteStatus.classList.add('error');
  } finally {
    submitting = false;
    renderSelection();
    if (statsMode) loadStats();
  }
}

const statsStatus = document.querySelector('#stats-status');
const ranking = document.querySelector('#ranking');
const totalLabel = document.querySelector('#total');

async function loadStats() {
  const id = ++loadId;
  statsStatus.textContent = 'Оновлюємо результати…';
  statsStatus.classList.remove('error');
  try {
    const response = await fetch('/api/stats', {cache:'no-store'});
    if (!response.ok) throw new Error('stats failed');
    const rows = await response.json();
    if (!statsMode || id !== loadId) return;
    const counts = new Map(rows.map(({emotion, total}) => [emotion, total]));
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    totalLabel.textContent = number.format(total);
    ranking.replaceChildren();
    statsStatus.textContent = rows.length ? 'Найчастіше обирали' : 'Тут з’являться результати після першого голосу.';
    const max = rows[0]?.total ?? 1;
    for (const [key, {group, label, tooltip}] of nodes) {
      const count = counts.get(key) ?? 0;
      group.querySelector('path').style.fillOpacity = total ? .22 + .78 * count / max : 1;
      tooltip.textContent = label + ' · ' + number.format(count);
      group.setAttribute('aria-label', tooltip.textContent);
    }
    for (const {emotion, total:count} of rows) {
      const row = document.createElement('div');
      row.className = 'stats-row';
      const name = document.createElement('span');
      name.textContent = nodes.get(emotion)?.label ?? 'Невідома емоція';
      const value = document.createElement('strong');
      value.textContent = number.format(count);
      const bar = document.createElement('div');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = 100 * count / max + '%';
      fill.style.background = nodes.get(emotion)?.color ?? '#f1d49e';
      bar.append(fill);
      row.append(name, value, bar);
      ranking.append(row);
    }
  } catch {
    if (id !== loadId || !statsMode) return;
    statsStatus.textContent = 'Не вдалося завантажити результати. Спробуй оновити.';
    statsStatus.classList.add('error');
  }
}

const resetButton = document.querySelector('#reset-stats');
const resetDialog = document.querySelector('#reset-dialog');
const resetStatus = document.querySelector('#reset-status');
const resetCode = document.querySelector('#reset-code');

resetButton.onclick = () => resetDialog.showModal();
resetCode.oninput = () => resetCode.setCustomValidity('');
resetDialog.onclose = () => {
  resetCode.value = '';
  resetCode.setCustomValidity('');
};
document.querySelector('#confirm-reset').onclick = async () => {
  if (resetButton.disabled) return;
  const token = resetCode.value.trim();
  if (!resetCode.closest('[data-reset-code]').hidden && !token) {
    resetCode.setCustomValidity('Введи код адміністратора.');
    resetCode.reportValidity();
    return;
  }
  resetCode.value = '';
  resetDialog.close();
  resetButton.disabled = true;
  resetStatus.classList.remove('error');
  resetStatus.textContent = 'Скидаємо статистику…';
  try {
    const headers = token ? {'X-Stats-Reset-Token': token} : {};
    const response = await fetch('/api/stats', {method: 'DELETE', headers});
    if (response.status === 403) {
      resetStatus.textContent = 'Скидання недоступне. Перевір код адміністратора.';
      resetStatus.classList.add('error');
      return;
    }
    if (!response.ok) throw new Error('reset failed');
    resetStatus.textContent = 'Статистику скинуто.';
    if (statsMode) {
      totalLabel.textContent = '—';
      ranking.replaceChildren();
      await loadStats();
    }
  } catch {
    resetStatus.textContent = 'Не вдалося підтвердити скидання. Онови статистику, щоб перевірити результат.';
    resetStatus.classList.add('error');
  } finally {
    resetButton.disabled = false;
  }
};

function setMode(showStats) {
  if (statsMode === showStats) return;
  statsMode = showStats;
  document.querySelector('#pick-mode').setAttribute('aria-pressed', !showStats);
  document.querySelector('#stats-mode').setAttribute('aria-pressed', showStats);
  document.querySelector('#pick').hidden = showStats;
  document.querySelector('#stats').hidden = !showStats;
  document.querySelector('#pick-intro').hidden = showStats;
  document.querySelector('#stats-intro').hidden = !showStats;
  syncWheel();
  if (showStats) loadStats();
}
document.querySelector('#pick-mode').onclick = () => setMode(false);
document.querySelector('#stats-mode').onclick = () => setMode(true);
document.querySelector('#refresh').onclick = loadStats;
select.onchange = () => {
  if (select.value && !selected.has(select.value)) toggleEmotion(select.value);
  select.value = '';
};
const wheelViewport = document.querySelector('#wheel-viewport');
const wheelZoom = document.querySelector('#wheel-zoom');
const wheelHelp = document.querySelector('#wheel-help');
wheelZoom.onclick = () => {
  const zoomed = wheelViewport.toggleAttribute('data-zoomed');
  wheelZoom.textContent = zoomed ? 'Зменшити колесо' : 'Збільшити колесо';
  wheelHelp.hidden = !zoomed;
  if (zoomed) {
    wheelViewport.tabIndex = 0;
    wheelViewport.scrollLeft = (wheelViewport.scrollWidth - wheelViewport.clientWidth) / 2;
    wheelViewport.scrollTop = (wheelViewport.scrollHeight - wheelViewport.clientHeight) / 2;
  } else {
    wheelViewport.removeAttribute('tabindex');
    wheelViewport.scrollLeft = 0;
    wheelViewport.scrollTop = 0;
  }
};

voteButton.onclick = submitVote;
renderSelection();
