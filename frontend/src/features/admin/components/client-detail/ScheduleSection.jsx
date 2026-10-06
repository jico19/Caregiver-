import {
  DAY_OPTIONS,
  SCHEDULE_STATUS_BADGE,
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
    <div className="admin-card">
      <h2 className="section-title m-0 mb-4">
        Visit Schedule ({schedule.length})
      </h2>

      <form onSubmit={handleAddSchedule} className="card p-4 mb-4 flex flex-col gap-3">
        <div className="form-grid-2">
          <div>
            <label htmlFor="sched-day">Day of Week</label>
            <select id="sched-day" value={schedDay} onChange={(e) => setSchedDay(e.target.value)}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sched-status">Status</label>
            <select id="sched-status" value={schedStatus} onChange={(e) => setSchedStatus(e.target.value)}>
              {Object.entries(SCHEDULE_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sched-start">Start Time</label>
            <input
              id="sched-start"
              type="time"
              required
              value={schedStart}
              onChange={(e) => setSchedStart(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sched-end">End Time</label>
            <input
              id="sched-end"
              type="time"
              required
              value={schedEnd}
              onChange={(e) => setSchedEnd(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sched-service">Service</label>
            <select
              id="sched-service"
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
                className="mt-2"
              />
            )}
          </div>
          <div>
            <label htmlFor="sched-notes">Notes</label>
            <input
              id="sched-notes"
              type="text"
              value={schedNotes}
              onChange={(e) => setSchedNotes(e.target.value)}
              placeholder="Optional care instructions"
            />
          </div>
        </div>
        <div>
          <button type="submit" disabled={addingSched} className="btn-success">
            {addingSched ? 'Adding...' : '+ Add Schedule Entry'}
          </button>
        </div>
      </form>

      {schedule.length === 0 ? (
        <div className="table-empty-sm">No schedule entries yet. Add the first visit above.</div>
      ) : (
        <div className="table-responsive">
          <table className="table-admin">
            <thead>
              <tr>
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
                <tr key={entry.id}>
                  <td className="cell-strong">{entry.day_of_week}</td>
                  <td className="text-primary font-medium">{entry.start_time} – {entry.end_time}</td>
                  <td className="cell-muted">{entry.service || '—'}</td>
                  <td>
                    <span className={SCHEDULE_STATUS_BADGE[entry.status] || 'badge-info'}>
                      {SCHEDULE_STATUS_LABELS[entry.status] || entry.status}
                    </span>
                  </td>
                  <td className="cell-muted">{entry.notes || '—'}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteSchedule(entry)}
                      className="btn-sm border border-red-300 text-red-600 bg-white hover:bg-red-50"
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
    </div>
  );
}
