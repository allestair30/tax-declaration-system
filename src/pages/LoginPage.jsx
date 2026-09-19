import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  loginAdmin,
  loginAssessor,
} from '../assets/services/api';

import { supabase } from '../assets/services/supabaseClient';

/* =========================================================
   SECURITY CONFIGURATION
========================================================= */

const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_SECONDS = 30;

const STORAGE_KEYS = {
  FAILED_ATTEMPTS: 'tax_login_failed_attempts',
  LOCKOUT_UNTIL: 'tax_login_lockout_until',
};

/* =========================================================
   SAFE LOCAL STORAGE HELPERS
========================================================= */

function getStoredNumber(key, fallback = 0) {
  try {
    const value = Number(localStorage.getItem(key));

    if (!Number.isFinite(value) || value < 0) {
      return fallback;
    }

    return value;
  } catch (error) {
    console.error(
      '[SECURITY] Unable to read localStorage:',
      error
    );

    return fallback;
  }
}

function setStoredNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    console.error(
      '[SECURITY] Unable to write localStorage:',
      error
    );
  }
}

function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(
      '[SECURITY] Unable to remove localStorage value:',
      error
    );
  }
}

/* =========================================================
   CURRENT LOCKOUT
========================================================= */

function getCurrentLockoutSeconds() {
  const lockoutUntil = getStoredNumber(
    STORAGE_KEYS.LOCKOUT_UNTIL,
    0
  );

  if (!lockoutUntil) {
    return 0;
  }

  const remainingMilliseconds =
    lockoutUntil - Date.now();

  if (remainingMilliseconds <= 0) {
    removeStoredValue(
      STORAGE_KEYS.LOCKOUT_UNTIL
    );

    removeStoredValue(
      STORAGE_KEYS.FAILED_ATTEMPTS
    );

    return 0;
  }

  return Math.ceil(
    remainingMilliseconds / 1000
  );
}

/* =========================================================
   CLEAR SECURITY STATE
========================================================= */

function clearSecurityState() {
  removeStoredValue(
    STORAGE_KEYS.FAILED_ATTEMPTS
  );

  removeStoredValue(
    STORAGE_KEYS.LOCKOUT_UNTIL
  );
}

/* =========================================================
   RECORD FAILED LOGIN
========================================================= */

function recordFailedLoginAttempt() {
  let failedAttempts = getStoredNumber(
    STORAGE_KEYS.FAILED_ATTEMPTS,
    0
  );

  failedAttempts += 1;

  if (
    failedAttempts >=
    MAX_LOGIN_ATTEMPTS
  ) {
    const lockoutUntil =
      Date.now() +
      LOCKOUT_DURATION_SECONDS * 1000;

    setStoredNumber(
      STORAGE_KEYS.LOCKOUT_UNTIL,
      lockoutUntil
    );

    setStoredNumber(
      STORAGE_KEYS.FAILED_ATTEMPTS,
      MAX_LOGIN_ATTEMPTS
    );

    return {
      locked: true,
      attempts: MAX_LOGIN_ATTEMPTS,
      remainingSeconds:
        LOCKOUT_DURATION_SECONDS,
    };
  }

  setStoredNumber(
    STORAGE_KEYS.FAILED_ATTEMPTS,
    failedAttempts
  );

  return {
    locked: false,
    attempts: failedAttempts,
    remainingSeconds: 0,
  };
}

/* =========================================================
   LOGIN PAGE
========================================================= */

