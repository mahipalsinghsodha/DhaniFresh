import React, { useState } from 'react'
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiCornerDownLeft
} from 'react-icons/fi'

/**
 * Enterprise Responsive Pagination Component
 * Supports large datasets (10,000+ items / 500+ pages) and custom page sizes (20, 50, 100, 200, 500, 1000).
 */
const Pagination = ({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 20,
  pageSizeOptions = [20, 50, 100, 200, 500, 1000],
  onPageChange,
  onPageSizeChange,
  itemName = 'items',
  className = ''
}) => {
  const [jumpInput, setJumpInput] = useState('')

  if (totalPages <= 1 && (!pageSizeOptions || totalItems <= pageSizeOptions[0])) {
    return null
  }

  // Calculate items range
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems || page * pageSize)

  // Generate sliding window with smart ellipsis
  const getPageNumbers = () => {
    const pages = []
    const delta = 2 // number of pages around current page

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }

    // Always include page 1
    pages.push(1)

    const left = Math.max(2, page - delta)
    const right = Math.min(totalPages - 1, page + delta)

    if (left > 2) {
      pages.push('ellipsis-left')
    }

    for (let i = left; i <= right; i++) {
      pages.push(i)
    }

    if (right < totalPages - 1) {
      pages.push('ellipsis-right')
    }

    // Always include last page
    pages.push(totalPages)

    return pages
  }

  const handleJump = (e) => {
    e.preventDefault()
    const target = parseInt(jumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target)
      setJumpInput('')
    }
  }

  const pageNumbers = getPageNumbers()

  return (
    <div
      className={`w-full flex flex-col lg:flex-row items-center justify-between gap-4 py-3.5 px-3 sm:px-5 bg-white border border-brand-primary/10 rounded-2xl shadow-xs mt-6 ${className}`}
    >
      {/* ── Left: Summary Text & Page Size Selector ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-[13px] text-brand-text/70 order-2 lg:order-1">
        {totalItems > 0 ? (
          <span>
            Showing <strong className="text-brand-primary font-bold">{startItem.toLocaleString()}–{endItem.toLocaleString()}</strong> of{' '}
            <strong className="text-brand-primary font-bold">{totalItems.toLocaleString()}</strong> {itemName}
            <span className="hidden sm:inline text-brand-text/40 ml-1.5">
              (Page <strong className="text-brand-primary font-semibold">{page}</strong> of <strong className="text-brand-primary font-semibold">{totalPages.toLocaleString()}</strong>)
            </span>
          </span>
        ) : (
          <span>
            Page <strong className="text-brand-primary font-bold">{page}</strong> of{' '}
            <strong className="text-brand-primary font-bold">{totalPages.toLocaleString()}</strong>
          </span>
        )}

        {/* Rows per page selector */}
        {onPageSizeChange && pageSizeOptions?.length > 0 && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-brand-primary/10">
            <span className="text-[11px] font-semibold text-brand-text/60">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2 text-xs font-bold rounded-lg border border-brand-primary/15 bg-[var(--ivory)] text-brand-primary outline-none focus:border-brand-secondary cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Right: Page Navigation Buttons ── */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 order-1 lg:order-2">
        {/* First Page */}
        {page > 3 && totalPages > 5 && (
          <button
            onClick={() => onPageChange(1)}
            title="First Page"
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-brand-primary/10 bg-white text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary/30 transition-all cursor-pointer"
          >
            <FiChevronsLeft size={14} />
          </button>
        )}

        {/* Previous Button */}
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous Page"
          className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-xl border border-brand-primary/10 bg-white text-xs font-bold text-brand-primary/80 hover:text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary/30 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <FiChevronLeft size={14} />
          <span className="hidden md:inline">Prev</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === 'ellipsis-left' || p === 'ellipsis-right') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-6 h-8 flex items-center justify-center text-xs font-bold text-brand-text/40 select-none"
                >
                  •••
                </span>
              )
            }

            const isActive = p === page
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-xs font-black scale-105'
                    : 'bg-white border border-brand-primary/10 text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary/30'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next Page"
          className="h-8 px-2.5 flex items-center justify-center gap-1 rounded-xl border border-brand-primary/10 bg-white text-xs font-bold text-brand-primary/80 hover:text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary/30 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <span className="hidden md:inline">Next</span>
          <FiChevronRight size={14} />
        </button>

        {/* Last Page */}
        {page < totalPages - 2 && totalPages > 5 && (
          <button
            onClick={() => onPageChange(totalPages)}
            title="Last Page"
            className="w-8 h-8 flex items-center justify-center rounded-xl border border-brand-primary/10 bg-white text-brand-primary/70 hover:text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary/30 transition-all cursor-pointer"
          >
            <FiChevronsRight size={14} />
          </button>
        )}

        {/* Quick Jump Input for 10+ pages */}
        {totalPages > 10 && (
          <form onSubmit={handleJump} className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-brand-primary/10">
            <span className="text-[11px] text-brand-text/50 font-medium">Go to</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value)}
              placeholder="Page"
              className="w-14 h-8 px-2 text-xs font-bold text-center border border-brand-primary/15 rounded-lg outline-none focus:border-brand-secondary bg-[var(--ivory)] text-brand-primary"
            />
            <button
              type="submit"
              disabled={!jumpInput}
              className="h-8 px-2 flex items-center justify-center rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 disabled:opacity-30 transition-all cursor-pointer"
            >
              <FiCornerDownLeft size={11} />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Pagination
