'use client';

import Link from 'next/link';
import Icon from './Icon';

function articleHeading(message) {
  if (message.title.trim()) return message.title.normalize('NFC');
  const excerpt = message.text.normalize('NFC').replace(/\s+/g, ' ').trim();
  return excerpt.length > 72 ? `${excerpt.slice(0, 72).trimEnd()}...` : excerpt;
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function ArticleCards({ messages, hasFilters }) {
  if (!messages.length) return <div className="empty-state"><Icon name={hasFilters ? 'search' : 'read'} /><h2>{hasFilters ? 'No matching articles' : 'No articles yet'}</h2><p>{hasFilters ? 'Adjust or clear the filters to see more.' : 'Articles will appear here when added.'}</p></div>;

  return <div className="article-grid">
    {messages.map((message) => <Link className={`article-card${message.isRead ? '' : ' unread'}`} href={`/articles/${message.id}`} key={message.id}>
      <div className="article-card-top">
        <span className="article-kicker">{message.category || message.source[0] || 'Article'}</span>
        {!message.isRead && <span className="unread-label">Unread</span>}
      </div>
      <h2>{articleHeading(message)}</h2>
      <p>{message.text.normalize('NFC').replace(/\s+/g, ' ').trim()}</p>
      <div className="article-card-footer">
        <span>{message.author.length ? message.author.join(', ') : 'Unknown author'}</span>
        <time>{dateLabel(message.articleTime || message.createdAt)}</time>
        <Icon name="arrowRight" />
      </div>
    </Link>)}
  </div>;
}
