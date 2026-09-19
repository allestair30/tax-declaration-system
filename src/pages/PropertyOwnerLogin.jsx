import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginPropertyOwner } from '../assets/services/userAuth';

export default function PropertyOwnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password security checker
  const getPasswordStrength = (value) => {
    if (!value) {
      return {
        label: '',
        color: '',
        width: '0%',
      };
    }

    let score = 0;

    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    if (score <= 2) {
      return {
        label: 'Weak password',
        color: 'bg-red-500',
        width: '33%',
      };
    }

    if (score <= 4) {
      return {
        label: 'Medium password',
        color: 'bg-yellow-500',
        width: '66%',
      };
    }

    return {
      label: 'Strong password',
      color: 'bg-green-500',
      width: '100%',
    };
  };

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError('');

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      await loginPropertyOwner(cleanEmail, password);
      navigate('/user-dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        <div className="bg-blue-900 text-white p-7 text-center">
          <div className="text-3xl mb-2">🏠</div>

          <h1 className="text-2xl font-bold">
            Property Owner Portal
          </h1>

          <p className="text-blue-200 text-sm mt-1">
            Tax Declaration Online Services
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5">

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Sign in to your account
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Use your registered email and password.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          <label className="block text-sm font-semibold text-slate-700">
            Email Address

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Password

            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-12 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                autoComplete="current-password"
              />

              {/* Show / Hide Password */}
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-700 text-sm font-semibold"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Password Security Indicator */}
            {password && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${passwordStrength.color} transition-all duration-300`}
                    style={{
                      width: passwordStrength.width,
                    }}
                  />
                </div>

                <div className="flex justify-between items-center mt-1">
                  <span
                    className={`text-xs ${
                      passwordStrength.label === 'Weak password'
                        ? 'text-red-600'
                        : passwordStrength.label === 'Medium password'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>

                  <span className="text-[10px] text-slate-400">
                    Password security
                  </span>
                </div>
              </div>
            )}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition"
          >
            {loading ? 'Signing in...' : 'Login to User Portal'}
          </button>

          <div className="text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-blue-700 font-semibold hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <div className="text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/user-register"
              className="text-blue-700 font-bold hover:underline"
            >
              Create Account
            </Link>
          </div>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-xs text-slate-500 hover:text-slate-800"
          >
            ← Back to Home
          </button>

        </form>
      </div>
    </div>
  );
}