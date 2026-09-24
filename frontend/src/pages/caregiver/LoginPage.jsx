import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, user } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stateId, setStateId] = useState('1'); // Default Florida (1)

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // If already logged in, redirect to appropriate role portal
  if (user) {
    if (user.role === 'administrator') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'client') return <Navigate to="/client/dashboard" replace />;
    return <Navigate to="/caregiver/dashboard" replace />;
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'administrator') {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedUser.role === 'client') {
        navigate('/client/dashboard', { replace: true });
      } else {
        navigate('/caregiver/dashboard', { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.detail || 'Sign in failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, 'caregiver', parseInt(stateId, 10), {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });
      // Auto-login after registration
      await login(email, password);
      navigate('/caregiver/dashboard');
    } catch (err) {
      setErrorMsg(err.detail || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="text-center mb-6">
        <h1 className="page-title mb-2">
          Caregiver Portal
        </h1>
        <p className="page-subtitle text-sm">
          {mode === 'login' ? 'Sign in to access your dashboard, documents, and training.' : 'Register as a caregiver candidate.'}
        </p>
      </div>

      <div className="tab-nav">
        <button
          type="button"
          onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`tab-button ${mode === 'login' ? 'tab-button-active' : ''}`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`tab-button ${mode === 'register' ? 'tab-button-active' : ''}`}
        >
          Create Account
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success">
          {successMsg}
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="caregiver@example.com"
            />
          </div>

          <div>
            <label htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full mt-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="reg-state">
              Operating State
            </label>
            <select
              id="reg-state"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
            >
              <option value="1">Florida (FL)</option>
              <option value="2">Indiana (IN)</option>
              <option value="3">Georgia (GA)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
            <div>
              <label htmlFor="reg-firstname">
                First Name
              </label>
              <input
                id="reg-firstname"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="reg-lastname">
                Last Name
              </label>
              <input
                id="reg-lastname"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-phone">
              Phone Number
            </label>
            <input
              id="reg-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </div>

          <div>
            <label htmlFor="reg-email">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="caregiver@example.com"
            />
          </div>

          <div>
            <label htmlFor="reg-password">
              Create Password
            </label>
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label htmlFor="reg-confirm">
              Confirm Password
            </label>
            <input
              id="reg-confirm"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full mt-2"
          >
            {isLoading ? 'Creating Account...' : 'Register Caregiver'}
          </button>
        </form>
      )}

      <div className="text-center text-sm mt-6">
        <Link to="/florida" className="text-secondary">
          ← Back to Public Website
        </Link>
      </div>
    </div>
  );
}
