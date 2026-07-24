const storageKey = 'privateChat.connection.v1';

const elements = {
  status: document.getElementById('status'),
  messages: document.getElementById('messages'),
  count: document.getElementById('message-count'),
  input: document.getElementById('message-input'),
  send: document.getElementById('send'),
  refresh: document.getElementById('refresh'),
  clearAll: document.getElementById('clear-all'),
  panel: document.getElementById('connection-panel'),
  mode: document.getElementById('connection-mode'),
  restFields: document.getElementById('rest-fields'),
  atlasFields: document.getElementById('atlas-fields'),
  apiBaseUrl: document.getElementById('api-base-url'),
  atlasBaseUrl: document.getElementById('atlas-base-url'),
  atlasApiKey: document.getElementById('atlas-api-key'),
  atlasDataSource: document.getElementById('atlas-data-source'),
  atlasDatabase: document.getElementById('atlas-database'),
  atlasCollection: document.getElementById('atlas-collection')
};

let configuration = loadConfiguration();

function loadConfiguration() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function normalizeUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function objectId(value) {
  if (typeof value === 'string') {
    return value;
  }
  return value && typeof value.$oid === 'string' ? value.$oid : '';
}

function dateValue(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value.$date === 'string') {
    return value.$date;
  }
  if (value && typeof value.$date === 'number') {
    return new Date(value.$date).toISOString();
  }
  return '';
}

function mapMessage(document) {
  return {
    id: objectId(document.id || document._id),
    text: typeof document.text === 'string' ? document.text : '',
    createdAt: dateValue(document.createdAt)
  };
}

function setStatus(text, state = '') {
  elements.status.textContent = text;
  elements.status.className = `status ${state}`.trim();
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(message, 'error');
  elements.messages.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'error-box';
  box.textContent = message;
  elements.messages.appendChild(box);
}

function setBusy(busy) {
  for (const button of document.querySelectorAll('button')) {
    button.disabled = busy;
  }
  if (busy) {
    setStatus('Working...', 'busy');
  }
}

async function requestRest(path, options = {}) {
  const response = await fetch(`${configuration.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status}).`);
  }
  return data;
}

async function requestAtlas(action, body = {}) {
  const response = await fetch(`${configuration.atlasBaseUrl}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ejson',
      Accept: 'application/ejson',
      apiKey: configuration.atlasApiKey
    },
    body: JSON.stringify({
      dataSource: configuration.atlasDataSource,
      database: configuration.atlasDatabase,
      collection: configuration.atlasCollection,
      ...body
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Atlas request failed (${response.status}).`);
  }
  return data;
}

