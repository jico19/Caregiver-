import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { homePathFor } from '../../../shared/lib/roles';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, user } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [stateId, setStateId] = useState('1'); // Default Florida (1)

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // If already logged in, redirect to appropriate role portal
  if (user) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const loggedUser = await login(email, password);
      navigate(homePathFor(loggedUser), { replace: true });
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
      await register(email, password, 'client', parseInt(stateId, 10));
      // Auto-login after registration
      await login(email, password);
      navigate('/client/dashboard');
    } catch (err) {
      setErrorMsg(err.detail || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="card bg-base-100 border border-base-200 shadow-sm p-8 max-w-[440px] mx-auto my-12">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-base-content mb-1">
          Client & Family Portal
        </h1>
        <p className="text-secondary text-sm">
          {mode === 'login' ? 'Sign in to access your care plan, authorizations, and documents.' : 'Create an account to start intake and services.'}
        </p>
      </div>

      <div role="tablist" className="tabs tabs-border mb-6">
        <button
          type="button"
          role="tab"
          onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`tab ${mode === 'login' ? 'tab-active font-semibold text-success' : ''}`}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`tab ${mode === 'register' ? 'tab-active font-semibold text-success' : ''}`}
        >
          Create Account
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-4">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success mb-4">
          {successMsg}
        </div>
      )}

      {mode === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label text-sm font-medium text-base-content mb-1" htmlFor="client-email">
              Email Address
            </label>
            <input
              id="client-email"
              type="email"
              required
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="form-control">
            <label className="label text-sm font-medium text-base-content mb-1" htmlFor="client-password">
              Password
            </label>
            <input
              id="client-password"
              type="password"
              required
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-success text-white w-full mt-2"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4">
          <div className="form-control">
            <label className="label text-sm font-medium text-base-content mb-1" htmlFor="client-reg-state">
              State of Care
            </label>
            <select
              id="client-reg-state"
              className="select select-bordered w-full"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
            >
              <option value="1">Florida (FL)</option>
              <option value="2">Indiana (IN)</option>
              <option value="3">Georgia (GA)</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label text-sm font-medium text-base-content mb-1" htmlFor="client-reg-email">
              Email Address
            </label>
            <input
              id="client-reg-email"
              type="email"
              required
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="form-control">
            <label className="label text-sm font-medium text-base-content mb-1" htmlFor="client-reg-password">
              Password
            </label>
            <input
              id="client-reg-password"
              type="password"
              required
              minLength={6}
              className="input input-bordered w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-control">
            <label className="label text-sm font-medium text-base-content mb-1" htmlFor="client-reg-confirm">
              Confirm Password
            </label>
            <input
              id="client-reg-confirm"
              type="password"
              required
              minLength={6}
              className="input input-bordered w-full"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-success text-white w-full mt-2"
          >
            {isLoading ? 'Creating Account...' : 'Register Client Account'}
          </button>
        </form>
      )}

      <div className="text-center text-sm mt-6">
        <Link to="/florida" className="text-secondary hover:underline">
          ← Back to Public Website
        </Link>
      </div>
    </div>
  );
}