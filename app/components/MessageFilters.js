'use client';

import Icon from './Icon';
import SuggestionInput from './SuggestionInput';

export const defaultFilters = { query: '', author: '', source: '', category: '', from: '', to: '', status: 'all', order: 'newest' };

export default function MessageFilters({ filters, setFilters, authors, sources, categories, showCategory, shown, total }) {
  const update = (key) => (valueOrEvent) => setFilters((current) => ({ ...current, [key]: valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent }));
  const activeCount = ['query', 'author', 'source', 'category', 'from', 'to'].filter((key) => filters[key]).length + (filters.status !== 'all' ? 1 : 0) + (filters.order !== 'newest' ? 1 : 0);
  return (
    <details className="filter-panel">
      <summary><span><Icon name="filter" />Filters {activeCount > 0 && <b>{activeCount}</b>}</span><span className="filter-result">{shown} of {total}</span></summary>
      <div className="filter-content">
        <div className="search-field filter-search"><Icon name="search" /><input value={filters.query} onChange={update('query')} placeholder="Search titles and articles" aria-label="Search titles and articles" />{filters.query && <button onClick={() => update('query')('')} aria-label="Clear search"><Icon name="close" /></button>}</div>
        <div className="filter-grid">
          <label><span>Author</span><SuggestionInput value={filters.author} onChange={update('author')} suggestions={authors} placeholder="Any author" /></label>
          <label><span>Source</span><SuggestionInput value={filters.source} onChange={update('source')} suggestions={sources} placeholder="Any source" /></label>
          {showCategory && <label><span>Category</span><select value={filters.category} onChange={update('category')}><option value="">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>}
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
