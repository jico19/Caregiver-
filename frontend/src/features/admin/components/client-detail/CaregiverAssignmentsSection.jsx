import { Link } from 'react-router-dom';
import Card from '../../../../shared/components/common/Card';
import FormField from '../../../../shared/components/common/FormField';
import EmptyState from '../../../../shared/components/common/EmptyState';

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
    <Card className="mb-6 p-0 overflow-hidden">
      <div className="p-4 border-b border-base-300">
        <h2 className="font-semibold text-base text-slate-900 m-0">
          Assigned Caregivers ({assignments.length})
        </h2>
      </div>

      <div className="p-4 border-b border-base-300 bg-base-200/30">
        <form onSubmit={handleAssignCaregiver}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <FormField label="Select Caregiver" id="assign-cg" required>
              <select
                id="assign-cg"
                required
                value={selectedCaregiverId}
                onChange={(e) => setSelectedCaregiverId(e.target.value)}
                className="select select-bordered select-sm w-full text-xs"
              >
                <option value="">-- Choose Caregiver --</option>
                {availableCaregivers.map((cg) => (
                  <option key={cg.id} value={cg.id}>
                    {cg.first_name} {cg.last_name} ({cg.ssn_last4 ? `SSN: ***-${cg.ssn_last4}` : cg.id})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Assignment Role" id="assign-role">
              <select
                id="assign-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="select select-bordered select-sm w-full text-xs"
              >
                <option value="primary">Primary Caregiver</option>
                <option value="backup">Backup Caregiver</option>
                <option value="relief">Relief Caregiver</option>
              </select>
            </FormField>

            <div>
              <button
                type="submit"
                disabled={assigning || !selectedCaregiverId}
                className="btn btn-primary btn-sm w-full"
              >
                {assigning ? 'Assigning...' : '+ Assign Caregiver'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {assignments.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No caregivers assigned"
            description="No caregivers assigned yet. Assign a caregiver above."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
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
                  <tr key={asg.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                    <td className="font-semibold text-slate-900 text-xs">
                      {cg ? (
                        <Link to={`/admin/caregivers/${cg.id}`} className="text-emerald-700 hover:text-emerald-800 underline">
                          {cg.first_name} {cg.last_name}
                        </Link>
                      ) : (cgId || 'Caregiver')}
                    </td>
                    <td>
                      <span className="badge badge-soft text-slate-700 text-xs capitalize">
                        {asg.role || 'primary'}
                      </span>
                    </td>
                    <td className="text-slate-600 text-xs">{cg?.phone || '—'}</td>
                    <td className="text-slate-600 text-xs">
                      {asg.assigned_at ? new Date(asg.assigned_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleEndAssignment(cgId)}
                        className="btn btn-ghost btn-xs text-red-600 hover:bg-red-50 border border-red-200"
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
    </Card>
  );
}
