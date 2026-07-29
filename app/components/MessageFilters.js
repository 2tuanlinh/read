'use client';

import Icon from './Icon';
import SuggestionInput from './SuggestionInput';

export const defaultFilters = { query: '', author: '', source: '', from: '', to: '', status: 'all', order: 'newest' };

export function filterMessages(messages, filters) {
  const query = filters.query.trim().toLocaleLowerCase();
  const author = filters.author.trim().toLocaleLowerCase();
  const source = filters.source.trim().toLocaleLowerCase();
  const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : null;
  return messages.filter((message) => {
    const articleTime = message.articleTime ? new Date(message.articleTime).getTime() : null;
    return (!query || message.text.toLocaleLowerCase().includes(query) || message.title.toLocaleLowerCase().includes(query))
      && (!author || message.author.some((value) => value.toLocaleLowerCase().includes(author)))
      && (!source || message.source.some((value) => value.toLocaleLowerCase().includes(source)))
      && (filters.status === 'all' || (filters.status === 'read') === message.isRead)
      && (from === null || (articleTime !== null && articleTime >= from))
      && (to === null || (articleTime !== null && articleTime <= to));
  }).sort((left, right) => {
    const leftDate = left.articleTime ? new Date(left.articleTime).getTime() : null;
    const rightDate = right.articleTime ? new Date(right.articleTime).getTime() : null;
    if (leftDate === null && rightDate === null) return new Date(right.createdAt) - new Date(left.createdAt);
    if (leftDate === null) return 1;
    if (rightDate === null) return -1;
    return filters.order === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
  });
}

export default function MessageFilters({ filters, setFilters, authors, sources, shown, total }) {
  const update = (key) => (valueOrEvent) => setFilters((current) => ({ ...current, [key]: valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent }));
  const activeCount = ['query', 'author', 'source', 'from', 'to'].filter((key) => filters[key]).length + (filters.status !== 'all' ? 1 : 0) + (filters.order !== 'newest' ? 1 : 0);
  return (
    <details className="filter-panel">
      <summary><span><Icon name="filter" />Filters {activeCount > 0 && <b>{activeCount}</b>}</span><span className="filter-result">{shown} of {total}</span></summary>
      <div className="filter-content">
        <div className="search-field filter-search"><Icon name="search" /><input value={filters.query} onChange={update('query')} placeholder="Search titles and articles" aria-label="Search titles and articles" />{filters.query && <button onClick={() => update('query')('')} aria-label="Clear search"><Icon name="close" /></button>}</div>
        <div className="filter-grid">
          <label><span>Author</span><SuggestionInput value={filters.author} onChange={update('author')} suggestions={authors} placeholder="Any author" /></label>
          <label><span>Source</span><SuggestionInput value={filters.source} onChange={update('source')} suggestions={sources} placeholder="Any source" /></label>
          <label><span>From</span><input type="date" value={filters.from} onChange={update('from')} /></label>
          <label><span>To</span><input type="date" value={filters.to} onChange={update('to')} /></label>
          <label><span>Status</span><select value={filters.status} onChange={update('status')}><option value="all">All messages</option><option value="unread">Unread</option><option value="read">Read</option></select></label>
          <label><span>Order</span><select value={filters.order} onChange={update('order')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </div>
        <div className="filter-footer"><span>{shown} {shown === 1 ? 'message' : 'messages'} shown</span><button className="button button-quiet" disabled={!activeCount} onClick={() => setFilters(defaultFilters)}>Clear filters</button></div>
      </div>
    </details>
  );
}
