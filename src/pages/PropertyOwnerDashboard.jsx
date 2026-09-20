import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../assets/services/supabaseClient';
import { logoutPropertyOwner } from '../assets/services/userAuth';
import { jsPDF } from 'jspdf';

// =========================================================
// CONFIG
// =========================================================

// Remembers which request modal is open so a page refresh keeps it open.
const OPEN_REQUEST_KEY = 'po_dashboard_open_request';

// Notification storage (per user). The status map remembers the last status
// we saw for each request so we can tell when the Assessor approved/rejected one.
const STATUS_KEY_PREFIX = 'po_request_status_';
const NOTIF_KEY_PREFIX = 'po_notifications_';
const MAX_NOTIFICATIONS = 30;

// Columns where the property image may be stored (first one that has a value is used).
const IMAGE_FIELDS = ['property_image', 'document_image', 'image_url'];

// OPTIONAL: set this to a Supabase Storage bucket name (e.g. 'tax-declaration-images')
// to upload edited images to Storage and save the public URL.
// Leave as null to save the image directly in the column as a base64 data URL.
const IMAGE_BUCKET = null;

// Only these fields can be changed by the owner. System / approval fields
// (approved_by, approval_date, verification_status, ...) are never sent.
const EDITABLE_FIELDS = [
  'td_no',
  'property_identification_no',
  'full_name',
  'owner_name',
  'owner_tin',
  'owner_address',
  'owner_telephone',
  'administrator_name',
  'administrator_tin',
  'administrator_address',
  'administrator_telephone',
  'location_number_street',
  'location_barangay_district',
  'location_municipality_province_city',
  'oct_tct_cloa_no',
  'cct_no',
  'dated',
  'survey_no',
  'lot_no',
  'blk_no',
  'boundary_north',
  'boundary_south',
  'boundary_east',
  'boundary_west',
  'is_land',
  'is_building',
  'building_no_of_storeys',
  'building_brief_description',
  'is_machinery',
  'machinery_brief_description',
  'is_others',
  'others_specify',
  'assessment_rows',
  'total_market_value',
  'total_assessed_value',
  'total_assessed_value_words',
  'taxability_status',
  'effectivity_qtr',
  'effectivity_yr',
  'previous_av',
  'cancels_td_no',
  'memoranda'
];

const ASSESSMENT_COLUMNS = [
  ['classification', 'Classification'],
  ['area', 'Area'],
  ['market_value', 'Market Value'],
  ['actual_use', 'Actual Use'],
  ['assessment_level', 'Assessment Level'],
  ['assessed_value', 'Assessed Value']
];

const NOT_RELEASED_MESSAGE =
  'This request must be verified and released by the Assessor first before you can access the document.';

const OTHER_OWNER_MESSAGE =
  'This Tax Declaration was submitted by another account. You can view and export it, but only its owner can edit it.';

// =========================================================
// HELPERS
// =========================================================

const parseRows = (rows) => {
  let value = rows;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }

  return Array.isArray(value) ? value : [];
};

const getImageValue = (declaration) =>
  declaration
    ? declaration.property_image ||
      declaration.document_image ||
      declaration.image_url ||
      null
    : null;

const getImageField = (declaration) =>
  IMAGE_FIELDS.find((f) => declaration?.[f]) ||
  IMAGE_FIELDS.find((f) => declaration && f in declaration) ||
  'property_image';

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the image.'));
    reader.readAsDataURL(blob);
  });

// Resize + compress so the image stays small (max 1600px, JPEG).
const resizeImage = (file, maxSize = 1600, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(
        1,
        maxSize / Math.max(img.width, img.height)
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('Unable to process the image.')),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected file is not a valid image.'));
    };

    img.src = objectUrl;
  });

// Load an image (data URL or normal URL) so jsPDF can embed it.
const loadImageForPdf = async (src) => {
  let dataUrl = src;

  if (!String(src).startsWith('data:')) {
    const response = await fetch(src);
    const blob = await response.blob();
    dataUrl = await blobToDataUrl(blob);
  }

  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

  const format = /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG';

  return { dataUrl, format, dims };
};

// ---------------------------------------------------------
// Request status helpers
// Only a request whose status is "Released" can be opened,
// exported or edited by the owner. Pending requests must be
// verified by the Assessor first.
// ---------------------------------------------------------

const normalizeStatus = (request) =>
  String(request?.verification_status || 'Pending')
    .trim()
    .toLowerCase();

const isReleasedRequest = (request) =>
  normalizeStatus(request) === 'released';

const canAccessRequest = (request) => isReleasedRequest(request);

const canEditRequest = (request) => isReleasedRequest(request);

// Submission type for a declaration that belongs to ANOTHER account.
// An explicit flag wins; otherwise it is "full" only when the record
// really contains full-detail data, so Quick Submit records stay Quick.
const getSharedSubmissionMode = (record) => {
  if (!record) return 'quick';

  if (
    record.submission_mode === 'quick' ||
    record.isQuickSubmit === true ||
    record.is_quick_submit === true ||
    record.quick_submit === true
  ) {
    return 'quick';
  }

  if (record.submission_mode === 'full') return 'full';

  const hasFullData =
    parseRows(record.assessment_rows).length > 0 ||
    Boolean(
      record.owner_tin ||
        record.owner_address ||
        record.location_number_street ||
        record.total_market_value
    );

  return hasFullData ? 'full' : 'quick';
};

// ---------------------------------------------------------
// Notification helpers
// "approved" = the Assessor verified and released the request.
// "rejected" = the Assessor rejected the request.
// Anything else (Pending, ...) does not trigger a notification.
// ---------------------------------------------------------

const getDecision = (request) => {
  const status = normalizeStatus(request);

  if (status === 'released' || status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';

  return null;
};

const buildNotification = (request, decision) => {
  const tdLabel = request.td_no ? ` (TD No. ${request.td_no})` : '';

  if (decision === 'approved') {
    return {
      id: `${request.id}-approved-${Date.now()}`,
      requestId: request.id,
      type: 'approved',
      title: 'Request approved',
      message: `Your Tax Declaration request${tdLabel} was approved and released by the Assessor. You can now view, edit and export it.`,
      time: new Date().toISOString(),
      read: false
    };
  }

  return {
    id: `${request.id}-rejected-${Date.now()}`,
    requestId: request.id,
    type: 'rejected',
    title: 'Request rejected',
    message:
      `Your Tax Declaration request${tdLabel} was rejected by the Assessor.` +
      (request.admin_notes ? ` Reason: ${request.admin_notes}` : ''),
    time: new Date().toISOString(),
    read: false
  };
};

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

// ---------------------------------------------------------
// Session helper
// A refresh can briefly return an error or an empty session
// while Supabase restores / refreshes the token. Retry a few
// times before deciding the user is really logged out.
// ---------------------------------------------------------

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSessionWithRetry = async (attempts = 10, delay = 300) => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const { data } = await supabase.auth.getSession();

      if (data?.session) return data.session;
    } catch {
      // retry
    }

    if (i < attempts - 1) {
      await wait(delay);
    }
  }

  return null;
};

