import { Link } from 'react-router-dom';

export default function CaregiverAssignmentsSection({
  assignments,
  availableCaregivers,
  selectedCaregiverId,
  setSelectedCaregiverId,
  selectedRole,
  setSelectedRole,
  assigning,
  handleAssignCaregiver,
  handleEndAssignment,
}) {
  return (
    <div className="card p-5 mt-6">
      <h2 className="section-title m-0 mb-4">
        Assigned Caregivers ({assignments.length})
      </h2>

      <form onSubmit={handleAssignCaregiver} className="bg-gray-50 border p-4 rounded mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div>
            <label htmlFor="assign-cg" className="block text-sm font-medium mb-1">Select Caregiver</label>
            <select
              id="assign-cg"
              required
              value={selectedCaregiverId}
              onChange={(e) => setSelectedCaregiverId(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="">-- Choose Caregiver --</option>
              {availableCaregivers.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.first_name} {cg.last_name} ({cg.ssn_last4 ? `SSN: ***-${cg.ssn_last4}` : cg.id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="assign-role" className="block text-sm font-medium mb-1">Assignment Role</label>
            <select
              id="assign-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="primary">Primary Caregiver</option>
              <option value="backup">Backup Caregiver</option>
              <option value="relief">Relief Caregiver</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={assigning || !selectedCaregiverId} className="btn-primary w-full">
              {assigning ? 'Assigning...' : '+ Assign Caregiver'}
            </button>
          </div>
        </div>
      </form>

      {assignments.length === 0 ? (
        <div className="table-empty-sm">No caregivers assigned yet. Assign a caregiver above.</div>
      ) : (
        <div className="table-responsive">
          <table className="table-admin">
            <thead>
              <tr>
                <th>Caregiver</th>
                <th>Role</th>
                <th>Contact</th>
                <th>Assigned Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((asg) => {
                const cg = asg.caregivers;
                const cgId = asg.caregiver_id || cg?.id;
                return (
                  <tr key={asg.id}>
                    <td className="cell-strong">
                      {cg ? (
                        <Link to={`/admin/caregivers/${cg.id}`} className="text-primary underline">
                          {cg.first_name} {cg.last_name}
                        </Link>
                      ) : (cgId || 'Caregiver')}
                    </td>
                    <td>
                      <span className="badge badge-info capitalize">
                        {asg.role || 'primary'}
                      </span>
                    </td>
                    <td className="cell-muted">{cg?.phone || '—'}</td>
                    <td className="cell-muted">
                      {asg.assigned_at ? new Date(asg.assigned_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleEndAssignment(cgId)}
                        className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
                      >
                        End Assignment
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
