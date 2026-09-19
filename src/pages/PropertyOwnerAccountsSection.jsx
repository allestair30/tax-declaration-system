import React, { useEffect, useState } from 'react';

import { supabase } from '../assets/services/supabaseClient';

export default function PropertyOwnerAccountsSection() {
  const [accounts, setAccounts] = useState([]);

  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [message, setMessage] = useState('');

  const [error, setError] = useState('');

  const [noticeText, setNoticeText] = useState({});

  const [openAccount, setOpenAccount] = useState(null);

  /* =========================================================
     LOAD PROPERTY OWNER ACCOUNTS + REQUESTS

     ACCOUNTS AND REQUESTS ARE LOADED SEPARATELY.

     This prevents an error in tax_declaration_requests
     from preventing Property Owner Accounts from appearing.
  ========================================================= */

  const load = async () => {
    setLoading(true);
    setError('');

    let accountLoadError = null;
    let requestLoadError = null;

    /* =======================================================
       LOAD PROPERTY OWNER ACCOUNTS
    ======================================================= */

    try {
      const {
        data: accountRows,
        error: accountError,
      } = await supabase
        .from('property_owner_accounts')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (accountError) {
        console.error(
          '[PROPERTY OWNER ACCOUNTS ERROR]',
          accountError
        );

        accountLoadError = accountError;
        setAccounts([]);
      } else {
        setAccounts(accountRows || []);
      }
    } catch (err) {
      console.error(
        '[PROPERTY OWNER ACCOUNTS LOAD ERROR]',
        err
      );

      accountLoadError = err;
      setAccounts([]);
    }

    /* =======================================================
       LOAD TAX DECLARATION REQUESTS

       This is intentionally independent from accounts.
    ======================================================= */

    try {
      const {
        data: requestRows,
        error: requestError,
      } = await supabase
        .from('tax_declaration_requests')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (requestError) {
        console.error(
          '[TAX DECLARATION REQUESTS ERROR]',
          requestError
        );

        requestLoadError = requestError;

        /*
         * Do NOT clear Property Owner accounts
         * if requests fail.
         */
        setRequests([]);
      } else {
        setRequests(requestRows || []);
      }
    } catch (err) {
      console.error(
        '[TAX DECLARATION REQUESTS LOAD ERROR]',
        err
      );

      requestLoadError = err;
      setRequests([]);
    }

    /* =======================================================
       DISPLAY ERRORS

       Account errors have priority because that is the
       primary section.
    ======================================================= */

    if (accountLoadError) {
      setError(
        accountLoadError?.message ||
          'Unable to load Property Owner accounts.'
      );
    } else if (requestLoadError) {
      setError(
        `Property Owner accounts loaded, but Tax Declaration Requests could not be loaded: ${
          requestLoadError?.message ||
          'Unknown error'
        }`
      );
    }

    setLoading(false);
  };

  /* =========================================================
     INITIALIZE

     CHECK REAL SUPABASE AUTH SESSION
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!mounted) return;

      setLoading(true);
      setError('');

      try {
        /* ===================================================
           CHECK REAL SUPABASE AUTH SESSION
        =================================================== */

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        console.log(
          '[ADMIN AUTH] Supabase user:',
          user
        );

        /* ===================================================
           AUTH ERROR

           This can happen when the browser has an old JWT
           whose "sub" user no longer exists in auth.users.
        =================================================== */

        if (authError) {
          console.error(
            '[ADMIN AUTH ERROR]',
            authError
          );

          if (mounted) {
            setAccounts([]);
            setRequests([]);

            setError(
              authError.message ||
                'Unable to verify your Supabase authentication session. Please log in again.'
            );

            setLoading(false);
          }

          return;
        }

        /* ===================================================
           NO REAL SUPABASE SESSION
        =================================================== */

        if (!user) {
          console.error(
            '[ADMIN AUTH] NO SUPABASE AUTH SESSION'
          );

          if (mounted) {
            setAccounts([]);
            setRequests([]);

            setError(
              'Your Supabase session is not authenticated. Please log in again.'
            );

            setLoading(false);
          }

          return;
        }

        console.log(
          '[ADMIN AUTH] Authenticated:',
          user.id,
          user.email
        );

        /* ===================================================
           LOAD ACCOUNTS + REQUESTS
        =================================================== */

        if (mounted) {
          await load();
        }
      } catch (err) {
        console.error(
          '[PROPERTY OWNER ACCOUNTS INIT]',
          err
        );

        if (mounted) {
          setError(
            err?.message ||
              'Unable to load Property Owner accounts.'
          );

          setLoading(false);
        }
      }
    };

    initialize();

    /* =======================================================
       LISTEN FOR SUPABASE AUTH CHANGES
    ======================================================= */

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log(
          '[ADMIN AUTH CHANGE]',
          event,
          session?.user?.id || null
        );

        if (!mounted) return;

        /* ===================================================
           SIGNED OUT
        =================================================== */

        if (event === 'SIGNED_OUT') {
          setAccounts([]);
          setRequests([]);

          setError(
            'Your Supabase session has ended. Please log in again.'
          );

          setLoading(false);

          return;
        }

        /* ===================================================
           SIGNED IN
        =================================================== */

        if (event === 'SIGNED_IN') {
          initialize();
          return;
        }

        /* ===================================================
           TOKEN REFRESH

           Avoid repeatedly initializing unnecessarily.
        =================================================== */

        if (event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            load();
          }
        }
      }
    );

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  /* =========================================================
     UPDATE ACCOUNT STATUS

     VERIFY BUTTON IS REMOVED.

     This function is only used for:
     - Locked
     - Verified when unlocking
  ========================================================= */

  const updateAccount = async (
    id,
    account_status
  ) => {
    setError('');
    setMessage('');

    const {
      error: updateError,
    } = await supabase
      .from('property_owner_accounts')
      .update({
        account_status,
        updated_at:
          new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error(
        '[ACCOUNT STATUS UPDATE ERROR]',
        updateError
      );

      setError(
        updateError.message
      );

      return;
    }

    setAccounts((items) =>
      items.map((a) =>
        a.id === id
          ? {
              ...a,
              account_status,
            }
          : a
      )
    );

    setMessage(
      `Account status changed to ${account_status}.`
    );
  };

  /* =========================================================
     DELETE PROPERTY OWNER ACCOUNT PROFILE
  ========================================================= */

  const deleteAccount = async (id) => {
    if (
      !window.confirm(
        'Permanently delete this Property Owner profile? The Supabase Auth user must be removed separately if your project does not use a server-side admin delete function.'
      )
    ) {
      return;
    }

    setError('');
    setMessage('');

    const {
      error: deleteError,
    } = await supabase
      .from('property_owner_accounts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error(
        '[PROPERTY OWNER DELETE ERROR]',
        deleteError
      );

      setError(
        deleteError.message
      );

      return;
    }

    setAccounts((items) =>
      items.filter(
        (a) => a.id !== id
      )
    );

    setMessage(
      'Property Owner profile permanently deleted.'
    );
  };

  /* =========================================================
     SEND INDIVIDUAL NOTICE
  ========================================================= */

  const sendNotice = async (
    account
  ) => {
    setError('');
    setMessage('');

    const messageText =
      String(
        noticeText[account.id] || ''
      ).trim();

    if (!messageText) {
      setError(
        'Enter a notice message first.'
      );

      return;
    }

    const {
      error: noticeError,
    } = await supabase
      .from('property_owner_notices')
      .insert({
        property_owner_id:
          account.id,

        title:
          'Notice from Assessor’s Office',

        message:
          messageText,
      });

    if (noticeError) {
      console.error(
        '[NOTICE ERROR]',
        noticeError
      );

      setError(
        noticeError.message
      );

      return;
    }

    setNoticeText((previous) => ({
      ...previous,
      [account.id]: '',
    }));

    setMessage(
      `Notice sent to ${
        account.full_name ||
        account.email
      }.`
    );
  };

  /* =========================================================
     VERIFY TAX DECLARATION REQUEST

     NOTE:
     This VERIFY is for TAX DECLARATION REQUESTS.

     The Property Owner Account VERIFY button has been
     completely removed.
  ========================================================= */

  const verifyRequest = async (
    request,
    status,
    notes = ''
  ) => {
    setError('');
    setMessage('');

    const releasedAt =
      status === 'Released'
        ? new Date().toISOString()
        : null;

    const {
      error: updateError,
    } = await supabase
      .from('tax_declaration_requests')
      .update({
        verification_status:
          status,

        admin_notes:
          notes,

        released_at:
          releasedAt,
      })
      .eq(
        'id',
        request.id
      );

    if (updateError) {
      console.error(
        '[REQUEST VERIFICATION ERROR]',
        updateError
      );

      setError(
        updateError.message
      );

      return;
    }

    setRequests((items) =>
      items.map((r) =>
        r.id === request.id
          ? {
              ...r,

              verification_status:
                status,

              admin_notes:
                notes,

              released_at:
                releasedAt,
            }
          : r
      )
    );

    setMessage(
      `Request #${request.id} is now ${status}.`
    );
  };

  /* =========================================================
     PENDING REQUESTS
  ========================================================= */

  const pendingRequests =
    requests.filter(
      (r) =>
        r.verification_status ===
        'Pending'
    );

  return (
    <div className="space-y-6">
      {/* =====================================================
          SUCCESS MESSAGE
      ===================================================== */}

      {message && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
          {message}
        </div>
      )}

      {/* =====================================================
          ERROR MESSAGE
      ===================================================== */}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* =====================================================
          PROPERTY OWNER ACCOUNTS
      ===================================================== */}

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">
                👤 Property Owner Accounts
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                View, lock, unlock, delete,
                and send individual notices
                to registered Property Owners.
              </p>
            </div>

            {/* ACCOUNT COUNT */}

            <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold uppercase text-blue-600">
                Total Accounts
              </p>

              <p className="text-xl font-black text-blue-900">
                {accounts.length}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading Property Owner accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No Property Owner accounts found.
          </div>
        ) : (
          <div className="divide-y">
            {accounts.map(
              (account) => (
                <div
                  key={account.id}
                  className="p-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* =================================================
                        ACCOUNT INFORMATION
                    ================================================= */}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900">
                          {account.full_name ||
                            'Unnamed Property Owner'}
                        </h3>

                  

                        
                      </div>

                      <p className="text-xs text-slate-600 mt-1">
                        {account.email ||
                          'No email'}
                      </p>

                      <p className="text-xs text-slate-500">
                        {account.contact_number ||
                          'No contact number'}{' '}
                        ·{' '}
                        {account.address ||
                          'No address'}
                      </p>

                      {/* ADDITIONAL ACCOUNT INFORMATION */}

                      {(account.barangay ||
                        account.municipality ||
                        account.province) && (
                        <p className="text-xs text-slate-500 mt-1">
                          {[
                            account.barangay,
                            account.municipality,
                            account.province,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}

                      {account.created_at && (
                        <p className="text-[10px] text-slate-400 mt-2">
                          Registered:{' '}
                          {new Date(
                            account.created_at
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* =================================================
                        ACCOUNT ACTIONS

                        VERIFY REMOVED
                    ================================================= */}

                    <div className="flex flex-wrap gap-2">
                      {/* LOCK */}

                      {account.account_status !==
                        'Locked' && (
                        <button
                          onClick={() =>
                            updateAccount(
                              account.id,
                              'Locked'
                            )
                          }
                          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold"
                        >
                          Lock
                        </button>
                      )}

                      {/* UNLOCK */}

                      {account.account_status ===
                        'Locked' && (
                        <button
                          onClick={() =>
                            updateAccount(
                              account.id,
                              'Verified'
                            )
                          }
                          className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-xs font-bold"
                        >
                          Unlock
                        </button>
                      )}

                      {/* DELETE */}

                      <button
                        onClick={() =>
                          deleteAccount(
                            account.id
                          )
                        }
                        className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg text-xs font-bold"
                      >
                        Delete
                      </button>

                      {/* NOTICE */}

                      
                    </div>
                  </div>

                  {/* =================================================
                      NOTICE FORM
                  ================================================= */}

                  {openAccount ===
                    account.id && (
                    <div className="mt-4 p-4 bg-slate-50 border rounded-xl">
                      <textarea
                        value={
                          noticeText[
                            account.id
                          ] || ''
                        }
                        onChange={(e) =>
                          setNoticeText(
                            (previous) => ({
                              ...previous,

                              [account.id]:
                                e.target.value,
                            })
                          )
                        }
                        rows={3}
                        placeholder="Write an individual notice for this Property Owner..."
                        className="w-full border border-slate-300 rounded-lg p-3 text-xs"
                      />

                      <button
                        onClick={() =>
                          sendNotice(
                            account
                          )
                        }
                        className="mt-2 bg-blue-900 hover:bg-blue-950 text-white px-4 py-2 rounded-lg text-xs font-bold"
                      >
                        Send Individual Notice
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </section>

      {/* =========================================================
          TAX DECLARATION REQUESTS
      ========================================================= */}

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-bold text-slate-900">
            📥 Tax Declaration Request Verification
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            {pendingRequests.length}{' '}
            pending request(s). Open every
            submitted document before releasing.
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No Tax Declaration requests found.
          </div>
        ) : (
          <div className="divide-y">
            {requests.map(
              (request) => (
                <RequestVerificationCard
                  key={request.id}
                  request={request}
                  onVerify={
                    verifyRequest
                  }
                />
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* =============================================================
   REQUEST VERIFICATION CARD
============================================================= */

function RequestVerificationCard({
  request,
  onVerify,
}) {
  const [notes, setNotes] =
    useState(
      request.admin_notes || ''
    );

  const [open, setOpen] =
    useState(false);

  const [declaration, setDeclaration] =
    useState(null);

  const [declarationError, setDeclarationError] =
    useState('');

  const [loadingDeclaration, setLoadingDeclaration] =
    useState(false);

  /* =========================================================
     OPEN DOCUMENTS
  ========================================================= */

  const openDocuments =
    async () => {
      const next = !open;

      setOpen(next);

      if (
        !next ||
        declaration ||
        !request.tax_declaration_id
      ) {
        return;
      }

      setLoadingDeclaration(
        true
      );

      setDeclarationError('');

      try {
        const {
          data,
          error,
        } = await supabase
          .from(
            'tax_declarations'
          )
          .select(
            `
              td_no,
              property_identification_no,
              owner_name,
              full_name,
              owner_address,
              barangay,
              location_barangay_district,
              verification_status
            `
          )
          .eq(
            'id',
            request.tax_declaration_id
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        setDeclaration(data);
      } catch (err) {
        console.error(
          '[DECLARATION LOAD ERROR]',
          err
        );

        setDeclarationError(
          err?.message ||
            'Unable to load the matching Tax Declaration.'
        );
      } finally {
        setLoadingDeclaration(
          false
        );
      }
    };

  const ownerName =
    declaration?.owner_name ||
    declaration?.full_name ||
    '—';

  return (
    <div className="p-5">
      {/* =====================================================
          REQUEST HEADER
      ===================================================== */}

      <div className="flex flex-col lg:flex-row lg:justify-between gap-3">
        <div>
          <p className="font-bold text-sm">
            Request #{request.id} · TD{' '}
            {request.td_no || '—'}
          </p>

          <p className="text-xs text-slate-500">
            PIN:{' '}
            {request.property_identification_no ||
              '—'}{' '}
            ·{' '}
            {request.submitted_by_email ||
              'No email'}
          </p>

          <p className="text-xs mt-1">
            <strong>
              Purpose:
            </strong>{' '}
            {request.purpose ||
              '—'}
          </p>

          <p className="text-xs mt-1 text-slate-500">
            <strong>
              Requester ID:
            </strong>{' '}
            {request.requester_id ||
              '—'}
          </p>

          <span
            className={`inline-block mt-2 px-2 py-1 rounded-full text-[10px] font-bold ${
              request.verification_status ===
              'Released'
                ? 'bg-emerald-100 text-emerald-800'
                : request.verification_status ===
                  'Rejected'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {request.verification_status ||
              'Pending'}
          </span>
        </div>

        <button
          onClick={
            openDocuments
          }
          className="self-start bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-xs font-bold"
        >
          {open
            ? 'Hide Documents'
            : 'Open Documents'}
        </button>
      </div>

      {/* =====================================================
          DOCUMENT AREA
      ===================================================== */}

      {open && (
        <div className="mt-4 p-4 rounded-xl bg-slate-50 border space-y-5">
          {/* =================================================
              TAX DECLARATION MATCH
          ================================================= */}

          <div className="p-4 rounded-lg bg-white border border-blue-200">
            <p className="font-bold text-blue-900 text-sm">
              Tax Declaration Matching Check
            </p>

            {declarationError && (
              <p className="text-rose-600 text-xs mt-2">
                {declarationError}
              </p>
            )}

            {loadingDeclaration && (
              <p className="text-slate-500 text-xs mt-2">
                Loading the matching Tax Declaration...
              </p>
            )}

            {declaration && (
              <div className="grid md:grid-cols-2 gap-2 mt-3 text-xs text-slate-700">
                <span>
                  TD No.:{' '}
                  <strong>
                    {declaration.td_no ||
                      '—'}
                  </strong>
                </span>

                <span>
                  PIN:{' '}
                  <strong>
                    {declaration.property_identification_no ||
                      '—'}
                  </strong>
                </span>

                <span>
                  Owner:{' '}
                  <strong>
                    {ownerName}
                  </strong>
                </span>

                <span>
                  Address:{' '}
                  <strong>
                    {declaration.owner_address ||
                      '—'}
                  </strong>
                </span>

                <span>
                  Barangay:{' '}
                  <strong>
                    {declaration.barangay ||
                      declaration.location_barangay_district ||
                      '—'}
                  </strong>
                </span>

                <span>
                  Declaration Status:{' '}
                  <strong>
                    {declaration.verification_status ||
                      '—'}
                  </strong>
                </span>
              </div>
            )}

            {!loadingDeclaration &&
              !declaration &&
              !declarationError &&
              !request.tax_declaration_id && (
                <p className="text-amber-700 text-xs mt-2">
                  No linked database ID was stored.
                  Verify the TD Number and PIN manually.
                </p>
              )}
          </div>

          {/* =================================================
              SUBMITTED DOCUMENTS
          ================================================= */}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Submitted Documents
                </h3>

                <p className="text-[10px] text-slate-500">
                  Review the actual files submitted by
                  the Property Owner before releasing
                  the request.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              <DocumentPreview
                label="Valid Government ID"
                url={
                  request.valid_government_id_url
                }
              />

              <DocumentPreview
                label="Proof of Ownership"
                url={
                  request.proof_of_ownership_url
                }
              />

              <DocumentPreview
                label="Tax Declaration Supporting Document"
                url={
                  request.supporting_document_image_url
                }
              />

              <DocumentPreview
                label="Authorization Letter"
                url={
                  request.authorization_letter_url
                }
              />
            </div>
          </div>

          {/* =================================================
              ADMIN NOTES
          ================================================= */}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Admin Notes / Rejection Notes
            </label>

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
              rows={3}
              className="w-full border border-slate-300 rounded-lg p-3 text-xs"
              placeholder="Add notes if rejecting or recording verification remarks."
            />
          </div>

          {/* =================================================
              ACTION BUTTONS
          ================================================= */}

          {request.verification_status !==
            'Released' && (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() =>
                  onVerify(
                    request,
                    'Rejected',
                    notes
                  )
                }
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                Reject with Notes
              </button>

              <button
                onClick={() =>
                  onVerify(
                    request,
                    'Released',
                    notes
                  )
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                ✓ Verify & Release
              </button>
            </div>
          )}

          {/* =================================================
              RELEASE INFORMATION
          ================================================= */}

          {request.released_at && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <strong>
                Released:
              </strong>{' '}
              {new Date(
                request.released_at
              ).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =============================================================
   DOCUMENT PREVIEW
============================================================= */

function DocumentPreview({
  label,
  url,
}) {
  if (!url) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">
          {label}
        </p>

        <div className="h-40 flex items-center justify-center rounded-lg bg-slate-50">
          <p className="text-xs text-slate-400 text-center">
            No document submitted
          </p>
        </div>
      </div>
    );
  }

  const cleanUrl =
    String(url).split('?')[0];

  const isPdf =
    /\.pdf$/i.test(
      cleanUrl
    ) ||
    String(url)
      .toLowerCase()
      .includes(
        'application/pdf'
      );

  const isImage =
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
      cleanUrl
    );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase text-slate-600 mb-2">
        {label}
      </p>

      {/* ===================================================
          IMAGE
      =================================================== */}

      {isImage && (
        <div className="w-full h-48 rounded-lg border bg-slate-100 overflow-hidden flex items-center justify-center">
          <img
            src={url}
            alt={label}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display =
                'none';
            }}
          />
        </div>
      )}

      {/* ===================================================
          PDF
      =================================================== */}

      {isPdf && (
        <div className="rounded-lg overflow-hidden border bg-slate-100">
          <iframe
            src={url}
            title={label}
            className="w-full h-48"
          />
        </div>
      )}

      {/* ===================================================
          UNKNOWN FILE TYPE
      =================================================== */}

      {!isImage &&
        !isPdf && (
          <div className="h-48 rounded-lg border bg-slate-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-2">
                📄
              </div>

              <p className="text-xs text-slate-500">
                Document file
              </p>
            </div>
          </div>
        )}

      {/* ===================================================
          OPEN FULL DOCUMENT
      =================================================== */}

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-3 text-center bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-[10px] font-bold"
      >
        Open Full Document ↗
      </a>
    </div>
  );
}