export default function PropertyOwnerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [notice, setNotice] = useState(
    location.state?.submitted
      ? (location.state?.message || 'Operation completed successfully.')
      : ''
  );

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [records, setRecords] = useState([]);
  // Declarations submitted by OTHER accounts that this owner requested
  const [sharedRecords, setSharedRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // =========================================================
  // NOTIFICATIONS (request approved / rejected)
  // =========================================================

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState(null);

  // =========================================================
  // DELETE REQUEST
  // =========================================================

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // =========================================================
  // REQUEST DETAILS MODAL
  // =========================================================

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedDeclaration, setSelectedDeclaration] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // =========================================================
  // INLINE EDIT MODE
  // =========================================================

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editData, setEditData] = useState(null);
  const [savingDetails, setSavingDetails] = useState(false);

  // Image replaced while editing (uploaded when Save is pressed)
  const [pendingImageBlob, setPendingImageBlob] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);

  // Refs used by the listeners so they never read stale state
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditingDetails;

  const loggingOutRef = useRef(false);

  const userId = session?.user?.id;

  // =========================================================
  // NOTIFICATION LOGIC
  // =========================================================

  const persistNotifications = (uid, list) => {
    if (!uid) return;
    writeStorage(`${NOTIF_KEY_PREFIX}${uid}`, list);
  };

  const addNotifications = (uid, fresh) => {
    if (!fresh.length) return;

    setNotifications((previous) => {
      const next = [...fresh, ...previous].slice(0, MAX_NOTIFICATIONS);
      persistNotifications(uid, next);
      return next;
    });

    const first = fresh[0];

    setToast({
      type: fresh.length === 1 ? first.type : 'info',
      title: fresh.length === 1 ? first.title : 'New request updates',
      message:
        fresh.length === 1
          ? first.message
          : `You have ${fresh.length} new updates on your Tax Declaration requests.`
    });
  };

  // Compares the latest request statuses with the last ones we saw.
  // The first time ever (no saved map) it only records the current statuses.
  const processStatusChanges = (uid, requestRows) => {
    const statusKey = `${STATUS_KEY_PREFIX}${uid}`;
    const stored = readStorage(statusKey, null);

    const current = {};

    requestRows.forEach((r) => {
      current[r.id] = normalizeStatus(r);
    });

    if (stored) {
      const fresh = [];

      requestRows.forEach((r) => {
        const decision = getDecision(r);

        if (!decision) return;

        const before = stored[r.id] || 'pending';

        if (before !== current[r.id]) {
          fresh.push(buildNotification(r, decision));
        }
      });

      addNotifications(uid, fresh);
    }

    writeStorage(statusKey, current);
  };

  const markAllNotificationsRead = () => {
    const next = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(next);
    persistNotifications(session?.user?.id, next);
  };

  const clearNotifications = () => {
    setNotifications([]);
    persistNotifications(session?.user?.id, []);
  };

  const openNotification = (notification) => {
    const next = notifications.map((n) =>
      n.id === notification.id ? { ...n, read: true } : n
    );

    setNotifications(next);
    persistNotifications(session?.user?.id, next);
    setShowNotifications(false);

    const request = requests.find((r) => r.id === notification.requestId);

    if (
      notification.type === 'approved' &&
      request &&
      canAccessRequest(request)
    ) {
      viewRequestDetails(request);
      return;
    }

    const section = document.getElementById('requests-section');

    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Auto-hide the toast
  useEffect(() => {
    if (!toast) return undefined;

    const timer = setTimeout(() => setToast(null), 9000);

    return () => clearTimeout(timer);
  }, [toast]);

  // =========================================================
  // DATA LOADING
  // =========================================================

  const fetchPortalData = async (uid) => {
    const [
      { data: profileData },
      { data: recordRows, error: recordError },
      { data: requestRows, error: requestError }
    ] = await Promise.all([
      supabase
        .from('property_owner_accounts')
        .select('*')
        .eq('id', uid)
        .maybeSingle(),

      supabase
        .from('tax_declarations')
        .select('*')
        .eq('submitted_by', uid)
        .order('submitted_at', { ascending: false }),

      supabase
        .from('tax_declaration_requests')
        .select('*')
        .eq('submitted_by', uid)
        .order('created_at', { ascending: false })
    ]);

    if (recordError) throw recordError;
    if (requestError) throw requestError;

    // Declarations submitted by other accounts that this owner has requested
    // (only returned by the database once the request is Released).
    const sharedRows = [];

    try {
      const seen = new Set((recordRows || []).map((r) => r.id));

      const ids = [
        ...new Set(
          (requestRows || [])
            .map((r) => r.tax_declaration_id)
            .filter((id) => id && !seen.has(id))
        )
      ];

      const tdNos = [
        ...new Set(
          (requestRows || []).map((r) => r.td_no).filter(Boolean)
        )
      ];

      const queries = [];

      if (ids.length > 0) {
        queries.push(
          supabase.from('tax_declarations').select('*').in('id', ids)
        );
      }

      if (tdNos.length > 0) {
        queries.push(
          supabase.from('tax_declarations').select('*').in('td_no', tdNos)
        );
      }

      const results = await Promise.all(queries);

      results.forEach(({ data }) => {
        (data || []).forEach((row) => {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            sharedRows.push(row);
          }
        });
      });
    } catch {
      // ignore - shared declarations are optional
    }

    return {
      profileData: profileData || null,
      recordRows: recordRows || [],
      requestRows: requestRows || [],
      sharedRows
    };
  };

  // Full load (shows the loading state) - used on first open / refresh
  const loadPortal = async (uid) => {
    setLoading(true);
    setError('');

    try {
      const { profileData, recordRows, requestRows, sharedRows } =
        await fetchPortalData(uid);

      setProfile(profileData);
      setRecords(recordRows);
      setSharedRecords(sharedRows);
      setRequests(requestRows);

      // Notify about requests approved / rejected since the last visit
      processStatusChanges(uid, requestRows);

      return { recordRows, requestRows };
    } catch (err) {
      setError(
        err?.message ||
        'Unable to load your Property Owner account.'
      );
      return { recordRows: [], requestRows: [] };
    } finally {
      setLoading(false);
    }
  };

  // Silent reload (no loading flash) - used after saving and on realtime changes
  const refreshData = async (uid) => {
    try {
      const { recordRows, requestRows, sharedRows } =
        await fetchPortalData(uid);

      setRecords(recordRows);
      setSharedRecords(sharedRows);
      setRequests(requestRows);

      // Notify when the Assessor approves / rejects a request
      processStatusChanges(uid, requestRows);

      setSelectedRequest((prev) =>
        prev
          ? requestRows.find((r) => r.id === prev.id) || prev
          : prev
      );

      // Never overwrite the record while the owner is typing
      if (!isEditingRef.current) {
        setSelectedDeclaration((prev) =>
          prev
            ? recordRows.find((r) => r.id === prev.id) || prev
            : prev
        );
      }
    } catch {
      // silent - the next refresh will try again
    }
  };

  // =========================================================
  // AUTHENTICATION + STAY ON THE PAGE AFTER REFRESH
  //
  // Fixes the "refresh sends me back to the login page" bug:
  //  - a failed / empty getSession() right after a refresh is
  //    retried instead of being treated as "logged out"
  //  - the auth listener can also start the load when Supabase
  //    delivers the restored session (INITIAL_SESSION)
  //  - SIGNED_OUT is double-checked before redirecting
  //  - the "started" flag is local to each effect run, so React
  //    StrictMode's double-mount cannot block the real load
  // =========================================================

  useEffect(() => {
    let active = true;
    let started = false;

    const initialize = async (initialSession) => {
      if (started) return;
      started = true;

      const user = initialSession.user;

      const { data: account } = await supabase
        .from('property_owner_accounts')
        .select('account_status')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;

      if (account?.account_status === 'Locked') {
        // stop the SIGNED_OUT listener from overriding the message
        loggingOutRef.current = true;

        await supabase.auth.signOut();

        navigate('/user-login', {
          replace: true,
          state: {
            message: 'Your account is locked.'
          }
        });

        return;
      }

      setSession(initialSession);

      // Restore saved notifications before the first load so new ones are added on top
      setNotifications(readStorage(`${NOTIF_KEY_PREFIX}${user.id}`, []));

      const { requestRows } = await loadPortal(user.id);

      if (!active) return;

      // Re-open the details modal that was open before the refresh
      // (only if that request is still Released)
      try {
        const savedId = sessionStorage.getItem(OPEN_REQUEST_KEY);

        if (savedId) {
          const savedRequest = requestRows.find(
            (r) => String(r.id) === savedId
          );

          if (savedRequest && canAccessRequest(savedRequest)) {
            await viewRequestDetails(savedRequest, user.id);
          } else {
            sessionStorage.removeItem(OPEN_REQUEST_KEY);
          }
        }
      } catch {
        // ignore storage errors
      }
    };

    const bootstrap = async () => {
      const currentSession = await getSessionWithRetry();

      if (!active) return;

      if (!currentSession) {
        navigate('/user-login', { replace: true });
        return;
      }

      await initialize(currentSession);
    };

    // NOTE: no awaited Supabase calls directly inside this callback
    // (that can deadlock the auth client) - work is deferred with setTimeout.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!active) return;

      if (event === 'SIGNED_OUT') {
        if (loggingOutRef.current) return;

        setTimeout(async () => {
          if (!active || loggingOutRef.current) return;

          const { data } = await supabase.auth.getSession();

          if (active && !loggingOutRef.current && !data?.session) {
            navigate('/user-login', { replace: true });
          }
        }, 0);

        return;
      }

      if (newSession) {
        setSession((prev) =>
          prev?.access_token === newSession.access_token
            ? prev
            : newSession
        );

        if (!started) {
          setTimeout(() => {
            if (active) initialize(newSession);
          }, 0);
        }
      }
    });

    bootstrap();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // =========================================================
  // REALTIME: keep the portal in sync with the Tax Form Manager
  // (works when Realtime is enabled for these tables)
  // =========================================================

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`owner-portal-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tax_declarations',
          filter: `submitted_by=eq.${userId}`
        },
        () => refreshData(userId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tax_declaration_requests',
          filter: `submitted_by=eq.${userId}`
        },
        () => refreshData(userId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // =========================================================
  // CLEAR SUCCESS MESSAGE AFTER REDIRECT
  // =========================================================

  useEffect(() => {
    if (location.state?.submitted) {
      navigate(location.pathname, {
        replace: true,
        state: {}
      });
    }
  }, [location, navigate]);

  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = async () => {
    loggingOutRef.current = true;

    try {
      sessionStorage.removeItem(OPEN_REQUEST_KEY);
    } catch {
      // ignore
    }

    await logoutPropertyOwner();
    navigate('/', { replace: true });
  };

  // =========================================================
  // DETERMINE QUICK / FULL SUBMISSION
  // =========================================================

  const getSubmissionMode = (record) => {
    if (!record) return 'quick';

    if (record.submission_mode === 'quick') {
      return 'quick';
    }

    if (record.submission_mode === 'full') {
      return 'full';
    }

    if (
      record.isQuickSubmit === true ||
      record.is_quick_submit === true ||
      record.quick_submit === true
    ) {
      return 'quick';
    }

    return 'full';
  };

  // =========================================================
  // FIND DECLARATION CONNECTED TO REQUEST
  // =========================================================

  const findDeclarationForRequest = async (request, uidOverride) => {
    if (!request) {
      throw new Error('Invalid Tax Declaration request.');
    }

    // The declaration may have been submitted by ANOTHER account, so it is
    // looked up without an owner filter. The database (RLS) only returns it
    // once the Assessor has released this owner's request.
    const lookups = [];

    if (request.tax_declaration_id) {
      lookups.push(['id', request.tax_declaration_id]);
    }

    if (request.td_no) {
      lookups.push(['td_no', request.td_no]);
    }

    if (request.property_identification_no) {
      lookups.push([
        'property_identification_no',
        request.property_identification_no
      ]);
    }

    for (const [column, value] of lookups) {
      const { data, error } = await supabase
        .from('tax_declarations')
        .select('*')
        .eq(column, value)
        .order('submitted_at', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) return data[0];
    }

    // No declaration record could be read: show what is stored on the
    // request itself instead of an error (view-only, Quick layout).
    const fallback = { ...request };
    delete fallback.id;

    return {
      ...fallback,
      id: null,
      submission_mode: 'quick',
      _fromRequest: true
    };
  };

  // =========================================================
  // VIEW DETAILS (Released requests only)
  // =========================================================

  const viewRequestDetails = async (request, uidOverride) => {
    if (!canAccessRequest(request)) {
      setError(NOT_RELEASED_MESSAGE);
      return;
    }

    setDetailsLoading(true);
    setError('');
    setIsEditingDetails(false);
    setEditData(null);
    setPendingImageBlob(null);

    try {
      const declaration =
        await findDeclarationForRequest(request, uidOverride);

      setSelectedRequest(request);
      setSelectedDeclaration(declaration);

      try {
        sessionStorage.setItem(OPEN_REQUEST_KEY, String(request.id));
      } catch {
        // ignore
      }
    } catch (err) {
      setError(
        err?.message ||
        'Unable to load the Tax Declaration details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // =========================================================
  // START INLINE EDIT (only reachable from the details modal)
  // Only Released requests can be edited.
  // =========================================================

  const editRequest = async (request) => {
    setError('');

    if (!canEditRequest(request)) {
      setError(NOT_RELEASED_MESSAGE);
      return;
    }

    try {
      let declaration = selectedDeclaration;

      if (
        !declaration ||
        !selectedRequest ||
        selectedRequest.id !== request.id
      ) {
        declaration =
          await findDeclarationForRequest(request);
      }

      if (declaration._fromRequest) {
        throw new Error(
          'Only the request details are available, so there is nothing to edit.'
        );
      }

      // Only the account that submitted the declaration can edit it
      if (
        declaration.submitted_by &&
        declaration.submitted_by !== session?.user?.id
      ) {
        throw new Error(OTHER_OWNER_MESSAGE);
      }

      setSelectedRequest(request);
      setSelectedDeclaration(declaration);

      // Clone so editing does not modify the read-only record
      const clonedDeclaration = {
        ...declaration,
        assessment_rows: parseRows(declaration.assessment_rows)
      };

      setPendingImageBlob(null);
      setEditData(clonedDeclaration);
      setIsEditingDetails(true);
    } catch (err) {
      setError(
        err?.message ||
        'Unable to open the Tax Declaration for editing.'
      );
    }
  };

  // =========================================================
  // EDIT FIELD HANDLER
  // =========================================================

  const handleEditChange = (field, value) => {
    setEditData((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  // =========================================================
  // ASSESSMENT ROW EDIT
  // =========================================================

  const handleAssessmentChange = (
    index,
    field,
    value
  ) => {
    setEditData((previous) => {
      const rows = Array.isArray(previous.assessment_rows)
        ? [...previous.assessment_rows]
        : [];

      rows[index] = {
        ...rows[index],
        [field]: value
      };

      return {
        ...previous,
        assessment_rows: rows
      };
    });
  };

  // =========================================================
  // IMAGE REPLACE (while editing)
  // =========================================================

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG or WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('The image is too large. Please choose one under 10 MB.');
      return;
    }

    setError('');
    setImageProcessing(true);

    try {
      const blob = await resizeImage(file);
      const preview = await blobToDataUrl(blob);

      setPendingImageBlob(blob);
      handleEditChange(getImageField(selectedDeclaration), preview);
    } catch (err) {
      setError(err?.message || 'Unable to process the selected image.');
    } finally {
      setImageProcessing(false);
    }
  };

  // =========================================================
  // CANCEL INLINE EDIT
  // =========================================================

  const cancelInlineEdit = () => {
    setIsEditingDetails(false);
    setEditData(null);
    setPendingImageBlob(null);
    setError('');
  };

  // =========================================================
  // SAVE INLINE EDIT
  // Updates tax_declarations (the same record the Tax Form Manager
  // reads) and syncs the linked request rows.
  // =========================================================

  const saveInlineEdit = async () => {
    if (!editData?.id || !selectedDeclaration) {
      setError(
        'Unable to save this Tax Declaration because its record ID is missing.'
      );
      return;
    }

    if (!session?.user?.id) {
      setError(
        'Your session has expired. Please log in again.'
      );
      return;
    }

    // The request may have been changed by the Assessor while editing
    if (!canEditRequest(selectedRequest)) {
      setError(NOT_RELEASED_MESSAGE);
      return;
    }

    // Declarations submitted by another account are view-only
    if (
      selectedDeclaration.submitted_by &&
      selectedDeclaration.submitted_by !== session.user.id
    ) {
      setError(OTHER_OWNER_MESSAGE);
      return;
    }

    setSavingDetails(true);
    setError('');
    setNotice('');

    try {
      const uid = session.user.id;
      const original = selectedDeclaration;
      const imageField = getImageField(original);
      const nextData = { ...editData };

      // ---- image: upload to Storage if a bucket is configured ----
      if (pendingImageBlob) {
        if (!(imageField in original)) {
          throw new Error(
            'This Tax Declaration has no image column to store the new image.'
          );
        }

        if (IMAGE_BUCKET) {
          const path = `${uid}/${original.id}-${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from(IMAGE_BUCKET)
            .upload(path, pendingImageBlob, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from(IMAGE_BUCKET)
            .getPublicUrl(path);

          nextData[imageField] = urlData.publicUrl;
        }
        // otherwise nextData[imageField] already holds the base64 preview
      }

      // ---- build the update from what actually changed ----
      const updateData = {};

      [...EDITABLE_FIELDS, imageField].forEach((field) => {
        if (!(field in original)) return;

        if (field === 'assessment_rows') {
          const newRows = parseRows(nextData.assessment_rows);
          const oldRows = parseRows(original.assessment_rows);

          if (JSON.stringify(newRows) === JSON.stringify(oldRows)) {
            return;
          }

          updateData.assessment_rows =
            typeof original.assessment_rows === 'string'
              ? JSON.stringify(newRows)
              : newRows;

          return;
        }

        let newValue = nextData[field];
        const oldValue = original[field];

        if (newValue === '') newValue = null;

        if ((newValue ?? null) === (oldValue ?? null)) return;

        updateData[field] = newValue;
      });

      if (Object.keys(updateData).length === 0) {
        setEditData(null);
        setIsEditingDetails(false);
        setPendingImageBlob(null);
        setNotice('No changes were made.');
        return;
      }

      const { data, error: updateError } = await supabase
        .from('tax_declarations')
        .update(updateData)
        .eq('id', original.id)
        .eq('submitted_by', uid)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      if (!data) {
        throw new Error(
          'The Tax Declaration was not updated.'
        );
      }

      // ---- keep the linked request rows in sync (TD No. / Property ID) ----
      const syncPatch = {};

      if ('td_no' in updateData) {
        syncPatch.td_no = data.td_no;
      }

      if ('property_identification_no' in updateData) {
        syncPatch.property_identification_no =
          data.property_identification_no;
      }

      let syncWarning = '';

      if (Object.keys(syncPatch).length > 0) {
        const { error: syncError } = await supabase
          .from('tax_declaration_requests')
          .update(syncPatch)
          .eq('submitted_by', uid)
          .eq('tax_declaration_id', data.id);

        if (syncError) syncWarning = syncError.message;

        // Older requests that are linked only by TD No.
        if (original.td_no) {
          const { error: legacyError } = await supabase
            .from('tax_declaration_requests')
            .update(syncPatch)
            .eq('submitted_by', uid)
            .is('tax_declaration_id', null)
            .eq('td_no', original.td_no);

          if (legacyError) syncWarning = legacyError.message;
        }
      }

      // Refresh the tables silently, then show the saved record
      await refreshData(uid);

      setSelectedDeclaration(data);

      setRecords((previous) =>
        previous.map((record) =>
          record.id === data.id
            ? data
            : record
        )
      );

      setEditData(null);
      setIsEditingDetails(false);
      setPendingImageBlob(null);

      setNotice(
        syncWarning
          ? 'Tax Declaration saved, but the linked request could not be synced: ' +
              syncWarning
          : 'Tax Declaration details were updated successfully.'
      );
    } catch (err) {
      setError(
        err?.message ||
        'Unable to save the Tax Declaration changes.'
      );
    } finally {
      setSavingDetails(false);
    }
  };

  // =========================================================
  // DELETE REQUEST
  // Removes the request row from tax_declaration_requests.
  // The submitted Tax Declaration record itself is not deleted.
  // =========================================================

  const askDeleteRequest = (request) => {
    setDeleteError('');
    setDeleteTarget(request);
  };

  const cancelDeleteRequest = () => {
    if (deleting) return;

    setDeleteTarget(null);
    setDeleteError('');
  };

  const deleteRequest = async () => {
    if (!deleteTarget) return;

    const uid = session?.user?.id;

    if (!uid) {
      setDeleteError('Your session has expired. Please log in again.');
      return;
    }

    setDeleting(true);
    setDeleteError('');

    try {
      const { data, error: deleteRequestError } = await supabase
        .from('tax_declaration_requests')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('submitted_by', uid)
        .select('id');

      if (deleteRequestError) throw deleteRequestError;

      // Row Level Security can silently delete nothing - treat that as a failure
      if (!data || data.length === 0) {
        throw new Error(
          'The request could not be deleted. Deleting requests may not be allowed for your account.'
        );
      }

      const deletedId = deleteTarget.id;

      setRequests((previous) =>
        previous.filter((r) => r.id !== deletedId)
      );

      // Remove notifications that belong to the deleted request
      setNotifications((previous) => {
        const next = previous.filter((n) => n.requestId !== deletedId);
        persistNotifications(uid, next);
        return next;
      });

      // Close the details modal if it was showing this request
      if (selectedRequest?.id === deletedId) {
        closeDetails();
      }

      setDeleteTarget(null);
      setNotice('Tax Declaration request was deleted successfully.');
    } catch (err) {
      setDeleteError(
        err?.message ||
        'Unable to delete the Tax Declaration request.'
      );
    } finally {
      setDeleting(false);
    }
  };

  // =========================================================
  // HELPER: ADD PDF FIELD
  // =========================================================

  const addPdfField = (pdf, label, value, y) => {
    const safeValue =
      value === null ||
      value === undefined ||
      value === ''
        ? '—'
        : String(value);

    const text = `${label}: ${safeValue}`;

    const wrapped = pdf.splitTextToSize(
      text,
      170
    );

    wrapped.forEach((line) => {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(line, 20, y);
      y += 6;
    });

    return y;
  };

  // =========================================================
  // PDF EXPORT (Released requests only)
  // =========================================================

  const exportRequestPdf = async (request) => {
    try {
      setError('');

      if (!canAccessRequest(request)) {
        throw new Error(NOT_RELEASED_MESSAGE);
      }

      const declaration =
        await findDeclarationForRequest(request);

      // ---------------------------------------------------------
      // FORM-STYLE PDF
      // The export intentionally follows the paper Tax Declaration
      // of Real Property layout shown in the reference image.
      // ---------------------------------------------------------
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const left = 8;
      const right = 202;
      const contentWidth = right - left;

      const textValue = (value) => {
        if (value === null || value === undefined || value === '') {
          return '';
        }
        return String(value);
      };

      const fitText = (value, maxWidth, fontSize = 7) => {
        const text = textValue(value);
        if (!text) return '';
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        return lines[0] || '';
      };

      const lineField = (
        label,
        value,
        x,
        y,
        width,
        {
          labelWidth = 30,
          fontSize = 7,
          lineOffset = 1.5,
          valueBold = false
        } = {}
      ) => {
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(fontSize);
        pdf.text(label, x, y);

        const valueX = x + labelWidth;
        const valueWidth = Math.max(8, width - labelWidth);

        pdf.setFont(undefined, valueBold ? 'bold' : 'normal');
        const display = fitText(
          value,
          valueWidth - 2,
          fontSize
        );

        if (display) {
          pdf.text(display, valueX, y);
        }

        pdf.setDrawColor(45);
        pdf.setLineWidth(0.25);
        pdf.line(
          valueX,
          y + lineOffset,
          x + width,
          y + lineOffset
        );
      };

      const underlinedValue = (
        value,
        x,
        y,
        width,
        {
          fontSize = 7,
          align = 'left',
          bold = false
        } = {}
      ) => {
        pdf.setFont(undefined, bold ? 'bold' : 'normal');
        pdf.setFontSize(fontSize);

        const display = fitText(value, width - 2, fontSize);

        if (display) {
          if (align === 'center') {
            pdf.text(
              display,
              x + width / 2,
              y,
              { align: 'center' }
            );
          } else if (align === 'right') {
            pdf.text(
              display,
              x + width - 1,
              y,
              { align: 'right' }
            );
          } else {
            pdf.text(display, x, y);
          }
        }

        pdf.setDrawColor(45);
        pdf.setLineWidth(0.25);
        pdf.line(x, y + 1.5, x + width, y + 1.5);
      };

      const checkbox = (
        label,
        checked,
        x,
        y,
        size = 3.5
      ) => {
        pdf.setDrawColor(35);
        pdf.setLineWidth(0.3);
        pdf.rect(x, y - size + 0.5, size, size);

        if (checked) {
          pdf.setFont(undefined, 'bold');
          pdf.setFontSize(7);
          pdf.text('X', x + 0.75, y - 0.4);
        }

        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(7);
        pdf.text(label, x + size + 2, y);
      };

      const sectionLabel = (label, x, y) => {
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(7);
        pdf.text(label, x, y);
      };

      const fmtDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return String(value);
        }

        return date.toLocaleDateString();
      };

      const rows = parseRows(declaration.assessment_rows);

      // ---------------------------------------------------------
      // HEADER
      // ---------------------------------------------------------
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(12);
      pdf.text(
        'TAX DECLARATION OF REAL PROPERTY',
        pageWidth / 2,
        12,
        { align: 'center' }
      );

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7);

      // Identification row
      lineField(
        'TD No.',
        declaration.td_no,
        left + 1,
        22,
        74,
        { labelWidth: 13 }
      );

      lineField(
        'Property Identification No.',
        declaration.property_identification_no,
        82,
        22,
        120,
        { labelWidth: 43 }
      );

      // Owner
      lineField(
        'Owner:',
        declaration.owner_name || declaration.full_name,
        left + 1,
        30,
        120,
        { labelWidth: 17 }
      );

      lineField(
        'TIN:',
        declaration.owner_tin,
        129,
        30,
        73,
        { labelWidth: 10 }
      );

      // Owner address / telephone
      lineField(
        'Address:',
        declaration.owner_address,
        left + 1,
        37,
        120,
        { labelWidth: 17 }
      );

      lineField(
        'Telephone No.',
        declaration.owner_telephone,
        129,
        37,
        73,
        { labelWidth: 28 }
      );

      // Administrator / beneficial user
      lineField(
        'Administrator/Beneficial User:',
        declaration.administrator_name,
        left + 1,
        45,
        120,
        { labelWidth: 61 }
      );

      lineField(
        'TIN:',
        declaration.administrator_tin,
        129,
        45,
        73,
        { labelWidth: 10 }
      );

      lineField(
        'Address:',
        declaration.administrator_address,
        left + 1,
        52,
        120,
        { labelWidth: 17 }
      );

      lineField(
        'Telephone No.',
        declaration.administrator_telephone,
        129,
        52,
        73,
        { labelWidth: 28 }
      );

      // Location of property
      sectionLabel('Location of Property:', left + 1, 60);

      underlinedValue(
        declaration.location_number_street,
        42,
        60,
        48,
        { fontSize: 6.5 }
      );

      underlinedValue(
        declaration.location_barangay_district,
        94,
        60,
        48,
        { fontSize: 6.5 }
      );

      underlinedValue(
        declaration.location_municipality_province_city,
        146,
        60,
        56,
        { fontSize: 6.5 }
      );

      pdf.setFont(undefined, 'italic');
      pdf.setFontSize(5.5);
      pdf.text(
        '(Number and Street)',
        66,
        65,
        { align: 'center' }
      );
      pdf.text(
        '(Barangay/District)',
        118,
        65,
        { align: 'center' }
      );
      pdf.text(
        '(Municipality & Province/City)',
        174,
        65,
        { align: 'center' }
      );

      // Title / cadastral information
      lineField(
        'OCT/TCT/CLOA No.',
        declaration.oct_tct_cloa_no,
        left + 1,
        73,
        82,
        { labelWidth: 35 }
      );

      lineField(
        'Survey No.',
        declaration.survey_no,
        109,
        73,
        93,
        { labelWidth: 22 }
      );

      lineField(
        'CCT',
        declaration.cct_no,
        left + 1,
        81,
        82,
        { labelWidth: 12 }
      );

      lineField(
        'Lot No.',
        declaration.lot_no,
        109,
        81,
        93,
        { labelWidth: 17 }
      );

      lineField(
        'Dated:',
        declaration.dated,
        left + 1,
        89,
        82,
        { labelWidth: 17 }
      );

      lineField(
        'Blk. No.',
        declaration.blk_no,
        109,
        89,
        93,
        { labelWidth: 19 }
      );

      // Boundaries
      sectionLabel('Boundaries:', left + 1, 98);

      lineField(
        'North:',
        declaration.boundary_north,
        31,
        98,
        73,
        { labelWidth: 14 }
      );

      lineField(
        'South:',
        declaration.boundary_south,
        112,
        98,
        90,
        { labelWidth: 15 }
      );

      lineField(
        'East:',
        declaration.boundary_east,
        31,
        106,
        73,
        { labelWidth: 12 }
      );

      lineField(
        'West:',
        declaration.boundary_west,
        112,
        106,
        90,
        { labelWidth: 15 }
      );

      // ---------------------------------------------------------
      // KIND OF PROPERTY ASSESSED
      // ---------------------------------------------------------
      pdf.setDrawColor(45);
      pdf.setLineWidth(0.25);
      pdf.line(left, 112, right, 112);

      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(7.5);
      pdf.text(
        'KIND OF PROPERTY ASSESSED:',
        left + 1,
        118
      );

      checkbox(
        'LAND',
        Boolean(declaration.is_land),
        left + 5,
        127
      );

      checkbox(
        'BUILDING',
        Boolean(declaration.is_building),
        left + 5,
        137
      );

      checkbox(
        'MACHINERY',
        Boolean(declaration.is_machinery),
        103,
        127
      );

      checkbox(
        'Others:',
        Boolean(declaration.is_others),
        103,
        137
      );

      lineField(
        'No. of Storeys:',
        declaration.building_no_of_storeys,
        31,
        137,
        73,
        { labelWidth: 28, fontSize: 6.5 }
      );

      lineField(
        'Brief Description:',
        declaration.building_brief_description,
        31,
        145,
        73,
        { labelWidth: 30, fontSize: 6.5 }
      );

      lineField(
        'Brief Description:',
        declaration.machinery_brief_description,
        128,
        127,
        74,
        { labelWidth: 31, fontSize: 6.5 }
      );

      lineField(
        'Specify:',
        declaration.others_specify,
        128,
        145,
        74,
        { labelWidth: 18, fontSize: 6.5 }
      );

      // ---------------------------------------------------------
      // ASSESSMENT TABLE
      // ---------------------------------------------------------
      const tableTop = 151;
      const headerHeight = 10;
      const rowHeight = 7;
      const totalRows = Math.max(4, Math.min(rows.length, 4));
      const tableBottom =
        tableTop + headerHeight + totalRows * rowHeight;

      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(6.5);

      const colWidths = [
        28, // Classification
        19, // Area
        32, // Market Value
        31, // Actual Use
        29, // Assessment Level
        55  // Assessed Value
      ];

      const colX = [left];
      colWidths.forEach((width) => {
        colX.push(colX[colX.length - 1] + width);
      });

      pdf.setDrawColor(45);
      pdf.setLineWidth(0.25);
      pdf.rect(
        left,
        tableTop,
        contentWidth,
        tableBottom - tableTop
      );

      for (let i = 1; i < colX.length - 1; i += 1) {
        pdf.line(
          colX[i],
          tableTop,
          colX[i],
          tableBottom
        );
      }

      pdf.line(
        left,
        tableTop + headerHeight,
        right,
        tableTop + headerHeight
      );

      for (let i = 1; i <= totalRows; i += 1) {
        pdf.line(
          left,
          tableTop + headerHeight + i * rowHeight,
          right,
          tableTop + headerHeight + i * rowHeight
        );
      }

      const headers = [
        'Classification',
        'Area',
        'Market Value',
        'Actual Use',
        'Assessment',
        'Assessed Value'
      ];

      headers.forEach((header, index) => {
        const center = colX[index] + colWidths[index] / 2;
        const headerLines = pdf.splitTextToSize(
          header,
          colWidths[index] - 3
        );

        pdf.text(
          headerLines,
          center,
          tableTop + 4,
          { align: 'center' }
        );
      });

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(6);

      for (let index = 0; index < totalRows; index += 1) {
        const row = rows[index] || {};
        const values = [
          row.classification,
          row.area,
          row.market_value,
          row.actual_use,
          row.assessment_level,
          row.assessed_value
        ];

        values.forEach((value, column) => {
          const cellX = colX[column] + 1.5;
          const cellY =
            tableTop +
            headerHeight +
            index * rowHeight +
            4.5;

          const display = fitText(
            value,
            colWidths[column] - 3,
            6
          );

          if (display) {
            pdf.text(display, cellX, cellY);
          }
        });
      }

      // Total row below assessment entries
      const totalY = tableBottom + 6;

      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(6.5);
      pdf.text('Total', 38, totalY);

      underlinedValue(
        rows.reduce(
          (sum, row) =>
            sum +
            (Number(
              String(row.area ?? '')
                .replace(/,/g, '')
                .replace(/[^\d.-]/g, '')
            ) || 0),
          0
        ) || '',
        48,
        totalY,
        22,
        { fontSize: 6.5 }
      );

      pdf.text('Php', 74, totalY);

      underlinedValue(
        declaration.total_market_value,
        88,
        totalY,
        46,
        { fontSize: 6.5 }
      );

      pdf.text('Php', 145, totalY);

      underlinedValue(
        declaration.total_assessed_value,
        155,
        totalY,
        47,
        { fontSize: 6.5, bold: true }
      );

      // ---------------------------------------------------------
      // TOTAL ASSESSED VALUE / EFFECTIVITY
      // ---------------------------------------------------------
      const valueTop = totalY + 12;

      lineField(
        'Total Assessed Value',
        declaration.total_assessed_value,
        left + 1,
        valueTop,
        122,
        { labelWidth: 40, fontSize: 6.8, valueBold: true }
      );

      underlinedValue(
        declaration.total_assessed_value_words,
        48,
        valueTop + 7,
        75,
        { fontSize: 6.2, align: 'center' }
      );

      pdf.setFont(undefined, 'italic');
      pdf.setFontSize(5.5);
      pdf.text(
        '(Amount in Words)',
        85.5,
        valueTop + 11,
        { align: 'center' }
      );

      checkbox(
        'Taxable',
        String(declaration.taxability_status || '')
          .toLowerCase() === 'taxable',
        left + 1,
        valueTop + 19
      );

      checkbox(
        'Exempt',
        String(declaration.taxability_status || '')
          .toLowerCase() === 'exempt',
        34,
        valueTop + 19
      );

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(6.5);
      pdf.text(
        'Effectivity of Assessment/Reassessment:',
        89,
        valueTop + 18
      );

      pdf.text('Qtr.', 160, valueTop + 18);
      underlinedValue(
        declaration.effectivity_qtr,
        169,
        valueTop + 18,
        14,
        { fontSize: 6.5, align: 'center' }
      );

      pdf.text('Yr.', 185, valueTop + 18);
      underlinedValue(
        declaration.effectivity_yr,
        192,
        valueTop + 18,
        10,
        { fontSize: 6.5, align: 'center' }
      );

      // ---------------------------------------------------------
      // APPROVAL
      // ---------------------------------------------------------
      const approvalY = valueTop + 34;

      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(7);
      pdf.text('APPROVED BY:', 28, approvalY);

      underlinedValue(
        declaration.approved_by,
        59,
        approvalY,
        77,
        { fontSize: 6.5, align: 'center' }
      );

      pdf.setFont(undefined, 'italic');
      pdf.setFontSize(5.5);
      pdf.text(
        'Provincial / City / Municipal Assessor',
        97.5,
        approvalY + 5,
        { align: 'center' }
      );

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(6.5);
      pdf.text('Date', 158, approvalY);
      underlinedValue(
        fmtDate(declaration.approval_date),
        169,
        approvalY,
        33,
        { fontSize: 6.5, align: 'center' }
      );

      // Previous assessed value
      pdf.text(
        'Previous A.V. Php',
        150,
        approvalY + 11
      );
      underlinedValue(
        declaration.previous_av,
        176,
        approvalY + 11,
        26,
        { fontSize: 6.2, align: 'center' }
      );

      // Cancellation row
      lineField(
        'This declaration cancels TD No.',
        declaration.cancels_td_no,
        left + 1,
        approvalY + 11,
        85,
        { labelWidth: 52, fontSize: 6.2 }
      );

      lineField(
        'Owner:',
        declaration.owner_name || declaration.full_name,
        93,
        approvalY + 11,
        109,
        { labelWidth: 15, fontSize: 6.2 }
      );

      // ---------------------------------------------------------
      // MEMORANDA
      // ---------------------------------------------------------
      const memoY = approvalY + 23;

      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(7);
      pdf.text('Memoranda:', left + 1, memoY);

      pdf.setDrawColor(45);
      pdf.setLineWidth(0.25);

      const memoStartY = memoY + 3;
      const memoLines = 5;

      for (let i = 0; i < memoLines; i += 1) {
        const lineY = memoStartY + i * 4.5;
        pdf.line(
          left + 2,
          lineY,
          right,
          lineY
        );
      }

      if (declaration.memoranda) {
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(6);
        const memoText = pdf.splitTextToSize(
          String(declaration.memoranda),
          contentWidth - 5
        );

        pdf.text(
          memoText.slice(0, 4),
          left + 3,
          memoStartY - 0.8
        );
      }

      // ---------------------------------------------------------
      // NOTES
      // ---------------------------------------------------------
      const notesY = 286;

      pdf.setFont(undefined, 'bolditalic');
      pdf.setFontSize(6.5);
      pdf.text('Notes:', left + 1, notesY);

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(5);

      const noteText =
        'This declaration is for real property taxation purposes only and the valuation indicated herein are based on the schedule of unit market values prepared for the purpose and duly enacted into an Ordinance by the Sangguniang Bayan under Ordinance No. ______ dated ______, 20____. It does not and cannot by itself confer any ownership or legal title to the property.';

      const noteLines = pdf.splitTextToSize(
        noteText,
        contentWidth - 17
      );

      pdf.text(
        noteLines.slice(0, 3),
        left + 12,
        notesY
      );

      // Keep the export filename tied to the declaration.
      const tdNo =
        declaration.td_no ||
        request.td_no ||
        request.id;

      pdf.save(
        `Tax-Declaration-${tdNo || 'Form'}.pdf`
      );
    } catch (err) {
      setError(
        err?.message ||
        'Unable to export the Tax Declaration.'
      );
    }
  };

  // =========================================================
  // CLOSE DETAILS
  // =========================================================

  const closeDetails = () => {
    setSelectedRequest(null);
    setSelectedDeclaration(null);
    setEditData(null);
    setIsEditingDetails(false);
    setPendingImageBlob(null);
    setError('');

    try {
      sessionStorage.removeItem(OPEN_REQUEST_KEY);
    } catch {
      // ignore
    }
  };

  // If the Assessor changes an open request away from "Released",
  // close the document (unless the owner is mid-edit; saving is blocked anyway).
  useEffect(() => {
    if (
      selectedRequest &&
      !isEditingDetails &&
      !canAccessRequest(selectedRequest)
    ) {
      closeDetails();
      setError(NOT_RELEASED_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRequest, isEditingDetails]);

  // =========================================================
  // DISPLAY NAME
  // =========================================================

  const name =
    profile?.full_name ||
    session?.user?.user_metadata?.full_name ||
    session?.user?.email ||
    'Property Owner';

  // =========================================================
  // CURRENT MODAL DATA
  // =========================================================

  const modalData =
    isEditingDetails && editData
      ? editData
      : selectedDeclaration;

  const modalIsOthers =
    Boolean(modalData?.submitted_by) &&
    modalData.submitted_by !== session?.user?.id;

  const modalMode = modalData?._fromRequest
    ? 'quick'
    : modalIsOthers
      ? getSharedSubmissionMode(modalData)
      : getSubmissionMode(modalData);
  const currentImage = getImageValue(modalData);

  // Editing is allowed only when the request status is "Released"
  const canEdit =
    canEditRequest(selectedRequest) &&
    !selectedDeclaration?._fromRequest &&
    (!selectedDeclaration?.submitted_by ||
      selectedDeclaration.submitted_by === session?.user?.id);

  const isOtherOwnersDeclaration =
    Boolean(selectedDeclaration?.submitted_by) &&
    selectedDeclaration.submitted_by !== session?.user?.id;

  // Small render helpers (same components / same layout as before)
  const field = (label, key, extra = {}) => (
    <EditableDetailField
      key={`${key}-${label}`}
      label={label}
      value={modalData?.[key]}
      editing={isEditingDetails}
      onChange={(value) => handleEditChange(key, value)}
      {...extra}
    />
  );

  const boolField = (label, key) => (
    <EditableBooleanField
      key={key}
      label={label}
      value={modalData?.[key]}
      editing={isEditingDetails}
      onChange={(value) => handleEditChange(key, value)}
    />
  );

  const showImageBlock =
    modalMode === 'quick' || Boolean(currentImage);

  const imageBlock = showImageBlock && (
    <div className="border rounded-xl p-4">

      <h3 className="font-bold text-slate-900 mb-3">
        🖼 Uploaded Property Image
      </h3>

      {currentImage ? (
        <div className="bg-slate-100 rounded-xl p-3 flex justify-center">
          <img
            src={currentImage}
            alt="Submitted Property"
            className="max-w-full max-h-[600px] object-contain rounded-lg border bg-white"
          />
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No image uploaded.
        </p>
      )}

      {isEditingDetails && (
        <div className="mt-3 flex flex-wrap items-center gap-3">

          <label
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer ${
              imageProcessing || savingDetails
                ? 'bg-slate-400 pointer-events-none'
                : 'bg-blue-900 hover:bg-blue-800'
            }`}
          >
            {imageProcessing
              ? 'Processing image...'
              : currentImage
                ? '🔄 Replace Image'
                : '⬆️ Upload Image'}

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              disabled={imageProcessing || savingDetails}
            />
          </label>

          {pendingImageBlob && (
            <span className="text-xs text-amber-700 font-semibold">
              New image selected — click “Save Changes” to apply it.
            </span>
          )}

        </div>
      )}

    </div>
  );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="min-h-screen bg-slate-100">

      {/* =====================================================
          TOAST (request approved / rejected)
      ===================================================== */}

      {toast && (
        <div className="fixed top-4 right-4 z-[80] w-[calc(100%-2rem)] max-w-sm">

          <div
            className={`rounded-xl shadow-2xl border p-4 flex items-start gap-3 ${
              toast.type === 'approved'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : toast.type === 'rejected'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-blue-50 border-blue-300 text-blue-900'
            }`}
            role="status"
          >

            <span className="text-lg leading-none">
              {toast.type === 'approved'
                ? '✅'
                : toast.type === 'rejected'
                  ? '⛔'
                  : '🔔'}
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">
                {toast.title}
              </p>

              <p className="text-xs mt-0.5 break-words">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => setToast(null)}
              className="font-bold text-lg leading-none"
              aria-label="Dismiss notification"
            >
              ×
            </button>

          </div>

        </div>
      )}

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="bg-blue-950 text-white px-5 py-4 shadow">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          <div>
            <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest">
              LGU San Fernando, Romblon
            </p>

            <h1 className="text-xl font-bold">
              Property Owner Portal
            </h1>
          </div>

          <div className="flex items-center gap-2">

            {/* NOTIFICATION BELL */}

            <div className="relative">

              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-2 rounded-lg"
                aria-label="Notifications"
              >
                🔔

                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />

                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">

                    <div className="p-3 border-b border-slate-200 flex items-center justify-between">

                      <p className="text-sm font-bold">
                        Notifications
                      </p>

                      <div className="flex items-center gap-3">

                        {unreadCount > 0 && (
                          <button
                            onClick={markAllNotificationsRead}
                            className="text-[11px] font-bold text-blue-800 hover:underline"
                          >
                            Mark all read
                          </button>
                        )}

                        {notifications.length > 0 && (
                          <button
                            onClick={clearNotifications}
                            className="text-[11px] font-bold text-slate-500 hover:underline"
                          >
                            Clear
                          </button>
                        )}

                      </div>

                    </div>

                    <div className="max-h-96 overflow-y-auto">

                      {notifications.length === 0 ? (

                        <p className="p-6 text-center text-xs text-slate-500">
                          No notifications yet. You will be notified when the Assessor approves or rejects a request.
                        </p>

                      ) : (

                        notifications.map((n) => (

                          <button
                            key={n.id}
                            onClick={() => openNotification(n)}
                            className={`w-full text-left p-3 border-b border-slate-100 flex items-start gap-3 hover:bg-slate-50 ${
                              n.read ? '' : 'bg-blue-50/60'
                            }`}
                          >

                            <span className="text-base leading-none mt-0.5">
                              {n.type === 'approved' ? '✅' : '⛔'}
                            </span>

                            <span className="flex-1 min-w-0">

                              <span
                                className={`block text-xs font-bold ${
                                  n.type === 'approved'
                                    ? 'text-emerald-800'
                                    : 'text-rose-800'
                                }`}
                              >
                                {n.title}
                              </span>

                              <span className="block text-xs text-slate-700 mt-0.5 break-words">
                                {n.message}
                              </span>

                              <span className="block text-[10px] text-slate-400 mt-1">
                                {new Date(n.time).toLocaleString()}
                              </span>

                            </span>

                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                            )}

                          </button>

                        ))

                      )}

                    </div>

                  </div>
                </>
              )}

            </div>

            <button
              onClick={logout}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg"
            >
              Logout
            </button>

          </div>

        </div>
      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="max-w-7xl mx-auto p-5 sm:p-8 space-y-6">

        {/* SUCCESS */}

        {notice && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex justify-between">

            <span>
              ✓ {notice}
            </span>

            <button
              onClick={() => setNotice('')}
              className="font-bold"
            >
              ×
            </button>

          </div>
        )}

        {/* ERROR */}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* ===================================================
            ACCOUNT HOME
        =================================================== */}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">

            <div>

              <p className="text-xs uppercase tracking-wider text-blue-700 font-bold">
                🏠 Account Home
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                Welcome, {name}
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {profile?.email || session?.user?.email}
              </p>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

              <button
                onClick={() => navigate('/form')}
                className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-3 rounded-xl text-xs font-bold"
              >
                📄 Access Tax Declaration Form
              </button>

              <button
                onClick={() => navigate('/request-form')}
                className="bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-3 rounded-xl text-xs font-bold"
              >
                📥 Request Tax Declaration
              </button>

            </div>

          </div>

        </section>

        {/* ===================================================
            MY TAX DECLARATION REQUESTS
        =================================================== */}

        <section
          id="requests-section"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >

          <div className="p-5 border-b border-slate-200">

            <h3 className="font-bold text-slate-900">
              📋 My Tax Declaration Requests
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              View, edit, and export your Tax Declaration once the Assessor has verified and released your request.
            </p>

          </div>

          {loading ? (

            <div className="p-8 text-center text-sm text-slate-500">
              Loading your account...
            </div>

          ) : requests.length === 0 ? (

            <div className="p-10 text-center text-sm text-slate-500">
              You have no Tax Declaration requests yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="text-left p-4">
                      TD No.
                    </th>

                    <th className="text-left p-4">
                      Property ID
                    </th>

                    <th className="text-left p-4">
                      Purpose
                    </th>

                    <th className="text-left p-4">
                      Requested
                    </th>

                    <th className="text-left p-4">
                      Submission Type
                    </th>

                    <th className="text-left p-4">
                      Status
                    </th>

                    <th className="text-center p-4">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {requests.map((r) => {

                    const matchingRecord =
                      [...records, ...sharedRecords].find(
                        (record) =>
                          (
                            r.tax_declaration_id &&
                            record.id === r.tax_declaration_id
                          ) ||
                          (
                            r.td_no &&
                            record.td_no === r.td_no
                          ) ||
                          (
                            r.property_identification_no &&
                            record.property_identification_no ===
                              r.property_identification_no
                          )
                      );

                    const matchIsOwn =
                      Boolean(matchingRecord) &&
                      records.some((x) => x.id === matchingRecord.id);

                    const mode =
                      matchingRecord && !matchIsOwn
                        ? getSharedSubmissionMode(matchingRecord)
                        : getSubmissionMode(matchingRecord);

                    const released = canAccessRequest(r);
                    const rejected = normalizeStatus(r) === 'rejected';

                    const deleteButton = (
                      <button
                        type="button"
                        onClick={() => askDeleteRequest(r)}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-bold"
                      >
                        🗑 Delete
                      </button>
                    );

                    return (

                      <tr
                        key={r.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >

                        <td className="p-4 font-semibold">
                          {r.td_no || '—'}
                        </td>

                        <td className="p-4">
                          {r.property_identification_no || '—'}
                        </td>

                        <td className="p-4 max-w-xs">
                          {r.purpose || '—'}
                        </td>

                        <td className="p-4">
                          {r.created_at
                            ? new Date(
                                r.created_at
                              ).toLocaleString()
                            : '—'}
                        </td>

                        <td className="p-4">

                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              mode === 'quick'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {mode === 'quick'
                              ? 'Quick Submit'
                              : 'Full Detail'}
                          </span>

                        </td>

                        <td className="p-4">

                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              released
                                ? 'bg-emerald-100 text-emerald-800'
                                : rejected
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {r.verification_status || 'Pending'}
                          </span>

                          {r.admin_notes && (
                            <p className="text-[10px] text-rose-600 mt-1">
                              {r.admin_notes}
                            </p>
                          )}

                        </td>

                        <td className="p-4">

                          {/* Only Released requests can access the document.
                              Edit lives ONLY inside the details modal. */}

                          {released ? (

                            <div className="flex flex-wrap justify-center gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  viewRequestDetails(r)
                                }
                                disabled={detailsLoading}
                                className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold"
                              >
                                👁 View Details
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  exportRequestPdf(r)
                                }
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold"
                              >
                                📄 Export PDF
                              </button>

                              {deleteButton}

                            </div>

                          ) : rejected ? (

                            <div className="flex flex-col items-center gap-2">

                              <div className="mx-auto max-w-[240px] flex items-start gap-2 text-left bg-rose-50 border border-rose-200 text-rose-800 rounded-lg px-3 py-2 text-[11px] font-semibold">

                                <span>⛔</span>

                                <span>
                                  This request was rejected by the Assessor.
                                  The document is not available.
                                </span>

                              </div>

                              {deleteButton}

                            </div>

                          ) : (

                            <div className="flex flex-col items-center gap-2">

                              <div className="mx-auto max-w-[240px] flex items-start gap-2 text-left bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-[11px] font-semibold">

                                <span>⏳</span>

                                <span>
                                  Pending — this request must be verified by
                                  the Assessor first before you can access
                                  the document.
                                </span>

                              </div>

                              {deleteButton}

                            </div>

                          )}

                        </td>

                      </tr>

                    );
                  })}

                </tbody>

              </table>

            </div>

          )}

        </section>

        {/* ===================================================
            MY TAX DECLARATION SUBMISSIONS
        =================================================== */}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="p-5 border-b border-slate-200">

            <h3 className="font-bold text-slate-900">
              📄 My Tax Declaration Submissions
            </h3>

          </div>

          {loading ? (

            <div className="p-8 text-center text-sm text-slate-500">
              Loading submissions...
            </div>

          ) : records.length === 0 ? (

            <div className="p-10 text-center text-sm text-slate-500">
              You have no submitted Tax Declarations yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="text-left p-4">
                      TD No.
                    </th>

                    <th className="text-left p-4">
                      Property ID
                    </th>

                    <th className="text-left p-4">
                      Submission Type
                    </th>

                    <th className="text-left p-4">
                      Submitted
                    </th>

                    <th className="text-left p-4">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {records.map((r) => {

                    const mode =
                      getSubmissionMode(r);

                    return (

                      <tr
                        key={r.id || r.td_no}
                        className="border-t border-slate-100"
                      >

                        <td className="p-4 font-semibold">
                          {r.td_no || '—'}
                        </td>

                        <td className="p-4">
                          {r.property_identification_no || '—'}
                        </td>

                        <td className="p-4">

                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              mode === 'quick'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {mode === 'quick'
                              ? 'Quick Submit'
                              : 'Full Detail'}
                          </span>

                        </td>

                        <td className="p-4">

                          {r.submitted_at
                            ? new Date(
                                r.submitted_at
                              ).toLocaleString()
                            : '—'}

                        </td>

                        <td className="p-4">

                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                            {r.verification_status || 'Pending'}
                          </span>

                        </td>

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </main>

      {/* =====================================================
          VIEW / INLINE EDIT DETAILS MODAL
      ===================================================== */}

      {selectedRequest && modalData && (

        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">

            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div className="bg-blue-950 text-white p-5 flex items-center justify-between shrink-0">

              <div>

                <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">
                  Tax Declaration
                </p>

                <h2 className="text-lg font-bold">
                  {modalData.td_no || 'Tax Declaration'}
                </h2>

                {isEditingDetails && (
                  <p className="text-xs text-amber-300 mt-1 font-semibold">
                    Editing Tax Declaration
                  </p>
                )}

              </div>

              <button
                onClick={closeDetails}
                className="text-white/80 hover:text-white text-2xl font-bold"
                disabled={savingDetails}
              >
                ×
              </button>

            </div>

            {/* =================================================
                MODAL ACTIONS  (at the TOP, always visible)
                Edit is enabled only for Released requests.
            ================================================= */}

            <div className="border-b bg-slate-50 p-4 flex flex-wrap items-center justify-end gap-2 shrink-0">

              {!isEditingDetails ? (

                <>

                  {!canEdit && (
                    <span className="mr-auto text-xs text-slate-500">
                      {selectedDeclaration?._fromRequest
                        ? 'Showing the request details. No submitted declaration record is linked, so editing is not available.'
                        : isOtherOwnersDeclaration
                        ? OTHER_OWNER_MESSAGE
                        : `Status: ${selectedRequest?.verification_status || 'Pending'} — editing is available only when the request is Released.`}
                    </span>
                  )}

                  <button
                    onClick={() =>
                      editRequest(selectedRequest)
                    }
                    disabled={!canEdit}
                    title={
                      canEdit
                        ? 'Edit this Tax Declaration'
                        : isOtherOwnersDeclaration
                          ? 'Only the owner of this declaration can edit it'
                          : 'Only Released requests can be edited'
                    }
                    className={`text-white px-4 py-2 rounded-lg text-xs font-bold ${
                      canEdit
                        ? 'bg-amber-500 hover:bg-amber-400'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    ✏️ Edit
                  </button>

                  <button
                    onClick={() =>
                      exportRequestPdf(selectedRequest)
                    }
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    📄 Export PDF
                  </button>

                  <button
                    onClick={() =>
                      askDeleteRequest(selectedRequest)
                    }
                    className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    🗑 Delete
                  </button>

                  <button
                    onClick={closeDetails}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    Close
                  </button>

                </>

              ) : (

                <>

                  <button
                    onClick={cancelInlineEdit}
                    disabled={savingDetails}
                    className="bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={saveInlineEdit}
                    disabled={savingDetails || imageProcessing}
                    className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold"
                  >
                    {savingDetails
                      ? 'Saving...'
                      : '💾 Save Changes'}
                  </button>

                </>

              )}

            </div>

            {/* =================================================
                MODAL BODY
            ================================================= */}

            <div className="p-5 overflow-y-auto flex-1 min-h-0">

              {modalMode === 'quick' ? (

                /* =================================================
                   QUICK SUBMIT
                ================================================= */

                <div className="space-y-6">

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">

                    <div className="flex items-center justify-between">

                      <div>

                        <h3 className="font-bold text-blue-900">
                          Quick Submit
                        </h3>

                        <p className="text-xs text-blue-700 mt-1">
                          This submission contains the minimum required
                          information and uploaded property image.
                        </p>

                      </div>

                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                        QUICK
                      </span>

                    </div>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {field('TD No.', 'td_no')}

                    {field(
                      'Property Identification No.',
                      'property_identification_no'
                    )}

                    {field('Full Name', 'full_name', {
                      value:
                        modalData.full_name || modalData.owner_name
                    })}

                    {field('Barangay', 'location_barangay_district')}

                    {field('Telephone', 'owner_telephone')}

                    <DetailField
                      label="Status"
                      value={
                        selectedRequest?.verification_status ||
                        modalData.verification_status ||
                        'Pending'
                      }
                    />

                  </div>

                  {imageBlock}

                </div>

              ) : (

                /* =================================================
                   FULL DETAIL FORM LAYOUT
                ================================================= */

                <div className="space-y-6">

                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">

                    <div className="flex items-center justify-between">

                      <div>

                        <h3 className="font-bold text-purple-900">
                          Full Detail Form Entry
                        </h3>

                        <p className="text-xs text-purple-700 mt-1">
                          Complete Tax Declaration information submitted
                          through the full-detail form.
                        </p>

                      </div>

                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                        FULL DETAIL
                      </span>

                    </div>

                  </div>

                  {/* IDENTIFICATION */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Identification
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">

                      {field('TD No.', 'td_no')}

                      {field('Property ID No.', 'property_identification_no')}

                      {field('Full Name', 'full_name', {
                        value:
                          modalData.full_name || modalData.owner_name
                      })}

                    </div>

                  </div>

                  {/* OWNER */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Owner Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                      {field('Owner', 'owner_name')}
                      {field('TIN', 'owner_tin')}
                      {field('Address', 'owner_address')}
                      {field('Telephone', 'owner_telephone')}

                    </div>

                  </div>

                  {/* ADMINISTRATOR */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Administrator / Beneficial User
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                      {field('Name', 'administrator_name')}
                      {field('TIN', 'administrator_tin')}
                      {field('Address', 'administrator_address')}
                      {field('Telephone', 'administrator_telephone')}

                    </div>

                  </div>

                  {/* LOCATION */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Location of Property
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">

                      {field('Number and Street', 'location_number_street')}
                      {field('Barangay', 'location_barangay_district')}
                      {field(
                        'Municipality / Province',
                        'location_municipality_province_city'
                      )}

                    </div>

                  </div>

                  {/* CADASTRAL */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Cadastral / Title Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                      {field('OCT/TCT/CLOA No.', 'oct_tct_cloa_no')}
                      {field('CCT No.', 'cct_no')}
                      {field('Dated', 'dated')}
                      {field('Survey No.', 'survey_no')}
                      {field('Lot No.', 'lot_no')}
                      {field('Blk No.', 'blk_no')}

                    </div>

                  </div>

                  {/* BOUNDARIES */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Boundaries
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">

                      {field('North', 'boundary_north')}
                      {field('South', 'boundary_south')}
                      {field('East', 'boundary_east')}
                      {field('West', 'boundary_west')}

                    </div>

                  </div>

                  {/* PROPERTY TYPE */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Kind of Property Assessed
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                      {boolField('Land', 'is_land')}
                      {boolField('Building', 'is_building')}

                      {field('Building Storeys', 'building_no_of_storeys')}

                      {field(
                        'Building Description',
                        'building_brief_description',
                        { multiline: true }
                      )}

                      {boolField('Machinery', 'is_machinery')}

                      {field(
                        'Machinery Description',
                        'machinery_brief_description',
                        { multiline: true }
                      )}

                      {boolField('Others', 'is_others')}

                      {field('Others Specify', 'others_specify', {
                        multiline: true
                      })}

                    </div>

                  </div>

                  {/* ASSESSMENT */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Assessment Table
                    </h3>

                    <div className="overflow-x-auto mt-3">

                      <table className="w-full text-xs border-collapse">

                        <thead>

                          <tr className="bg-slate-100">

                            {ASSESSMENT_COLUMNS.map(([key, label]) => (
                              <th
                                key={key}
                                className="border p-2 text-left"
                              >
                                {label}
                              </th>
                            ))}

                          </tr>

                        </thead>

                        <tbody>

                          {Array.isArray(modalData.assessment_rows) &&
                            modalData.assessment_rows.map((row, index) => (

                              <tr key={index}>

                                {ASSESSMENT_COLUMNS.map(([key]) => (

                                  <td
                                    key={key}
                                    className={`border p-2 ${
                                      key === 'assessed_value' &&
                                      !isEditingDetails
                                        ? 'font-bold'
                                        : ''
                                    }`}
                                  >

                                    {isEditingDetails ? (

                                      <input
                                        type="text"
                                        value={row[key] || ''}
                                        onChange={(e) =>
                                          handleAssessmentChange(
                                            index,
                                            key,
                                            e.target.value
                                          )
                                        }
                                        className="w-full border border-slate-300 rounded p-2 font-normal"
                                      />

                                    ) : (

                                      row[key] || '—'

                                    )}

                                  </td>

                                ))}

                              </tr>

                            ))}

                        </tbody>

                      </table>

                    </div>

                  </div>

                  {/* TOTALS */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Total Valuation
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                      {field('Total Market Value', 'total_market_value')}
                      {field('Total Assessed Value', 'total_assessed_value')}

                      {field(
                        'Total Assessed Value in Words',
                        'total_assessed_value_words',
                        { multiline: true }
                      )}

                      {field('Taxability Status', 'taxability_status')}
                      {field('Effectivity Quarter', 'effectivity_qtr')}
                      {field('Effectivity Year', 'effectivity_yr')}

                    </div>

                  </div>

                  {/* APPROVAL */}

                  <div>

                    <h3 className="font-bold text-blue-900 border-b pb-2">
                      Approval / Memoranda
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                      <DetailField
                        label="Approved By"
                        value={modalData.approved_by}
                      />

                      <DetailField
                        label="Approval Date"
                        value={modalData.approval_date}
                      />

                      {field('Previous Assessed Value', 'previous_av')}
                      {field('Cancels TD No.', 'cancels_td_no')}

                      <div className="md:col-span-2">

                        {field('Memoranda', 'memoranda', {
                          multiline: true
                        })}

                      </div>

                    </div>

                  </div>

                  {/* IMAGE (only if the record has one) */}

                  {imageBlock}

                </div>

              )}

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          DELETE REQUEST CONFIRMATION
      ===================================================== */}

      {deleteTarget && (

        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            <div className="p-5 border-b border-slate-200">

              <h3 className="font-bold text-slate-900">
                🗑 Delete this request?
              </h3>

            </div>

            <div className="p-5 space-y-3">

              <p className="text-sm text-slate-700">
                You are about to delete the request
                {deleteTarget.td_no ? ` for TD No. ${deleteTarget.td_no}` : ''}
                . This cannot be undone.
              </p>

              <p className="text-xs text-slate-500">
                Only the request is removed. Your submitted Tax Declaration record is not deleted.
              </p>

              {deleteError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  {deleteError}
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">

              <button
                onClick={cancelDeleteRequest}
                disabled={deleting}
                className="bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>

              <button
                onClick={deleteRequest}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-xs font-bold"
              >
                {deleting ? 'Deleting...' : 'Delete request'}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

// =========================================================
// READ-ONLY DETAIL FIELD
// =========================================================

function DetailField({ label, value }) {

  const displayValue =
    value === null ||
    value === undefined ||
    value === ''
      ? '—'
      : String(value);

  return (

    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">

      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">
        {label}
      </p>

      <p className="text-sm text-slate-900 mt-1 whitespace-pre-wrap break-words">
        {displayValue}
      </p>

    </div>

  );
}

// =========================================================
// EDITABLE DETAIL FIELD
// =========================================================

function EditableDetailField({
  label,
  value,
  editing,
  onChange,
  multiline = false
}) {

  const displayValue =
    value === null ||
    value === undefined ||
    value === ''
      ? ''
      : String(value);

  if (!editing) {
    return (
      <DetailField
        label={label}
        value={value}
      />
    );
  }

  return (

    <div className="border border-blue-300 rounded-lg p-3 bg-blue-50">

      <p className="text-[10px] uppercase tracking-wide text-blue-700 font-bold mb-2">
        {label}
      </p>

      {multiline ? (

        <textarea
          value={displayValue}
          onChange={(e) =>
            onChange(e.target.value)
          }
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

      ) : (

        <input
          type="text"
          value={displayValue}
          onChange={(e) =>
            onChange(e.target.value)
          }
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

      )}

    </div>

  );
}

// =========================================================
// EDITABLE BOOLEAN FIELD
// =========================================================

function EditableBooleanField({
  label,
  value,
  editing,
  onChange
}) {

  if (!editing) {
    return (
      <DetailField
        label={label}
        value={value ? 'Yes' : 'No'}
      />
    );
  }

  return (

    <div className="border border-blue-300 rounded-lg p-3 bg-blue-50">

      <p className="text-[10px] uppercase tracking-wide text-blue-700 font-bold mb-2">
        {label}
      </p>

      <select
        value={value ? 'true' : 'false'}
        onChange={(e) =>
          onChange(
            e.target.value === 'true'
          )
        }
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >

        <option value="true">
          Yes
        </option>

        <option value="false">
          No
        </option>

      </select>

    </div>

  );
}