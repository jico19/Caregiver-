import Card from '../../../../shared/components/common/Card';

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
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search box */}
        <div className="relative min-w-[280px] flex-1 max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by Auth #, Client name, Medicaid #..."
            className="input input-bordered input-sm w-full pr-8 text-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
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
            className="select select-bordered select-sm text-sm"
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
            className="select select-bordered select-sm text-sm"
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
            className="select select-bordered select-sm text-sm"
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
              className="btn btn-ghost btn-sm text-slate-600 hover:text-slate-900"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Results counter */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-200 text-xs text-slate-500">
        <span>
          Showing <strong className="text-slate-900">{filteredCount}</strong> of <strong className="text-slate-900">{totalCount}</strong> authorization{totalCount === 1 ? '' : 's'}
        </span>
        {hasActiveFilters && (
          <span className="badge badge-sm badge-ghost font-medium">
            Filtered view active
          </span>
        )}
      </div>
    </Card>
  );
}
