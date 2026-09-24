import { useNavigate, useParams } from 'react-router-dom';
import { VALID_STATES } from '../../contexts/StateContext';

export default function StateSwitcher() {
  const navigate = useNavigate();
  const params = useParams();
  const currentState = params.state || 'florida';

  function handleChange(e) {
    const next = e.target.value;
    // Preserve the sub-path when switching states
    const pathSegments = window.location.pathname.split('/');
    // pathSegments[0] = '', pathSegments[1] = state, pathSegments[2+] = sub-path
    const subPath = pathSegments.slice(2).join('/');
    navigate(`/${next}${subPath ? '/' + subPath : ''}`);
  }

  return (
    <select value={currentState} onChange={handleChange} aria-label="Select state">
      {VALID_STATES.map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
