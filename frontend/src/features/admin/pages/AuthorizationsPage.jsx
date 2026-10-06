import { useAuth } from '../../../shared/hooks/useAuth';
import { useAuthorizationsData } from '../hooks/useAuthorizationsData';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import AuthorizationMetrics from '../components/authorizations/AuthorizationMetrics';
import AuthorizationForm from '../components/authorizations/AuthorizationForm';
import AuthorizationToolbar from '../components/authorizations/AuthorizationToolbar';
import AuthorizationsTable from '../components/authorizations/AuthorizationsTable';

export default function AuthorizationsPage() {
  const { token } = useAuth();
  const data = useAuthorizationsData(token);

  return (
    <PageContainer>
      <PageHeader
        title="Medicaid Authorizations"
        badge="FL • IN • GA"
        badgeVariant="info"
        description="Issue, track expiration windows, and maintain compliance for state Medicaid service approvals."
        actions={
          <button
            type="button"
            onClick={() => data.setShowForm(!data.showForm)}
            className={`btn btn-sm ${data.showForm ? 'btn-ghost' : 'btn-primary'}`}
          >
            {data.showForm ? (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Close Form
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Issue New Authorization
              </>
            )}
          </button>
        }
      />

      {data.errorMsg && (
        <div role="alert" className="alert alert-error mb-4 flex justify-between items-center text-sm py-2 px-4 rounded-box">
          <span>{data.errorMsg}</span>
          <button type="button" onClick={() => data.setErrorMsg('')} className="btn btn-ghost btn-xs btn-circle">✕</button>
        </div>
      )}

      {data.successMsg && (
        <div role="status" className="alert alert-success mb-4 flex justify-between items-center text-sm py-2 px-4 rounded-box">
          <span>{data.successMsg}</span>
          <button type="button" onClick={() => data.setSuccessMsg('')} className="btn btn-ghost btn-xs btn-circle">✕</button>
        </div>
      )}

      <AuthorizationMetrics
        metrics={data.metrics}
        filterStatus={data.filterStatus}
        onSelectStatus={data.setFilterStatus}
      />

      {data.showForm && (
        <AuthorizationForm
          clients={data.clients}
          clientId={data.clientId}
          selectedClient={data.selectedClient}
          onClientChange={data.handleClientChange}
          authNumber={data.authNumber}
          setAuthNumber={data.setAuthNumber}
          onRegenerateAuthNumber={data.handleRegenerateAuthNumber}
          startDate={data.startDate}
          setStartDate={data.setStartDate}
          endDate={data.endDate}
          setEndDate={data.setEndDate}
          onApplyDurationPreset={data.applyDurationPreset}
          notes={data.notes}
          setNotes={data.setNotes}
          submitting={data.submitting}
          onSubmit={data.handleCreateAuth}
          onClose={() => data.setShowForm(false)}
        />
      )}

      <AuthorizationToolbar
        searchTerm={data.searchTerm}
        onSearchChange={data.setSearchTerm}
        onClearSearch={() => data.setSearchTerm('')}
        filterState={data.filterState}
        onFilterStateChange={data.setFilterState}
        filterStatus={data.filterStatus}
        onFilterStatusChange={data.setFilterStatus}
        sortBy={data.sortBy}
        onSortByChange={data.setSortBy}
        hasActiveFilters={data.hasActiveFilters}
        onResetFilters={data.handleResetFilters}
        filteredCount={data.filteredAuthorizations.length}
        totalCount={data.authorizations.length}
      />

      <AuthorizationsTable
        loading={data.loading}
        totalCount={data.authorizations.length}
        filteredAuthorizations={data.filteredAuthorizations}
        copiedAuthId={data.copiedAuthId}
        onCopyAuthNumber={data.handleCopyAuthNumber}
        reviewingId={data.reviewingId}
        reviewAction={data.reviewAction}
        onReview={data.handleReview}
        onOpenForm={() => data.setShowForm(true)}
        onResetFilters={data.handleResetFilters}
      />
    </PageContainer>
  );
}
