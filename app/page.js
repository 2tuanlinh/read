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
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [uri, setUri] = useState('');
  const [uriInput, setUriInput] = useState('');
  const [showUri, setShowUri] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  async function loadMessages(activeUri = uri) {
    setError('');
    const result = await api('/api/messages', {}, activeUri);
    setMessages(result.messages || []);
  }

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || '';
    setUri(saved);
    setUriInput(saved);
    setReady(true);
    if (saved) {
      loadMessages(saved).catch((loadError) => setError(loadError.message));
    }
  }, []);

  async function login(event) {
    event.preventDefault();
    const value = uriInput.trim();
    if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
      setError('Enter a valid mongodb:// or mongodb+srv:// connection URI.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/health', {}, value);
      localStorage.setItem(storageKey, value);
      setUri(value);
      await loadMessages(value);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setUri('');
    setUriInput('');
    setMessages([]);
    setDraft('');
    setEditing(null);
    setError('');
  }

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  async function createMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await run(async () => {
      await api('/api/messages', { method: 'POST', body: JSON.stringify({ text }) });
      setDraft('');
      await loadMessages();
    });
  }

  async function saveEdit(id) {
    const text = editText.trim();
    if (!text) return;
    await run(async () => {
      await api(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) });
      setEditing(null);
      await loadMessages();
    });
  }

  async function deleteMessage(id) {
    if (!window.confirm('Delete this message permanently?')) return;
    await run(async () => {
      await api(`/api/messages/${id}`, { method: 'DELETE' });
      await loadMessages();
    });
  }

  async function clearAll() {
    if (!messages.length || !window.confirm(`Delete all ${messages.length} messages permanently?`)) return;
    await run(async () => {
      await api('/api/messages', { method: 'DELETE' });
      await loadMessages();
    });
  }

  if (!ready) return <div className="boot">Opening console...</div>;

  if (!uri) {
    return (
      <main className="login-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <section className="login-card">
          <div className="brand-mark"><Icon name="message" /></div>
          <p className="kicker">Private workspace</p>
          <h1>Your messages.<br /><span>Your database.</span></h1>
          <p className="login-copy">Connect directly to your MongoDB cluster and manage the messages used by your Private Chat extension.</p>

          <form onSubmit={login}>
            <label htmlFor="mongo-uri">MongoDB connection URI</label>
            <div className="uri-field">
              <Icon name="database" />
              <input
                id="mongo-uri"
                type={showUri ? 'text' : 'password'}
                value={uriInput}
                onChange={(event) => setUriInput(event.target.value)}
                placeholder="mongodb+srv://user:password@cluster..."
                autoComplete="off"
                autoFocus
              />
              <button type="button" className="eye-button" onClick={() => setShowUri(!showUri)} aria-label="Toggle URI visibility"><Icon name="eye" /></button>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="primary login-button" disabled={busy} type="submit">
              {busy ? 'Testing connection...' : 'Connect to database'}
            </button>
          </form>

          <div className="privacy-note"><Icon name="shield" /><span>Your URI is saved in this browser until you log out. It is never stored in this project.</span></div>
          <p className="database-note">Uses <code>private_chat.messages</code></p>
        </section>
      </main>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark small"><Icon name="message" /></span><strong>Private Chat</strong></div>
        <nav><span className="nav-item active"><Icon name="message" />Messages</span></nav>
        <div className="sidebar-bottom">
          <div className="connection-state"><span className="pulse" /><div><strong>Connected</strong><small>private_chat.messages</small></div></div>
          <button className="logout-button" onClick={logout}><Icon name="logout" />Log out</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div><p className="kicker">Database console</p><h1>Messages</h1><p>Manage everything shared with your VS Code extension.</p></div>
          <button className="refresh-button" disabled={busy} onClick={() => run(loadMessages)}><Icon name="refresh" />Refresh</button>
        </header>

        {error && <div className="alert"><strong>Connection error</strong><span>{error}</span></div>}

        <section className="composer panel">
          <div className="panel-heading"><div><h2>New message</h2><p>Publish a note to your shared collection.</p></div><span className="count-badge">{messages.length} total</span></div>
          <form onSubmit={createMessage}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  event.currentTarget.form.requestSubmit();
                }
              }}
              placeholder="Write something worth remembering..."
            />
            <div className="composer-footer"><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send</span><button className="primary" disabled={busy || !draft.trim()} type="submit"><Icon name="send" />Post message</button></div>
          </form>
        </section>

        <section className="message-section">
          <div className="list-heading"><div><h2>Message history</h2><p>Newest messages appear first.</p></div><button className="clear-button" disabled={busy || !messages.length} onClick={clearAll}><Icon name="trash" />Clear all</button></div>

          <div className="message-list">
            {!messages.length && <div className="empty-state"><span><Icon name="message" /></span><h3>No messages yet</h3><p>Your first message will appear here.</p></div>}
            {messages.map((message, index) => (
              <article className="message-card" key={message.id}>
                <div className="message-index">{String(messages.length - index).padStart(2, '0')}</div>
                <div className="message-body">
                  {editing === message.id ? (
                    <textarea className="edit-textarea" value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
                  ) : <p>{message.text}</p>}
                  <time>{timeLabel(message.createdAt)}</time>
                </div>
                <div className="message-actions">
                  {editing === message.id ? <>
                    <button className="text-button" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="save-button" disabled={busy} onClick={() => saveEdit(message.id)}>Save</button>
                  </> : <>
                    <button title="Edit message" onClick={() => { setEditing(message.id); setEditText(message.text); }}><Icon name="edit" /></button>
                    <button className="danger-icon" title="Delete message" onClick={() => deleteMessage(message.id)}><Icon name="trash" /></button>
                  </>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
