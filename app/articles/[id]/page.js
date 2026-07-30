'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';

const storageKey = 'private-chat.mongodb-uri';
const themeStorageKey = 'private-chat.theme';

function articleHeading(article) {
  if (article.title.trim()) return article.title.normalize('NFC');
  const excerpt = article.text.normalize('NFC').replace(/\s+/g, ' ').trim();
  return excerpt.length > 90 ? `${excerpt.slice(0, 90).trimEnd()}...` : excerpt;
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function ArticlePage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [state, setState] = useState('loading');
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const theme = localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    const uri = localStorage.getItem(storageKey) || '';
    if (!uri) {
      setError('Connect your MongoDB database from the reading list before opening an article.');
      setState('error');
      return;
    }

    const controller = new AbortController();
    fetch(`/api/messages/${id}`, {
      headers: { 'x-mongodb-uri': encodeURIComponent(uri) },
      signal: controller.signal
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
      setArticle(data.message);
      setState('success');
    }).catch((loadError) => {
      if (loadError.name === 'AbortError') return;
      setError(loadError.message);
      setState('error');
    });
    return () => controller.abort();
  }, [id]);

  if (state === 'loading') return <main className="article-state"><span className="spinner" />Loading article</main>;
  if (state === 'error') return <main className="article-state"><Icon name="read" /><h1>Article unavailable</h1><p>{error}</p><Link className="button button-primary" href="/">Return to articles</Link></main>;

  async function toggleReadStatus() {
    const uri = localStorage.getItem(storageKey) || '';
    if (!uri || statusBusy) return;
    setStatusBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-mongodb-uri': encodeURIComponent(uri) },
        body: JSON.stringify({ isRead: !article.isRead })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
      setArticle(data.message);
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setStatusBusy(false);
    }
  }

  const paragraphs = article.text.normalize('NFC').split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return <div className="article-page">
    <header className="article-reader-header"><div><Link href="/" className="reader-back"><Icon name="arrowLeft" />All articles</Link><div className="reader-header-actions"><button className="button button-quiet" disabled={statusBusy} onClick={toggleReadStatus}>{statusBusy ? <span className="spinner" /> : <Icon name="check" />}{statusBusy ? 'Updating' : article.isRead ? 'Mark unread' : 'Mark as read'}</button><span className="reader-brand">tuan2linh</span></div></div></header>
    <main className="article-reader">
      <article>
        {error && <div className="alert reader-alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" /></button></div>}
        <div className="reader-meta-top"><span>{article.category || article.source[0] || 'Article'}</span><time>{dateLabel(article.articleTime || article.createdAt)}</time></div>
        <h1>{articleHeading(article)}</h1>
        {(article.author.length || article.source.length) && <div className="reader-byline">{article.author.length > 0 && <span>By {article.author.join(', ')}</span>}{article.source.length > 0 && <span>From {article.source.join(', ')}</span>}</div>}
        <div className="article-body">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </article>
    </main>
  </div>;
}
