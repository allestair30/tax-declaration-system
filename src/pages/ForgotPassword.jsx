import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../assets/services/userAuth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      await requestPasswordReset(email);
      setMessage('If an account exists for this email, a password reset link has been sent. Please check your email.');
    } catch (err) {
      setError(err?.message || 'Unable to send the password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-900 text-white p-7 text-center">
          <div className="text-3xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold">Recover Password</h1>
          <p className="text-blue-200 text-sm mt-1">Property Owner Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Forgot your password?</h2>
            <p className="text-xs text-slate-500 mt-1">Enter your registered email address and we will send you a secure reset link.</p>
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
          {message && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">{message}</div>}
          <label className="block text-sm font-semibold text-slate-700">
            Email Address
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </label>
          <button disabled={loading} className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
          <div className="text-center text-sm">
            <Link to="/user-login" className="text-blue-700 font-semibold hover:underline">← Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
