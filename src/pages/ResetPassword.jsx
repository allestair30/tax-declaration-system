import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../assets/services/supabaseClient';
import { updatePropertyOwnerPassword } from '../assets/services/userAuth';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError || !data?.session) {
        setError('This password reset link is invalid or has expired. Please request a new reset link.');
        return;
      }

      setReady(true);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) setReady(true);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await updatePropertyOwnerPassword(password);
      setMessage('Your password has been updated successfully. You can now log in with your new password.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/user-login', { replace: true }), 1500);
    } catch (err) {
      setError(err?.message || 'Unable to update your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-900 text-white p-7 text-center">
          <div className="text-3xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold">Set New Password</h1>
          <p className="text-blue-200 text-sm mt-1">Property Owner Portal</p>
        </div>
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
          {message && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">{message}</div>}
          {ready && !message && (
            <>
              <label className="block text-sm font-semibold text-slate-700">
                New Password
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="At least 8 characters" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Confirm New Password
                <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Repeat your new password" />
              </label>
              <button disabled={loading} className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition">
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </>
          )}
          {!ready && !message && !error && <p className="text-sm text-slate-500">Validating your reset link...</p>}
        </form>
      </div>
    </div>
  );
}
