import Card from '../../../../shared/components/common/Card';
import FormField from '../../../../shared/components/common/FormField';
import StatusBadge from '../../../../shared/components/common/StatusBadge';
import EmptyState from '../../../../shared/components/common/EmptyState';
import {
  DAY_OPTIONS,
  SCHEDULE_STATUS_LABELS,
  SERVICE_OPTIONS,
} from '../../constants/clientDetailConstants';

export default function ScheduleSection({
  schedule,
  schedDay,
  setSchedDay,
  schedStart,
  setSchedStart,
  schedEnd,
  setSchedEnd,
  schedService,
  setSchedService,
  schedCustomService,
  setSchedCustomService,
  schedStatus,
  setSchedStatus,
  schedNotes,
  setSchedNotes,
  addingSched,
  handleAddSchedule,
  handleDeleteSchedule,
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-base-300">
        <h2 className="font-semibold text-base text-slate-900 m-0">
          Visit Schedule ({schedule.length})
        </h2>
      </div>

      <div className="p-4 border-b border-base-300 bg-base-200/30">
        <form onSubmit={handleAddSchedule} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <FormField label="Day of Week" id="sched-day">
              <select
                id="sched-day"
                className="select select-bordered select-sm w-full text-xs"
                value={schedDay}
                onChange={(e) => setSchedDay(e.target.value)}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" id="sched-status">
              <select
                id="sched-status"
                className="select select-bordered select-sm w-full text-xs"
                value={schedStatus}
                onChange={(e) => setSchedStatus(e.target.value)}
              >
                {Object.entries(SCHEDULE_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Start Time" id="sched-start" required>
              <input
                id="sched-start"
                type="time"
                required
                className="input input-bordered input-sm w-full text-xs"
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
              />
            </FormField>
            <FormField label="End Time" id="sched-end" required>
              <input
                id="sched-end"
                type="time"
                required
                className="input input-bordered input-sm w-full text-xs"
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
              />
            </FormField>
            <FormField label="Service" id="sched-service">
              <select
                id="sched-service"
                className="select select-bordered select-sm w-full text-xs"
                value={schedService}
                onChange={(e) => setSchedService(e.target.value)}
              >
                <option value="">No service</option>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {schedService === 'custom' && (
                <input
                  type="text"
                  maxLength={200}
                  value={schedCustomService}
                  onChange={(e) => setSchedCustomService(e.target.value)}
                  placeholder="Enter custom service name"
                  className="input input-bordered input-xs w-full text-xs mt-1"
                />
              )}
            </FormField>
            <FormField label="Notes" id="sched-notes">
              <input
                id="sched-notes"
                type="text"
                className="input input-bordered input-sm w-full text-xs"
                value={schedNotes}
                onChange={(e) => setSchedNotes(e.target.value)}
                placeholder="Optional care instructions"
              />
            </FormField>
          </div>
          <div>
            <button type="submit" disabled={addingSched} className="btn btn-primary btn-sm">
              {addingSched ? 'Adding...' : '+ Add Schedule Entry'}
            </button>
          </div>
        </form>
      </div>

      {schedule.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No schedule entries"
            description="No schedule entries yet. Add the first visit above."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr className="border-b border-base-300 text-slate-500 text-xs bg-base-200/50">
                <th>Day</th>
                <th>Time</th>
                <th>Service</th>
                <th>Status</th>
                <th>Notes</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr key={entry.id} className="border-b border-base-300/60 hover:bg-base-200/50">
                  <td className="font-semibold text-slate-900 text-xs">{entry.day_of_week}</td>
                  <td className="font-mono text-xs text-slate-700">{entry.start_time} – {entry.end_time}</td>
                  <td className="text-slate-600 text-xs">{entry.service || '—'}</td>
                  <td>
                    <StatusBadge
                      status={entry.status}
                      label={SCHEDULE_STATUS_LABELS[entry.status] || entry.status}
                    />
                  </td>
                  <td className="text-slate-500 text-xs">{entry.notes || '—'}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteSchedule(entry)}
                      className="btn btn-ghost btn-xs text-red-600 hover:bg-red-50 border border-red-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
