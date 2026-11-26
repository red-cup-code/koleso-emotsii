const {projectUrl, publishableKey} = window.EMOTION_WHEEL_CONFIG ?? {};
const hasBackend = Boolean(projectUrl && publishableKey);
const connection = document.querySelector('#connection-status');
if (!hasBackend) {
  connection.hidden = false;
  connection.textContent = 'Голосування буде доступне після підключення бази даних.';
  document.querySelector('#reset-stats').hidden = true;
}

async function dataRequest(path, options = {}) {
  if (!hasBackend) return new Response(null, {status: 503});
  const route = options.method === 'POST' ? 'record_emotion_vote'
    : options.method === 'DELETE' ? 'reset_emotion_stats'
    : 'get_emotion_stats';
  const ballot = path === '/api/vote' ? JSON.parse(options.body) : null;
  const body = ballot ? {choices: ballot.emotions, submission_id: ballot.submissionId} : {};
  return fetch(projectUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + route, {
    method: 'POST',
    headers: {apikey: publishableKey, 'Content-Type': 'application/json'},
    body: JSON.stringify(body),
    cache: 'no-store'
  });
}