const api = {
  async health() {
    if (configuration.mode === 'atlas') {
      await requestAtlas('findOne', { filter: {}, projection: { _id: 1 } });
      return `${configuration.atlasDatabase}.${configuration.atlasCollection}`;
    }
    const result = await requestRest('/api/health');
    return `${result.database}.${result.collection}`;
  },

  async list() {
    if (configuration.mode === 'atlas') {
      const result = await requestAtlas('find', { sort: { createdAt: 1, _id: 1 } });
      return (result.documents || []).map(mapMessage);
    }
    const result = await requestRest('/api/messages');
    return (result.messages || []).map(mapMessage);
  },

  async create(text) {
    if (configuration.mode === 'atlas') {
      return requestAtlas('insertOne', {
        document: { text, createdAt: { $date: new Date().toISOString() } }
      });
    }
    return requestRest('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  async update(id, text) {
    if (configuration.mode === 'atlas') {
      return requestAtlas('updateOne', {
        filter: { _id: { $oid: id } },
        update: { $set: { text } }
      });
    }
    return requestRest(`/api/messages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ text })
    });
  },

  async delete(id) {
    if (configuration.mode === 'atlas') {
      return requestAtlas('deleteOne', { filter: { _id: { $oid: id } } });
    }
    return requestRest(`/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async clear() {
    if (configuration.mode === 'atlas') {
      return requestAtlas('deleteMany', { filter: {} });
    }
    return requestRest('/api/messages', { method: 'DELETE' });
  }
};

function createButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.className = className;
  button.addEventListener('click', () => onClick().catch(showError));
  return button;
}

function formatDate(value) {
  if (!value) {
    return 'Unknown time';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}

function renderMessages(messages) {
  elements.messages.innerHTML = '';
  elements.count.textContent = String(messages.length);

  if (messages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No messages yet. Post one to the shared collection.';
    elements.messages.appendChild(empty);
    return;
  }

  for (const message of messages) {
    const item = document.createElement('article');
    item.className = 'message';

    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.text;

    const footer = document.createElement('div');
    footer.className = 'message-footer';

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = formatDate(message.createdAt);

    const actions = document.createElement('div');
    actions.className = 'actions compact';
    actions.append(
      createButton('Edit', 'secondary', () => startEdit(item, message)),
      createButton('Delete', 'danger ghost', () => deleteMessage(message.id))
    );

    footer.append(meta, actions);
    item.append(text, footer);
    elements.messages.appendChild(item);
  }
}

async function startEdit(item, message) {
  item.innerHTML = '';
  const editor = document.createElement('textarea');
  editor.className = 'edit-area';
  editor.value = message.text;

  const actions = document.createElement('div');
  actions.className = 'actions end';
  actions.append(
    createButton('Cancel', 'secondary', loadMessages),
    createButton('Save', '', async () => {
      const text = editor.value.trim();
      if (!text) {
        throw new Error('Message text cannot be empty.');
      }
      setBusy(true);
      try {
        await api.update(message.id, text);
        await loadMessages();
      } finally {
        setBusy(false);
      }
    })
  );

  item.append(editor, actions);
  editor.focus();
}

async function loadMessages() {
  if (!configuration) {
    elements.count.textContent = '0';
    renderMessages([]);
    setStatus('Not configured');
    elements.panel.hidden = false;
    return;
  }

  setStatus('Loading...', 'busy');
  const [label, messages] = await Promise.all([api.health(), api.list()]);
  renderMessages(messages);
  setStatus(label, 'ok');
}

async function sendMessage() {
  if (!configuration) {
    elements.panel.hidden = false;
    throw new Error('Configure a connection first.');
  }
  const text = elements.input.value.trim();
  if (!text) {
    return;
  }

  setBusy(true);
  try {
    await api.create(text);
    elements.input.value = '';
    await loadMessages();
  } finally {
    setBusy(false);
  }
}

async function deleteMessage(id) {
  if (!id || !confirm('Delete this message?')) {
    return;
  }
  setBusy(true);
  try {
    await api.delete(id);
    await loadMessages();
  } finally {
    setBusy(false);
  }
}

async function clearAll() {
  if (!configuration || !confirm('Delete all messages from the shared collection?')) {
    return;
  }
  setBusy(true);
  try {
    await api.clear();
    await loadMessages();
  } finally {
    setBusy(false);
  }
}

function updateModeFields() {
  const atlas = elements.mode.value === 'atlas';
  elements.restFields.hidden = atlas;
  elements.atlasFields.hidden = !atlas;
}

function populateForm() {
  const value = configuration || {};
  elements.mode.value = value.mode || 'rest';
  elements.apiBaseUrl.value = value.apiBaseUrl || '';
  elements.atlasBaseUrl.value = value.atlasBaseUrl || '';
  elements.atlasApiKey.value = value.atlasApiKey || '';
  elements.atlasDataSource.value = value.atlasDataSource || 'Cluster0';
  elements.atlasDatabase.value = value.atlasDatabase || 'private_chat';
  elements.atlasCollection.value = value.atlasCollection || 'messages';
  updateModeFields();
}

function readForm() {
  const mode = elements.mode.value;
  if (mode === 'rest') {
    const apiBaseUrl = normalizeUrl(elements.apiBaseUrl.value);
    if (!apiBaseUrl) {
      throw new Error('Enter the hosted REST API base URL.');
    }
    return { mode, apiBaseUrl };
  }

  const atlasBaseUrl = normalizeUrl(elements.atlasBaseUrl.value);
  const atlasApiKey = elements.atlasApiKey.value.trim();
  const atlasDataSource = elements.atlasDataSource.value.trim();
  const atlasDatabase = elements.atlasDatabase.value.trim();
  const atlasCollection = elements.atlasCollection.value.trim();
  if (!atlasBaseUrl || !atlasApiKey || !atlasDataSource || !atlasDatabase || !atlasCollection) {
    throw new Error('Complete all Atlas connection fields.');
  }
  return { mode, atlasBaseUrl, atlasApiKey, atlasDataSource, atlasDatabase, atlasCollection };
}

async function saveConfiguration() {
  const previous = configuration;
  configuration = readForm();
  setBusy(true);
  try {
    const label = await api.health();
    localStorage.setItem(storageKey, JSON.stringify(configuration));
    elements.panel.hidden = true;
    await loadMessages();
    setStatus(label, 'ok');
  } catch (error) {
    configuration = previous;
    throw error;
  } finally {
    setBusy(false);
  }
}

elements.mode.addEventListener('change', updateModeFields);
document.getElementById('open-settings').addEventListener('click', () => {
  populateForm();
  elements.panel.hidden = false;
});
document.getElementById('close-settings').addEventListener('click', () => {
  elements.panel.hidden = true;
});
document.getElementById('save-settings').addEventListener('click', () => saveConfiguration().catch(showError));
document.getElementById('forget-settings').addEventListener('click', () => {
  localStorage.removeItem(storageKey);
  configuration = null;
  populateForm();
  loadMessages().catch(showError);
});
elements.send.addEventListener('click', () => sendMessage().catch(showError));
elements.refresh.addEventListener('click', () => loadMessages().catch(showError));
elements.clearAll.addEventListener('click', () => clearAll().catch(showError));
elements.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendMessage().catch(showError);
  }
});

populateForm();
loadMessages().catch(showError);
