import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { submitTaxDeclaration } from '../assets/services/api';
import { supabase } from '../assets/services/supabaseClient';

const BARANGAYS_SAN_FERNANDO = [
  "Agtiwa", "Azarga", "Campalingo", "Canjalon", "España",
  "Mabini", "Mabulo", "Otod", "Panangcalan", "Pili", "Poblacion", "Taclobo"
];

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
    { classification: '', area: '', market_value: '', actual_use: '', assessment_level: '', assessed_value: '' },
    { classification: '', area: '', market_value: '', actual_use: '', assessment_level: '', assessed_value: '' },
    { classification: '', area: '', market_value: '', actual_use: '', assessment_level: '', assessed_value: '' },
    { classification: '', area: '', market_value: '', actual_use: '', assessment_level: '', assessed_value: '' }
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

// Helper: Format numbers with commas while preserving valid decimal entry
const formatNumberWithCommas = (value) => {
  if (!value && value !== 0) return '';

  const cleanStr = value.toString().replace(/[^0-9.]/g, '');
  const parts = cleanStr.split('.');

  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return parts.length > 1
    ? `${parts[0]}.${parts[1]}`
    : parts[0];
};

// Helper: Clean comma-formatted numbers for mathematical calculation
const parseFormattedNumber = (val) => {
  if (!val) return 0;

  const num = parseFloat(val.toString().replace(/,/g, ''));

  return isNaN(num) ? 0 : num;
};

/*
=========================================================
NUMBER TO WORDS
=========================================================
*/

const numberToWords = (number) => {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen'
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety'
  ];

  const convertHundreds = (num) => {
    let result = '';

    if (num >= 100) {
      result += `${ones[Math.floor(num / 100)]} Hundred`;
      num %= 100;

      if (num > 0) {
        result += ' ';
      }
    }

    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      num %= 10;

      if (num > 0) {
        result += `-${ones[num]}`;
      }
    } else if (num > 0) {
      result += ones[num];
    }

    return result;
  };

  const convertNumber = (num) => {
    if (num === 0) return 'Zero';

    let result = '';

    if (num >= 1000000000) {
      const billions = Math.floor(num / 1000000000);

      result += `${convertNumber(billions)} Billion`;
      num %= 1000000000;

      if (num > 0) {
        result += ' ';
      }
    }

    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);

      result += `${convertNumber(millions)} Million`;
      num %= 1000000;

      if (num > 0) {
        result += ' ';
      }
    }

    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);

      result += `${convertNumber(thousands)} Thousand`;
      num %= 1000;

      if (num > 0) {
        result += ' ';
      }
    }

    if (num > 0) {
      result += convertHundreds(num);
    }

    return result;
  };

  const numericValue = parseFloat(
    number?.toString().replace(/,/g, '')
  );

  if (isNaN(numericValue) || numericValue <= 0) {
    return '';
  }

  const roundedValue = Math.round(numericValue * 100) / 100;

  const wholeNumber = Math.floor(roundedValue);
  const decimalPart = Math.round(
    (roundedValue - wholeNumber) * 100
  );

  let words = convertNumber(wholeNumber);

  if (wholeNumber === 1) {
    words += ' Peso';
  } else {
    words += ' Pesos';
  }

  if (decimalPart > 0) {
    words += ` and ${convertNumber(decimalPart)} Centavos`;
  }

  words += ' Only';

  return words;
};

