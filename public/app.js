const statusEl = document.getElementById('status');
const listEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString();
}

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.addEventListener('click', onClick);
  return button;
}

function renderMessages(messages) {
  listEl.innerHTML = '';

  if (!messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No messages yet. Post one to MongoDB.';
    listEl.appendChild(empty);
    return;
  }

  for (const message of messages) {
    const item = document.createElement('article');
    item.className = 'message';
    item.dataset.id = message.id;

    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.text;

    const footer = document.createElement('div');
    footer.className = 'message-actions';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = formatDate(message.createdAt);

    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.append(
      createButton('Edit', 'secondary', () => startEdit(item, message)),
      createButton('Delete', 'danger', () => deleteMessage(message.id))
    );

    footer.append(meta, actions);
    item.append(text, footer);
    listEl.appendChild(item);
  }
}

function startEdit(item, message) {
  item.innerHTML = '';

  const editor = document.createElement('textarea');
  editor.className = 'edit-area';
  editor.value = message.text;

  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.append(
    createButton('Cancel', 'secondary', () => loadMessages()),
    createButton('Save', '', async () => {
      const text = editor.value.trim();
      if (!text) {
        return;
      }
      await api(`/api/messages/${message.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text })
      });
      await loadMessages();
    })
  );

  item.append(editor, actions);
  editor.focus();
}

async function loadHealth() {
  try {
    const health = await api('/api/health');
    setStatus(`${health.database}.${health.collection}`, 'ok');
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function loadMessages() {
  try {
    const data = await api('/api/messages');
    renderMessages(data.messages || []);
  } catch (error) {
    listEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'error-box';
    box.textContent = error.message;
    listEl.appendChild(box);
  }
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) {
    return;
  }

  await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ text })
  });
  inputEl.value = '';
  await loadMessages();
}

async function deleteMessage(id) {
  if (!confirm('Delete this message?')) {
    return;
  }
  await api(`/api/messages/${id}`, { method: 'DELETE' });
  await loadMessages();
}

async function clearAll() {
  if (!confirm('Delete all messages from MongoDB?')) {
    return;
  }
  await api('/api/messages', { method: 'DELETE' });
  await loadMessages();
}

document.getElementById('send').addEventListener('click', () => {
  sendMessage().catch((error) => alert(error.message));
});
document.getElementById('refresh').addEventListener('click', () => {
  Promise.all([loadHealth(), loadMessages()]).catch((error) => alert(error.message));
});
document.getElementById('clear-all').addEventListener('click', () => {
  clearAll().catch((error) => alert(error.message));
});
inputEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendMessage().catch((error) => alert(error.message));
  }
});

Promise.all([loadHealth(), loadMessages()]).catch((error) => {
  setStatus(error.message, 'error');
});
