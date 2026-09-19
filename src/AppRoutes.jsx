import React, { useState, useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import HeroSection from './pages/HeroSection';
import TaxDecForm from './pages/TaxDecForm';
import RequestTaxDeclarationForm from './pages/RequestTaxDeclarationForm';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import NoticeDashboard from './pages/NoticeDashboard';
import TaxFormManager from './pages/taxform';
import TaxAnalyticsPage from './pages/TaxAnalyticsPage';
import PropertyOwnerLogin from './pages/PropertyOwnerLogin';
import PropertyOwnerRegister from './pages/PropertyOwnerRegister';
import PropertyOwnerDashboard from './pages/PropertyOwnerDashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { supabase } from './assets/services/supabaseClient';

import ErrorBoundary from './pages/ErrorBoundary';

/* =========================================================
   APP ROUTES
========================================================= */

export default function AppRoutes() {
  const navigate = useNavigate();

  /* =======================================================
     USER ROLE
  ======================================================= */

  const [userRole, setUserRole] = useState(null);

  const [propertyOwnerSession, setPropertyOwnerSession] = useState(null);

  /*
    IMPORTANT:
    This prevents the dashboard from redirecting to
    /user-login while Supabase is still restoring the
    existing session after a page refresh.
  */
  const [propertyOwnerAuthLoading, setPropertyOwnerAuthLoading] = useState(true);

  /* =======================================================
     SUPABASE AUTH SESSION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    const initializePropertyOwnerSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error(
            '[SUPABASE AUTH] Failed to restore property owner session:',
            error
          );

          setPropertyOwnerSession(null);
        } else {
          setPropertyOwnerSession(data?.session || null);
        }
      } catch (error) {
        console.error(
          '[SUPABASE AUTH] Unexpected session restoration error:',
          error
        );

        if (mounted) {
          setPropertyOwnerSession(null);
        }
      } finally {
        if (mounted) {
          setPropertyOwnerAuthLoading(false);
        }
      }
    };

    initializePropertyOwnerSession();

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setPropertyOwnerSession(session || null);

      /*
        The auth listener has received the current authentication
        state, so it is safe for protected routes to make a decision.
      */
      setPropertyOwnerAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  /* =======================================================
     RECORDS — SUPABASE IS THE SOURCE OF TRUTH
  ======================================================= */

  const [records, setRecords] = useState([]);
  const [dashboardHiddenIds, setDashboardHiddenIds] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const canLoadRecords =
      userRole === 'assessor' ||
      userRole === 'administrator' ||
      userRole === 'admin' ||
      userRole === 'analytics';

    if (!canLoadRecords) {
      setRecords([]);
      setRecordsLoading(false);
      return undefined;
    }

    const loadRecords = async () => {
      setRecordsLoading(true);

      const { data, error } = await supabase
        .from('tax_declarations')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (!mounted) return;

      if (error) {
        console.error(
          '[SUPABASE] Failed to load tax declarations:',
          error
        );

        setRecords([]);
      } else {
        setRecords(Array.isArray(data) ? data : []);

        setDashboardHiddenIds(
          (Array.isArray(data) ? data : [])
            .filter((record) => record?.is_hidden === true)
            .map((record) => record.id || record.td_no)
        );
      }

      setRecordsLoading(false);
    };

    loadRecords();

    const channel = supabase
      .channel('tax-declarations-app-routes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tax_declarations',
        },
        () => loadRecords()
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  /* =======================================================
     ADD NEW TAX DECLARATION
  ======================================================= */

  const handleAddNewRecord = async (newRecord) => {
    // TaxDecForm already saves the declaration to Supabase.
    // Refresh the parent state from the database instead of Supabase

    const { data, error } = await supabase
      .from('tax_declarations')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error(
        '[SUPABASE] Failed to refresh tax declarations:',
        error
      );

      return;
    }

    setRecords(Array.isArray(data) ? data : []);

    navigate('/user-dashboard', {
      replace: true,
      state: {
        submitted: true,
        message:
          'Tax Declaration submitted successfully. Please wait for MAO verification.',
      },
    });
  };

  /* =======================================================
     UPDATE TAX DECLARATION
  ======================================================= */

  const handleUpdateRecord = async (updatedRecord) => {
    const id = updatedRecord?.id;

    if (!id) return;

    const { data, error } = await supabase
      .from('tax_declarations')
      .update(updatedRecord)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(
        '[SUPABASE] Failed to update tax declaration:',
        error
      );

      return;
    }

    setRecords((prevRecords) =>
      prevRecords.map((r) => (r.id === id ? data : r))
    );
  };

  /* =======================================================
     APPROVE TAX DECLARATION
  ======================================================= */

  const handleApproveRecord = async (recordId) => {
    const record = records.find(
      (r) => r.id === recordId || r.td_no === recordId
    );

    if (!record?.id) return;

    const { data, error } = await supabase
      .from('tax_declarations')
      .update({
        verification_status: 'Approved',
        rejection_reason: '',
      })
      .eq('id', record.id)
      .select()
      .single();

    if (error) {
      console.error(
        '[SUPABASE] Failed to approve tax declaration:',
        error
      );

      return;
    }

    setRecords((prevRecords) =>
      prevRecords.map((r) => (r.id === record.id ? data : r))
    );
  };

  /* =======================================================
     DELETE TAX DECLARATION
  ======================================================= */

  const handleDeleteRecord = async (targetIdOrTdNo) => {
    const record = records.find(
      (r) =>
        r.id === targetIdOrTdNo ||
        r.td_no === targetIdOrTdNo
    );

    if (!record?.id) return;

    const { error } = await supabase
      .from('tax_declarations')
      .update({
        is_hidden: true,
      })
      .eq('id', record.id);

    if (error) {
      console.error(
        '[SUPABASE] Failed to hide tax declaration:',
        error
      );

      return;
    }

    setRecords((prevRecords) =>
      prevRecords.filter((r) => r.id !== record.id)
    );

    setDashboardHiddenIds((prev) =>
      prev.includes(record.id)
        ? prev
        : [...prev, record.id]
    );
  };

  /* =======================================================
     APPROVED RECORDS
  ======================================================= */

  const approvedRecords = records.filter((r) => {
    const recordIdentifier = r?.id || r?.td_no;

    const isHidden =
      dashboardHiddenIds.includes(recordIdentifier);

    const isApproved =
      r?.verification_status === 'Approved' ||
      r?.verification_status === 'Passed';

    return !isHidden && isApproved;
  });

  /* =======================================================
     LOGIN SUCCESS
  ======================================================= */

  const handleLoginSuccess = (data) => {
    console.log('[APP] LOGIN SUCCESS:', data);

    if (!data || !data.success) {
      console.error(
        '[APP] Invalid login response:',
        data
      );

      return;
    }

    const loggedInRole = data.role;

    console.log(
      '[APP] Logged-in role:',
      loggedInRole
    );

    /* -----------------------------------------
       SAVE ROLE
    ----------------------------------------- */

    setUserRole(loggedInRole);

    /* -----------------------------------------
       ADMINISTRATOR → TAX ANALYTICS
    ----------------------------------------- */

    if (
      loggedInRole === 'administrator' ||
      loggedInRole === 'admin' ||
      loggedInRole === 'analytics'
    ) {
      console.log(
        '[APP] Administrator → /analytics'
      );

      navigate('/analytics', {
        replace: true,
      });

      return;
    }

    /* -----------------------------------------
       ASSESSOR → ADMIN DASHBOARD
    ----------------------------------------- */

    if (loggedInRole === 'assessor') {
      console.log(
        '[APP] Assessor → /dashboard'
      );

      navigate('/dashboard', {
        replace: true,
      });

      return;
    }

    /* -----------------------------------------
       UNKNOWN ROLE
    ----------------------------------------- */

    console.error(
      '[APP] Unknown role:',
      loggedInRole
    );

    navigate('/login', {
      replace: true,
    });
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = async () => {
    console.log('[APP] Logging out');

    await supabase.auth.signOut();

    setUserRole(null);
    setPropertyOwnerSession(null);

    navigate('/', {
      replace: true,
    });
  };

  /* =======================================================
     NAVIGATION HELPERS
  ======================================================= */

  const goHome = () => {
    navigate('/', {
      replace: false,
    });
  };

  const goToForm = () => {
    navigate(
      propertyOwnerSession
        ? '/user-dashboard'
        : '/user-login'
    );
  };

  const goToUserLogin = () => {
    navigate('/user-login');
  };

  const goToRequestForm = () => {
    navigate(
      propertyOwnerSession
        ? '/request-form'
        : '/user-login',
      {
        state: {
          from: '/request-form',
        },
      }
    );
  };

  const goToLogin = () => {
    navigate('/login');
  };

  const goToNoticeDashboard = () => {
    navigate(
      propertyOwnerSession
        ? '/user-dashboard'
        : '/user-login',
      {
        state: propertyOwnerSession
          ? undefined
          : {
              from: '/notice-dashboard',
            },
      }
    );
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const goToManagement = () => {
    navigate('/management');
  };

  const goToAnalytics = () => {
    navigate('/analytics');
  };

  /* =======================================================
     ROUTES
  ======================================================= */

  return (
    <div className="min-h-screen w-full bg-slate-100 flex flex-col font-sans">
      <Routes>

        {/* PUBLIC ROUTES */}

        <Route
          path="/"
          element={
            <ErrorBoundary>
              <HeroSection
                onGetStarted={goToForm}
                onRequestForm={goToRequestForm}
                onGoToLogin={goToLogin}
                onViewDashboard={goToNoticeDashboard}
              />
            </ErrorBoundary>
          }
        />

        {/* =================================================
            NOTICE DASHBOARD
        ================================================= */}

        <Route
          path="/notice-dashboard"
          element={
            propertyOwnerAuthLoading ? (
              <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>

                  <p className="text-slate-600">
                    Restoring your session...
                  </p>
                </div>
              </div>
            ) : propertyOwnerSession ? (
              <Navigate
                to="/user-dashboard"
                replace
              />
            ) : (
              <Navigate
                to="/user-login"
                replace
                state={{
                  from: '/notice-dashboard',
                }}
              />
            )
          }
        />

        {/* =================================================
            PROPERTY OWNER USER PORTAL
        ================================================= */}

        <Route
          path="/user-login"
          element={
            propertyOwnerAuthLoading ? (
              <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>

                  <p className="text-slate-600">
                    Checking session...
                  </p>
                </div>
              </div>
            ) : (
              <PropertyOwnerLogin />
            )
          }
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/user-register"
          element={<PropertyOwnerRegister />}
        />

        {/* =================================================
            USER DASHBOARD

            IMPORTANT:
            Do NOT redirect until Supabase has finished
            restoring the session after refresh.
        ================================================= */}

        <Route
          path="/user-dashboard"
          element={
            propertyOwnerAuthLoading ? (
              <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="text-center">

                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>

                  <p className="text-lg font-medium text-slate-700">
                    Restoring your session...
                  </p>

                  <p className="text-sm text-slate-500 mt-1">
                    Please wait
                  </p>

                </div>
              </div>
            ) : propertyOwnerSession ? (
              <PropertyOwnerDashboard />
            ) : (
              <Navigate
                to="/user-login"
                replace
              />
            )
          }
        />

        {/* =================================================
            TAX DECLARATION FORM
            AUTHENTICATED PROPERTY OWNERS ONLY
        ================================================= */}

        <Route
          path="/form"
          element={
            propertyOwnerAuthLoading ? (
              <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>

                  <p className="text-slate-600">
                    Restoring your session...
                  </p>
                </div>
              </div>
            ) : propertyOwnerSession ? (
              <TaxDecForm
                onSubmitRecord={handleAddNewRecord}
                onBackToHome={() =>
                  navigate('/user-dashboard')
                }
              />
            ) : (
              <Navigate
                to="/user-login"
                replace
                state={{
                  from: '/form',
                }}
              />
            )
          }
        />

        {/* =================================================
            REQUEST TAX DECLARATION
            AUTHENTICATED PROPERTY OWNERS ONLY
        ================================================= */}

        <Route
          path="/request-form"
          element={
            propertyOwnerAuthLoading ? (
              <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>

                  <p className="text-slate-600">
                    Restoring your session...
                  </p>
                </div>
              </div>
            ) : propertyOwnerSession ? (
              <RequestTaxDeclarationForm />
            ) : (
              <Navigate
                to="/user-login"
                replace
                state={{
                  from: '/request-form',
                }}
              />
            )
          }
        />

        {/* =================================================
            LOGIN
        ================================================= */}

        <Route
          path="/login"
          element={
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onBackToHome={goHome}
            />
          }
        />

        {/* =================================================
            ASSESSOR DASHBOARD
        ================================================= */}

        <Route
          path="/dashboard"
          element={
            <ErrorBoundary>
              <AdminDashboard
                initialRecords={records}
                onApproveRecord={handleApproveRecord}
                onUpdateRecord={handleUpdateRecord}
                onDeleteRecord={handleDeleteRecord}
                onGoToTaxFormManager={goToManagement}
                onLogout={handleLogout}
              />
            </ErrorBoundary>
          }
        />

        {/* =================================================
            ALIAS REDIRECTS FOR DASHBOARD
        ================================================= */}

        <Route
          path="/admin-dashboard"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/AdminDashboard"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        <Route
          path="/Admin_Dashboard"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* =================================================
            TAX FORM MANAGER
        ================================================= */}

        <Route
          path="/management"
          element={
            <TaxFormManager
              records={approvedRecords}
              onBackToDashboard={goToDashboard}
              onUpdateRecord={handleUpdateRecord}
              onDeleteRecord={handleDeleteRecord}
            />
          }
        />

        {/* =================================================
            ADMINISTRATOR ANALYTICS
        ================================================= */}

        <Route
          path="/analytics"
          element={
            <ErrorBoundary>
              <TaxAnalyticsPage
                userRole={
                  userRole || 'administrator'
                }
                onLogout={handleLogout}
              />
            </ErrorBoundary>
          }
        />

        {/* =================================================
            UNKNOWN URL - FALLBACK
        ================================================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </div>
  );
}