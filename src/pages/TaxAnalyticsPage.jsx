import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { fetchTaxDeclarations } from '../assets/services/api';

export default function TaxAnalyticsPage({
  userRole = 'administrator',
  onLogout,
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear().toString()
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  /* =========================================================
     LOAD DATABASE
  ========================================================= */

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const response = await fetchTaxDeclarations();

      const data = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.records)
        ? response.records
        : [];

      setRecords(data);
    } catch (err) {
      console.error(
        'Failed to load tax declarations for analytics:',
        err
      );

      setError(
        err?.message ||
          'Could not fetch analytics data from the database server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* =========================================================
     HELPERS
  ========================================================= */

  const parseNumber = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 0;
    }

    const cleaned = String(value)
      .replace(/₱/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '');

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getAssessedValue = (record) => {
    return parseNumber(
      record?.total_assessed_value ??
        record?.total_av ??
        record?.assessed_value
    );
  };

  const getMarketValue = (record) => {
    return parseNumber(
      record?.total_market_value ??
        record?.market_value
    );
  };

  const getDate = (record) => {
    const value =
      record?.created_at ||
      record?.updated_at ||
      record?.approval_date ||
      record?.dated;

    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  };

  const isQuickSubmit = (record) => {
    return (
      record?.submission_mode === 'quick' ||
      record?.isQuickSubmit === true ||
      record?.is_quick_submit === true ||
      record?.quick_submit === true ||
      record?.quickSubmit === true
    );
  };

  const hasImage = (record) => {
    return Boolean(
      record?.property_image ||
        record?.document_image ||
        record?.image_url ||
        record?.file_path
    );
  };

  const getVerificationStatus = (record) => {
    const status =
      record?.verification_status || 'Pending';

    return String(status).trim();
  };

  const formatCurrency = (value) => {
    return `₱${Number(value || 0).toLocaleString(
      'en-PH',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const formatInteger = (value) => {
    return Number(value || 0).toLocaleString('en-PH');
  };

  /* =========================================================
     BASIC STATISTICS
  ========================================================= */

  const totalRecordsCount = records.length;

  const passedCount = records.filter((r) => {
    const status = getVerificationStatus(r);

    return (
      status === 'Passed' ||
      status === 'Approved'
    );
  }).length;

  const rejectedCount = records.filter(
    (r) =>
      getVerificationStatus(r) === 'Rejected'
  ).length;

  const pendingCount = records.filter((r) => {
    const status = getVerificationStatus(r);

    return (
      !status ||
      status === 'Pending'
    );
  }).length;

  const quickSubmitCount = records.filter(
    isQuickSubmit
  ).length;

  const fullDetailCount =
    totalRecordsCount - quickSubmitCount;

  const recordsWithImages = records.filter(
    hasImage
  ).length;

  const recordsWithoutImages =
    totalRecordsCount - recordsWithImages;

  /* =========================================================
     FINANCIAL ANALYTICS
  ========================================================= */

  const totalAssessedSum = records.reduce(
    (sum, record) =>
      sum + getAssessedValue(record),
    0
  );

  const totalMarketSum = records.reduce(
    (sum, record) =>
      sum + getMarketValue(record),
    0
  );

  const averageAssessedValue =
    totalRecordsCount > 0
      ? totalAssessedSum / totalRecordsCount
      : 0;

  const averageMarketValue =
    totalRecordsCount > 0
      ? totalMarketSum / totalRecordsCount
      : 0;

  const highestAssessedRecord = useMemo(() => {
    if (!records.length) return null;

    return records.reduce(
      (highest, current) => {
        if (!highest) return current;

        return getAssessedValue(current) >
          getAssessedValue(highest)
          ? current
          : highest;
      },
      null
    );
  }, [records]);

  const highestMarketRecord = useMemo(() => {
    if (!records.length) return null;

    return records.reduce(
      (highest, current) => {
        if (!highest) return current;

        return getMarketValue(current) >
          getMarketValue(highest)
          ? current
          : highest;
      },
      null
    );
  }, [records]);

  /* =========================================================
     PERCENTAGES
  ========================================================= */

  const approvalRate =
    totalRecordsCount > 0
      ? (passedCount / totalRecordsCount) * 100
      : 0;

  const rejectionRate =
    totalRecordsCount > 0
      ? (rejectedCount / totalRecordsCount) * 100
      : 0;

  const pendingRate =
    totalRecordsCount > 0
      ? (pendingCount / totalRecordsCount) * 100
      : 0;

  const quickSubmitRate =
    totalRecordsCount > 0
      ? (quickSubmitCount / totalRecordsCount) * 100
      : 0;

  const documentCoverageRate =
    totalRecordsCount > 0
      ? (recordsWithImages / totalRecordsCount) * 100
      : 0;

  /* =========================================================
     DATE ANALYTICS
  ========================================================= */

  const today = new Date();

  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const weekStart = new Date(todayStart);

  const dayOfWeek = todayStart.getDay();

  const daysSinceMonday =
    dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setDate(
    todayStart.getDate() - daysSinceMonday
  );

  const monthStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  const recordsToday = records.filter((r) => {
    const date = getDate(r);

    return date && date >= todayStart;
  }).length;

  const recordsThisWeek = records.filter((r) => {
    const date = getDate(r);

    return date && date >= weekStart;
  }).length;

  const recordsThisMonth = records.filter((r) => {
    const date = getDate(r);

    return date && date >= monthStart;
  }).length;

  /* =========================================================
     YEAR RECORDS
  ========================================================= */

  const yearRecords = useMemo(() => {
    return records.filter((record) => {
      const date = getDate(record);

      if (!date) return false;

      return (
        date.getFullYear().toString() ===
        selectedYear
      );
    });
  }, [records, selectedYear]);

  const selectedYearCount =
    yearRecords.length;

  const selectedYearAssessedValue =
    yearRecords.reduce(
      (sum, record) =>
        sum + getAssessedValue(record),
      0
    );

  const selectedYearMarketValue =
    yearRecords.reduce(
      (sum, record) =>
        sum + getMarketValue(record),
      0
    );

  /* =========================================================
     MONTHLY ANALYTICS
  ========================================================= */

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthlyData = useMemo(() => {
    return months.map((monthName, index) => {
      const monthRecords =
        records.filter((record) => {
          const date = getDate(record);

          if (!date) return false;

          return (
            date.getMonth() === index &&
            date.getFullYear().toString() ===
              selectedYear
          );
        });

      return {
        month: monthName,
        count: monthRecords.length,
        assessedValue:
          monthRecords.reduce(
            (sum, record) =>
              sum + getAssessedValue(record),
            0
          ),
        marketValue:
          monthRecords.reduce(
            (sum, record) =>
              sum + getMarketValue(record),
            0
          ),
      };
    });
  }, [records, selectedYear]);

  const maxMonthlyCount = Math.max(
    ...monthlyData.map((m) => m.count),
    1
  );

  const maxMonthlyAssessed = Math.max(
    ...monthlyData.map(
      (m) => m.assessedValue
    ),
    1
  );

  /* =========================================================
     BARANGAY ANALYTICS
  ========================================================= */

  const barangayData = useMemo(() => {
    const map = {};

    records.forEach((record) => {
      const barangay =
        record?.location_barangay_district ||
        record?.barangay ||
        'Unknown Barangay';

      if (!map[barangay]) {
        map[barangay] = {
          name: barangay,
          count: 0,
          assessedValue: 0,
          marketValue: 0,
        };
      }

      map[barangay].count += 1;

      map[barangay].assessedValue +=
        getAssessedValue(record);

      map[barangay].marketValue +=
        getMarketValue(record);
    });

    return Object.values(map).sort(
      (a, b) => b.count - a.count
    );
  }, [records]);

  const maxBarangayCount = Math.max(
    ...barangayData.map((b) => b.count),
    1
  );

  const barangays = useMemo(() => {
    return [
      'All',
      ...barangayData.map(
        (barangay) => barangay.name
      ),
    ];
  }, [barangayData]);

  /* =========================================================
     STATUS ANALYTICS
  ========================================================= */

  const statusData = [
    {
      label: 'Approved / Passed',
      count: passedCount,
      percentage: approvalRate,
      className:
        'bg-emerald-500',
      lightClass:
        'bg-emerald-50',
      textClass:
        'text-emerald-800',
    },
    {
      label: 'Pending',
      count: pendingCount,
      percentage: pendingRate,
      className:
        'bg-yellow-500',
      lightClass:
        'bg-yellow-50',
      textClass:
        'text-yellow-800',
    },
    {
      label: 'Rejected',
      count: rejectedCount,
      percentage: rejectionRate,
      className:
        'bg-red-500',
      lightClass:
        'bg-red-50',
      textClass:
        'text-red-800',
    },
  ];

  /* =========================================================
     FILTERED RECORDS
  ========================================================= */

  const filteredRecords = useMemo(() => {
    const search =
      searchTerm.toLowerCase().trim();

    return records.filter((record) => {
      const tdNo = String(
        record?.td_no || ''
      ).toLowerCase();

      const owner = String(
        record?.owner_name ||
          record?.full_name ||
          ''
      ).toLowerCase();

      const barangay = String(
        record?.location_barangay_district ||
          record?.barangay ||
          ''
      ).toLowerCase();

      const matchesSearch =
        !search ||
        tdNo.includes(search) ||
        owner.includes(search) ||
        barangay.includes(search);

      const actualBarangay =
        record?.location_barangay_district ||
        record?.barangay ||
        'Unknown Barangay';

      const matchesBarangay =
        barangayFilter === 'All' ||
        actualBarangay === barangayFilter;

      const actualStatus =
        getVerificationStatus(record);

      const matchesStatus =
        statusFilter === 'All' ||
        actualStatus === statusFilter ||
        (
          statusFilter ===
            'Approved / Passed' &&
          (
            actualStatus === 'Approved' ||
            actualStatus === 'Passed'
          )
        );

      return (
        matchesSearch &&
        matchesBarangay &&
        matchesStatus
      );
    });
  }, [
    records,
    searchTerm,
    barangayFilter,
    statusFilter,
  ]);

  /* =========================================================
     RECENT RECORDS
  ========================================================= */

  const recentRecords = useMemo(() => {
    return [...records]
      .sort((a, b) => {
        const dateA =
          getDate(a)?.getTime() || 0;

        const dateB =
          getDate(b)?.getTime() || 0;

        return dateB - dateA;
      })
      .slice(0, 8);
  }, [records]);

  /* =========================================================
     TOP ASSESSED PROPERTIES
  ========================================================= */

  const topProperties = useMemo(() => {
    return [...records]
      .sort(
        (a, b) =>
          getAssessedValue(b) -
          getAssessedValue(a)
      )
      .slice(0, 5);
  }, [records]);

  /* =========================================================
     PRINT
  ========================================================= */

  const handlePrintReport = () => {
    window.print();
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96 font-sans text-xs text-slate-500 uppercase tracking-widest">
        Loading municipal analytics database...
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="max-w-[1600px] mx-auto font-sans p-4 md:p-6 space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">

        <div>
          <div className="flex items-center gap-2 flex-wrap">

            <h1 className="text-base md:text-lg font-bold text-blue-900 uppercase">
              System Analytics & Monthly Reports
            </h1>

            <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
              Role: {userRole}
            </span>

          </div>

          <p className="text-xs text-slate-500 mt-1">
            Municipal Government of San Fernando,
            Romblon — Real Property Tax Archiving
            System
          </p>

          <p className="text-[11px] font-medium text-slate-600 mt-1">
            <strong className="text-blue-900">
              Municipal Administrator Mandate:
            </strong>{' '}
            Monitor operations, supervise records
            management, evaluate assessment activity,
            and support administrative
            decision-making.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 text-xs">
              Year:
            </span>

            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(e.target.value)
              }
              className="border border-slate-300 rounded-lg p-2 bg-white font-semibold text-blue-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-800"
            >
              {[
                '2024',
                '2025',
                '2026',
                '2027',
              ].map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg border border-slate-300 transition text-xs"
          >
            {refreshing
              ? 'Refreshing...'
              : 'Refresh Data'}
          </button>

          <button
            onClick={handlePrintReport}
            className="bg-blue-900 hover:bg-blue-800 text-white font-bold px-3 py-2 rounded-lg shadow-sm transition text-xs"
          >
            Print Report
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3 py-2 rounded-lg border border-red-200 transition text-xs"
            >
              Sign Out
            </button>
          )}

        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* =====================================================
          MAIN KPI CARDS
      ===================================================== */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">

        <MetricCard
          title="Total Records"
          value={formatInteger(
            totalRecordsCount
          )}
          description="Database archive"
          className="bg-blue-50 border-blue-200"
          titleClass="text-blue-700"
          valueClass="text-blue-900"
        />

        <MetricCard
          title="Approved"
          value={formatInteger(
            passedCount
          )}
          description={`${approvalRate.toFixed(
            1
          )}% approval rate`}
          className="bg-emerald-50 border-emerald-200"
          titleClass="text-emerald-700"
          valueClass="text-emerald-900"
        />

        <MetricCard
          title="Pending"
          value={formatInteger(
            pendingCount
          )}
          description={`${pendingRate.toFixed(
            1
          )}% awaiting review`}
          className="bg-yellow-50 border-yellow-200"
          titleClass="text-yellow-700"
          valueClass="text-yellow-900"
        />

        <MetricCard
          title="Rejected"
          value={formatInteger(
            rejectedCount
          )}
          description={`${rejectionRate.toFixed(
            1
          )}% rejection rate`}
          className="bg-red-50 border-red-200"
          titleClass="text-red-700"
          valueClass="text-red-900"
        />

        <MetricCard
          title="Quick Submit"
          value={formatInteger(
            quickSubmitCount
          )}
          description={`${quickSubmitRate.toFixed(
            1
          )}% of records`}
          className="bg-amber-50 border-amber-200"
          titleClass="text-amber-700"
          valueClass="text-amber-900"
        />

        <MetricCard
          title="Full Detail"
          value={formatInteger(
            fullDetailCount
          )}
          description="Complete declarations"
          className="bg-indigo-50 border-indigo-200"
          titleClass="text-indigo-700"
          valueClass="text-indigo-900"
        />

        <MetricCard
          title="Documents"
          value={formatInteger(
            recordsWithImages
          )}
          description={`${documentCoverageRate.toFixed(
            1
          )}% image coverage`}
          className="bg-cyan-50 border-cyan-200"
          titleClass="text-cyan-700"
          valueClass="text-cyan-900"
        />

        <MetricCard
          title="No Document"
          value={formatInteger(
            recordsWithoutImages
          )}
          description="Missing scanned image"
          className="bg-orange-50 border-orange-200"
          titleClass="text-orange-700"
          valueClass="text-orange-900"
        />

      </div>

      {/* =====================================================
          ACTIVITY SUMMARY
      ===================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <ActivityCard
          title="Submitted Today"
          value={recordsToday}
          description="Records created today"
        />

        <ActivityCard
          title="Submitted This Week"
          value={recordsThisWeek}
          description="Records since Monday"
        />

        <ActivityCard
          title="Submitted This Month"
          value={recordsThisMonth}
          description="Current month's activity"
        />

      </div>

      {/* =====================================================
          FINANCIAL ANALYTICS
      ===================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        <FinancialCard
          title="Total Assessed Value"
          value={formatCurrency(
            totalAssessedSum
          )}
          description="All archived declarations"
        />

        <FinancialCard
          title="Total Market Value"
          value={formatCurrency(
            totalMarketSum
          )}
          description="All recorded market values"
        />

        <FinancialCard
          title="Average Assessed Value"
          value={formatCurrency(
            averageAssessedValue
          )}
          description="Average per declaration"
        />

        <FinancialCard
          title="Average Market Value"
          value={formatCurrency(
            averageMarketValue
          )}
          description="Average market value"
        />

      </div>

      {/* =====================================================
          HIGHEST VALUES
      ===================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

          <h2 className="text-xs font-bold text-blue-900 uppercase">
            Highest Assessed Property
          </h2>

          {highestAssessedRecord ? (
            <div className="mt-4">

              <p className="text-2xl font-extrabold text-blue-900">
                {formatCurrency(
                  getAssessedValue(
                    highestAssessedRecord
                  )
                )}
              </p>

              <p className="text-xs font-bold text-slate-700 mt-2">
                TD No.{' '}
                {highestAssessedRecord.td_no ||
                  'N/A'}
              </p>

              <p className="text-[11px] text-slate-500">
                {highestAssessedRecord.owner_name ||
                  highestAssessedRecord.full_name ||
                  'Unknown owner'}
              </p>

            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-4">
              No records available.
            </p>
          )}

        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

          <h2 className="text-xs font-bold text-emerald-900 uppercase">
            Highest Market Value Property
          </h2>

          {highestMarketRecord ? (
            <div className="mt-4">

              <p className="text-2xl font-extrabold text-emerald-900">
                {formatCurrency(
                  getMarketValue(
                    highestMarketRecord
                  )
                )}
              </p>

              <p className="text-xs font-bold text-slate-700 mt-2">
                TD No.{' '}
                {highestMarketRecord.td_no ||
                  'N/A'}
              </p>

              <p className="text-[11px] text-slate-500">
                {highestMarketRecord.owner_name ||
                  highestMarketRecord.full_name ||
                  'Unknown owner'}
              </p>

            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-4">
              No records available.
            </p>
          )}

        </div>

      </div>

      {/* =====================================================
          YEAR SUMMARY
      ===================================================== */}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">

        <div className="flex justify-between items-center flex-wrap gap-3">

          <div>
            <h2 className="text-xs font-bold text-blue-900 uppercase">
              {selectedYear} Annual Summary
            </h2>

            <p className="text-[11px] text-slate-500">
              Database activity and property
              valuation for the selected year.
            </p>
          </div>

          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-[10px] font-bold">
            {selectedYear}
          </span>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">

          <SummaryBox
            title="Year Records"
            value={formatInteger(
              selectedYearCount
            )}
          />

          <SummaryBox
            title="Year Market Value"
            value={formatCurrency(
              selectedYearMarketValue
            )}
          />

          <SummaryBox
            title="Year Assessed Value"
            value={formatCurrency(
              selectedYearAssessedValue
            )}
          />

        </div>

      </div>

      {/* =====================================================
          MONTHLY SUBMISSION GRAPH
      ===================================================== */}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

        <div className="flex justify-between items-center flex-wrap gap-2 mb-5">

          <div>
            <h2 className="text-xs font-bold text-blue-900 uppercase">
              Monthly Tax Declaration Activity
            </h2>

            <p className="text-[11px] text-slate-500">
              Number of declarations recorded in{' '}
              {selectedYear}.
            </p>
          </div>

          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
            {selectedYearCount} Annual Records
          </span>

        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">

          <div className="h-64 flex items-end justify-between gap-1 sm:gap-3 pt-8 pb-2 px-2 border-b border-slate-200">

            {monthlyData.map(
              (item, index) => {

                const heightPercent =
                  Math.round(
                    (item.count /
                      maxMonthlyCount) *
                      100
                  );

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center h-full justify-end group relative"
                  >

                    <div className="absolute -top-12 bg-slate-900 text-white text-[9px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10 shadow-lg">

                      {item.month}{' '}
                      {selectedYear}:{' '}
                      {item.count} records

                    </div>

                    <span className="text-[9px] font-bold text-slate-600 mb-1">
                      {item.count > 0
                        ? item.count
                        : ''}
                    </span>

                    <div
                      style={{
                        height: `${Math.max(
                          heightPercent,
                          item.count > 0
                            ? 12
                            : 4
                        )}%`,
                      }}
                      className={`w-full rounded-t transition-all duration-500 ${
                        item.count > 0
                          ? 'bg-blue-900 group-hover:bg-blue-600'
                          : 'bg-slate-200'
                      }`}
                    />

                  </div>
                );
              }
            )}

          </div>

          <div className="flex justify-between pt-2 px-1 text-[10px] font-bold text-slate-600 uppercase">

            {monthlyData.map(
              (item, index) => (
                <div
                  key={index}
                  className="flex-1 text-center truncate"
                >
                  {item.month}
                </div>
              )
            )}

          </div>

        </div>

      </div>

      {/* =====================================================
          MONTHLY FINANCIAL GRAPH
      ===================================================== */}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

        <div className="mb-5">

          <h2 className="text-xs font-bold text-emerald-900 uppercase">
            Monthly Assessed Value
          </h2>

          <p className="text-[11px] text-slate-500">
            Cumulative assessed value recorded
            per month for {selectedYear}.
          </p>

        </div>

        <div className="space-y-3">

          {monthlyData.map(
            (item, index) => {

              const width =
                maxMonthlyAssessed > 0
                  ? (item.assessedValue /
                      maxMonthlyAssessed) *
                    100
                  : 0;

              return (
                <div key={index}>

                  <div className="flex justify-between text-[10px] font-bold mb-1">

                    <span className="text-slate-600">
                      {item.month}
                    </span>

                    <span className="text-emerald-800">
                      {formatCurrency(
                        item.assessedValue
                      )}
                    </span>

                  </div>

                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(
                          width,
                          item.assessedValue > 0
                            ? 2
                            : 0
                        )}%`,
                      }}
                    />

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

      {/* =====================================================
          STATUS DISTRIBUTION
      ===================================================== */}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

        <div className="mb-4">

          <h2 className="text-xs font-bold text-blue-900 uppercase">
            Verification Status Distribution
          </h2>

          <p className="text-[11px] text-slate-500">
            Current processing condition of all
            archived tax declarations.
          </p>

        </div>

        <div className="space-y-4">

          {statusData.map((item) => (
            <div key={item.label}>

              <div className="flex justify-between text-xs mb-1">

                <span className="font-semibold text-slate-700">
                  {item.label}
                </span>

                <span
                  className={`font-bold ${item.textClass}`}
                >
                  {item.count} (
                  {item.percentage.toFixed(1)}
                  %)
                </span>

              </div>

              <div className="h-4 bg-slate-100 rounded-full overflow-hidden">

                <div
                  className={`h-full ${item.className} rounded-full transition-all duration-500`}
                  style={{
                    width: `${item.percentage}%`,
                  }}
                />

              </div>

            </div>
          ))}

        </div>

      </div>

      {/* =====================================================
          BARANGAY ANALYTICS
      ===================================================== */}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

        <div className="flex justify-between items-center flex-wrap gap-2 mb-5">

          <div>

            <h2 className="text-xs font-bold text-blue-900 uppercase">
              Records by Barangay
            </h2>

            <p className="text-[11px] text-slate-500">
              Distribution of tax declarations
              across barangays.
            </p>

          </div>

          <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-md">
            {barangayData.length} Barangays
          </span>

        </div>

        <div className="space-y-4">

          {barangayData.length === 0 ? (
            <p className="text-xs text-slate-400">
              No barangay data available.
            </p>
          ) : (
            barangayData
              .slice(0, 10)
              .map((barangay) => {

                const width =
                  (barangay.count /
                    maxBarangayCount) *
                  100;

                return (
                  <div key={barangay.name}>

                    <div className="flex justify-between items-center text-[11px] mb-1">

                      <span className="font-bold text-slate-700">
                        {barangay.name}
                      </span>

                      <span className="font-bold text-blue-900">
                        {barangay.count} records
                      </span>

                    </div>

                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

                      <div
                        className="h-full bg-blue-800 rounded-full"
                        style={{
                          width: `${width}%`,
                        }}
                      />

                    </div>

                    <div className="flex justify-between mt-1 text-[9px] text-slate-400">

                      <span>
                        Assessed:{' '}
                        {formatCurrency(
                          barangay.assessedValue
                        )}
                      </span>

                      <span>
                        Market:{' '}
                        {formatCurrency(
                          barangay.marketValue
                        )}
                      </span>

                    </div>

                  </div>
                );
              })
          )}

        </div>

      </div>

      {/* =====================================================
          SUBMISSION CHANNEL
      ===================================================== */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

          <h2 className="text-xs font-bold text-blue-900 uppercase mb-4">
            Submission Channel Breakdown
          </h2>

          <div className="space-y-3">

            <ChannelRow
              title="Full Detail Paper Form"
              count={fullDetailCount}
              total={totalRecordsCount}
              className="bg-blue-600"
            />

            <ChannelRow
              title="Quick Submit Image Upload"
              count={quickSubmitCount}
              total={totalRecordsCount}
              className="bg-amber-500"
            />

          </div>

        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

          <h2 className="text-xs font-bold text-cyan-900 uppercase mb-4">
            Digital Document Coverage
          </h2>

          <div className="space-y-3">

            <ChannelRow
              title="Records With Scanned Document"
              count={recordsWithImages}
              total={totalRecordsCount}
              className="bg-cyan-600"
            />

            <ChannelRow
              title="Records Without Scanned Document"
              count={recordsWithoutImages}
              total={totalRecordsCount}
              className="bg-orange-500"
            />

          </div>

        </div>

      </div>

      {/* =====================================================
          TOP PROPERTIES
      ===================================================== */}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

        <div className="mb-4">

          <h2 className="text-xs font-bold text-blue-900 uppercase">
            Top Properties by Assessed Value
          </h2>

          <p className="text-[11px] text-slate-500">
            Five records with the highest assessed
            values.
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse">

            <thead>

              <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase text-slate-600">

                <th className="p-2.5">
                  Rank
                </th>

                <th className="p-2.5">
                  TD No.
                </th>

                <th className="p-2.5">
                  Owner
                </th>

                <th className="p-2.5">
                  Barangay
                </th>

                <th className="p-2.5">
                  Market Value
                </th>

                <th className="p-2.5">
                  Assessed Value
                </th>

              </tr>

            </thead>

            <tbody>

              {topProperties.map(
                (record, index) => (

                  <tr
                    key={
                      record.id || index
                    }
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >

                    <td className="p-2.5 font-bold text-blue-900">
                      #{index + 1}
                    </td>

                    <td className="p-2.5 font-mono font-bold">
                      {record.td_no || '---'}
                    </td>

                    <td className="p-2.5">
                      {record.owner_name ||
                        record.full_name ||
                        'N/A'}
                    </td>

                    <td className="p-2.5">
                      {record.location_barangay_district ||
                        record.barangay ||
                        'N/A'}
                    </td>

                    <td className="p-2.5 font-semibold">
                      {formatCurrency(
                        getMarketValue(record)
                      )}
                    </td>

                    <td className="p-2.5 font-bold text-emerald-800">
                      {formatCurrency(
                        getAssessedValue(record)
                      )}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =====================================================
          RECENT ACTIVITY
      ===================================================== */}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

        <div className="mb-4">

          <h2 className="text-xs font-bold text-blue-900 uppercase">
            Recent Database Activity
          </h2>

          <p className="text-[11px] text-slate-500">
            Most recently created or updated tax
            declaration records.
          </p>

        </div>

        <div className="space-y-2">

          {recentRecords.map(
            (record, index) => {

              const date =
                getDate(record);

              const status =
                getVerificationStatus(
                  record
                );

              return (
                <div
                  key={
                    record.id || index
                  }
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100"
                >

                  <div>

                    <div className="flex items-center gap-2 flex-wrap">

                      <span className="font-mono font-bold text-blue-900 text-xs">
                        {record.td_no ||
                          'NO TD NO.'}
                      </span>

                      <StatusBadge
                        status={status}
                      />

                    </div>

                    <p className="text-[11px] text-slate-600 mt-1">
                      {record.owner_name ||
                        record.full_name ||
                        'Unknown owner'}
                    </p>

                  </div>

                  <div className="text-right">

                    <p className="text-[10px] font-bold text-slate-500">

                      {date
                        ? date.toLocaleDateString(
                            'en-PH',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }
                          )
                        : 'No date'}

                    </p>

                    <p className="text-[10px] text-emerald-700 font-bold">

                      {formatCurrency(
                        getAssessedValue(
                          record
                        )
                      )}

                    </p>

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

      {/* =====================================================
          DETAILED RECORD TABLE
      ===================================================== */}

      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b pb-3 mb-4">

          <div>

            <h2 className="font-bold text-blue-900 uppercase">
              Evaluated Tax Declaration Records
            </h2>

            <p className="text-[11px] text-slate-500">
              Search, filter, and review archived
              database entries.
            </p>

          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">

            <input
              type="text"
              placeholder="Search TD No., Owner, Barangay..."
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(
                  e.target.value
                )
              }
              className="w-full sm:w-64 border border-slate-300 p-2 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-800"
            />

            <select
              value={barangayFilter}
              onChange={(e) =>
                setBarangayFilter(
                  e.target.value
                )
              }
              className="border border-slate-300 p-2 rounded-lg bg-white text-xs"
            >

              {barangays.map(
                (barangay) => (
                  <option
                    key={barangay}
                    value={barangay}
                  >
                    {barangay === 'All'
                      ? 'All Barangays'
                      : barangay}
                  </option>
                )
              )}

            </select>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="border border-slate-300 p-2 rounded-lg bg-white text-xs"
            >

              <option value="All">
                All Statuses
              </option>

              <option value="Approved / Passed">
                Approved / Passed
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Rejected">
                Rejected
              </option>

            </select>

          </div>

        </div>

        <div className="flex justify-between items-center mb-3">

          <span className="text-[10px] text-slate-500 font-semibold">
            Showing{' '}
            {filteredRecords.length}{' '}
            of {records.length} records
          </span>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full text-left border-collapse">

            <thead>

              <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-[10px] uppercase">

                <th className="p-2.5">
                  TD No.
                </th>

                <th className="p-2.5">
                  Owner Name
                </th>

                <th className="p-2.5">
                  Barangay
                </th>

                <th className="p-2.5">
                  Market Value
                </th>

                <th className="p-2.5">
                  Assessed Value
                </th>

                <th className="p-2.5">
                  Type
                </th>

                <th className="p-2.5">
                  Document
                </th>

                <th className="p-2.5">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredRecords.length ===
              0 ? (
                <tr>

                  <td
                    colSpan="8"
                    className="text-center py-8 text-slate-400 italic"
                  >
                    No records match your
                    search criteria.
                  </td>

                </tr>
              ) : (
                filteredRecords.map(
                  (item, index) => {

                    const quick =
                      isQuickSubmit(
                        item
                      );

                    return (
                      <tr
                        key={
                          item.id ||
                          index
                        }
                        className="border-b border-slate-100 hover:bg-slate-50 transition"
                      >

                        <td className="p-2.5 font-mono font-bold text-blue-900">
                          {item.td_no ||
                            '---'}
                        </td>

                        <td className="p-2.5 font-medium">
                          {item.owner_name ||
                            item.full_name ||
                            'N/A'}
                        </td>

                        <td className="p-2.5">
                          {item.location_barangay_district ||
                            item.barangay ||
                            'N/A'}
                        </td>

                        <td className="p-2.5 font-semibold">
                          {formatCurrency(
                            getMarketValue(
                              item
                            )
                          )}
                        </td>

                        <td className="p-2.5 font-semibold text-emerald-800">
                          {formatCurrency(
                            getAssessedValue(
                              item
                            )
                          )}
                        </td>

                        <td className="p-2.5">

                          <span
                            className={`px-2 py-1 rounded text-[9px] font-bold ${
                              quick
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {quick
                              ? 'QUICK'
                              : 'FULL'}
                          </span>

                        </td>

                        <td className="p-2.5">

                          <span
                            className={`px-2 py-1 rounded text-[9px] font-bold ${
                              hasImage(
                                item
                              )
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {hasImage(
                              item
                            )
                              ? 'AVAILABLE'
                              : 'MISSING'}
                          </span>

                        </td>

                        <td className="p-2.5">

                          <StatusBadge
                            status={
                              getVerificationStatus(
                                item
                              )
                            }
                          />

                        </td>

                      </tr>
                    );
                  }
                )
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* =====================================================
          ADMINISTRATIVE INFORMATION
      ===================================================== */}

      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm print:hidden">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          <div>

            <p className="text-[9px] uppercase tracking-widest text-slate-400">
              Database Source
            </p>

            <p className="text-sm font-bold mt-1">
              Supabase
            </p>

          </div>

          <div>

            <p className="text-[9px] uppercase tracking-widest text-slate-400">
              Records Analyzed
            </p>

            <p className="text-sm font-bold mt-1">
              {formatInteger(
                totalRecordsCount
              )}
            </p>

          </div>

          <div>

            <p className="text-[9px] uppercase tracking-widest text-slate-400">
              Report Generated
            </p>

            <p className="text-sm font-bold mt-1">
              {new Date().toLocaleString(
                'en-PH'
              )}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function MetricCard({
  title,
  value,
  description,
  className,
  titleClass,
  valueClass,
}) {
  return (
    <div
      className={`p-4 rounded-xl border shadow-sm ${className}`}
    >

      <span
        className={`text-[9px] font-bold uppercase tracking-wider ${titleClass}`}
      >
        {title}
      </span>

      <p
        className={`text-2xl font-extrabold mt-1 ${valueClass}`}
      >
        {value}
      </p>

      <span className="text-[9px] text-slate-500 mt-1 block">
        {description}
      </span>

    </div>
  );
}

function ActivityCard({
  title,
  value,
  description,
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

      <p className="text-[10px] font-bold text-slate-500 uppercase">
        {title}
      </p>

      <p className="text-3xl font-extrabold text-blue-900 mt-1">
        {value}
      </p>

      <p className="text-[10px] text-slate-500 mt-1">
        {description}
      </p>

    </div>
  );
}

function FinancialCard({
  title,
  value,
  description,
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">

      <p className="text-[10px] font-bold text-slate-500 uppercase">
        {title}
      </p>

      <p className="text-xl font-extrabold text-emerald-800 mt-2 break-words">
        {value}
      </p>

      <p className="text-[10px] text-slate-500 mt-1">
        {description}
      </p>

    </div>
  );
}

function SummaryBox({
  title,
  value,
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

      <p className="text-[9px] font-bold text-slate-500 uppercase">
        {title}
      </p>

      <p className="text-lg font-extrabold text-blue-900 mt-1">
        {value}
      </p>

    </div>
  );
}

function ChannelRow({
  title,
  count,
  total,
  className,
}) {
  const percentage =
    total > 0
      ? (count / total) * 100
      : 0;

  return (
    <div>

      <div className="flex justify-between items-center mb-1">

        <span className="text-[11px] font-semibold text-slate-700">
          {title}
        </span>

        <span className="text-[10px] font-bold text-slate-600">
          {count} (
          {percentage.toFixed(1)}
          %)
        </span>

      </div>

      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

        <div
          className={`h-full ${className} rounded-full transition-all duration-500`}
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}

function StatusBadge({
  status,
}) {
  const normalized =
    String(status || 'Pending');

  const isApproved =
    normalized === 'Approved' ||
    normalized === 'Passed';

  const isRejected =
    normalized === 'Rejected';

  return (
    <span
      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
        isApproved
          ? 'bg-emerald-100 text-emerald-800'
          : isRejected
          ? 'bg-red-100 text-red-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      {normalized}
    </span>
  );
}