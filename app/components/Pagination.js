'use client';

import Icon from './Icon';

function pageItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const ordered = [...pages].filter((page) => page > 0 && page <= totalPages).sort((left, right) => left - right);
  return ordered.flatMap((page, index) => index > 0 && page - ordered[index - 1] > 1 ? ['ellipsis', page] : [page]);
}

export default function Pagination({ currentPage, pageSize, totalItems, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (!totalItems) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  return <nav className="pagination" aria-label="Pagination">
    <span className="pagination-summary">{firstItem}-{lastItem} of {totalItems}</span>
    <div className="pagination-pages">
      <button className="pagination-arrow" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page"><Icon name="arrowLeft" /></button>
      {pageItems(currentPage, totalPages).map((page, index) => page === 'ellipsis'
        ? <span className="pagination-ellipsis" key={`ellipsis-${index}`}>...</span>
        : <button className={page === currentPage ? 'active' : ''} onClick={() => onPageChange(page)} aria-current={page === currentPage ? 'page' : undefined} key={page}>{page}</button>)}
      <button className="pagination-arrow" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page"><Icon name="arrowRight" /></button>
    </div>
    <label className="page-size"><span>Per page</span><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
  </nav>;
}
