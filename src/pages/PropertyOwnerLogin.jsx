import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginPropertyOwner } from '../assets/services/userAuth';

export default function PropertyOwnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginPropertyOwner(email, password);
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
          <h1 className="text-2xl font-bold">Property Owner Portal</h1>
          <p className="text-blue-200 text-sm mt-1">Tax Declaration Online Services</p>
        </div>
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-1">Use your registered email and password.</p>
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
          <label className="block text-sm font-semibold text-slate-700">
            Email Address
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@example.com" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
          </label>
          <button disabled={loading} className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition">
            {loading ? 'Signing in...' : 'Login to User Portal'}
          </button>
          <div className="text-center text-sm">
            <Link to="/forgot-password" className="text-blue-700 font-semibold hover:underline">
              Forgot Password?
            </Link>
          </div>
          <div className="text-center text-sm text-slate-600">
            Don't have an account? <Link to="/user-register" className="text-blue-700 font-bold hover:underline">Create Account</Link>
          </div>
          <button type="button" onClick={() => navigate('/')} className="w-full text-xs text-slate-500 hover:text-slate-800">← Back to Home</button>
        </form>
      </div>
    </div>
  );
}