export default function TaxDeclarationForm({
  formData: initialFormData,
  handleRowChange: customHandleRowChange,
  handleChange: customHandleChange,
  onBackToHome,
  onSubmitRecord
}) {
  const navigate = useNavigate();

  const [submissionMode, setSubmissionMode] = useState('quick');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(
    () => initialFormData || DEFAULT_FORM_STATE
  );
  const [imagePreview, setImagePreview] = useState(null);

  // Sync state if initialFormData prop arrives asynchronously
  useEffect(() => {
    if (initialFormData) {
      setFormData(initialFormData);
    }
  }, [initialFormData]);

  // Clean up object URLs to prevent browser memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (e) => {
    if (customHandleChange) {
      customHandleChange(e);
    }

    const { name, value, type, checked } = e.target;

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }

    if (
      name === 'owner_telephone' ||
      name === 'administrator_telephone'
    ) {
      const sanitized = value
        .replace(/\D/g, '')
        .slice(0, 11);

      setFormData(prev => ({
        ...prev,
        [name]: sanitized
      }));

      return;
    }

    /*
    =====================================================
    AUTOMATIC TOTAL ASSESSED VALUE IN WORDS
    =====================================================
    */

    if (name === 'total_assessed_value') {
      const formatted = formatNumberWithCommas(value);

      const words = numberToWords(formatted);

      setFormData(prev => ({
        ...prev,
        total_assessed_value: formatted,
        total_assessed_value_words: words
      }));

      return;
    }

    if (
      name === 'total_market_value' ||
      name === 'previous_av'
    ) {
      const formatted = formatNumberWithCommas(value);

      setFormData(prev => ({
        ...prev,
        [name]: formatted
      }));

      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({
        ...prev,
        property_image: 'Please select a valid image file.'
      }));

      return;
    }

    // Optional size limit: 5 MB
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        property_image: 'Image must be smaller than 5 MB.'
      }));

      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const base64String = reader.result;

      setFormData(prev => ({
        ...prev,

        // Store the actual image data as a string
        property_image: base64String,
        document_image: base64String,
        image_url: base64String
      }));
    };

    reader.onerror = () => {
      setErrors(prev => ({
        ...prev,
        property_image: 'Failed to read the image.'
      }));
    };

    reader.readAsDataURL(file);

    // Preview
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(URL.createObjectURL(file));

    setErrors(prev => ({
      ...prev,
      property_image: null
    }));
  };

  const handleRowChange = (index, e) => {
    if (customHandleRowChange) {
      customHandleRowChange(index, e);
    }

    const { name, value } = e.target;

    const updatedRows = [
      ...(formData.assessment_rows || [])
    ];

    if (!updatedRows[index]) return;

    if (
      name === 'market_value' ||
      name === 'assessed_value'
    ) {
      updatedRows[index][name] =
        formatNumberWithCommas(value);
    } else {
      updatedRows[index][name] = value;
    }

    // Auto-compute total values from row items
    let calculatedTotalMV = 0;
    let calculatedTotalAV = 0;

    updatedRows.forEach((row) => {
      calculatedTotalMV += parseFormattedNumber(
        row.market_value
      );

      calculatedTotalAV += parseFormattedNumber(
        row.assessed_value
      );
    });

    /*
    =====================================================
    AUTOMATIC TOTAL ASSESSED VALUE IN WORDS
    =====================================================
    */

    const calculatedTotalAVFormatted =
      calculatedTotalAV > 0
        ? formatNumberWithCommas(
            calculatedTotalAV.toFixed(2)
          )
        : formData.total_assessed_value;

    const calculatedTotalAVWords =
      calculatedTotalAV > 0
        ? numberToWords(calculatedTotalAVFormatted)
        : formData.total_assessed_value_words;

    setFormData(prev => ({
      ...prev,
      assessment_rows: updatedRows,

      total_market_value:
        calculatedTotalMV > 0
          ? formatNumberWithCommas(
              calculatedTotalMV.toFixed(2)
            )
          : prev.total_market_value,

      total_assessed_value:
        calculatedTotalAV > 0
          ? calculatedTotalAVFormatted
          : prev.total_assessed_value,

      total_assessed_value_words:
        calculatedTotalAV > 0
          ? calculatedTotalAVWords
          : prev.total_assessed_value_words
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.td_no?.trim()) {
      newErrors.td_no = "TD No. is required.";
    }

    if (!formData.property_identification_no?.trim()) {
      newErrors.property_identification_no =
        "Property Identification No. is required.";
    }

    if (!formData.full_name?.trim()) {
      newErrors.full_name = "Full Name is required.";
    }

    if (submissionMode === 'quick') {
      if (!formData.location_barangay_district?.trim()) {
        newErrors.location_barangay_district =
          "Barangay is required for Quick Submit.";
      }

      if (
        !formData.property_image &&
        !formData.document_image &&
        !formData.image_url
      ) {
        newErrors.property_image =
          "Property image upload is required for Quick Submit.";
      }
    }

    if (submissionMode === 'full') {
      if (
        formData.owner_telephone &&
        formData.owner_telephone.length !== 11
      ) {
        newErrors.owner_telephone =
          "Owner's telephone must be exactly 11 digits.";
      }

      if (
        formData.administrator_telephone &&
        formData.administrator_telephone.length !== 11
      ) {
        newErrors.administrator_telephone =
          "Administrator's telephone must be exactly 11 digits.";
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous submit error
    setErrors(prev => ({
      ...prev,
      submit: null
    }));

    if (!validate()) {
      setErrors(prev => ({
        ...prev,
        submit: "Please fix the validation errors above."
      }));

      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authData } =
        await supabase.auth.getSession();

      const authenticatedUser =
        authData?.session?.user;

      if (!authenticatedUser) {
        setErrors(prev => ({
          ...prev,
          submit:
            'Your user session has expired. Please log in again.'
        }));

        navigate('/user-login', {
          replace: true
        });

        return;
      }

      const accountType =
        authenticatedUser.user_metadata?.account_type;

      if (
        accountType &&
        accountType !== 'property_owner'
      ) {
        setErrors(prev => ({
          ...prev,
          submit:
            'Only Property Owner accounts can submit a Tax Declaration.'
        }));

        return;
      }

      const mode =
        submissionMode === 'full'
          ? 'full'
          : 'quick';

      // FIX: Define isQuickSubmit here using your existing mode or state
      const isQuickSubmit = mode === 'quick';

      const submittedImage =
        formData.property_image ||
        formData.document_image ||
        formData.image_url ||
        null;

      /*
      =====================================================
      MAKE SURE TOTAL ASSESSED VALUE WORDS IS UPDATED
      BEFORE SUBMISSION
      =====================================================
      */

      const automaticAssessedValueWords =
        numberToWords(
          formData.total_assessed_value
        );

      const payload = {
        ...formData,

        // Automatically generated amount in words
        total_assessed_value_words:
          automaticAssessedValueWords ||
          formData.total_assessed_value_words ||
          '',

        // Property Owner Account
        submitted_by: authenticatedUser.id,
        submitted_by_email:
          authenticatedUser.email || '',

        // Identification
        id:
          formData.id ||
          `TD-${Date.now()}`,

        // Owner
        owner_name:
          mode === 'full'
            ? (
                formData.owner_name ||
                formData.full_name ||
                ''
              )
            : (
                formData.full_name ||
                formData.owner_name ||
                ''
              ),

        // IMPORTANT: single source of truth
        submission_mode: submissionMode,
        isQuickSubmit: isQuickSubmit,
        is_quick_submit: isQuickSubmit,
        quick_submit: isQuickSubmit,

        // Status
        verification_status: 'Pending',

        // Quick Submit image
        property_image:
          mode === 'quick'
            ? submittedImage
            : (formData.property_image || null),

        document_image:
          mode === 'quick'
            ? submittedImage
            : (formData.document_image || null),

        image_url:
          mode === 'quick'
            ? submittedImage
            : (formData.image_url || null),

        // Useful for dashboard
        submitted_at:
          new Date().toISOString()
      };

      console.log(
        `[TAX DECLARATION] ${mode.toUpperCase()} SUBMISSION`,
        payload
      );

      // =====================================================
      // SEND TO BACKEND
      // =====================================================

      const savedRecord =
        await submitTaxDeclaration(payload);

      console.log(
        '[TAX DECLARATION] BACKEND RESPONSE:',
        savedRecord
      );

      const finalRecord =
        savedRecord?.data ||
        savedRecord ||
        payload;

      // =====================================================
      // IMPORTANT:
      // Make sure returned record still has submission_mode
      // =====================================================

      const normalizedRecord = {
        ...payload,
        ...finalRecord,

        submission_mode:
          finalRecord?.submission_mode ||
          payload.submission_mode,

        isQuickSubmit:
          finalRecord?.isQuickSubmit ??
          payload.isQuickSubmit,

        is_quick_submit:
          finalRecord?.is_quick_submit ??
          payload.is_quick_submit,

        total_assessed_value_words:
          finalRecord?.total_assessed_value_words ||
          payload.total_assessed_value_words
      };

      console.log(
        '[TAX DECLARATION] FINAL NORMALIZED RECORD:',
        normalizedRecord
      );

      // =====================================================
      // UPDATE PARENT
      // =====================================================

      if (onSubmitRecord) {
        onSubmitRecord(normalizedRecord);
      }

      // =====================================================
      // SUCCESS
      // GO BACK TO PROPERTY OWNER USER DASHBOARD
      // =====================================================

      navigate('/user-dashboard', {
        replace: true,
        state: {
          submissionSuccess: true,
          redirectToNotice: true,
          message:
            mode === 'quick'
              ? 'Quick Tax Declaration submitted successfully! Please wait for audit and review.'
              : 'Full Tax Declaration submitted successfully! Please wait for audit and review.',
          submittedRecord: normalizedRecord
        }
      });

    } catch (error) {
      console.error(
        '[TAX DECLARATION] SUBMISSION FAILED:',
        error
      );

      const message =
        error?.message ||
        'Failed to submit tax declaration. Please make sure the server is running.';

      if (
        message
          .toLowerCase()
          .includes('td no.') &&
        message
          .toLowerCase()
          .includes('already exists')
      ) {
        setErrors(prev => ({
          ...prev,
          td_no: message,
          submit: null
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          submit: message
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
      record.is_quick_submit === true
    ) {
      return 'quick';
    }

    // Existing/legacy records
    return 'full';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-lg font-sans text-slate-900 border border-slate-200">

      <h2 className="text-xl font-bold text-center border-b pb-3 mb-4 uppercase tracking-wider text-blue-900">
        Tax Declaration of Real Property - LGU San Fernando, Romblon
      </h2>

      {/* Submission Mode Selection */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <label className="block text-xs font-bold uppercase text-slate-700 mb-2">
          Select Submission Option:
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          <button
            type="button"
            onClick={() => setSubmissionMode('quick')}
            className={`p-3 text-left rounded-lg border text-xs transition duration-200 ${
              submissionMode === 'quick'
                ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="font-bold uppercase">
              Quick Submit (Minimum Criteria)
            </div>

            <div
              className={`text-[10px] mt-1 ${
                submissionMode === 'quick'
                  ? 'text-blue-100'
                  : 'text-slate-500'
              }`}
            >
              Requires TD No., PIN, Full Name, Barangay, and Property Image.
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSubmissionMode('full')}
            className={`p-3 text-left rounded-lg border text-xs transition duration-200 ${
              submissionMode === 'full'
                ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="font-bold uppercase">
              Full Detail Form Entry
            </div>

            <div
              className={`text-[10px] mt-1 ${
                submissionMode === 'full'
                  ? 'text-blue-100'
                  : 'text-slate-500'
              }`}
            >
              Fill out complete property details and valuation assessment tables.
            </div>
          </button>

        </div>
      </div>

      {errors.submit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
          {errors.submit}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 text-sm"
        noValidate
      >

        {/* Identification Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded border border-slate-200">

          <div>
            <label className="block font-semibold mb-1 text-xs uppercase text-slate-600">
              TD No. *
            </label>

            <input
              type="text"
              name="td_no"
              value={formData.td_no || ''}
              onChange={handleChange}
              placeholder="e.g. TD-2026-001"
              className={`w-full border p-2 rounded bg-white text-xs ${
                errors.td_no
                  ? 'border-red-500'
                  : 'border-slate-300'
              }`}
            />

            {errors.td_no && (
              <p className="text-red-500 text-[10px] mt-1">
                {errors.td_no}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-1 text-xs uppercase text-slate-600">
              Property ID No. *
            </label>

            <input
              type="text"
              name="property_identification_no"
              value={formData.property_identification_no || ''}
              onChange={handleChange}
              placeholder="e.g. 048-01-002-03-001"
              className={`w-full border p-2 rounded bg-white text-xs ${
                errors.property_identification_no
                  ? 'border-red-500'
                  : 'border-slate-300'
              }`}
            />

            {errors.property_identification_no && (
              <p className="text-red-500 text-[10px] mt-1">
                {errors.property_identification_no}
              </p>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-1 text-xs uppercase text-slate-600">
              Full Name *
            </label>

            <input
              type="text"
              name="full_name"
              value={formData.full_name || ''}
              onChange={handleChange}
              placeholder="e.g. Juan A. Dela Cruz"
              className={`w-full border p-2 rounded bg-white text-xs ${
                errors.full_name
                  ? 'border-red-500'
                  : 'border-slate-300'
              }`}
            />

            {errors.full_name && (
              <p className="text-red-500 text-[10px] mt-1">
                {errors.full_name}
              </p>
            )}
          </div>

        </div>

        {/* Quick Submit Mode: Barangay and Image Upload */}
        {submissionMode === 'quick' && (
          <div className="border p-4 rounded space-y-4 bg-blue-50/50 border-blue-200">

            <div>
              <label className="block text-xs font-semibold uppercase text-blue-900 mb-1">
                Barangay Location *
              </label>

              <select
                name="location_barangay_district"
                value={formData.location_barangay_district || ''}
                onChange={handleChange}
                className={`w-full border p-2 rounded bg-white text-xs ${
                  errors.location_barangay_district
                    ? 'border-red-500'
                    : 'border-slate-300'
                }`}
              >
                <option value="">
                  -- Select Barangay --
                </option>

                {BARANGAYS_SAN_FERNANDO.map((bgy) => (
                  <option key={bgy} value={bgy}>
                    {bgy}
                  </option>
                ))}
              </select>

              {errors.location_barangay_district && (
                <p className="text-red-500 text-[10px] mt-1">
                  {errors.location_barangay_district}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-blue-900 mb-1">
                Telephone No. (11 Digits)
              </label>

              <input
                type="text"
                name="owner_telephone"
                value={formData.owner_telephone || ''}
                onChange={handleChange}
                placeholder="09123456789"
                maxLength="11"
                className={`w-full border p-2 rounded bg-white text-xs ${
                  errors.owner_telephone
                    ? 'border-red-500'
                    : 'border-slate-300'
                }`}
              />

              {errors.owner_telephone && (
                <p className="text-red-500 text-[10px] mt-1">
                  {errors.owner_telephone}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-blue-900 mb-1">
                Upload Property Image *
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className={`w-full border p-2 rounded bg-white text-xs file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-900 file:text-white hover:file:bg-blue-800 ${
                  errors.property_image
                    ? 'border-red-500'
                    : 'border-slate-300'
                }`}
              />

              <span className="block text-[10px] text-slate-500 mt-1">
                Please upload a valid property image file so it can be previewed seamlessly in the admin dashboard review panel.
              </span>

              {errors.property_image && (
                <p className="text-red-500 text-[10px] mt-1">
                  {errors.property_image}
                </p>
              )}

              {imagePreview && (
                <div className="mt-2">
                  <span className="block text-xs font-semibold text-slate-600 mb-1">
                    Image Preview:
                  </span>

                  <img
                    src={imagePreview}
                    alt="Property Preview"
                    className="h-32 object-contain rounded border bg-white p-1 shadow-sm"
                  />
                </div>
              )}
            </div>

          </div>
        )}

        {/* Full Submit Mode Sections */}
        {submissionMode === 'full' && (
          <div className="space-y-6">

            {/* Owner Info */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                <div className="md:col-span-8">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Owner
                  </label>

                  <input
                    type="text"
                    name="owner_name"
                    value={
                      formData.owner_name ||
                      formData.full_name ||
                      ''
                    }
                    onChange={handleChange}
                    placeholder="e.g. Juan Dela Cruz"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    TIN
                  </label>

                  <input
                    type="text"
                    name="owner_tin"
                    value={formData.owner_tin || ''}
                    onChange={handleChange}
                    placeholder="e.g. 123-456-789-000"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                <div className="md:col-span-8">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Address
                  </label>

                  <input
                    type="text"
                    name="owner_address"
                    value={formData.owner_address || ''}
                    onChange={handleChange}
                    placeholder="e.g. Purok Mahusay, Poblacion, San Fernando, Romblon"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Telephone No. (11 Digits)
                  </label>

                  <input
                    type="text"
                    name="owner_telephone"
                    value={formData.owner_telephone || ''}
                    onChange={handleChange}
                    placeholder="09123456789"
                    maxLength="11"
                    className={`w-full border p-2 rounded text-xs ${
                      errors.owner_telephone
                        ? 'border-red-500'
                        : 'border-slate-300'
                    }`}
                  />

                  {errors.owner_telephone && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.owner_telephone}
                    </p>
                  )}
                </div>

              </div>

            </div>

            {/* Administrator Info */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                <div className="md:col-span-8">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Administrator / Beneficial User
                  </label>

                  <input
                    type="text"
                    name="administrator_name"
                    value={formData.administrator_name || ''}
                    onChange={handleChange}
                    placeholder="e.g. Maria Santos"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    TIN
                  </label>

                  <input
                    type="text"
                    name="administrator_tin"
                    value={formData.administrator_tin || ''}
                    onChange={handleChange}
                    placeholder="e.g. 987-654-321-000"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

                <div className="md:col-span-8">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Address
                  </label>

                  <input
                    type="text"
                    name="administrator_address"
                    value={formData.administrator_address || ''}
                    onChange={handleChange}
                    placeholder="e.g. Brgy. España, San Fernando, Romblon"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Telephone No. (11 Digits)
                  </label>

                  <input
                    type="text"
                    name="administrator_telephone"
                    value={formData.administrator_telephone || ''}
                    onChange={handleChange}
                    placeholder="09987654321"
                    maxLength="11"
                    className={`w-full border p-2 rounded text-xs ${
                      errors.administrator_telephone
                        ? 'border-red-500'
                        : 'border-slate-300'
                    }`}
                  />

                  {errors.administrator_telephone && (
                    <p className="text-red-500 text-[10px] mt-1">
                      {errors.administrator_telephone}
                    </p>
                  )}
                </div>

              </div>

            </div>

            {/* Location Section */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Location of Property
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                <div>
                  <input
                    type="text"
                    name="location_number_street"
                    value={formData.location_number_street || ''}
                    onChange={handleChange}
                    placeholder="e.g. National Road"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />

                  <span className="block text-[10px] text-slate-500 mt-1 text-center">
                    (Number and Street)
                  </span>
                </div>

                <div>
                  <select
                    name="location_barangay_district"
                    value={formData.location_barangay_district || ''}
                    onChange={handleChange}
                    className="w-full border border-slate-300 p-2 rounded bg-white text-xs"
                  >
                    <option value="">
                      -- Select Barangay --
                    </option>

                    {BARANGAYS_SAN_FERNANDO.map((bgy) => (
                      <option key={bgy} value={bgy}>
                        {bgy}
                      </option>
                    ))}
                  </select>

                  <span className="block text-[10px] text-slate-500 mt-1 text-center">
                    (Barangay - San Fernando)
                  </span>
                </div>

                <div>
                  <input
                    type="text"
                    name="location_municipality_province_city"
                    value={
                      formData.location_municipality_province_city || ''
                    }
                    onChange={handleChange}
                    placeholder="San Fernando, Romblon"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />

                  <span className="block text-[10px] text-slate-500 mt-1 text-center">
                    (Municipality & Province / City)
                  </span>
                </div>

              </div>
            </div>

            {/* Cadastral / Title Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded bg-white border-slate-200">

              <div className="space-y-3">

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    OCT/TCT/CLOA No.
                  </label>

                  <input
                    type="text"
                    name="oct_tct_cloa_no"
                    value={formData.oct_tct_cloa_no || ''}
                    onChange={handleChange}
                    placeholder="e.g. OCT-12345"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    CCT No.
                  </label>

                  <input
                    type="text"
                    name="cct_no"
                    value={formData.cct_no || ''}
                    onChange={handleChange}
                    placeholder="e.g. CCT-987"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Dated
                  </label>

                  <input
                    type="date"
                    name="dated"
                    value={formData.dated || ''}
                    onChange={handleChange}
                    className="w-full border border-slate-300 p-2 rounded text-xs bg-white"
                  />
                </div>

              </div>

              <div className="space-y-3">

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Survey No.
                  </label>

                  <input
                    type="text"
                    name="survey_no"
                    value={formData.survey_no || ''}
                    onChange={handleChange}
                    placeholder="e.g. Cad-123"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Lot No.
                    </label>

                    <input
                      type="text"
                      name="lot_no"
                      value={formData.lot_no || ''}
                      onChange={handleChange}
                      placeholder="e.g. 45"
                      className="w-full border border-slate-300 p-2 rounded text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                      Blk No.
                    </label>

                    <input
                      type="text"
                      name="blk_no"
                      value={formData.blk_no || ''}
                      onChange={handleChange}
                      placeholder="e.g. 12"
                      className="w-full border border-slate-300 p-2 rounded text-xs"
                    />
                  </div>

                </div>

              </div>

            </div>

            {/* Boundaries */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Boundaries
              </label>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">
                    North
                  </label>

                  <input
                    type="text"
                    name="boundary_north"
                    value={formData.boundary_north || ''}
                    onChange={handleChange}
                    placeholder="Lot 101"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">
                    South
                  </label>

                  <input
                    type="text"
                    name="boundary_south"
                    value={formData.boundary_south || ''}
                    onChange={handleChange}
                    placeholder="Road"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">
                    East
                  </label>

                  <input
                    type="text"
                    name="boundary_east"
                    value={formData.boundary_east || ''}
                    onChange={handleChange}
                    placeholder="Creek"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase mb-1">
                    West
                  </label>

                  <input
                    type="text"
                    name="boundary_west"
                    value={formData.boundary_west || ''}
                    onChange={handleChange}
                    placeholder="Lot 103"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

              </div>
            </div>

            {/* Property Type / Kind */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Kind of Property Assessed
              </label>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">

                <label className="flex items-center gap-2 cursor-pointer">

                  <input
                    type="checkbox"
                    name="is_land"
                    checked={!!formData.is_land}
                    onChange={handleChange}
                    className="rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                  />

                  <span>Land</span>
                </label>

                <div className="space-y-1">

                  <label className="flex items-center gap-2 cursor-pointer">

                    <input
                      type="checkbox"
                      name="is_building"
                      checked={!!formData.is_building}
                      onChange={handleChange}
                      className="rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                    />

                    <span>Building</span>
                  </label>

                  {formData.is_building && (
                    <div className="pl-6 space-y-1">

                      <input
                        type="text"
                        name="building_no_of_storeys"
                        value={
                          formData.building_no_of_storeys || ''
                        }
                        onChange={handleChange}
                        placeholder="No. of Storeys"
                        className="w-full border border-slate-300 p-1 rounded text-xs"
                      />

                      <input
                        type="text"
                        name="building_brief_description"
                        value={
                          formData.building_brief_description || ''
                        }
                        onChange={handleChange}
                        placeholder="Brief Description"
                        className="w-full border border-slate-300 p-1 rounded text-xs"
                      />

                    </div>
                  )}
                </div>

                <div className="space-y-1">

                  <label className="flex items-center gap-2 cursor-pointer">

                    <input
                      type="checkbox"
                      name="is_machinery"
                      checked={!!formData.is_machinery}
                      onChange={handleChange}
                      className="rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                    />

                    <span>Machinery</span>
                  </label>

                  {formData.is_machinery && (
                    <div className="pl-6">

                      <input
                        type="text"
                        name="machinery_brief_description"
                        value={
                          formData.machinery_brief_description || ''
                        }
                        onChange={handleChange}
                        placeholder="Brief Description"
                        className="w-full border border-slate-300 p-1 rounded text-xs"
                      />

                    </div>
                  )}
                </div>

                <div className="space-y-1">

                  <label className="flex items-center gap-2 cursor-pointer">

                    <input
                      type="checkbox"
                      name="is_others"
                      checked={!!formData.is_others}
                      onChange={handleChange}
                      className="rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                    />

                    <span>Others</span>
                  </label>

                  {formData.is_others && (
                    <div className="pl-6">

                      <input
                        type="text"
                        name="others_specify"
                        value={formData.others_specify || ''}
                        onChange={handleChange}
                        placeholder="Specify"
                        className="w-full border border-slate-300 p-1 rounded text-xs"
                      />

                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Assessment Table Section */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Kind of Property Assessed - Assessment Table
              </label>

              <div className="overflow-x-auto">

                <table className="w-full text-left text-xs border-collapse">

                  <thead>
                    <tr className="bg-slate-100 border-b text-slate-700 uppercase text-[10px]">

                      <th className="p-2 border">
                        Classification
                      </th>

                      <th className="p-2 border">
                        Area
                      </th>

                      <th className="p-2 border">
                        Market Value (₱)
                      </th>

                      <th className="p-2 border">
                        Actual Use
                      </th>

                      <th className="p-2 border">
                        Assessment Level (%)
                      </th>

                      <th className="p-2 border">
                        Assessed Value (₱)
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {(formData.assessment_rows || []).map(
                      (row, idx) => (
                        <tr
                          key={idx}
                          className="border-b"
                        >

                          <td className="p-1 border">

                            <input
                              type="text"
                              name="classification"
                              value={
                                row.classification || ''
                              }
                              onChange={(e) =>
                                handleRowChange(idx, e)
                              }
                              placeholder="e.g. Residential"
                              className="w-full border-0 p-1 text-xs focus:ring-1 focus:ring-blue-800 bg-transparent"
                            />

                          </td>

                          <td className="p-1 border">

                            <input
                              type="text"
                              name="area"
                              value={row.area || ''}
                              onChange={(e) =>
                                handleRowChange(idx, e)
                              }
                              placeholder="0.00"
                              className="w-full border-0 p-1 text-xs focus:ring-1 focus:ring-blue-800 bg-transparent"
                            />

                          </td>

                          <td className="p-1 border">

                            <input
                              type="text"
                              name="market_value"
                              value={row.market_value || ''}
                              onChange={(e) =>
                                handleRowChange(idx, e)
                              }
                              placeholder="0.00"
                              className="w-full border-0 p-1 text-xs focus:ring-1 focus:ring-blue-800 bg-transparent"
                            />

                          </td>

                          <td className="p-1 border">

                            <input
                              type="text"
                              name="actual_use"
                              value={row.actual_use || ''}
                              onChange={(e) =>
                                handleRowChange(idx, e)
                              }
                              placeholder="Residential"
                              className="w-full border-0 p-1 text-xs focus:ring-1 focus:ring-blue-800 bg-transparent"
                            />

                          </td>

                          <td className="p-1 border">

                            <input
                              type="text"
                              name="assessment_level"
                              value={
                                row.assessment_level || ''
                              }
                              onChange={(e) =>
                                handleRowChange(idx, e)
                              }
                              placeholder="20"
                              className="w-full border-0 p-1 text-xs focus:ring-1 focus:ring-blue-800 bg-transparent"
                            />

                          </td>

                          <td className="p-1 border">

                            <input
                              type="text"
                              name="assessed_value"
                              value={
                                row.assessed_value || ''
                              }
                              onChange={(e) =>
                                handleRowChange(idx, e)
                              }
                              placeholder="0.00"
                              className="w-full border-0 p-1 text-xs focus:ring-1 focus:ring-blue-800 bg-transparent font-bold"
                            />

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>
              </div>
            </div>

            {/* Total Valuation & Taxability Status */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Total Market Value (₱)
                  </label>

                  <input
                    type="text"
                    name="total_market_value"
                    value={formData.total_market_value || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Total Assessed Value (₱)
                  </label>

                  <input
                    type="text"
                    name="total_assessed_value"
                    value={formData.total_assessed_value || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full border border-slate-300 p-2 rounded text-xs font-bold text-blue-900"
                  />
                </div>

              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Total Assessed Value (Amount in Words)
                </label>

                <input
                  type="text"
                  name="total_assessed_value_words"
                  value={
                    formData.total_assessed_value_words || ''
                  }
                  readOnly
                  placeholder="Automatically generated from Total Assessed Value"
                  className="w-full border border-slate-300 p-2 rounded text-xs bg-slate-50 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Taxability Status
                  </label>

                  <select
                    name="taxability_status"
                    value={
                      formData.taxability_status || 'Taxable'
                    }
                    onChange={handleChange}
                    className="w-full border border-slate-300 p-2 rounded bg-white text-xs"
                  >
                    <option value="Taxable">
                      Taxable
                    </option>

                    <option value="Exempt">
                      Exempt
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Effectivity Quarter
                  </label>

                  <input
                    type="text"
                    name="effectivity_qtr"
                    value={formData.effectivity_qtr || ''}
                    onChange={handleChange}
                    placeholder="e.g. 1st Qtr"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Effectivity Year
                  </label>

                  <input
                    type="text"
                    name="effectivity_yr"
                    value={formData.effectivity_yr || ''}
                    onChange={handleChange}
                    placeholder="2026"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

              </div>
            </div>

            {/* Approval & Memorandum Section */}
            <div className="border p-4 rounded space-y-3 bg-white border-slate-200">

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Approved By (Assessor)
                  </label>

                  <input
                    type="text"
                    name="approved_by"
                    value={formData.approved_by || ''}
                    onChange={handleChange}
                    placeholder="Provincial/City/Municipal Assessor"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Approval Date
                  </label>

                  <input
                    type="date"
                    name="approval_date"
                    value={formData.approval_date || ''}
                    onChange={handleChange}
                    className="w-full border border-slate-300 p-2 rounded text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Previous Assessed Value (₱)
                  </label>

                  <input
                    type="text"
                    name="previous_av"
                    value={formData.previous_av || ''}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full border border-slate-300 p-2 rounded text-xs"
                  />
                </div>

              </div>

              <div>

                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Cancels TD No. & Memoranda / Notes
                </label>

                <input
                  type="text"
                  name="cancels_td_no"
                  value={formData.cancels_td_no || ''}
                  onChange={handleChange}
                  placeholder="This declaration cancels TD No..."
                  className="w-full border border-slate-300 p-2 rounded text-xs mb-2"
                />

                <textarea
                  name="memoranda"
                  value={formData.memoranda || ''}
                  onChange={handleChange}
                  placeholder="Enter memoranda notes, previous owner reference, or notary details..."
                  rows="3"
                  className="w-full border border-slate-300 p-2 rounded text-xs"
                />

              </div>

            </div>

          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">

          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-2 rounded-lg text-xs font-semibold transition shadow"
          >
            {isSubmitting
              ? 'Submitting Tax Declaration...'
              : 'Submit Tax Declaration'}
          </button>

        </div>

      </form>
    </div>
  );
}