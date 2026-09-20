import React, { useState, useEffect, useCallback } from 'react';
import TaxFormManager from '../pages/taxform';
import PropertyOwnerAccountsSection from './PropertyOwnerAccountsSection';


import {
  fetchTaxDeclarations,
  updateVerificationStatus,
  deleteTaxRecord
} from '../assets/services/api';

const DEFAULT_FORM_STATE = {
  td_no: '',
  property_identification_no: '',
  full_name: '',
  owner_name: '',
  owner_tin: '',
  owner_address: '',
  owner_telephone: '',

  administrator_name: '',
  administrator_tin: '',
  administrator_address: '',
  administrator_telephone: '',

  location_number_street: '',
  location_barangay_district: '',
  location_municipality_province_city: 'San Fernando, Romblon',

  oct_tct_cloa_no: '',
  cct_no: '',
  dated: '',
  survey_no: '',
  lot_no: '',
  blk_no: '',

  boundary_north: '',
  boundary_south: '',
  boundary_east: '',
  boundary_west: '',

  is_land: false,
  is_building: false,
  building_no_of_storeys: '',
  building_brief_description: '',

  is_machinery: false,
  machinery_brief_description: '',

  is_others: false,
  others_specify: '',

  assessment_rows: [
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: ''
    },
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: ''
    },
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: ''
    },
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: ''
    }
  ],

  total_market_value: '',
  total_assessed_value: '',
  total_assessed_value_words: '',

  taxability_status: 'Taxable',
  effectivity_qtr: '',
  effectivity_yr: '',

  approved_by: '',
  approval_date: '',

  cancels_td_no: '',
  previous_av: '',
  memoranda: '',

  property_image: null,
  document_image: null,
  image_url: null
};

