import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { homePathFor } from '../../../shared/lib/roles';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';

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
    <div className="w-full max-w-md mx-auto my-12 px-4">
      <Card>
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">
            Caregiver Portal
          </h1>
          <p className="text-xs text-slate-500 m-0">
            {mode === 'login' ? 'Sign in to access your dashboard, documents, and training.' : 'Register as a caregiver candidate.'}
          </p>
        </div>

        <div role="tablist" className="flex border-b border-base-300 mb-6">
          <button
            type="button"
            role="tab"
            onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 pb-2 text-xs text-center border-b-2 font-medium transition-colors ${
              mode === 'login'
                ? 'border-green-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 pb-2 text-xs text-center border-b-2 font-medium transition-colors ${
              mode === 'register'
                ? 'border-green-600 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Account
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className="alert alert-soft alert-error mb-4">
            <span className="text-xs">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" className="alert alert-soft alert-success mb-4">
            <span className="text-xs">{successMsg}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <FormField label="Email Address" htmlFor="login-email" required>
              <input
                id="login-email"
                type="email"
                required
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="caregiver@example.com"
              />
            </FormField>

            <FormField label="Password" htmlFor="login-password" required>
              <input
                id="login-password"
                type="password"
                required
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-sm w-full mt-2"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
            <FormField label="Operating State" htmlFor="reg-state">
              <select
                id="reg-state"
                className="select select-bordered w-full"
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
              >
                <option value="1">Florida (FL)</option>
                <option value="2">Indiana (IN)</option>
                <option value="3">Georgia (GA)</option>
              </select>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="First Name" htmlFor="reg-firstname" required>
                <input
                  id="reg-firstname"
                  type="text"
                  required
                  className="input input-bordered w-full"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </FormField>

              <FormField label="Last Name" htmlFor="reg-lastname" required>
                <input
                  id="reg-lastname"
                  type="text"
                  required
                  className="input input-bordered w-full"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Phone Number" htmlFor="reg-phone">
              <input
                id="reg-phone"
                type="tel"
                className="input input-bordered w-full"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 000-0000"
              />
            </FormField>

            <FormField label="Email Address" htmlFor="reg-email" required>
              <input
                id="reg-email"
                type="email"
                required
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="caregiver@example.com"
              />
            </FormField>

            <FormField label="Create Password" htmlFor="reg-password" required>
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </FormField>

            <FormField label="Confirm Password" htmlFor="reg-confirm" required>
              <input
                id="reg-confirm"
                type="password"
                required
                minLength={6}
                className="input input-bordered w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </FormField>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-sm w-full mt-2"
            >
              {isLoading ? 'Creating Account...' : 'Register Caregiver'}
            </button>
          </form>
        )}

        <div className="text-center text-xs mt-6 pt-4 border-t border-base-300">
          <Link to="/florida" className="text-slate-500 hover:text-slate-900 hover:underline">
            ← Back to Public Website
          </Link>
        </div>
      </Card>
    </div>
  );
}