export default function LoginPage() {
  const navigate = useNavigate();

  /* =======================================================
     LOGIN FORM
  ======================================================= */

  const [role, setRole] =
    useState('administrator');

  const [username, setUsername] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  /* =======================================================
     SECURITY STATE
  ======================================================= */

  const [lockoutSeconds, setLockoutSeconds] =
    useState(() =>
      getCurrentLockoutSeconds()
    );

  const [failedAttempts, setFailedAttempts] =
    useState(() =>
      getStoredNumber(
        STORAGE_KEYS.FAILED_ATTEMPTS,
        0
      )
    );

  /* =======================================================
     LOCKOUT TIMER
  ======================================================= */

  useEffect(() => {
    const updateLockoutState = () => {
      const remaining =
        getCurrentLockoutSeconds();

      const attempts =
        getStoredNumber(
          STORAGE_KEYS.FAILED_ATTEMPTS,
          0
        );

      setLockoutSeconds(
        remaining
      );

      setFailedAttempts(
        attempts
      );

      if (remaining <= 0) {
        setFailedAttempts(0);
      }
    };

    updateLockoutState();

    const interval =
      setInterval(
        updateLockoutState,
        1000
      );

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* =======================================================
     LOCKED STATUS
  ======================================================= */

  const isLocked =
    lockoutSeconds > 0;

  /* =======================================================
     ROLE CHANGE
  ======================================================= */

  const handleRoleChange = (newRole) => {
    if (isLocked || loading) {
      return;
    }

    setRole(newRole);
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  /* =======================================================
     USERNAME CHANGE
  ======================================================= */

  const handleUsernameChange = (e) => {
    if (isLocked) {
      return;
    }

    setUsername(e.target.value);
    setError('');
  };

  /* =======================================================
     PASSWORD CHANGE
  ======================================================= */

  const handlePasswordChange = (e) => {
    if (isLocked) {
      return;
    }

    setPassword(e.target.value);
    setError('');
  };

  /* =======================================================
     CREDENTIAL ERROR DETECTION
  ======================================================= */

  const isCredentialError = (message) => {
    const lowerMessage =
      String(message || '').toLowerCase();

    return (
      lowerMessage.includes(
        'invalid username'
      ) ||
      lowerMessage.includes(
        'invalid password'
      ) ||
      lowerMessage.includes(
        'invalid credentials'
      ) ||
      lowerMessage.includes(
        'wrong password'
      ) ||
      lowerMessage.includes(
        'incorrect password'
      ) ||
      lowerMessage.includes(
        'authentication failed'
      ) ||
      lowerMessage.includes(
        'invalid login'
      ) ||
      lowerMessage.includes(
        'invalid email or password'
      ) ||
      lowerMessage.includes(
        'invalid login credentials'
      )
    );
  };

  /* =======================================================
     HANDLE LOGIN
  ======================================================= */

  const handleLogin = async (e) => {
    e.preventDefault();

    /* -----------------------------------------------------
       BLOCK WHILE LOCKED
    ----------------------------------------------------- */

    const currentLockout =
      getCurrentLockoutSeconds();

    if (currentLockout > 0) {
      setLockoutSeconds(
        currentLockout
      );

      setError(
        `Too many failed login attempts. Please wait ${currentLockout} second${
          currentLockout === 1
            ? ''
            : 's'
        } before trying again.`
      );

      return;
    }

    if (loading) {
      return;
    }

    setError('');

    /* -----------------------------------------------------
       VALIDATE BEFORE LOADING
    ----------------------------------------------------- */

    const cleanUsername =
      String(username || '').trim();

    if (!cleanUsername) {
      setError(
        'Please enter your username.'
      );

      return;
    }

    if (!password) {
      setError(
        'Please enter your password.'
      );

      return;
    }

    setLoading(true);

    try {
      /* ===================================================
         LOGGING
      =================================================== */

      console.log(
        '=========================================='
      );

      console.log(
        '[LOGIN] Starting authentication...'
      );

      console.log(
        '[LOGIN] Role:',
        role
      );

      console.log(
        '[LOGIN] Username:',
        cleanUsername
      );

      console.log(
        '=========================================='
      );

      /* ===================================================
         CLEAR ANY OLD INVALID APPLICATION SESSION
      =================================================== */

      try {
        const {
          data: {
            session: existingSession,
          },
        } =
          await supabase.auth.getSession();

        console.log(
          '[LOGIN] Existing Supabase session:',
          existingSession
            ? {
                userId:
                  existingSession.user?.id,
                email:
                  existingSession.user?.email,
              }
            : null
        );
      } catch (sessionCheckError) {
        console.warn(
          '[LOGIN] Unable to inspect existing Supabase session:',
          sessionCheckError
        );
      }

      /* ===================================================
         AUTHENTICATION
      =================================================== */

      let result;

      if (
        role === 'administrator'
      ) {
        console.log(
          '[LOGIN] Using loginAdmin()...'
        );

        result =
          await loginAdmin(
            cleanUsername,
            password
          );
      } else {
        console.log(
          '[LOGIN] Using loginAssessor()...'
        );

        result =
          await loginAssessor(
            cleanUsername,
            password
          );
      }

      console.log(
        '[LOGIN] Authentication result:',
        result
      );

      /* ===================================================
         NO RESPONSE
      =================================================== */

      if (!result) {
        setError(
          'No response was returned from Supabase.'
        );

        return;
      }

      /* ===================================================
         EXPLICIT AUTHENTICATION FAILURE
      =================================================== */

      if (
        result.success === false ||
        result.authenticated === false
      ) {
        const securityResult =
          recordFailedLoginAttempt();

        setFailedAttempts(
          securityResult.attempts
        );

        /* -----------------------------------------------
           LOCKOUT
        ----------------------------------------------- */

        if (
          securityResult.locked
        ) {
          setLockoutSeconds(
            securityResult.remainingSeconds
          );

          setPassword('');
          setShowPassword(false);

          setError(
            `Too many failed login attempts. Login is locked for ${LOCKOUT_DURATION_SECONDS} seconds.`
          );

          return;
        }

        /* -----------------------------------------------
           REMAINING ATTEMPTS
        ----------------------------------------------- */

        const attemptsLeft =
          MAX_LOGIN_ATTEMPTS -
          securityResult.attempts;

        setPassword('');
        setShowPassword(false);

        setError(
          `${
            result.message ||
            'Invalid username or password.'
          } ${attemptsLeft} attempt${
            attemptsLeft === 1
              ? ''
              : 's'
          } remaining.`
        );

        return;
      }

      /* ===================================================
         IMPORTANT SUPABASE AUTH CHECK
         
         A custom RPC/localStorage login is NOT enough.
         The application requires a real Supabase Auth
         session because your RLS policies use:
         
             TO authenticated
      =================================================== */

      console.log(
        '[LOGIN] Checking Supabase Auth session...'
      );

      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          '[LOGIN] Supabase session error:',
          sessionError
        );

        setError(
          sessionError.message ||
          'Unable to verify your Supabase authentication session.'
        );

        return;
      }

      /* ===================================================
         NO REAL SUPABASE SESSION
      =================================================== */

      if (!session?.user) {
        console.error(
          '[LOGIN] AUTHENTICATION RESULT WAS SUCCESSFUL, BUT NO SUPABASE AUTH SESSION EXISTS.'
        );

        console.error(
          '[LOGIN] loginAdmin/loginAssessor must call supabase.auth.signInWithPassword().'
        );

        setError(
          'Login was accepted, but no Supabase authentication session was created. Please contact the system administrator.'
        );

        return;
      }

      /* ===================================================
         VERIFY CURRENT AUTH USER
      =================================================== */

      const {
        data: {
          user: authUser,
        },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !authUser
      ) {
        console.error(
          '[LOGIN] Unable to verify authenticated Supabase user:',
          userError
        );

        setError(
          'Unable to verify your Supabase authentication account. Please log in again.'
        );

        return;
      }

      console.log(
        '[LOGIN] REAL SUPABASE AUTH SESSION CONFIRMED:',
        {
          userId:
            authUser.id,
          email:
            authUser.email,
          expiresAt:
            session.expires_at,
        }
      );

      /* ===================================================
         SUCCESSFUL LOGIN
      =================================================== */

      clearSecurityState();

      setFailedAttempts(0);
      setLockoutSeconds(0);

      /* ===================================================
         BUILD USER OBJECT
      =================================================== */

      const resultUser =
        result.user || {};

      const user = {
        id:
          resultUser.id ||
          authUser.id ||
          result.id ||
          null,

        username:
          resultUser.username ||
          result.username ||
          cleanUsername,

        full_name:
          resultUser.full_name ||
          result.full_name ||
          '',

        email:
          resultUser.email ||
          result.email ||
          authUser.email ||
          '',

        official_role:
          resultUser.official_role ||
          result.official_role ||
          '',
      };

      /* ===================================================
         FINAL USERNAME
      =================================================== */

      const finalUsername =
        user.username ||
        result.username ||
        cleanUsername;

      /* ===================================================
         SELECTED ROLE
      =================================================== */

      const userRole =
        role === 'administrator'
          ? 'administrator'
          : 'assessor';

      /* ===================================================
         REAL SUPABASE ACCESS TOKEN
         
         NEVER CREATE A FAKE TOKEN.
      =================================================== */

      const token =
        session.access_token || null;

      if (token) {
        localStorage.setItem(
          'token',
          token
        );
      } else {
        localStorage.removeItem(
          'token'
        );
      }

      /* ===================================================
         SAVE APPLICATION SESSION
      =================================================== */

      localStorage.setItem(
        'role',
        userRole
      );

      localStorage.setItem(
        'userRole',
        userRole
      );

      localStorage.setItem(
        'username',
        finalUsername
      );

      localStorage.setItem(
        'user',
        JSON.stringify(user)
      );

      localStorage.setItem(
        'authUser',
        JSON.stringify({
          ...user,
          supabase_user_id:
            authUser.id,
          email:
            authUser.email ||
            user.email,
        })
      );

      /* ===================================================
         ASSESSOR-SPECIFIC COMPATIBILITY
      =================================================== */

      if (
        userRole === 'assessor'
      ) {
        localStorage.setItem(
          'verified',
          'true'
        );

        localStorage.setItem(
          'isAdminVerified',
          'true'
        );
      } else {
        localStorage.removeItem(
          'verified'
        );

        localStorage.removeItem(
          'isAdminVerified'
        );
      }

      /* ===================================================
         FINAL LOGIN LOG
      =================================================== */

      console.log(
        '[LOGIN] Supabase authentication successful.'
      );

      console.log(
        '[LOGIN] Application session saved:',
        {
          role:
            userRole,
          username:
            finalUsername,
          supabaseUserId:
            authUser.id,
          email:
            authUser.email,
        }
      );

      /* ===================================================
         REDIRECT
      =================================================== */

      if (
        userRole === 'administrator'
      ) {
        console.log(
          '[LOGIN] Administrator authenticated successfully.'
        );

        console.log(
          '[LOGIN] Redirecting to /analytics...'
        );

        navigate(
          '/analytics',
          {
            replace: true,
          }
        );
      } else {
        console.log(
          '[LOGIN] Assessor authenticated successfully.'
        );

        console.log(
          '[LOGIN] Redirecting to /dashboard...'
        );

        navigate(
          '/dashboard',
          {
            replace: true,
          }
        );
      }

    } catch (err) {
      console.error(
        '=========================================='
      );

      console.error(
        '[LOGIN ERROR]',
        err
      );

      console.error(
        '=========================================='
      );

      let message =
        err?.message ||
        'Unable to log in.';

      const lowerMessage =
        String(message).toLowerCase();

      /* ===================================================
         CREDENTIAL FAILURE
      =================================================== */

      if (
        isCredentialError(
          lowerMessage
        )
      ) {
        const securityResult =
          recordFailedLoginAttempt();

        setFailedAttempts(
          securityResult.attempts
        );

        /* -----------------------------------------------
           LOCKOUT
        ----------------------------------------------- */

        if (
          securityResult.locked
        ) {
          setLockoutSeconds(
            securityResult.remainingSeconds
          );

          setPassword('');
          setShowPassword(false);

          setError(
            `Too many failed login attempts. Login is locked for ${LOCKOUT_DURATION_SECONDS} seconds.`
          );

          return;
        }

        /* -----------------------------------------------
           REMAINING ATTEMPTS
        ----------------------------------------------- */

        const attemptsLeft =
          MAX_LOGIN_ATTEMPTS -
          securityResult.attempts;

        setPassword('');
        setShowPassword(false);

        setError(
          `Invalid username or password. ${attemptsLeft} attempt${
            attemptsLeft === 1
              ? ''
              : 's'
          } remaining.`
        );

        return;
      }

      /* ===================================================
         ADMIN RPC ERROR
      =================================================== */

      if (
        lowerMessage.includes(
          'authenticate_municipal_official'
        )
      ) {
        message =
          'Administrator authentication is not configured correctly in Supabase.';
      }

      /* ===================================================
         ASSESSOR RPC ERROR
      =================================================== */

      else if (
        lowerMessage.includes(
          'authenticate_assessor'
        )
      ) {
        message =
          'Assessor authentication is not configured correctly in Supabase.';
      }

      /* ===================================================
         SUPABASE AUTH SESSION ERROR
      =================================================== */

      else if (
        lowerMessage.includes(
          'auth session missing'
        ) ||
        lowerMessage.includes(
          'session missing'
        ) ||
        lowerMessage.includes(
          'no session'
        )
      ) {
        message =
          'Supabase authentication session is missing. Please log in again.';
      }

      /* ===================================================
         INVALID CREDENTIAL FALLBACK
      =================================================== */

      else if (
        lowerMessage.includes(
          'invalid username'
        ) ||
        lowerMessage.includes(
          'invalid password'
        ) ||
        lowerMessage.includes(
          'invalid credentials'
        ) ||
        lowerMessage.includes(
          'invalid login credentials'
        ) ||
        lowerMessage.includes(
          'invalid email or password'
        )
      ) {
        message =
          'Invalid username or password.';
      }

      /* ===================================================
         PERMISSION ERROR
      =================================================== */

      else if (
        lowerMessage.includes(
          'permission denied'
        )
      ) {
        message =
          'Supabase permission denied. Please check the authentication and RLS policies.';
      }

      /* ===================================================
         NETWORK ERROR
         
         NOT COUNTED AS FAILED LOGIN
      =================================================== */

      else if (
        lowerMessage.includes(
          'failed to fetch'
        ) ||
        lowerMessage.includes(
          'network error'
        ) ||
        lowerMessage.includes(
          'fetch failed'
        )
      ) {
        message =
          'Unable to connect to Supabase. Please check your Supabase configuration.';
      }

      setError(message);

    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     LOCKOUT MESSAGE
  ========================================================= */

  const lockoutMessage =
    lockoutSeconds > 0
      ? `Too many failed login attempts. Please wait ${lockoutSeconds} second${
          lockoutSeconds === 1
            ? ''
            : 's'
        }.`
      : '';

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-3 py-6">

      <div className="w-full max-w-xs sm:max-w-sm">

        {/* =================================================
            BACK TO HOME
        ================================================= */}

        <div className="mb-3">

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors duration-150"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>

            Back to Home
          </Link>

        </div>

        {/* =================================================
            LOGIN CARD
        ================================================= */}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">

          {/* =================================================
              HEADER
          ================================================= */}

          <div className="text-center mb-5">

            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 mb-2.5">

              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0h4m-4 0H9m4 0V7m0 0h4m-4 0H9"
                />
              </svg>

            </div>

            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Tax Declaration
            </h1>

            <p className="text-xs text-slate-500 font-medium mt-0.5">
              LGU San Fernando, Romblon
            </p>

          </div>

          {/* =================================================
              LOCKOUT NOTICE
          ================================================= */}

          {isLocked && (

            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">

              <svg
                className="w-5 h-5 text-red-600 mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m0-8v2m8 3a8 8 0 10-16 0 8 8 0 0016 0z"
                />
              </svg>

              <div>

                <p className="text-xs font-semibold text-red-800">
                  Login temporarily locked
                </p>

                <p className="text-[11px] text-red-700 mt-0.5">
                  {lockoutMessage}
                </p>

                <p className="text-[10px] text-red-600 mt-1">
                  This security lock remains active even if
                  you refresh the page.
                </p>

              </div>

            </div>

          )}

          {/* =================================================
              OFFICE NOTICE
          ================================================= */}

          <div className="mb-4 rounded-md bg-amber-50/80 border border-amber-200/80 p-2.5 flex items-start gap-2">

            <svg
              className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            <p className="text-[11px] leading-snug text-amber-900">

              <strong className="font-semibold">
                Note:
              </strong>{' '}

              Strictly 1 active user permitted per office
              (Administrator &amp; Assessor).

            </p>

          </div>

          {/* =================================================
              ROLE SELECTOR
          ================================================= */}

          <div className="mb-4">

            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Login As
            </label>

            <div className="grid grid-cols-2 gap-2">

              {/* ADMINISTRATOR */}

              <button
                type="button"
                onClick={() =>
                  handleRoleChange(
                    'administrator'
                  )
                }
                disabled={
                  loading ||
                  isLocked
                }
                className={`py-2.5 px-3 rounded-md border text-xs font-semibold transition ${
                  role === 'administrator'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                } ${
                  loading || isLocked
                    ? 'cursor-not-allowed opacity-60'
                    : ''
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">

                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-3.31 0-6 1.79-6 4v1h12v-1c0-2.21-2.69-4-6-4z"
                    />
                  </svg>

                  Administrator

                </span>
              </button>

              {/* ASSESSOR */}

              <button
                type="button"
                onClick={() =>
                  handleRoleChange(
                    'assessor'
                  )
                }
                disabled={
                  loading ||
                  isLocked
                }
                className={`py-2.5 px-3 rounded-md border text-xs font-semibold transition ${
                  role === 'assessor'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                } ${
                  loading || isLocked
                    ? 'cursor-not-allowed opacity-60'
                    : ''
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">

                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 12c0 5.591 3.824 10.29 9 11.622C17.176 22.29 21 17.591 21 12c0-1.41-.243-2.764-.69-4.016z"
                    />
                  </svg>

                  Assessor

                </span>
              </button>

            </div>

          </div>

          {/* =================================================
              LOGIN FORM
          ================================================= */}

          <form
            onSubmit={handleLogin}
            className="space-y-3.5"
          >

            {/* USERNAME */}

            <div>

              <label
                htmlFor="username"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={
                  handleUsernameChange
                }
                autoComplete="username"
                placeholder="Enter username"
                disabled={
                  loading ||
                  isLocked
                }
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed transition"
              />

            </div>

            {/* PASSWORD */}

            <div>

              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Password
              </label>

              <div className="relative">

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={
                    handlePasswordChange
                  }
                  autoComplete="current-password"
                  placeholder="Enter password"
                  disabled={
                    loading ||
                    isLocked
                  }
                  required
                  className="w-full px-3 py-2 pr-10 text-xs border border-slate-300 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed transition"
                />

                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  title={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                  disabled={
                    loading ||
                    isLocked ||
                    !password
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >

                  {showPassword ? (

                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029M6.228 6.228A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a9.953 9.953 0 01-4.132 5.411M6.228 6.228L3 3m3.228 3.228l3.54 3.54m4.464 4.464L21 21m-3.589-3.589l-3.54-3.54m0 0a3 3 0 10-4.243-4.243m4.243 4.243L9.628 9.628"
                      />
                    </svg>

                  ) : (

                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>

                  )}

                </button>

              </div>

              <p className="text-[9px] text-slate-400 mt-1">
                Password is hidden by default and is never
                stored in the browser.
              </p>

            </div>

            {/* FAILED ATTEMPTS */}

            {!isLocked &&
              failedAttempts > 0 && (

                <div className="rounded-md bg-orange-50 border border-orange-200 p-2.5">

                  <p className="text-[11px] text-orange-700">

                    Failed attempts:{' '}

                    <strong>
                      {failedAttempts}
                    </strong>

                    {' / '}

                    {MAX_LOGIN_ATTEMPTS}

                  </p>

                  <p className="text-[10px] text-orange-600 mt-0.5">

                    {MAX_LOGIN_ATTEMPTS -
                      failedAttempts}{' '}

                    attempt
                    {MAX_LOGIN_ATTEMPTS -
                      failedAttempts ===
                    1
                      ? ''
                      : 's'}{' '}

                    remaining before temporary lockout.

                  </p>

                </div>

              )}

            {/* ERROR */}

            {error && !isLocked && (

              <div className="rounded-md bg-red-50 border border-red-200 p-2.5">

                <p className="text-xs text-red-600 leading-tight">
                  {error}
                </p>

              </div>

            )}

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              disabled={
                loading ||
                isLocked
              }
              className={`w-full py-2.5 px-4 rounded-md text-white text-xs font-semibold shadow-sm transition ${
                isLocked
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } ${
                loading
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >

              {loading
                ? 'Signing in...'
                : isLocked
                ? `Locked (${lockoutSeconds}s)`
                : role ===
                  'administrator'
                ? 'Log In Administrator'
                : 'Log In Assessor'}

            </button>

          </form>

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="text-center mt-5 pt-4 border-t border-slate-100">

            <p className="text-[10px] text-slate-400 font-medium">
              Real Property Tax Declaration Management System
            </p>

            <p className="text-[9px] text-slate-300 mt-1">
              Protected authentication system
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}