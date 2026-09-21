import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../AdminWebsiteCSS/Pagination.css';

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    const halfRange = Math.floor(maxPagesToShow / 2);
    
    let startPage = Math.max(1, currentPage - halfRange);
    let endPage = Math.min(totalPages, currentPage + halfRange);
    
    // Adjust range if near start or end
    if (currentPage <= halfRange) {
      endPage = Math.min(totalPages, maxPagesToShow);
    }
    if (currentPage > totalPages - halfRange) {
      startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    }

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="pagination-wrapper">
      <span className="pagination-info">
        Showing {startItem}–{endItem} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          className="pagination-btn pagination-arrow"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        
        <div className="pagination-numbers">
          {getPageNumbers().map((page, idx) =>
            page === '...' ? (
              <span key={`dots-${idx}`} className="pagination-dots">…</span>
            ) : (
              <button
                key={page}
                className={`pagination-btn pagination-num ${currentPage === page ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                title={`Go to page ${page}`}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          className="pagination-btn pagination-arrow"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
      <div className="pagination-page-indicator">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
};

export default Pagination;
