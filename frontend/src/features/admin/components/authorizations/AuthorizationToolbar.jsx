export default function AuthorizationToolbar({
  searchTerm,
  onSearchChange,
  onClearSearch,
  filterState,
  onFilterStateChange,
  filterStatus,
  onFilterStatusChange,
  sortBy,
  onSortByChange,
  hasActiveFilters,
  onResetFilters,
  filteredCount,
  totalCount,
}) {
  return (
    <div className="toolbar-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search box */}
        <div className="search-wrap">
          <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Auth #, Client name, Medicaid #..."
            className="search-input"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={onClearSearch}
              className="search-clear"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* State filter */}
          <select
            aria-label="Filter by state"
            value={filterState}
            onChange={(e) => onFilterStateChange(e.target.value)}
            className="filter-select"
          >
            <option value="all">All States</option>
            <option value="FL">Florida (FL)</option>
            <option value="IN">Indiana (IN)</option>
            <option value="GA">Georgia (GA)</option>
          </select>

          {/* Status filter */}
          <select
            aria-label="Filter by status"
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="expiring_soon">Expiring Soon (≤30d)</option>
            <option value="expired">Expired</option>
          </select>

          {/* Sort order */}
          <select
            aria-label="Sort authorizations"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="filter-select"
          >
            <option value="end_date_asc">Expiration: Soonest First</option>
            <option value="end_date_desc">Expiration: Latest First</option>
            <option value="created_desc">Recently Issued</option>
            <option value="client_name">Client Name (A–Z)</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="btn-reset"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Results counter */}
      <div className="results-bar">
        <span>
          Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> authorization{totalCount === 1 ? '' : 's'}
        </span>
        {hasActiveFilters && (
          <span className="filter-active-label">
            Filtered view active
          </span>
        )}
      </div>
    </div>
  );
}