export default function AdminDashboard({
  onLogout = () => {},
  initialRecords = [],
  onUpdateRecord,
  onDeleteRecord,
  onApproveRecord,
  onGoToTaxFormManager
}) {
  const [activePage, setActivePage] = useState('dashboard');

  const [records, setRecords] = useState(
    Array.isArray(initialRecords) ? initialRecords : []
  );

  const [dashboardHiddenIds, setDashboardHiddenIds] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const loadRecords = useCallback(async () => {
    try {
      if (typeof fetchTaxDeclarations !== 'function') {
        console.error(
          'fetchTaxDeclarations is not available.'
        );
        return [];
      }

      const data = await fetchTaxDeclarations();

      const fetchedRecords = Array.isArray(data)
        ? data
        : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.data)
        ? data.data
        : [];

      /*
       * IMPORTANT:
       * Always replace the React state with the server result, even when
       * the result is an empty array. The old code only updated when
       * fetchedRecords.length > 0, which could leave stale local data
       * visible after refresh/login.
       */
      setRecords(fetchedRecords);

      return fetchedRecords;
    } catch (error) {
      console.error(
        'Failed to fetch tax declarations from API:',
        error
      );

      // Keep the already loaded local records as an offline fallback.
      return null;
    }
  }, []);

  useEffect(() => {
    // Load the database version immediately when the dashboard mounts.
    // This is important after refresh/logout/login so the UI is not relying
    // only on the previous React state.
    loadRecords();

    const refreshRecords = () => {
      loadRecords();
    };

    window.addEventListener(
      'taxDeclarationUpdated',
      refreshRecords
    );

    window.addEventListener(
      'tax_records_updated',
      refreshRecords
    );

    window.addEventListener(
      'storage',
      refreshRecords
    );

    return () => {
      window.removeEventListener(
        'taxDeclarationUpdated',
        refreshRecords
      );

      window.removeEventListener(
        'tax_records_updated',
        refreshRecords
      );

      window.removeEventListener(
        'storage',
        refreshRecords
      );
    };
  }, [loadRecords]);

  const safeRecords = Array.isArray(records)
    ? records
    : [];

  const visibleRecords = safeRecords.filter((record) => {
    const id = record?.id || record?.td_no;

    return !dashboardHiddenIds.includes(id);
  });

  const totalRecordsCount = visibleRecords.length;

  const taxableCount = visibleRecords.filter(
    (record) =>
      (record?.taxability_status ||
        record?.status) === 'Taxable'
  ).length;

  const exemptCount = visibleRecords.filter(
    (record) =>
      (record?.taxability_status ||
        record?.status) === 'Exempt'
  ).length;

  const approvedCount = visibleRecords.filter(
    (record) =>
      record?.verification_status === 'Approved' ||
      record?.verification_status === 'Passed'
  ).length;

  const rejectedCount = visibleRecords.filter(
    (record) =>
      record?.verification_status === 'Rejected'
  ).length;

  const pendingCount = visibleRecords.filter(
    (record) =>
      !record?.verification_status ||
      record?.verification_status === 'Pending'
  ).length;

  const filteredRecords = visibleRecords.filter(
    (record) => {
      if (!record) {
        return false;
      }

      const term = searchTerm
        .trim()
        .toLowerCase();

      if (!term) {
        return true;
      }

      const fieldsToSearch = [
        record.td_no,
        record.owner_name,
        record.owner,
        record.full_name,
        record.location_barangay_district,
        record.barangay,
        record.property_identification_no,
        record.pin
      ];

      return fieldsToSearch.some(
        (field) =>
          field &&
          String(field)
            .toLowerCase()
            .includes(term)
      );
    }
  );

  const closeModal = useCallback(() => {
    setSelectedRecord(null);
    setIsRejecting(false);
    setRejectionReasonInput('');
    setImageZoom(1);
    setImageRotation(0);
  }, []);

  const handleInternalUpdateRecord = (
    updatedRecord
  ) => {
    if (
      !updatedRecord?.id &&
      !updatedRecord?.td_no
    ) {
      return;
    }

    setRecords((previousRecords) =>
      previousRecords.map((record) => {
        const sameId =
          record.id &&
          updatedRecord.id &&
          record.id === updatedRecord.id;

        const sameTdNo =
          record.td_no &&
          updatedRecord.td_no &&
          record.td_no === updatedRecord.td_no;

        return sameId || sameTdNo
          ? updatedRecord
          : record;
      })
    );

    if (typeof onUpdateRecord === 'function') {
      onUpdateRecord(updatedRecord);
    }
  };

  const handleDeleteFromDashboardOnly = (
    targetIdOrTdNo
  ) => {
    if (!targetIdOrTdNo) {
      return;
    }

    const confirmed = window.confirm(
      'Remove this card from the Dashboard and Notice Board?\n\n' +
      'The record will remain safely stored in the database and will remain available in the Tax Form Portal.'
    );

    if (!confirmed) {
      return;
    }

    setDashboardHiddenIds((previousIds) => {
      if (
        previousIds.includes(targetIdOrTdNo)
      ) {
        return previousIds;
      }

      return [
        ...previousIds,
        targetIdOrTdNo
      ];
    });

    closeModal();
  };

  const handleDeleteRecordPermanently = async (
    targetIdOrTdNo
  ) => {
    if (!targetIdOrTdNo) {
      return;
    }

    const confirmed = window.confirm(
      '⚠️ WARNING\n\n' +
      'Are you sure you want to PERMANENTLY delete this record from the database?\n\n' +
      'This action cannot be undone and the record will also disappear from the Tax Form Portal.'
    );

    if (!confirmed) {
      return;
    }

    setIsUpdating(true);

    try {
      if (
        typeof deleteTaxRecord === 'function'
        
      ) {
        await deleteTaxRecord(
          targetIdOrTdNo
        );
      }

      setRecords((previousRecords) =>
        previousRecords.filter(
          (record) =>
            record.id !==
              targetIdOrTdNo &&
            record.td_no !==
              targetIdOrTdNo
        )
      );

      setDashboardHiddenIds(
        (previousIds) =>
          previousIds.filter(
            (id) =>
              id !== targetIdOrTdNo
          )
      );

      if (
        typeof onDeleteRecord ===
        'function'
      ) {
        onDeleteRecord(
          targetIdOrTdNo
        );
      }

      closeModal();

      window.dispatchEvent(
        new Event('tax_records_updated')
      );

      alert(
        'Record permanently deleted from the database.'
      );
    } catch (error) {
      console.error(
        'API Delete Error:',
        error
      );

      alert(
        'Failed to permanently delete the record from the database. The record was not removed.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleVerifyRecord = async (
    targetRecord,
    status,
    reason = ''
  ) => {
    if (
      !targetRecord?.id &&
      !targetRecord?.td_no
    ) {
      alert('Error: Record identifier missing.');
      return;
    }

    if (typeof updateVerificationStatus !== 'function') {
      alert(
        'Error: updateVerificationStatus is not available. The status cannot be permanently saved.'
      );
      return;
    }

    setIsUpdating(true);

    const targetId =
      targetRecord.id ||
      targetRecord.td_no;

    const normalizedStatus =
      status === 'Passed'
        ? 'Passed'
        : status === 'Approved'
        ? 'Approved'
        : status === 'Rejected'
        ? 'Rejected'
        : 'Pending';

    try {
      /*
       * FIRST: save to the backend/database.
       *
       * The previous code caught this error and continued as if the save
       * succeeded. That made the status look changed until refresh, then
       * the old database value came back.
       */
      await updateVerificationStatus(
        targetId,
        {
          verification_status: normalizedStatus,
          rejection_reason:
            normalizedStatus === 'Rejected'
              ? reason
              : ''
        }
      );

      /*
       * Update the UI immediately after the database update succeeds.
       */
      const updatedRecord = {
        ...targetRecord,
        verification_status: normalizedStatus,
        rejection_reason:
          normalizedStatus === 'Rejected'
            ? reason
            : ''
      };

      setRecords((previousRecords) => {
        const nextRecords = previousRecords.map(
          (record) => {
            const sameId =
              record.id &&
              updatedRecord.id &&
              String(record.id) ===
                String(updatedRecord.id);

            const sameTdNo =
              record.td_no &&
              updatedRecord.td_no &&
              String(record.td_no) ===
                String(updatedRecord.td_no);

            return sameId || sameTdNo
              ? {
                  ...record,
                  ...updatedRecord
                }
              : record;
          }
        );

        return nextRecords;
      });

      if (
        normalizedStatus === 'Approved' ||
        normalizedStatus === 'Passed'
      ) {
        if (
          typeof onApproveRecord === 'function'
        ) {
          onApproveRecord(targetId);
        }
      }

      if (
        typeof onUpdateRecord === 'function'
      ) {
        onUpdateRecord(updatedRecord);
      }

      /*
       * Re-fetch from the database after saving.
       * This is the critical part that guarantees that refresh/logout/login
       * reads the persisted status rather than an old React/local value.
       */
      const freshRecords = await loadRecords();

      if (freshRecords === null) {
        console.warn(
          'Status was saved, but the verification refresh could not read the server response.'
        );
      }

      window.dispatchEvent(
        new Event('tax_records_updated')
      );

      closeModal();

      if (
        normalizedStatus === 'Passed' ||
        normalizedStatus === 'Approved'
      ) {
        alert(
          `Tax Declaration ${
            targetRecord.td_no ||
            targetId
          } successfully approved and permanently saved.`
        );
      } else {
        alert(
          `Tax Declaration ${
            targetRecord.td_no ||
            targetId
          } has been rejected and the status was permanently saved.`
        );
      }
    } catch (error) {
      console.error(
        'Failed to permanently update verification status:',
        error
      );

      /*
       * DO NOT pretend the operation succeeded.
       * If the API/database update fails, refreshing the page will correctly
       * show the database value instead of giving the user a false success.
       */
      alert(
        `Failed to save the verification status for ${
          targetRecord.td_no ||
          targetId
        }. Please check the API/database connection and try again.`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const getSubmissionMode = (
    record
  ) => {
    if (!record) {
      return 'full';
    }

    const quickFlag =
      record.isQuickSubmit === true ||
      record.is_quick_submit === true ||
      record.quick_submit === true ||
      record.quickSubmit === true ||

      record.isQuickSubmit ===
        'true' ||
      record.is_quick_submit ===
        'true' ||
      record.quick_submit ===
        'true' ||
      record.quickSubmit ===
        'true' ||

      record.isQuickSubmit === 1 ||
      record.is_quick_submit === 1 ||
      record.quick_submit === 1;

    if (quickFlag) {
      return 'quick';
    }

    const rawMode =
      record.submission_mode ??
      record.submissionMode ??
      record.mode ??
      record.submission_type ??
      record.submissionType ??
      record.form_type ??
      record.formType ??
      '';

    const mode = String(rawMode)
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/-/g, ' ');

    if (
      mode.includes('quick') ||
      mode.includes('image') ||
      mode.includes('scan') ||
      mode === 'file'
    ) {
      return 'quick';
    }

    const hasImageOnly =
      (
        record.property_image ||
        record.document_image ||
        record.image_url ||
        record.file_path
      ) &&
      !record.classification &&
      !record.market_value &&
      !record.assessed_value;

    if (hasImageOnly) {
      return 'quick';
    }

    return 'full';
  };

  const openReviewModal = (
    record
  ) => {
    const mergedRecord = {
      ...DEFAULT_FORM_STATE,
      ...record
    };

    setSelectedRecord(
      mergedRecord
    );

    setIsRejecting(false);
    setRejectionReasonInput('');
    setImageZoom(1);
    setImageRotation(0);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 flex font-sans">
      <aside className="w-64 bg-blue-950 text-white flex flex-col justify-between shadow-xl">
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-blue-200">
              LGU San Fernando
            </h2>

            <p className="text-[10px] text-blue-400 mt-0.5">
              Assessor's Office Portal
            </p>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => {
                setActivePage('dashboard');
                closeModal();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition ${
                activePage === 'dashboard'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-blue-200 hover:bg-blue-900/50'
              }`}
            >
              <span>📊</span>
              Analytics & Records
            </button>

            <button
              onClick={() => {
                if (
                  typeof onGoToTaxFormManager ===
                  'function'
                ) {
                  onGoToTaxFormManager();
                } else {
                  setActivePage(
                    'formManager'
                  );
                }

                closeModal();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition ${
                activePage === 'formManager'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-blue-200 hover:bg-blue-900/50'
              }`}
            >
              <span>📄</span>
              Tax Form Portal
            </button>

            <button
              onClick={() => {
                setActivePage('propertyOwners');
                closeModal();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition ${
                activePage === 'propertyOwners'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-blue-200 hover:bg-blue-900/50'
              }`}
            >
              <span>👤</span>
              Property Owner Accounts
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-blue-900">
          <button
            onClick={onLogout}
            className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition focus:outline-none"
          >
            Log Out Admin
          </button>
        </div>
      </aside>

      <div className="flex-grow flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              {activePage === 'dashboard'
                ? 'Real Property Tax Analytics Dashboard'
                : activePage === 'propertyOwners'
                ? 'Property Owner Accounts & Request Verification'
                : 'Tax Form Records Management'}
            </h1>

            <p className="text-[11px] text-slate-500">
              Municipality of San Fernando, Romblon | Assessor Panel
            </p>
          </div>

         
        </header>

        <main className="flex-grow p-8 max-w-7xl w-full mx-auto space-y-6">
          {activePage === 'propertyOwners' && (
            <PropertyOwnerAccountsSection />
          )}

          {activePage === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Total Records
                  </span>

                  <span className="text-3xl font-extrabold text-blue-900 mt-2 block">
                    {totalRecordsCount}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Status Breakdown
                  </span>

                  <div className="flex gap-2 mt-2">
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">
                      {approvedCount} Passed
                    </span>

                    <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-xs font-bold">
                      {rejectedCount} Fail
                    </span>

                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">
                      {pendingCount} Pend
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Taxable Properties
                  </span>

                  <span className="text-3xl font-extrabold text-blue-800 mt-2 block">
                    {taxableCount}
                  </span>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Exempt Properties
                  </span>

                  <span className="text-3xl font-extrabold text-amber-700 mt-2 block">
                    {exemptCount}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                <input
                  type="text"
                  placeholder="Search by TD No., Owner, PIN, or Barangay..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  className="w-full sm:w-96 border border-slate-300 p-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-800 bg-white"
                />

                <span className="text-xs text-slate-500">
                  Showing{' '}
                  <strong>
                    {filteredRecords.length}
                  </strong>{' '}
                  of{' '}
                  <strong>
                    {totalRecordsCount}
                  </strong>{' '}
                  records
                </span>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b text-slate-700 uppercase text-xs">
                      <th className="p-4">
                        TD No.
                      </th>

                      <th className="p-4">
                        Owner Name
                      </th>

                      <th className="p-4">
                        Barangay
                      </th>

                      <th className="p-4">
                        Submission Mode
                      </th>

                      <th className="p-4">
                        Verification
                      </th>

                      <th className="p-4 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map(
                        (
                          record,
                          index
                        ) => {
                          const submissionMode =
                            getSubmissionMode(
                              record
                            );

                          const isQuickSubmit =
                            submissionMode ===
                            'quick';

                          const status =
                            record.verification_status ||
                            'Pending';

                          return (
                            <tr
                              key={
                                record.id ||
                                record.td_no ||
                                index
                              }
                              className="hover:bg-slate-50 transition"
                            >
                              <td className="p-4 font-semibold text-blue-900">
                                {record.td_no ||
                                  'N/A'}
                              </td>

                              <td className="p-4">
                                {record.owner_name ||
                                  record.full_name ||
                                  record.owner ||
                                  'N/A'}
                              </td>

                              <td className="p-4">
                                {record.location_barangay_district ||
                                  record.barangay ||
                                  'Not Specified'}
                              </td>

                              <td className="p-4">
                                <span
                                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                    isQuickSubmit
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {isQuickSubmit
                                    ? 'QUICK SUBMIT'
                                    : 'FULL DETAIL'}
                                </span>
                              </td>

                              <td className="p-4">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                    status ===
                                      'Approved' ||
                                    status ===
                                      'Passed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : status ===
                                        'Rejected'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {status ===
                                  'Passed'
                                    ? 'Approved'
                                    : status}
                                </span>
                              </td>

                              <td className="p-4 text-center">
                                <button
                                  onClick={() =>
                                    openReviewModal(
                                      record
                                    )
                                  }
                                  className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-semibold transition"
                                >
                                  Review Form
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )
                    ) : (
                      <tr>
                        <td
                          colSpan="6"
                          className="p-8 text-center text-slate-400 text-xs uppercase font-medium"
                        >
                          No matching records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePage === 'formManager' && (
            <TaxFormManager
              records={safeRecords.filter(
                (record) =>
                  record?.verification_status ===
                    'Approved' ||
                  record?.verification_status ===
                    'Passed'
              )}
              onUpdateRecord={
                handleInternalUpdateRecord
              }
              onBackToDashboard={() =>
                setActivePage(
                  'dashboard'
                )
              }
            />
          )}

          {activePage === 'dashboard' &&
            selectedRecord && (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50"
                onClick={closeModal}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-4 border border-slate-200 max-h-[92vh] flex flex-col"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <div className="bg-blue-900 text-blue-100 text-[10px] font-semibold uppercase px-3 py-1 rounded flex items-center justify-between">
                    <span>
                      🔒 Assessor's Internal Assessment Action
                    </span>

                    <span>
                      Municipality of San Fernando, Romblon
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h3 className="font-bold text-blue-900 text-sm uppercase">
                        TD No:{' '}
                        {selectedRecord.td_no ||
                          'N/A'}
                      </h3>

                      <p className="text-[11px] text-slate-500">
                        Owner:{' '}
                        {selectedRecord.owner_name ||
                          selectedRecord.full_name ||
                          selectedRecord.owner ||
                          'Unspecified'}
                      </p>
                    </div>

                    <button
                      onClick={closeModal}
                      className="text-slate-400 text-xl font-bold hover:text-slate-600 focus:outline-none"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto space-y-3 pr-1 text-xs">
                    {getSubmissionMode(
                      selectedRecord
                    ) === 'quick' ? (
                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center relative min-h-[400px]">
                        <div className="absolute top-4 right-4 bg-slate-800/95 border border-slate-600 p-1.5 rounded-lg flex items-center gap-2 shadow-lg z-10 text-white">
                          <button
                            type="button"
                            onClick={() =>
                              setImageZoom(
                                (previous) =>
                                  Math.min(
                                    previous +
                                      0.25,
                                    3
                                  )
                              )
                            }
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold transition"
                          >
                            🔍+
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setImageZoom(
                                (previous) =>
                                  Math.max(
                                    previous -
                                      0.25,
                                    0.5
                                  )
                              )
                            }
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold transition"
                          >
                            🔍-
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setImageZoom(1)
                            }
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] font-bold transition"
                          >
                            1:1
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setImageRotation(
                                (previous) =>
                                  (previous +
                                    90) %
                                  360
                              )
                            }
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold transition"
                          >
                            🔄 Rotate
                          </button>
                        </div>

                        <div className="overflow-auto w-full h-[450px] flex items-center justify-center p-2">
                          <img
                            src={
                              typeof selectedRecord.property_image ===
                                'object' &&
                              selectedRecord.property_image instanceof
                                File
                                ? URL.createObjectURL(
                                    selectedRecord.property_image
                                  )
                                : selectedRecord.property_image ||
                                  selectedRecord.document_image ||
                                  selectedRecord.image_url ||
                                  selectedRecord.file_path ||
                                  ''
                            }
                            alt="Quick Submit Scanned Document"
                            style={{
                              transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                              transition:
                                'transform 0.2s ease-in-out'
                            }}
                            className="max-h-[400px] w-auto object-contain rounded shadow bg-white p-1 cursor-grab"
                          />
                        </div>

                        <div className="absolute bottom-2 left-4 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded">
                          Zoom:{' '}
                          {Math.round(
                            imageZoom *
                              100
                          )}
                          % | Rotation:{' '}
                          {imageRotation}°
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-300 p-6 rounded-lg space-y-4 text-slate-900 text-xs">
                        <div className="text-center border-b-2 border-slate-900 pb-3">
                          <h4 className="font-extrabold text-base tracking-wider uppercase text-slate-900">
                            Tax Declaration of Real Property
                          </h4>

                          <p className="text-[11px] text-slate-600">
                            Municipality of San Fernando, Romblon
                          </p>
                        </div>

                        {selectedRecord.rejection_reason && (
                          <div className="bg-rose-50 p-2.5 rounded border border-rose-200 text-rose-900">
                            <strong>
                              Rejection Reason:
                            </strong>{' '}
                            {
                              selectedRecord.rejection_reason
                            }
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 border-b pb-3">
                          <div>
                            <span className="font-bold text-slate-700">
                              TD No.:
                            </span>{' '}

                            <span className="border-b border-dotted border-slate-400 px-2 font-mono font-bold text-blue-900">
                              {selectedRecord.td_no ||
                                'N/A'}
                            </span>
                          </div>

                          <div>
                            <span className="font-bold text-slate-700">
                              Property Identification No. (PIN):
                            </span>{' '}

                            <span className="border-b border-dotted border-slate-400 px-2 font-mono">
                              {selectedRecord.property_identification_no ||
                                selectedRecord.pin ||
                                'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 border-b pb-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <span className="font-bold text-slate-700">
                                Owner:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.owner_name ||
                                  selectedRecord.full_name ||
                                  selectedRecord.owner ||
                                  'N/A'}
                              </span>
                            </div>

                            <div>
                              <span className="font-bold text-slate-700">
                                TIN:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.owner_tin ||
                                  'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <span className="font-bold text-slate-700">
                                Address:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.owner_address ||
                                  selectedRecord.address ||
                                  'N/A'}
                              </span>
                            </div>

                            <div>
                              <span className="font-bold text-slate-700">
                                Telephone No.:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.owner_telephone ||
                                  selectedRecord.telephone_no ||
                                  'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 border-b pb-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <span className="font-bold text-slate-700">
                                Administrator/Beneficial User:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.administrator_name ||
                                  selectedRecord.administrator ||
                                  'N/A'}
                              </span>
                            </div>

                            <div>
                              <span className="font-bold text-slate-700">
                                TIN:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.administrator_tin ||
                                  selectedRecord.admin_tin ||
                                  'N/A'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <span className="font-bold text-slate-700">
                                Address:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.administrator_address ||
                                  selectedRecord.admin_address ||
                                  'N/A'}
                              </span>
                            </div>

                            <div>
                              <span className="font-bold text-slate-700">
                                Telephone No.:
                              </span>{' '}

                              <span className="border-b border-dotted border-slate-400 px-2">
                                {selectedRecord.administrator_telephone ||
                                  selectedRecord.admin_tel ||
                                  'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-b pb-3">
                          <div className="col-span-3 space-y-1">
                            <div>
                              <strong>
                                No. / Street:
                              </strong>{' '}
                              {selectedRecord.location_number_street ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Barangay / District:
                              </strong>{' '}
                              {selectedRecord.location_barangay_district ||
                                selectedRecord.barangay ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Municipality / Province / City:
                              </strong>{' '}
                              {selectedRecord.location_municipality_province_city ||
                                'San Fernando, Romblon'}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-b pb-3">
                          <div className="space-y-1">
                            <div>
                              <strong>
                                OCT/TCT/CLOA No.:
                              </strong>{' '}
                              {selectedRecord.oct_tct_cloa_no ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                CCT No.:
                              </strong>{' '}
                              {selectedRecord.cct_no ||
                                selectedRecord.cct ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Dated:
                              </strong>{' '}
                              {selectedRecord.dated ||
                                selectedRecord.title_date ||
                                'N/A'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div>
                              <strong>
                                Survey No.:
                              </strong>{' '}
                              {selectedRecord.survey_no ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Lot No.:
                              </strong>{' '}
                              {selectedRecord.lot_no ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Blk. No.:
                              </strong>{' '}
                              {selectedRecord.blk_no ||
                                'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="border-b pb-3 space-y-1">
                          <span className="font-bold text-slate-700">
                            Boundaries:
                          </span>

                          <div className="grid grid-cols-2 gap-2 pl-4">
                            <div>
                              <strong>
                                North:
                              </strong>{' '}
                              {selectedRecord.boundary_north ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                South:
                              </strong>{' '}
                              {selectedRecord.boundary_south ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                East:
                              </strong>{' '}
                              {selectedRecord.boundary_east ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                West:
                              </strong>{' '}
                              {selectedRecord.boundary_west ||
                                'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="border-b pb-3 space-y-2">
                          <span className="font-bold text-slate-700 uppercase">
                            Kind of Property Assessed:
                          </span>

                          <div className="grid grid-cols-2 gap-2 pl-2">
                            <div>
                              {selectedRecord.is_land
                                ? '☑'
                                : '☐'}{' '}
                              Land
                            </div>

                            <div>
                              {selectedRecord.is_machinery
                                ? '☑'
                                : '☐'}{' '}
                              Machinery:{' '}
                              {selectedRecord.machinery_brief_description ||
                                selectedRecord.machinery_desc ||
                                'N/A'}
                            </div>

                            <div>
                              {selectedRecord.is_building
                                ? '☑'
                                : '☐'}{' '}
                              Building (Storeys:{' '}
                              {selectedRecord.building_no_of_storeys ||
                                selectedRecord.storeys ||
                                'N/A'}
                              ) -{' '}
                              {selectedRecord.building_brief_description ||
                                'N/A'}
                            </div>

                            <div>
                              {selectedRecord.is_others
                                ? '☑'
                                : '☐'}{' '}
                              Others:{' '}
                              {selectedRecord.others_specify ||
                                selectedRecord.other_desc ||
                                'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="border border-slate-300 rounded overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b text-slate-700 uppercase">
                                <th className="p-2 border-r">
                                  Classification
                                </th>

                                <th className="p-2 border-r">
                                  Area
                                </th>

                                <th className="p-2 border-r">
                                  Market Value
                                </th>

                                <th className="p-2 border-r">
                                  Actual Use
                                </th>

                                <th className="p-2 border-r">
                                  Assessment Level
                                </th>

                                <th className="p-2">
                                  Assessed Value
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {Array.isArray(
                                selectedRecord.assessment_rows
                              ) &&
                              selectedRecord
                                .assessment_rows
                                .length > 0 ? (
                                selectedRecord.assessment_rows.map(
                                  (
                                    row,
                                    index
                                  ) => (
                                    <tr
                                      key={
                                        index
                                      }
                                      className="border-b last:border-b-0"
                                    >
                                      <td className="p-2 border-r">
                                        {row.classification ||
                                          (index ===
                                          0
                                            ? selectedRecord.classification
                                            : '') ||
                                          '-'}
                                      </td>

                                      <td className="p-2 border-r">
                                        {row.area ||
                                          (index ===
                                          0
                                            ? selectedRecord.area
                                            : '') ||
                                          '-'}
                                      </td>

                                      <td className="p-2 border-r">
                                        {row.market_value
                                          ? `₱ ${row.market_value}`
                                          : index ===
                                              0 &&
                                            selectedRecord.market_value
                                          ? `₱ ${selectedRecord.market_value}`
                                          : '-'}
                                      </td>

                                      <td className="p-2 border-r">
                                        {row.actual_use ||
                                          (index ===
                                          0
                                            ? selectedRecord.actual_use
                                            : '') ||
                                          '-'}
                                      </td>

                                      <td className="p-2 border-r">
                                        {row.assessment_level
                                          ? `${row.assessment_level}%`
                                          : index ===
                                              0 &&
                                            selectedRecord.assessment_level
                                          ? `${selectedRecord.assessment_level}%`
                                          : '-'}
                                      </td>

                                      <td className="p-2 font-bold">
                                        {row.assessed_value
                                          ? `₱ ${row.assessed_value}`
                                          : index ===
                                              0 &&
                                            selectedRecord.assessed_value
                                          ? `₱ ${selectedRecord.assessed_value}`
                                          : '-'}
                                      </td>
                                    </tr>
                                  )
                                )
                              ) : (
                                <tr>
                                  <td className="p-2 border-r border-b">
                                    {selectedRecord.classification ||
                                      'Residential'}
                                  </td>

                                  <td className="p-2 border-r border-b">
                                    {selectedRecord.area ||
                                      '0.00'}
                                  </td>

                                  <td className="p-2 border-r border-b">
                                    ₱{' '}
                                    {selectedRecord.market_value ||
                                      '0.00'}
                                  </td>

                                  <td className="p-2 border-r border-b">
                                    {selectedRecord.actual_use ||
                                      'Residential'}
                                  </td>

                                  <td className="p-2 border-r border-b">
                                    {selectedRecord.assessment_level ||
                                      '20'}
                                    %
                                  </td>

                                  <td className="p-2 border-b font-bold">
                                    ₱{' '}
                                    {selectedRecord.assessed_value ||
                                      '0.00'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-b pb-3 items-center">
                          <div className="space-y-1">
                            <div>
                              <strong>
                                Total Market Value:
                              </strong>{' '}
                              ₱{' '}
                              {selectedRecord.total_market_value ||
                                selectedRecord.market_value ||
                                '0.00'}
                            </div>

                            <div>
                              <strong>
                                Total Assessed Value:
                              </strong>{' '}

                              <span className="font-bold text-blue-900 text-sm">
                                ₱{' '}
                                {selectedRecord.total_assessed_value ||
                                  selectedRecord.assessed_value ||
                                  '0.00'}
                              </span>
                            </div>

                            <div className="text-[10px] italic text-slate-500">
                              (
                              {selectedRecord.total_assessed_value_words ||
                                'Zero Pesos Only'}
                              )
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div>
                              Taxability Status:{' '}

                              <strong className="text-blue-900">
                                {selectedRecord.taxability_status ||
                                  selectedRecord.status ||
                                  'Taxable'}
                              </strong>
                            </div>

                            <div>
                              Effectivity: Qtr{' '}
                              {selectedRecord.effectivity_qtr ||
                                'N/A'}
                              , Yr{' '}
                              {selectedRecord.effectivity_yr ||
                                'N/A'}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-b pb-3">
                          <div className="space-y-1">
                            <div>
                              <strong>
                                Approved By:
                              </strong>{' '}
                              {selectedRecord.approved_by ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Approval Date:
                              </strong>{' '}
                              {selectedRecord.approval_date ||
                                'N/A'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div>
                              <strong>
                                Cancels TD No.:
                              </strong>{' '}
                              {selectedRecord.cancels_td_no ||
                                'N/A'}
                            </div>

                            <div>
                              <strong>
                                Previous Assessed Value:
                              </strong>{' '}
                              ₱{' '}
                              {selectedRecord.previous_av ||
                                '0.00'}
                            </div>
                          </div>
                        </div>

                        <div className="border-b pb-3 space-y-1">
                          <strong>
                            Memoranda:
                          </strong>

                          <p className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700 min-h-[40px]">
                            {selectedRecord.memoranda ||
                              selectedRecord.notes ||
                              'None recorded.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {isRejecting && (
                    <div className="space-y-2 bg-rose-50 p-3 rounded-lg border border-rose-200">
                      <label className="block font-bold text-rose-900 text-xs">
                        Specify Reason for Rejection / Revision Note:
                      </label>

                      <textarea
                        value={
                          rejectionReasonInput
                        }
                        onChange={(event) =>
                          setRejectionReasonInput(
                            event.target.value
                          )
                        }
                        placeholder="Enter clear remarks explaining why this declaration is being rejected..."
                        className="w-full border border-rose-300 p-2 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        rows="2"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setIsRejecting(
                              false
                            )
                          }
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded text-xs font-semibold transition"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          disabled={
                            isUpdating
                          }
                          onClick={() =>
                            handleVerifyRecord(
                              selectedRecord,
                              'Rejected',
                              rejectionReasonInput
                            )
                          }
                          className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1 rounded text-xs font-semibold transition shadow"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="flex items-center gap-2">
                      

                      <button
                        type="button"
                        disabled={
                          isUpdating
                        }
                        onClick={() =>
                          handleDeleteRecordPermanently(
                            selectedRecord.id ||
                              selectedRecord.td_no
                          )
                        }
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded text-xs font-semibold transition"
                      >
                        Delete Permanently (Database)
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isRejecting && (
                        <button
                          type="button"
                          disabled={
                            isUpdating
                          }
                          onClick={() =>
                            setIsRejecting(
                              true
                            )
                          }
                          className="bg-rose-100 hover:bg-rose-200 text-rose-800 px-4 py-1.5 rounded text-xs font-semibold transition"
                        >
                          Reject Record
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          isUpdating
                        }
                        onClick={() =>
                          handleVerifyRecord(
                            selectedRecord,
                            'Passed'
                          )
                        }
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-1.5 rounded text-xs font-semibold transition shadow"
                      >
                        {isUpdating
                          ? 'Saving...'
                          : '✓ Approve & Pass'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}