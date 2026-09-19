import React, { useState, useEffect, useCallback } from 'react';

export default function NoticeDashboard({ records = [], onBackToHome }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNoticeId, setSelectedNoticeId] = useState(null);

  const getStoredRecords = useCallback(
    () => (Array.isArray(records) ? records : []),
    [records]
  );

  const getStoredHiddenIds = useCallback(() => [], []);

  const [noticeRecords, setNoticeRecords] =
    useState(() => (Array.isArray(records) ? records : []));

  const [dashboardHiddenIds, setDashboardHiddenIds] =
    useState([]);

  // ============================================================
  // NORMALIZE RECORD
  // ============================================================

  const normalizeRecord = (record) => {
    if (!record) return record;

    const normalized = {
      ...record,

      verification_status:
        record.verification_status ||
        record.status ||
        'Pending',

      status:
        record.verification_status ||
        record.status ||
        'Pending',
    };

    return normalized;
  };

  // ============================================================
  // UPDATE LOCAL RECORDS
  // ============================================================

  const updateNoticeRecords = useCallback((newRecords) => {
    if (!Array.isArray(newRecords)) return;
    setNoticeRecords(newRecords.map(normalizeRecord));
  }, []);

  // ============================================================
  // STATUS NORMALIZATION
  // ============================================================

  const getNormalizedStatus = (record) => {
    if (!record) {
      return {
        label: 'Pending',
        isApproved: false,
        isRejected: false,
      };
    }

    const rawStatus = String(
      record.verification_status ||
        record.status ||
        'Pending'
    )
      .trim()
      .toLowerCase();

    const isApproved =
      rawStatus === 'approved' ||
      rawStatus === 'passed';

    const isRejected =
      rawStatus === 'rejected' ||
      rawStatus === 'failed';

    let label = 'Pending';

    if (isApproved) {
      label = 'Approved';
    }

    if (isRejected) {
      label = 'Rejected';
    }

    return {
      label,
      isApproved,
      isRejected,
    };
  };

  // ============================================================
  // SYNC PROPS
  // ============================================================

  useEffect(() => {
    if (Array.isArray(records)) {
      updateNoticeRecords(records);
    }
  }, [records, updateNoticeRecords]);

  // ============================================================
  // LISTEN FOR TAX DECLARATION UPDATES
  // ============================================================

  useEffect(() => {
    const handleTaxDeclarationUpdated = (event) => {
      console.log(
        '[NOTICE DASHBOARD] Tax declaration updated',
        event?.detail
      );

      const currentRecords = getStoredRecords();

      if (Array.isArray(currentRecords)) {
        setNoticeRecords(
          currentRecords.map(normalizeRecord)
        );
      }
    };

    const handleTaxRecordsUpdated = () => {
      console.log(
        '[NOTICE DASHBOARD] Tax records updated'
      );

      const currentRecords = getStoredRecords();

      if (Array.isArray(currentRecords)) {
        setNoticeRecords(
          currentRecords.map(normalizeRecord)
        );
      }
    };

    window.addEventListener(
      'taxDeclarationUpdated',
      handleTaxDeclarationUpdated
    );

    window.addEventListener(
      'tax_records_updated',
      handleTaxRecordsUpdated
    );

    return () => {
      window.removeEventListener(
        'taxDeclarationUpdated',
        handleTaxDeclarationUpdated
      );

      window.removeEventListener(
        'tax_records_updated',
        handleTaxRecordsUpdated
      );
    };
  }, [getStoredRecords]);

  // ============================================================
  // REAL-TIME STATUS POLLING
  //
  // This asks your API for the latest records.
  // If the Admin Dashboard changes a record in Supabase,
  // the Notice Dashboard will pick up the new status.
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const fetchLatestRecords = async () => {
      try {
        const response = await fetch(
          'http://localhost:5000/api/tax-declarations'
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (cancelled) {
          return;
        }

        // Support several common API response formats
        const latestRecords =
          Array.isArray(data)
            ? data
            : Array.isArray(data.records)
            ? data.records
            : Array.isArray(data.data)
            ? data.data
            : null;

        if (!latestRecords) {
          return;
        }

        // Preserve locally hidden records
        setNoticeRecords(
          latestRecords.map(normalizeRecord)
        );

      } catch (error) {
        // Do not break the notice board if API is unavailable.
        console.warn(
          '[NOTICE DASHBOARD] Unable to refresh records:',
          error
        );
      }
    };

    // Initial refresh
    fetchLatestRecords();

    // Refresh every 2 seconds
    const interval = setInterval(
      fetchLatestRecords,
      2000
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ============================================================
  // SAFE RECORDS
  // ============================================================

  const safeRecords = Array.isArray(noticeRecords)
    ? noticeRecords
    : [];

  // ============================================================
  // HIDDEN RECORDS
  // ============================================================

  const visibleNoticeRecords = safeRecords.filter(
    (r) => {
      const id = r?.id || r?.td_no;

      return !dashboardHiddenIds.includes(id);
    }
  );

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredRecords =
    visibleNoticeRecords.filter((rec) => {
      if (!rec) return false;

      const term = searchTerm
        .trim()
        .toLowerCase();

      if (!term) {
        return true;
      }

      return (
        (
          rec.owner_name &&
          String(rec.owner_name)
            .toLowerCase()
            .includes(term)
        ) ||

        (
          rec.owner &&
          String(rec.owner)
            .toLowerCase()
            .includes(term)
        ) ||

        (
          rec.location_barangay_district &&
          String(
            rec.location_barangay_district
          )
            .toLowerCase()
            .includes(term)
        ) ||

        (
          rec.barangay &&
          String(rec.barangay)
            .toLowerCase()
            .includes(term)
        )
      );
    });

  // ============================================================
  // SELECTED NOTICE
  // ============================================================

  const selectedNotice =
    safeRecords.find(
      (r) =>
        (r.id &&
          r.id === selectedNoticeId) ||
        (r.td_no &&
          r.td_no === selectedNoticeId)
    );

  // ============================================================
  // ACTIVE STATUS
  // ============================================================

  const activeNoticeStatus =
    getNormalizedStatus(selectedNotice);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen w-full bg-slate-100 flex flex-col font-sans">

      {/* Top Header */}
      <header className="bg-blue-950 text-white shadow-md px-8 py-4 flex justify-between items-center">
        <div>
          <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
            LGU San Fernando, Romblon
          </span>

          <h1 className="text-lg font-extrabold uppercase">
            Public Tax Declaration Verification Notice Board
          </h1>
        </div>

        <button
          onClick={onBackToHome}
          className="bg-blue-800 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow"
        >
          &larr; Back to Home
        </button>
      </header>

      {/* Main Body */}
      <main className="flex-grow p-6 sm:p-10 max-w-6xl w-full mx-auto space-y-6">

        {/* Banner */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">

          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-800">
              Check Assessment Status
            </h2>

            <p className="text-xs text-slate-500">
              View real-time evaluation feedback, approval notices, or revision requirements submitted to the Assessor's Office.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by Owner Name or Barangay..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              className="w-full border border-slate-300 p-2.5 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-800 bg-slate-50"
            />
          </div>

        </div>

        {/* Notice Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {filteredRecords.length > 0 ? (

            filteredRecords.map(
              (record, index) => {

                const recordId =
                  record.id ||
                  record.td_no ||
                  index;

                const {
                  label,
                  isApproved,
                  isRejected,
                } =
                  getNormalizedStatus(
                    record
                  );

                return (
                  <div
                    key={recordId}
                    onClick={() =>
                      setSelectedNoticeId(
                        record.id ||
                          record.td_no
                      )
                    }
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition"
                  >

                    <div className="space-y-3">

                      <div className="flex justify-end items-center">

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {label}
                        </span>

                      </div>

                      <div className="space-y-2 pt-1">

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Owner Full Name
                          </span>

                          <span className="text-slate-900 font-bold text-sm leading-tight block">
                            {record.owner_name ||
                              record.owner ||
                              'N/A'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Barangay
                          </span>

                          <span className="text-slate-800 font-semibold text-sm leading-tight block">
                            {record.location_barangay_district ||
                              record.barangay ||
                              'San Fernando'}
                          </span>
                        </div>

                      </div>

                      {isRejected &&
                        record.rejection_reason && (
                          <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-[11px] text-rose-900 mt-2 space-y-1">

                            <strong className="block font-bold">
                              Assessor Review Note / Reason:
                            </strong>

                            <p className="line-clamp-2">
                              {
                                record.rejection_reason
                              }
                            </p>

                          </div>
                        )}

                    </div>

                  </div>
                );
              }
            )

          ) : (

            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs uppercase font-medium">
              No tax declaration notices found matching your criteria.
            </div>

          )}

        </div>

      </main>

      {/* Notice Detail Modal */}
      {selectedNotice && (

        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">

          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200">

            <div className="flex justify-between items-center border-b pb-3">

              <div>

                <h3 className="font-bold text-blue-900 text-sm uppercase">
                  Official Assessment Notice Slip
                </h3>

                <p className="text-[10px] text-slate-500">
                  Notice Details
                </p>

              </div>

              <button
                onClick={() =>
                  setSelectedNoticeId(null)
                }
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                &times;
              </button>

            </div>

            <div className="space-y-3 text-xs">

              {/* Status */}
              <div className="p-3 bg-slate-50 rounded-xl border space-y-2">

                <div className="flex justify-between items-center">

                  <span className="text-slate-500">
                    Overall Status:
                  </span>

                  <span
                    className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                      activeNoticeStatus.isApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeNoticeStatus.isRejected
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeNoticeStatus.label}
                  </span>

                </div>

                {activeNoticeStatus.isRejected &&
                  selectedNotice.rejection_reason && (

                    <div className="bg-rose-50 text-rose-900 p-3 rounded-xl border border-rose-200 mt-2 space-y-1">

                      <strong className="block text-rose-950 font-bold">
                        Reason for Rejection / Revision Requirement:
                      </strong>

                      <p className="text-xs leading-relaxed">
                        {
                          selectedNotice.rejection_reason
                        }
                      </p>

                    </div>

                  )}

              </div>

              {/* Owner */}
              <div className="p-3 bg-slate-50 rounded-xl border space-y-3">

                <div>

                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Owner Full Name
                  </span>

                  <span className="text-slate-900 font-bold text-sm block">
                    {selectedNotice.owner_name ||
                      selectedNotice.owner ||
                      'N/A'}
                  </span>

                </div>

                <div>

                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Barangay
                  </span>

                  <span className="text-slate-800 font-semibold text-sm block">
                    {selectedNotice.location_barangay_district ||
                      selectedNotice.barangay ||
                      'San Fernando'}
                  </span>

                </div>

              </div>

            </div>

            <div className="flex justify-end items-center pt-3 border-t">

              <button
                type="button"
                onClick={() =>
                  setSelectedNoticeId(null)
                }
                className="bg-blue-900 hover:bg-blue-800 text-white px-5 py-2 rounded-xl text-xs font-semibold transition"
              >
                Close Notice
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
