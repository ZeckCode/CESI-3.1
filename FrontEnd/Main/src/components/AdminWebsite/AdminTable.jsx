import React, { useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, Filter, AlertCircle, Inbox } from 'lucide-react';
import Pagination from './Pagination';
import '../AdminWebsiteCSS/AdminTable.css';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const SKELETON_ROWS = 8;

/**
 * AdminTable — reusable data-table component for admin modules.
 *
 * @param {Array}    columns   – [{ key, label, sortable?, render?(value, row), className?, headerClassName? }]
 * @param {Array}    data      – Row objects
 * @param {boolean}  loading   – Show skeleton rows
 * @param {ReactNode} emptyState – Custom empty-state content
 * @param {object}   [search]  – { value, onChange, placeholder }
 * @param {object}   [filter]  – { value, onChange, options: [{value, label}], label, allLabel }
 * @param {object}   [pagination] – { currentPage, totalPages, totalItems, itemsPerPage, onPageChange, onPageSizeChange }
 * @param {Function} [rowActions] – (row) => ReactNode  (rendered in last column)
 * @param {Function} [onRowClick] – (row) => void
 * @param {object}   [checkbox] – { selected: Set|Array, onSelectAll, onSelect, getId: (row)=>string }
 * @param {boolean}  zebra       – Enable zebra striping (default true)
 * @param {boolean}  stickyHeader – Sticky header (default true)
 * @param {string}   [rowKey]    – Field to use as React key (default: 'id')
 * @param {ReactNode} [topContent] – Rendered above the table
 */
const AdminTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyState,
  search,
  filter,
  pagination,
  rowActions,
  onRowClick,
  checkbox,
  zebra = true,
  stickyHeader = true,
  rowKey = 'id',
  topContent,
}) => {
  const [sortKey, setSortKey] = React.useState(null);
  const [sortDir, setSortDir] = React.useState('asc');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const isEmpty = !loading && (!data || data.length === 0);

  const allSelected = useMemo(() => {
    if (!checkbox || !checkbox.selected || !checkbox.getId || !data.length) return false;
    const sel = checkbox.selected instanceof Set ? checkbox.selected : new Set(checkbox.selected);
    if (sel.size === 0) return false;
    return data.every((row) => sel.has(checkbox.getId(row)));
  }, [checkbox, data]);

  const someSelected = useMemo(() => {
    if (!checkbox || !checkbox.selected || !checkbox.getId || !data.length) return false;
    const sel = checkbox.selected instanceof Set ? checkbox.selected : new Set(checkbox.selected);
    if (sel.size === 0) return false;
    return data.some((row) => sel.has(checkbox.getId(row)));
  }, [checkbox, data]);

  const isSelected = (row) => {
    if (!checkbox || !checkbox.selected || !checkbox.getId) return false;
    const sel = checkbox.selected instanceof Set ? checkbox.selected : new Set(checkbox.selected);
    return sel.has(checkbox.getId(row));
  };

  const showTopBar = search || filter || topContent;

  return (
    <div className="admintbl-root">
      {/* ── Search / Filter bar ── */}
      {showTopBar && (
        <div className="admintbl-topbar">
          {topContent && <div className="admintbl-topcontent">{topContent}</div>}
          <div className="admintbl-controls">
            {search && (
              <div className="admintbl-search">
                <Search size={15} className="admintbl-search-icon" />
                <input
                  type="text"
                  className="admintbl-search-input"
                  placeholder={search.placeholder || 'Search...'}
                  value={search.value || ''}
                  onChange={(e) => search.onChange && search.onChange(e.target.value)}
                />
                {search.value && (
                  <button
                    className="admintbl-search-clear"
                    onClick={() => search.onChange && search.onChange('')}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            {filter && filter.options && filter.options.length > 0 && (
              <div className="admintbl-filter">
                <Filter size={14} className="admintbl-filter-icon" />
                <select
                  className="admintbl-filter-select"
                  value={filter.value || 'all'}
                  onChange={(e) => filter.onChange && filter.onChange(e.target.value)}
                >
                  <option value="all">{filter.allLabel || `All ${filter.label || ''}`}</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className={`admintbl-wrap ${stickyHeader ? 'admintbl-sticky' : ''}`}>
        <table className={`admintbl-table ${zebra ? 'admintbl-zebra' : ''}`}>
          <thead>
            <tr>
              {checkbox && (
                <th className="admintbl-th admintbl-th-checkbox">
                  <input
                    type="checkbox"
                    className="admintbl-checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={(e) => checkbox.onSelectAll && checkbox.onSelectAll(e.target.checked)}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`admintbl-th ${col.headerClassName || ''} ${col.sortable ? 'admintbl-sortable' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="admintbl-th-label">{col.label}</span>
                  {col.sortable && sortKey === col.key && (
                    <span className="admintbl-sort-icon">
                      {sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  )}
                </th>
              ))}
              {rowActions && <th className="admintbl-th admintbl-th-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <tr key={`skel-${i}`} className="admintbl-skel-row">
                  {checkbox && <td className="admintbl-td"><div className="admintbl-skel admintbl-skel-sm" /></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="admintbl-td">
                      <div className="admintbl-skel" style={{ width: `${60 + Math.random() * 35}%` }} />
                    </td>
                  ))}
                  {rowActions && <td className="admintbl-td"><div className="admintbl-skel admintbl-skel-sm" /></td>}
                </tr>
              ))}
            {!loading && isEmpty && (
              <tr>
                <td
                  colSpan={columns.length + (checkbox ? 1 : 0) + (rowActions ? 1 : 0)}
                  className="admintbl-empty"
                >
                  {emptyState || (
                    <div className="admintbl-empty-content">
                      <Inbox size={40} className="admintbl-empty-icon" />
                      <span className="admintbl-empty-text">No data available</span>
                    </div>
                  )}
                </td>
              </tr>
            )}
            {!loading &&
              sortedData.map((row) => (
                <tr
                  key={row[rowKey] ?? JSON.stringify(row)}
                  className={`admintbl-row ${onRowClick ? 'admintbl-clickable' : ''} ${checkbox && isSelected(row) ? 'admintbl-selected' : ''}`}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {checkbox && (
                    <td className="admintbl-td admintbl-td-checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="admintbl-checkbox"
                        checked={isSelected(row)}
                        onChange={(e) => checkbox.onSelect && checkbox.onSelect(row, e.target.checked)}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={`admintbl-td ${col.className || ''}`}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="admintbl-td admintbl-td-actions" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="admintbl-pagination-area">
          <div className="admintbl-page-size">
            <span className="admintbl-page-size-label">Rows per page:</span>
            <select
              className="admintbl-page-size-select"
              value={pagination.itemsPerPage || 10}
              onChange={(e) => pagination.onPageSizeChange && pagination.onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            itemsPerPage={pagination.itemsPerPage || 10}
            onPageChange={pagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
};

export default AdminTable;
