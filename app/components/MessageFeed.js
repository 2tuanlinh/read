'use client';

import Icon from './Icon';

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function MessageFeed({ messages, collapsedMessages, busy, editing, editTitle, editText, editArticleTime, openMenu, setEditing, setEditTitle, setEditText, setEditArticleTime, setOpenMenu, toggleMessage, saveEdit, setReadStatus, setPendingDelete, hasFilters }) {
  if (!messages.length) return <div className="empty-state"><Icon name={hasFilters ? 'search' : 'message'} /><h2>{hasFilters ? 'No matching messages' : 'No messages yet'}</h2><p>{hasFilters ? 'Adjust or clear the filters to see more.' : 'Add a message to get started.'}</p></div>;
  return <div className="message-list">
    {messages.map((message) => {
      const collapsed = collapsedMessages.has(message.id);
      return <article className={`message-row${collapsed ? ' collapsed' : ''}${message.isRead ? '' : ' unread'}`} key={message.id}>
        <div className="message-main">
          {editing === message.id ? <div className="edit-fields"><label className="edit-title-field"><span>Title</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Optional article title" autoFocus /></label><textarea className="edit-textarea" value={editText} onChange={(event) => setEditText(event.target.value)} /><label><span>Article date</span><input type="date" value={editArticleTime} onChange={(event) => setEditArticleTime(event.target.value)} /></label></div> : <>{message.title && !collapsed && <h3 className="message-title">{message.title}</h3>}{!collapsed && <p>{message.text}</p>}{collapsed && <p className="collapsed-label">{message.title || 'Message collapsed'}</p>}{(message.author.length || message.source.length || message.articleTime) && <div className="message-metadata">{message.author.length > 0 && <span>By {message.author.join(', ')}</span>}{message.source.length > 0 && <span>Source: {message.source.join(', ')}</span>}{message.articleTime && <span>Article: {dateLabel(message.articleTime)}</span>}</div>}</>}
          <time>{timeLabel(message.createdAt)}</time>
        </div>
        {editing === message.id ? <div className="edit-actions"><button className="button button-quiet" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" disabled={busy === `edit-${message.id}`} onClick={() => saveEdit(message.id)}>{busy === `edit-${message.id}` && <span className="spinner" />}{busy === `edit-${message.id}` ? 'Saving' : 'Save'}</button></div> : <div className="row-actions" onClick={(event) => event.stopPropagation()}>
          <button className="icon-button collapse-button" onClick={() => toggleMessage(message.id)} aria-label={collapsed ? 'Expand message' : 'Collapse message'} aria-expanded={!collapsed}><Icon name={collapsed ? 'chevronRight' : 'chevronDown'} /></button>
          <div className="menu-wrap"><button className="icon-button row-menu-button" onClick={() => setOpenMenu(openMenu === message.id ? null : message.id)} aria-label="Message actions" aria-expanded={openMenu === message.id}><Icon name="more" /></button>
            {openMenu === message.id && <div className="action-menu"><button onClick={() => { setReadStatus(message.id, !message.isRead); setOpenMenu(null); }}><Icon name="check" />{message.isRead ? 'Mark unread' : 'Mark read'}</button><button onClick={() => { setEditing(message.id); setEditTitle(message.title); setEditText(message.text); setEditArticleTime(message.articleTime ? message.articleTime.slice(0, 10) : ''); toggleMessage(message.id, false); setOpenMenu(null); }}><Icon name="edit" />Edit</button><button className="danger" onClick={() => setPendingDelete(message.id)}><Icon name="trash" />Delete</button></div>}
          </div>
        </div>}
      </article>;
    })}
  </div>;
}
