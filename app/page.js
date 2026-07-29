'use client';

import { useEffect, useState } from 'react';
import ArticleCards from './components/ArticleCards';
import Icon from './components/Icon';
import MessageFeed from './components/MessageFeed';
import MessageFilters, { defaultFilters, filterMessages } from './components/MessageFilters';
import SuggestionInput from './components/SuggestionInput';

const storageKey = 'private-chat.mongodb-uri';
const themeStorageKey = 'private-chat.theme';
const modeStorageKey = 'private-chat.mode';

function connectionLabel(uri) {
  const match = uri.match(/@([^/?]+)/);
  if (match) return match[1];
  return uri.replace(/^mongodb(?:\+srv)?:\/\//, '').split('/')[0].replace(/^[^@]+@/, '') || 'MongoDB';
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState('light');
  const [mode, setMode] = useState('read');
  const [uri, setUri] = useState('');
  const [uriInput, setUriInput] = useState('');
  const [showUri, setShowUri] = useState(false);
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [author, setAuthor] = useState('');
  const [source, setSource] = useState('');
  const [articleTime, setArticleTime] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');
  const [editArticleTime, setEditArticleTime] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [collapsedMessages, setCollapsedMessages] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState('');
  const [syncState, setSyncState] = useState('idle');
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  async function api(path, options = {}, activeUri = uri) {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-mongodb-uri': encodeURIComponent(activeUri),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }

  async function loadMessages(activeUri = uri, quiet = false) {
    if (!quiet) setError('');
    setSyncState('loading');
    try {
      const result = await api('/api/messages', {}, activeUri);
      setMessages(result.messages || []);
      setLastSynced(new Date());
      setSyncState('success');
    } catch (loadError) {
      setSyncState('error');
      throw loadError;
    }
  }

  function notify(message, type = 'success') {
    setToast({ message, type });
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || '';
    const savedTheme = localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light';
    const savedMode = localStorage.getItem(modeStorageKey) === 'edit' ? 'edit' : 'read';
    setTheme(savedTheme);
    setMode(savedMode);
    document.documentElement.dataset.theme = savedTheme;
    setUri(saved);
    setUriInput(saved);
    setReady(true);
    if (saved) loadMessages(saved).catch((loadError) => setError(loadError.message));
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem(themeStorageKey, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setEditing(null);
    setOpenMenu(null);
    localStorage.setItem(modeStorageKey, nextMode);
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function login(event) {
    event.preventDefault();
    const value = uriInput.trim();
    if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
      setError('Enter a valid MongoDB connection URI.');
      return;
    }
    setBusy('login');
    setError('');
    try {
      await api('/api/health', {}, value);
      localStorage.setItem(storageKey, value);
      setUri(value);
      await loadMessages(value);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy('');
    }
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setUri('');
    setUriInput('');
    setMessages([]);
    setTitle('');
    setDraft('');
    setFilters(defaultFilters);
    setEditing(null);
    setError('');
  }

  async function run(name, action, successMessage) {
    setBusy(name);
    setError('');
    try {
      await action();
      if (successMessage) notify(successMessage);
    } catch (actionError) {
      setError(actionError.message);
      notify(actionError.message, 'error');
    } finally {
      setBusy('');
    }
  }

  async function createMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await run('create', async () => {
      const result = await api('/api/messages', { method: 'POST', body: JSON.stringify({ title, text, author, source, articleTime }) });
      setMessages((current) => [result.message, ...current]);
      setTitle('');
      setDraft('');
      setLastSynced(new Date());
      setSyncState('success');
    }, 'Message added');
  }

  async function saveEdit(id) {
    const text = editText.trim();
    if (!text) return;
    await run(`edit-${id}`, async () => {
      const result = await api(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ title: editTitle, text, articleTime: editArticleTime }) });
      setMessages((current) => current.map((message) => message.id === id ? result.message : message));
      setEditing(null);
      setLastSynced(new Date());
      setSyncState('success');
    }, 'Message updated');
  }

  async function setReadStatus(id, isRead) {
    await run(`read-${id}`, async () => {
      const result = await api(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ isRead }) });
      setMessages((current) => current.map((message) => message.id === id ? result.message : message));
    }, isRead ? 'Marked as read' : 'Marked as unread');
  }

  function toggleMessage(id, force) {
    setCollapsedMessages((current) => {
      const next = new Set(current);
      const collapse = typeof force === 'boolean' ? force : !next.has(id);
      if (collapse) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    await run('delete', async () => {
      if (target === 'all') {
        await api('/api/messages', { method: 'DELETE' });
        setMessages([]);
      } else {
        await api(`/api/messages/${target}`, { method: 'DELETE' });
        setMessages((current) => current.filter((message) => message.id !== target));
      }
      setPendingDelete(null);
      setOpenMenu(null);
      setLastSynced(new Date());
      setSyncState('success');
    }, target === 'all' ? 'All messages deleted' : 'Message deleted');
  }

  const filteredMessages = filterMessages(messages, filters);
  const authorSuggestions = [...new Set(messages.flatMap((message) => message.author))].sort((a, b) => a.localeCompare(b));
  const sourceSuggestions = [...new Set(messages.flatMap((message) => message.source))].sort((a, b) => a.localeCompare(b));
  const allMessagesCollapsed = filteredMessages.length > 0 && filteredMessages.every((message) => collapsedMessages.has(message.id));
  const networkActive = Boolean(busy) || syncState === 'loading';
  const operationLabels = { create: 'Adding message...', delete: 'Deleting...' };
  const syncLabel = busy.startsWith('edit-')
    ? 'Saving message...'
    : operationLabels[busy] || (syncState === 'loading'
    ? 'Syncing...'
    : syncState === 'error'
      ? 'Sync failed'
      : lastSynced
        ? `Up to date · ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Not synced');

  if (!ready) return <div className="boot"><span className="spinner" />Loading</div>;

  if (!uri) {
    return (
      <main className="login-page">
        <button className="button button-quiet login-theme" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`}><Icon name={theme === 'light' ? 'moon' : 'sun'} /><span>{theme === 'light' ? 'Dark' : 'Light'}</span></button>
        <section className="login-card">
          <div className="login-brand"><span className="brand-icon"><Icon name="message" /></span><span>tuan2linh</span></div>
          <div className="login-heading">
            <h1>Connect your database</h1>
            <p>Use the MongoDB connection URI configured in your VS Code extension.</p>
          </div>
          <form onSubmit={login}>
            <label htmlFor="mongo-uri">MongoDB URI</label>
            <div className="uri-field">
              <Icon name="database" />
              <input id="mongo-uri" type={showUri ? 'text' : 'password'} value={uriInput} onChange={(event) => setUriInput(event.target.value)} placeholder="mongodb+srv://user:password@cluster..." autoComplete="off" autoFocus />
              <button type="button" className="icon-button" onClick={() => setShowUri(!showUri)} aria-label="Toggle URI visibility"><Icon name="eye" /></button>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-primary login-button" disabled={busy === 'login'} type="submit">
              {busy === 'login' && <span className="spinner" />}{busy === 'login' ? 'Connecting...' : 'Connect'}
            </button>
          </form>
          <div className="login-details">
            <div><span>Database</span><code>private_chat</code></div>
            <div><span>Collection</span><code>messages</code></div>
          </div>
          <p className="privacy-note"><Icon name="shield" />The URI is stored only in this browser until you disconnect.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell" onClick={() => openMenu && setOpenMenu(null)}>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand"><span className="brand-icon"><Icon name="message" /></span><strong>tuan2linh</strong></div>
          <nav className="mode-switch" aria-label="Application mode">
            <button className={mode === 'read' ? 'active' : ''} onClick={() => changeMode('read')} aria-pressed={mode === 'read'}><Icon name="read" />Read</button>
            <button className={mode === 'edit' ? 'active' : ''} onClick={() => changeMode('edit')} aria-pressed={mode === 'edit'}><Icon name="edit" />Edit</button>
          </nav>
          <div className="header-actions">
            <span className="connection"><i /> <span>{connectionLabel(uri)}</span></span>
            <button className="button button-quiet theme-toggle" onClick={toggleTheme} aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Use ${theme === 'light' ? 'dark' : 'light'} theme`}><Icon name={theme === 'light' ? 'moon' : 'sun'} /><span>{theme === 'light' ? 'Dark' : 'Light'}</span></button>
            <button className="button button-quiet" disabled={busy === 'refresh'} onClick={() => run('refresh', () => loadMessages(), 'Messages refreshed')}>{busy === 'refresh' ? <span className="spinner" /> : <Icon name="refresh" />}<span>{busy === 'refresh' ? 'Refreshing' : 'Refresh'}</span></button>
            <button className="button button-quiet" onClick={logout}><Icon name="logout" /><span>Disconnect</span></button>
          </div>
        </div>
      </header>
      {networkActive && <div className="network-progress" role="progressbar" aria-label="API request in progress"><span /></div>}

      <main className="content">
        <div className="page-heading">
          <div><span className="mode-eyebrow">{mode} mode</span><h1>{mode === 'read' ? 'Reading list' : 'Manage messages'}</h1><p>{mode === 'read' ? 'A focused feed shared with your VS Code extension.' : 'Create, revise, and organize your message collection.'}</p></div>
          <div className="page-status"><span className={`sync-status ${syncState}`}>{networkActive && <span className="spinner" />}{!networkActive && syncState === 'success' && <Icon name="check" />}{!networkActive && syncState === 'error' && <Icon name="close" />}{syncLabel}</span><span className="message-count">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span></div>
        </div>

        {error && <div className="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" /></button></div>}

        {mode === 'edit' && <form className="composer" onSubmit={createMessage}>
          <input className="composer-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Article title (optional)" />
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }} placeholder="Write a message..." />
          <div className="metadata-fields">
            <label><span>Author</span><SuggestionInput value={author} onChange={setAuthor} suggestions={authorSuggestions} placeholder="Choose or enter" /></label>
            <label><span>Source</span><SuggestionInput value={source} onChange={setSource} suggestions={sourceSuggestions} placeholder="Choose or enter" /></label>
            <label><span>Article date</span><input type="date" value={articleTime} onChange={(event) => setArticleTime(event.target.value)} /></label>
          </div>
          <div className="composer-bar"><span><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd></span><button className="button button-primary" disabled={busy === 'create' || !draft.trim()} type="submit">{busy === 'create' ? <span className="spinner" /> : <Icon name="send" />}Add message</button></div>
        </form>}

        <section className="message-section">
          <MessageFilters filters={filters} setFilters={setFilters} authors={authorSuggestions} sources={sourceSuggestions} shown={filteredMessages.length} total={messages.length} />
          <div className="toolbar">
            <span className="toolbar-label">{filteredMessages.length} {filteredMessages.length === 1 ? (mode === 'read' ? 'article' : 'result') : (mode === 'read' ? 'articles' : 'results')}</span>
            <div className="toolbar-actions">
              {mode === 'edit' && <button className="button button-quiet" disabled={!filteredMessages.length} onClick={() => setCollapsedMessages((current) => { const next = new Set(current); filteredMessages.forEach((message) => allMessagesCollapsed ? next.delete(message.id) : next.add(message.id)); return next; })}><Icon name={allMessagesCollapsed ? 'chevronRight' : 'chevronDown'} />{allMessagesCollapsed ? 'Expand all' : 'Collapse all'}</button>}
              {mode === 'edit' && <button className="button button-danger-quiet" disabled={!messages.length} onClick={() => setPendingDelete('all')}><Icon name="trash" />Delete all</button>}
            </div>
          </div>
          {mode === 'read' ? <ArticleCards messages={filteredMessages} hasFilters={JSON.stringify(filters) !== JSON.stringify(defaultFilters)} /> : <MessageFeed messages={filteredMessages} collapsedMessages={collapsedMessages} busy={busy} editing={editing} editTitle={editTitle} editText={editText} editArticleTime={editArticleTime} openMenu={openMenu} setEditing={setEditing} setEditTitle={setEditTitle} setEditText={setEditText} setEditArticleTime={setEditArticleTime} setOpenMenu={setOpenMenu} toggleMessage={toggleMessage} saveEdit={saveEdit} setReadStatus={setReadStatus} setPendingDelete={setPendingDelete} hasFilters={JSON.stringify(filters) !== JSON.stringify(defaultFilters)} />}
        </section>
      </main>

      {pendingDelete && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPendingDelete(null)}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-icon"><Icon name="trash" /></div><h2 id="dialog-title">{pendingDelete === 'all' ? 'Delete all messages?' : 'Delete this message?'}</h2><p>{pendingDelete === 'all' ? `This will permanently delete all ${messages.length} messages.` : 'This message will be permanently removed.'} This action cannot be undone.</p><div className="dialog-actions"><button className="button button-quiet" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button button-danger" disabled={busy === 'delete'} onClick={confirmDelete}>{busy === 'delete' && <span className="spinner" />}Delete</button></div></section></div>}

      {toast && <div className={`toast ${toast.type}`} role="status">{toast.type === 'success' ? <Icon name="check" /> : <Icon name="close" />}<span>{toast.message}</span></div>}
    </div>
  );
}
