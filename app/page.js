'use client';

import { useEffect, useState } from 'react';

const storageKey = 'private-chat.mongodb-uri';

function Icon({ name }) {
  const paths = {
    database: <><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
    send: <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></>,
    trash: <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    close: <><path d="M18 6L6 18M6 6l12 12"/></>,
    check: <><path d="M20 6L9 17l-5-5"/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function connectionLabel(uri) {
  const match = uri.match(/@([^/?]+)/);
  if (match) return match[1];
  return uri.replace(/^mongodb(?:\+srv)?:\/\//, '').split('/')[0].replace(/^[^@]+@/, '') || 'MongoDB';
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [uri, setUri] = useState('');
  const [uriInput, setUriInput] = useState('');
  const [showUri, setShowUri] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
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
    setUri(saved);
    setUriInput(saved);
    setReady(true);
    if (saved) loadMessages(saved).catch((loadError) => setError(loadError.message));
  }, []);

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
    setDraft('');
    setQuery('');
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
      const result = await api('/api/messages', { method: 'POST', body: JSON.stringify({ text }) });
      setMessages((current) => [result.message, ...current]);
      setDraft('');
      setLastSynced(new Date());
      setSyncState('success');
    }, 'Message added');
  }

  async function saveEdit(id) {
    const text = editText.trim();
    if (!text) return;
    await run(`edit-${id}`, async () => {
      const result = await api(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) });
      setMessages((current) => current.map((message) => message.id === id ? result.message : message));
      setEditing(null);
      setLastSynced(new Date());
      setSyncState('success');
    }, 'Message updated');
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

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredMessages = normalizedQuery
    ? messages.filter((message) => message.text.toLocaleLowerCase().includes(normalizedQuery))
    : messages;
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
        <section className="login-card">
          <div className="login-brand"><span className="brand-icon"><Icon name="message" /></span><span>Private Chat</span></div>
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
          <div className="brand"><span className="brand-icon"><Icon name="message" /></span><strong>Private Chat</strong></div>
          <div className="header-actions">
            <span className="connection"><i /> <span>{connectionLabel(uri)}</span></span>
            <button className="button button-quiet" disabled={busy === 'refresh'} onClick={() => run('refresh', () => loadMessages(), 'Messages refreshed')}>{busy === 'refresh' ? <span className="spinner" /> : <Icon name="refresh" />}<span>{busy === 'refresh' ? 'Refreshing' : 'Refresh'}</span></button>
            <button className="button button-quiet" onClick={logout}><Icon name="logout" /><span>Disconnect</span></button>
          </div>
        </div>
      </header>
      {networkActive && <div className="network-progress" role="progressbar" aria-label="API request in progress"><span /></div>}

      <main className="content">
        <div className="page-heading">
          <div><h1>Messages</h1><p>Messages shared with your VS Code extension.</p></div>
          <div className="page-status"><span className={`sync-status ${syncState}`}>{networkActive && <span className="spinner" />}{!networkActive && syncState === 'success' && <Icon name="check" />}{!networkActive && syncState === 'error' && <Icon name="close" />}{syncLabel}</span><span className="message-count">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span></div>
        </div>

        {error && <div className="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" /></button></div>}

        <form className="composer" onSubmit={createMessage}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              event.currentTarget.form.requestSubmit();
            }
          }} placeholder="Write a message..." />
          <div className="composer-bar"><span><kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd></span><button className="button button-primary" disabled={busy === 'create' || !draft.trim()} type="submit">{busy === 'create' ? <span className="spinner" /> : <Icon name="send" />}Add message</button></div>
        </form>

        <section className="message-section">
          <div className="toolbar">
            <div className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search messages" aria-label="Search messages" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" /></button>}</div>
            <button className="button button-danger-quiet" disabled={!messages.length} onClick={() => setPendingDelete('all')}><Icon name="trash" />Delete all</button>
          </div>

          <div className="message-list">
            {!filteredMessages.length && (
              <div className="empty-state"><Icon name={query ? 'search' : 'message'} /><h2>{query ? 'No matching messages' : 'No messages yet'}</h2><p>{query ? 'Try a different search term.' : 'Add a message to get started.'}</p></div>
            )}
            {filteredMessages.map((message) => (
              <article className="message-row" key={message.id}>
                <div className="message-main">
                  {editing === message.id ? (
                    <textarea className="edit-textarea" value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
                  ) : <p>{message.text}</p>}
                  <time>{timeLabel(message.createdAt)}</time>
                </div>
                {editing === message.id ? (
                  <div className="edit-actions"><button className="button button-quiet" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={busy === `edit-${message.id}`} onClick={() => saveEdit(message.id)}>{busy === `edit-${message.id}` && <span className="spinner" />}{busy === `edit-${message.id}` ? 'Saving' : 'Save'}</button></div>
                ) : (
                  <div className="menu-wrap" onClick={(event) => event.stopPropagation()}>
                    <button className="icon-button row-menu-button" onClick={() => setOpenMenu(openMenu === message.id ? null : message.id)} aria-label="Message actions" aria-expanded={openMenu === message.id}><Icon name="more" /></button>
                    {openMenu === message.id && <div className="action-menu"><button onClick={() => { setEditing(message.id); setEditText(message.text); setOpenMenu(null); }}><Icon name="edit" />Edit</button><button className="danger" onClick={() => setPendingDelete(message.id)}><Icon name="trash" />Delete</button></div>}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      {pendingDelete && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPendingDelete(null)}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-icon"><Icon name="trash" /></div><h2 id="dialog-title">{pendingDelete === 'all' ? 'Delete all messages?' : 'Delete this message?'}</h2><p>{pendingDelete === 'all' ? `This will permanently delete all ${messages.length} messages.` : 'This message will be permanently removed.'} This action cannot be undone.</p><div className="dialog-actions"><button className="button button-quiet" onClick={() => setPendingDelete(null)}>Cancel</button><button className="button button-danger" disabled={busy === 'delete'} onClick={confirmDelete}>{busy === 'delete' && <span className="spinner" />}Delete</button></div></section></div>}

      {toast && <div className={`toast ${toast.type}`} role="status">{toast.type === 'success' ? <Icon name="check" /> : <Icon name="close" />}<span>{toast.message}</span></div>}
    </div>
  );
}
