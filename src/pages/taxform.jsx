import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  fetchTaxDeclarations,
  updateVerificationStatus,
} from '../assets/services/api';

/* =========================================================
   DEFAULT FORM STATE
========================================================= */

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
  location_municipality_province_city:
    'San Fernando, Romblon',

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
      assessed_value: '',
    },
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: '',
    },
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: '',
    },
    {
      classification: '',
      area: '',
      market_value: '',
      actual_use: '',
      assessment_level: '',
      assessed_value: '',
    },
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
  image_url: null,
  file_path: null,
};

/* =========================================================
   ENVIRONMENT
========================================================= */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || '';

const STORAGE_BUCKET =
  import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ||
  'tax-declarations';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000/api'; 
 
const BACKEND_BASE_URL = 
  API_BASE_URL.replace(/\/api\/?$/, ''); 
 
/* ========================================================= 
   SAFE HELPERS 
========================================================= */ 
 
const isValidString = (value) => { 
  return ( 
    typeof value === 'string' && 
    value.trim() !== '' && 
    value !== 'null' && 
    value !== 'undefined' && 
    value !== '[object Object]' 
  ); 
}; 
 
/* ========================================================= 
   ASSESSMENT ROW PARSER 
========================================================= */ 
 
const parseAssessmentRows = (rowsData) => { 
  let parsedRows = rowsData; 
 
  if (typeof parsedRows === 'string') { 
    try { 
      parsedRows = JSON.parse(parsedRows); 
    } catch { 
      parsedRows = []; 
    } 
  } 
 
  if (!Array.isArray(parsedRows)) { 
    parsedRows = []; 
  } 
 
  return parsedRows; 
}; 
 
/* ========================================================= 
   RECORD ID HELPER 
========================================================= */ 
 
const getRecordId = (record) => { 
  if (!record) { 
    return null; 
  } 
 
  return ( 
    record.id || 
    record.record_id || 
    record.td_no || 
    null 
  ); 
}; 
 
/* ========================================================= 
   APPROVED RECORD CHECK 
========================================================= */ 
 
/* 
 * IMPORTANT: 
 * 
 * Dashboard hiding is NOT the same as database deletion. 
 * 
 * This function determines whether a database record 
 * should appear in Tax Form Manager. 
 */ 
 
const isApprovedRecord = (record) => { 
  if (!record || typeof record !== 'object') { 
    return false; 
  } 
 
  const possibleStatuses = [ 
    record.verification_status, 
    record.verificationStatus, 
    record.status, 
  ]; 
 
  /* 
   * If the record has a status, require it to be Approved 
   * or Passed. 
   */ 
  const status = possibleStatuses.find( 
    (value) => 
      value !== null && 
      value !== undefined && 
      String(value).trim() !== '' 
  ); 
 
  /* 
   * Some older records may not have a status field. 
   * 
   * If there is no status at all, do NOT automatically 
   * throw them away here. They may be legacy approved 
   * records. 
   */ 
  if (!status) { 
    return true; 
  } 
 
  const normalized = String(status) 
    .trim() 
    .toLowerCase(); 
 
  return ( 
    normalized === 'approved' || 
    normalized === 'passed' 
  ); 
}; 
 
/* ========================================================= 
   SUPABASE PUBLIC URL 
========================================================= */ 
 
const getSupabasePublicUrl = (path) => { 
  if (!isValidString(path)) { 
    return null; 
  } 
 
  const cleanPath = path.trim(); 
 
  if ( 
    cleanPath.startsWith('http://') || 
    cleanPath.startsWith('https://') 
  ) { 
    return cleanPath; 
  } 
 
  if (cleanPath.startsWith('data:image/')) { 
    return cleanPath; 
  } 
 
  if (!SUPABASE_URL) { 
    return null; 
  } 
 
  const normalizedPath = cleanPath 
    .replace(/^\/+/, '') 
    .replace( 
      /^storage\/v1\/object\/public\//, 
      '' 
    ); 
 
  if ( 
    normalizedPath.startsWith( 
      `${STORAGE_BUCKET}/` 
    ) 
  ) { 
    const storagePath = 
      normalizedPath.substring( 
        STORAGE_BUCKET.length + 1 
      ); 
 
    return ( 
      `${SUPABASE_URL}/storage/v1/object/public/` + 
      `${STORAGE_BUCKET}/${storagePath}` 
    ); 
  } 
 
  if ( 
    normalizedPath.startsWith( 
      'tax-declarations/' 
    ) 
  ) { 
    return ( 
      `${SUPABASE_URL}/storage/v1/object/public/` + 
      `${STORAGE_BUCKET}/${normalizedPath}` 
    ); 
  } 
 
  return ( 
    `${SUPABASE_URL}/storage/v1/object/public/` + 
    `${STORAGE_BUCKET}/${normalizedPath}` 
  ); 
}; 
 
/* ========================================================= 
   IMAGE URL RESOLVER 
========================================================= */ 
 
const getImageUrl = (image) => { 
  if (!image) { 
    return null; 
  } 
 
  if (typeof image === 'object') { 
    if (isValidString(image.url)) { 
      return getImageUrl(image.url); 
    } 
 
    if (isValidString(image.publicUrl)) { 
      return getImageUrl(image.publicUrl); 
    } 
 
    if (isValidString(image.public_url)) { 
      return getImageUrl(image.public_url); 
    } 
 
    if (isValidString(image.image_url)) { 
      return getImageUrl(image.image_url); 
    } 
 
    if (isValidString(image.property_image)) { 
      return getImageUrl(image.property_image); 
    } 
 
    if (isValidString(image.file_path)) { 
      return getImageUrl(image.file_path); 
    } 
 
    if (isValidString(image.path)) { 
      return getImageUrl(image.path); 
    } 
 
    if (image.data) { 
      return getImageUrl(image.data); 
    } 
 
    return null; 
  } 
 
  if (typeof image !== 'string') { 
    return null; 
  } 
 
  let value = image.trim(); 
 
  if (!value) { 
    return null; 
  } 
 
  if ( 
    value === 'null' || 
    value === 'undefined' || 
    value === '[object Object]' 
  ) { 
    return null; 
  } 
 
  if (value.startsWith('data:image/')) { 
    return value; 
  } 
 
  const looksLikeBase64 = 
    value.length > 100 && 
    /^[A-Za-z0-9+/]+={0,2}$/.test(value); 
 
  if (looksLikeBase64) { 
    if (value.startsWith('/9j/')) { 
      return `data:image/jpeg;base64,${value}`; 
    } 
 
    if (value.startsWith('iVBORw0KGgo')) { 
      return `data:image/png;base64,${value}`; 
    } 
 
    if (value.startsWith('R0lGOD')) { 
      return `data:image/gif;base64,${value}`; 
    } 
 
    if (value.startsWith('UklGR')) { 
      return `data:image/webp;base64,${value}`; 
    } 
  } 
 
  if ( 
    value.startsWith('http://') || 
    value.startsWith('https://') 
  ) { 
    return value; 
  } 
 
  const supabaseUrl = 
    getSupabasePublicUrl(value); 
 
  if (supabaseUrl) { 
    return supabaseUrl; 
  } 
 
  value = value.replace(/\\/g, '/'); 
 
  if (value.startsWith('/uploads/')) { 
    return `${BACKEND_BASE_URL}${value}`; 
  } 
 
  if (value.startsWith('uploads/')) { 
    return `${BACKEND_BASE_URL}/${value}`; 
  } 
 
  if (value.startsWith('/')) { 
    return `${BACKEND_BASE_URL}${value}`; 
  } 
 
  if (!value.includes('/')) { 
    return ( 
      `${BACKEND_BASE_URL}/uploads/` + 
      encodeURIComponent(value) 
    ); 
  } 
 
  return `${BACKEND_BASE_URL}/${value}`; 
}; 
 
/* ========================================================= 
   FIND RECORD IMAGE 
========================================================= */ 
 
const getRecordImage = (record) => { 
  if (!record || typeof record !== 'object') { 
    return null; 
  } 
 
  const candidates = [ 
    record.property_image, 
    record.image_url, 
    record.document_image, 
    record.file_path, 
    record.attachment, 
    record.photo, 
    record.image, 
  ]; 
 
  for (const candidate of candidates) { 
    const url = getImageUrl(candidate); 
 
    if (url) { 
      return url; 
    } 
  } 
 
  if ( 
    record.data && 
    typeof record.data === 'object' 
  ) { 
    return getRecordImage(record.data); 
  } 
 
  return null; 
}; 
 
/* ========================================================= 
   NORMALIZE API RESPONSE 
========================================================= */ 
 
const extractRecordsFromResponse = ( 
  response 
) => { 
  if (!response) { 
    return []; 
  } 
 
  if (Array.isArray(response)) { 
    return response; 
  } 
 
  if (Array.isArray(response.data)) { 
    return response.data; 
  } 
 
  if (Array.isArray(response.records)) { 
    return response.records; 
  } 
 
  if ( 
    response.data && 
    Array.isArray(response.data.records) 
  ) { 
    return response.data.records; 
  } 
 
  return []; 
}; 
 
/* ========================================================= 
   UNIQUE RECORD KEY 
========================================================= */ 
 
const getRecordKey = (record) => { 
  if (!record) { 
    return null; 
  } 
 
  if ( 
    record.id !== undefined && 
    record.id !== null && 
    String(record.id).trim() !== '' 
  ) { 
    return `id:${record.id}`; 
  } 
 
  if ( 
    record.record_id !== undefined && 
    record.record_id !== null && 
    String(record.record_id).trim() !== '' 
  ) { 
    return `record:${record.record_id}`; 
  } 
 
  if (isValidString(record.td_no)) { 
    return `td:${record.td_no 
      .trim() 
      .toLowerCase()}`; 
  } 
 
  if ( 
    isValidString( 
      record.property_identification_no 
    ) 
  ) { 
    return `pin:${record.property_identification_no 
      .trim() 
      .toLowerCase()}`; 
  } 
 
  return null; 
}; 
 
/* ========================================================= 
   MERGE RECORDS 
========================================================= */ 
 
const mergeRecords = ( 
  existingRecords, 
  incomingRecords 
) => { 
  const map = new Map(); 
 
  const addRecords = (records) => { 
    if (!Array.isArray(records)) { 
      return; 
    } 
 
    records.forEach((record) => { 
      if ( 
        !record || 
        typeof record !== 'object' 
      ) { 
        return; 
      } 
 
      const key = getRecordKey(record); 
 
      if (!key) { 
        return; 
      } 
 
      const existing = map.get(key); 
 
      map.set(key, { 
        ...(existing || {}), 
        ...record, 
      }); 
    }); 
  }; 
 
  addRecords(existingRecords); 
  addRecords(incomingRecords); 
 
  return Array.from(map.values()); 
}; 
 
/* ========================================================= 
   COMPONENT 
========================================================= */ 
 
export default function TaxFormManager({ 
  records = [], 
  onUpdateRecord, 
  onDeleteRecord, 
  onBackToDashboard, 
}) { 
  /* 
   * IMPORTANT: 
   * 
   * managerRecords is completely independent from the 
   * Dashboard's hidden-record list. 
   */ 
 
  const [managerRecords, setManagerRecords] = 
    useState([]); 
 
  const [loading, setLoading] = 
    useState(false); 
 
  const [loadingRecords, setLoadingRecords] = 
    useState(false); 
 
  const [loadError, setLoadError] = 
    useState(''); 
 
  const [searchTerm, setSearchTerm] = 
    useState(''); 
 
  const [editingRecord, setEditingRecord] = 
    useState(null); 
 
  const [viewingRecord, setViewingRecord] = 
    useState(null); 
 
  const [editFormData, setEditFormData] = 
    useState(DEFAULT_FORM_STATE); 
 
  const [ 
    viewingImageModal, 
    setViewingImageModal, 
  ] = useState(null); 
 
  const [imageZoom, setImageZoom] = 
    useState(1); 
 
  const [imageRotation, setImageRotation] = 
    useState(0); 
 
  const [imagePosition, setImagePosition] = 
    useState({ 
      x: 0, 
      y: 0, 
    }); 
 
  const [isDraggingImage, setIsDraggingImage] = 
    useState(false); 
 
  const [dragStart, setDragStart] = 
    useState({ 
      x: 0, 
      y: 0, 
    }); 
 
  const [activeTab, setActiveTab] = 
    useState('records'); 
 
  /* ======================================================= 
     LOAD APPROVED RECORDS DIRECTLY FROM DATABASE 
  ======================================================= */ 
 
  const loadManagerRecords = useCallback( 
    async () => { 
      setLoadingRecords(true); 
      setLoadError(''); 
 
      try { 
        /* 
         * IMPORTANT: 
         * 
         * We intentionally do NOT use the Dashboard's 
         * filtered records here. 
         * 
         * We request records directly from the API. 
         */ 
        const response = 
          await fetchTaxDeclarations(); 
 
        const databaseRecords = 
          extractRecordsFromResponse( 
            response 
          ); 
 
        /* 
         * Only approved records belong in this Manager. 
         * 
         * Dashboard hidden IDs are NOT checked here. 
         */ 
        const approvedRecords = 
          databaseRecords.filter( 
            isApprovedRecord 
          ); 
 
        setManagerRecords( 
          approvedRecords 
        ); 
      } catch (error) { 
        console.error( 
          'Failed to load approved tax records:', 
          error 
        ); 
 
        setLoadError( 
          error?.message || 
            'Unable to load approved tax records from the database.' 
        ); 
 
        /* 
         * Do not destroy currently displayed records 
         * if refreshing fails. 
         */ 
      } finally { 
        setLoadingRecords(false); 
      } 
    }, 
    [] 
  ); 
 
  /* ======================================================= 
     INITIAL DATABASE LOAD 
  ======================================================= */ 
 
  useEffect(() => { 
    loadManagerRecords(); 
  }, [loadManagerRecords]); 
 
  /* ======================================================= 
     OPTIONAL PARENT RECORD SYNC 
      
     IMPORTANT: 
      
     We DO NOT replace managerRecords with the parent's 
     records. 
      
     This prevents Dashboard hiding from removing records 
     from Tax Form Manager. 
  ======================================================= */ 
 
  useEffect(() => { 
    if (!Array.isArray(records)) { 
      return; 
    } 
 
    if (records.length === 0) { 
      return; 
    } 
 
    const approvedParentRecords = 
      records.filter( 
        isApprovedRecord 
      ); 
 
    if (approvedParentRecords.length === 0) { 
      return; 
    } 
 
    setManagerRecords((previous) => 
      mergeRecords( 
        previous, 
        approvedParentRecords 
      ) 
    ); 
  }, [records]); 
 
  /* ======================================================= 
     SAFE RECORDS 
  ======================================================= */ 
 
  const safeRecords = 
    Array.isArray(managerRecords) 
      ? managerRecords 
      : []; 
 
  /* ======================================================= 
     ANALYTICS 
  ======================================================= */ 
 
  const analytics = useMemo(() => { 
    const total = safeRecords.length; 
 
    const parseMoney = (value) => { 
      if ( 
        value === null || 
        value === undefined || 
        value === '' 
      ) { 
        return 0; 
      } 
 
      const num = parseFloat( 
        String(value).replace(/,/g, '') 
      ); 
 
      return Number.isNaN(num) 
        ? 0 
        : num; 
    }; 
 
    let totalAssessedValue = 0; 
    let totalMarketValue = 0; 
 
    const barangayCounts = {}; 
 
    const taxabilityCounts = { 
      Taxable: 0, 
      Exempt: 0, 
    }; 
 
    let quickSubmitCount = 0; 
    let fullDetailCount = 0; 
 
    safeRecords.forEach((record) => { 
      totalAssessedValue += 
        parseMoney( 
          record.total_assessed_value 
        ); 
 
      totalMarketValue += 
        parseMoney( 
          record.total_market_value 
        ); 
 
      const barangay = 
        record.location_barangay_district || 
        'Unspecified'; 
 
      barangayCounts[barangay] = 
        (barangayCounts[barangay] || 0) + 
        1; 
 
      const status = 
        record.taxability_status || 
        'Taxable'; 
 
      taxabilityCounts[status] = 
        (taxabilityCounts[status] || 0) + 
        1; 
 
      const imageUrl = 
        getRecordImage(record); 
 
      if (imageUrl) { 
        quickSubmitCount += 1; 
      } else { 
        fullDetailCount += 1; 
      } 
    }); 
 
    const topBarangays = 
      Object.entries(barangayCounts) 
        .sort((a, b) => b[1] - a[1]) 
        .slice(0, 5); 
 
    return { 
      total, 
      totalAssessedValue, 
      totalMarketValue, 
 
      averageAssessedValue: 
        total > 0 
          ? totalAssessedValue / total 
          : 0, 
 
      taxabilityCounts, 
      quickSubmitCount, 
      fullDetailCount, 
      topBarangays, 
 
      barangayCount: 
        Object.keys(barangayCounts) 
          .length, 
    }; 
  }, [safeRecords]); 
 
  /* ======================================================= 
     CURRENCY 
  ======================================================= */ 
 
  const formatCurrency = (num) => 
    Number(num || 0).toLocaleString( 
      'en-PH', 
      { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2, 
      } 
    ); 
 
  /* ======================================================= 
     SEARCH 
  ======================================================= */ 
 
  const normalizedSearch = 
    searchTerm 
      .trim() 
      .toLowerCase(); 
 
  const filteredRecords = 
    safeRecords.filter((record) => { 
      if (!normalizedSearch) { 
        return true; 
      } 
 
      return [ 
        record.td_no, 
        record.owner_name, 
        record.full_name, 
        record.location_barangay_district, 
        record.property_identification_no, 
      ].some( 
        (value) => 
          value && 
          String(value) 
            .toLowerCase() 
            .includes( 
              normalizedSearch 
            ) 
      ); 
    }); 
 
  /* ======================================================= 
     VIEW 
  ======================================================= */ 
 
  const handleViewClick = (record) => { 
    setViewingRecord({ 
      ...record, 
 
      assessment_rows: 
        parseAssessmentRows( 
          record.assessment_rows 
        ), 
    }); 
  }; 
 
  /* ======================================================= 
     EDIT 
  ======================================================= */ 
 
  const handleEditClick = (record) => { 
    const imageUrl = 
      getRecordImage(record); 
 
    /* 
     * Quick Submit/image records are read-only. 
     */ 
    if (imageUrl) { 
      return; 
    } 
 
    setEditingRecord(record); 
 
    setEditFormData({ 
      ...DEFAULT_FORM_STATE, 
      ...record, 
 
      assessment_rows: 
        parseAssessmentRows( 
          record.assessment_rows 
        ), 
    }); 
  }; 
 
  /* ======================================================= 
     EDIT CHANGE 
  ======================================================= */ 
 
  const handleEditChange = (event) => { 
    const { 
      name, 
      value, 
      type, 
      checked, 
    } = event.target; 
 
    setEditFormData((previous) => ({ 
      ...previous, 
 
      [name]: 
        type === 'checkbox' 
          ? checked 
          : value, 
    })); 
  }; 
 
  /* ======================================================= 
     ASSESSMENT CHANGE 
  ======================================================= */ 
 
  const handleAssessmentChange = ( 
    index, 
    field, 
    value 
  ) => { 
    const rows = Array.isArray( 
      editFormData.assessment_rows 
    ) 
      ? [ 
          ...editFormData.assessment_rows, 
        ] 
      : [ 
          ...DEFAULT_FORM_STATE.assessment_rows, 
        ]; 
 
    if (!rows[index]) { 
      rows[index] = { 
        classification: '', 
        area: '', 
        market_value: '', 
        actual_use: '', 
        assessment_level: '', 
        assessed_value: '', 
      }; 
    } 
 
    rows[index] = { 
      ...rows[index], 
      [field]: value, 
    }; 
 
    setEditFormData((previous) => ({ 
      ...previous, 
      assessment_rows: rows, 
    })); 
  }; 
 
  /* ======================================================= 
     SAVE EDIT 
  ======================================================= */ 
 
  const handleSaveEdit = async (event) => { 
    event.preventDefault(); 
 
    if (!editingRecord) { 
      return; 
    } 
 
    const recordId = 
      getRecordId(editingRecord); 
 
    if (!recordId) { 
      alert( 
        'This tax declaration does not have a valid record ID.' 
      ); 
 
      return; 
    } 
 
    const timestampNow = 
      new Date().toISOString(); 
 
    const updatedRecord = { 
      ...editingRecord, 
      ...editFormData, 
 
      id: editingRecord.id, 
 
      assessment_rows: 
        editFormData.assessment_rows, 
 
      updated_at: timestampNow, 
 
      date_updated: 
        timestampNow.split('T')[0], 
    }; 
 
    setLoading(true); 
 
    try { 
      const response = 
        await updateVerificationStatus( 
          recordId, 
          updatedRecord 
        ); 
 
      const savedRecord = 
        response?.data || 
        response || 
        updatedRecord; 
 
      const finalRecord = { 
        ...updatedRecord, 
        ...savedRecord, 
      }; 
 
      /* 
       * Update Manager immediately. 
       */ 
      setManagerRecords((previous) => 
        previous.map((record) => { 
          const currentId = 
            getRecordId(record); 
 
          return String(currentId) === 
            String(recordId) 
            ? { 
                ...record, 
                ...finalRecord, 
              } 
            : record; 
        }) 
      ); 
 
      /* 
       * Tell parent as well. 
       */ 
      if ( 
        typeof onUpdateRecord === 
        'function' 
      ) { 
        onUpdateRecord(finalRecord); 
      } 
 
      setEditingRecord(null); 
 
      alert( 
        'Tax Declaration updated successfully.' 
      ); 
    } catch (error) { 
      console.error( 
        'Error updating tax declaration:', 
        error 
      ); 
 
      alert( 
        error?.message || 
          'Failed to save changes to the database.' 
      ); 
    } finally { 
      setLoading(false); 
    } 
  }; 
 
  /* ======================================================= 
     DELETE 
      
     This is PERMANENT deletion. 
      
     Hiding a Dashboard record does not call this. 
  ======================================================= */ 
 
  const handleDeleteClick = async ( 
    record 
  ) => { 
    const recordId = 
      getRecordId(record); 
 
    const recordTd = 
      record.td_no || 
      recordId || 
      ''; 
 
    if (!recordId) { 
      alert( 
        'This tax record does not have a valid ID.' 
      ); 
 
      return; 
    } 
 
    if ( 
      !window.confirm( 
        `Are you sure you want to permanently delete tax record ${recordTd}? This cannot be undone.` 
      ) 
    ) { 
      return; 
    } 
 
    if ( 
      typeof onDeleteRecord === 
      'function' 
    ) { 
      try { 
        setLoading(true); 
 
        await onDeleteRecord( 
          recordId 
        ); 
 
        /* 
         * Only remove from Manager after the parent 
         * confirms the permanent deletion. 
         */ 
        setManagerRecords((previous) => 
          previous.filter( 
            (item) => 
              String( 
                getRecordId(item) 
              ) !== 
              String(recordId) 
          ) 
        ); 
      } catch (error) { 
        console.error( 
          'Error deleting record:', 
          error 
        ); 
 
        alert( 
          error?.message || 
            'Failed to permanently delete the record.' 
        ); 
      } finally { 
        setLoading(false); 
      } 
 
      return; 
    } 
 
    alert( 
      'Delete operation is not connected to the database yet.' 
    ); 
  }; 
 
  /* ======================================================= 
     IMAGE VIEWER 
  ======================================================= */ 
 
  const openImageViewer = (url) => { 
    if (!url) { 
      return; 
    } 
 
    setImageZoom(1); 
 
    setImageRotation(0); 
 
    setImagePosition({ 
      x: 0, 
      y: 0, 
    }); 
 
    setViewingImageModal({ 
      url, 
    }); 
  }; 
 
  const closeImageViewer = () => { 
    setViewingImageModal(null); 
 
    setImageZoom(1); 
 
    setImageRotation(0); 
 
    setImagePosition({ 
      x: 0, 
      y: 0, 
    }); 
 
    setIsDraggingImage(false); 
  }; 
 
  /* ======================================================= 
     IMAGE DRAG 
  ======================================================= */ 
 
  const handleMouseDownImage = ( 
    event 
  ) => { 
    event.preventDefault(); 
 
    setIsDraggingImage(true); 
 
    setDragStart({ 
      x: 
        event.clientX - 
        imagePosition.x, 
 
      y: 
        event.clientY - 
        imagePosition.y, 
    }); 
  }; 
 
  const handleMouseMoveImage = ( 
    event 
  ) => { 
    if (!isDraggingImage) { 
      return; 
    } 
 
    setImagePosition({ 
      x: 
        event.clientX - 
        dragStart.x, 
 
      y: 
        event.clientY - 
        dragStart.y, 
    }); 
  }; 
 
  const handleMouseUpImage = () => { 
    setIsDraggingImage(false); 
  }; 
 
  /* ======================================================= 
     RENDER 
  ======================================================= */ 
 
  return ( 
    <div className="max-w-7xl mx-auto font-sans my-4 p-3"> 
 
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start"> 
 
        {/* ================================================= 
            SIDEBAR 
        ================================================= */} 
 
        <aside className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4"> 
 
          <div> 
            <h3 className="font-bold text-blue-900 text-xs uppercase tracking-wider mb-1"> 
              Dashboard Menu 
            </h3> 
 
            <p className="text-[10px] text-slate-500"> 
              Real Property Tax System 
            </p> 
          </div> 
 
          <nav className="space-y-1 text-xs"> 
 
            <button 
              onClick={() => 
                setActiveTab('records') 
              } 
              className={`w-full text-left px-3 py-2 rounded-lg font-semibold transition flex items-center justify-between ${ 
                activeTab === 'records' 
                  ? 'bg-blue-900 text-white shadow' 
                  : 'text-slate-700 hover:bg-slate-100' 
              }`} 
            > 
              <span> 
                📁 Tax Records 
              </span> 
 
              <span 
                className={`text-[10px] px-2 py-0.5 rounded-full ${ 
                  activeTab === 'records' 
                    ? 'bg-blue-800 text-white' 
                    : 'bg-slate-200 text-slate-700' 
                }`} 
              > 
                {safeRecords.length} 
              </span> 
            </button> 
 
            <button 
              onClick={() => 
                setActiveTab('analytics') 
              } 
              className={`w-full text-left px-3 py-2 rounded-lg font-semibold transition ${ 
                activeTab === 'analytics' 
                  ? 'bg-blue-900 text-white shadow' 
                  : 'text-slate-700 hover:bg-slate-100' 
              }`} 
            > 
              📊 Analytics 
            </button> 
 
          </nav> 
 
          <div className="pt-4 border-t border-slate-100 space-y-2"> 
 
            <button 
              type="button" 
              onClick={loadManagerRecords} 
              disabled={loadingRecords} 
              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50" 
            > 
              {loadingRecords 
                ? 'Refreshing...' 
                : '↻ Refresh Records'} 
            </button> 
 
            {onBackToDashboard && ( 
              <button 
                onClick={ 
                  onBackToDashboard 
                } 
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition" 
              > 
                ← Exit 
              </button> 
            )} 
 
          </div> 
 
        </aside> 
 
        {/* ================================================= 
            MAIN 
        ================================================= */} 
 
        <main className="lg:col-span-4 space-y-4"> 
 
          {/* ================================================= 
              ANALYTICS 
          ================================================= */} 
 
          {activeTab === 'analytics' && ( 
            <div className="space-y-4"> 
 
              <div className="bg-white p-6 rounded-xl shadow border border-slate-200 space-y-4"> 
 
                <h3 className="text-sm font-bold text-blue-900 uppercase"> 
                  Portfolio Overview 
                </h3> 
 
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"> 
 
                  <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200"> 
                    <span className="text-[10px] font-bold text-blue-700 uppercase"> 
                      Total Records 
                    </span> 
 
                    <p className="text-xl font-extrabold text-blue-900 mt-1"> 
                      {analytics.total} 
                    </p> 
                  </div> 
 
                  <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200"> 
                    <span className="text-[10px] font-bold text-emerald-700 uppercase"> 
                      Total Assessed Value 
                    </span> 
 
                    <p className="text-xl font-extrabold text-emerald-900 mt-1"> 
                      ₱ 
                      {formatCurrency( 
                        analytics.totalAssessedValue 
                      )} 
                    </p> 
                  </div> 
 
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200"> 
                    <span className="text-[10px] font-bold text-amber-700 uppercase"> 
                      Total Market Value 
                    </span> 
 
                    <p className="text-xl font-extrabold text-amber-900 mt-1"> 
                      ₱ 
                      {formatCurrency( 
                        analytics.totalMarketValue 
                      )} 
                    </p> 
                  </div> 
 
                  <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200"> 
                    <span className="text-[10px] font-bold text-purple-700 uppercase"> 
                      Avg. Assessed Value 
                    </span> 
 
                    <p className="text-xl font-extrabold text-purple-900 mt-1"> 
                      ₱ 
                      {formatCurrency( 
                        analytics.averageAssessedValue 
                      )} 
                    </p> 
                  </div> 
 
                </div> 
              </div> 
 
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"> 
 
                <div className="bg-white p-5 rounded-xl shadow border border-slate-200 space-y-3"> 
 
                  <h4 className="text-xs font-bold text-blue-900 uppercase"> 
                    Submission Mode 
                  </h4> 
 
                  <div className="space-y-2"> 
 
                    <div className="flex items-center justify-between text-xs"> 
 
                      <span className="font-semibold text-slate-700"> 
                        Quick Submit 
                      </span> 
 
                      <span className="font-bold text-amber-700"> 
                        { 
                          analytics.quickSubmitCount 
                        } 
                      </span> 
 
                    </div> 
 
                    <div className="w-full bg-slate-100 rounded-full h-2"> 
 
                      <div 
                        className="bg-amber-500 h-2 rounded-full transition-all" 
                        style={{ 
                          width: `${ 
                            analytics.total > 
                            0 
                              ? ( 
                                  analytics.quickSubmitCount / 
                                  analytics.total 
                                ) * 
                                100 
                              : 0 
                          }%`, 
                        }} 
                      /> 
 
                    </div> 
 
                    <div className="flex items-center justify-between text-xs pt-2"> 
 
                      <span className="font-semibold text-slate-700"> 
                        Full Detail 
                      </span> 
 
                      <span className="font-bold text-blue-700"> 
                        { 
                          analytics.fullDetailCount 
                        } 
                      </span> 
 
                    </div> 
 
                    <div className="w-full bg-slate-100 rounded-full h-2"> 
 
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ 
                          width: `${ 
                            analytics.total > 
                            0 
                              ? ( 
                                  analytics.fullDetailCount / 
                                  analytics.total 
                                ) * 
                                100 
                              : 0 
                          }%`, 
                        }} 
                      /> 
 
                    </div> 
 
                  </div> 
                </div> 
 
                <div className="bg-white p-5 rounded-xl shadow border border-slate-200 space-y-3"> 
 
                  <h4 className="text-xs font-bold text-blue-900 uppercase"> 
                    Taxability Status 
                  </h4> 
 
                  <div className="space-y-2"> 
 
                    <div className="flex items-center justify-between text-xs"> 
 
                      <span className="font-semibold text-slate-700"> 
                        Taxable 
                      </span> 
 
                      <span className="font-bold text-emerald-700"> 
                        {analytics 
                          .taxabilityCounts 
                          .Taxable || 
                          0} 
                      </span> 
 
                    </div> 
 
                    <div className="w-full bg-slate-100 rounded-full h-2"> 
 
                      <div 
                        className="bg-emerald-500 h-2 rounded-full" 
                        style={{ 
                          width: `${ 
                            analytics.total > 
                            0 
                              ? ( 
                                  ( 
                                    analytics 
                                      .taxabilityCounts 
                                      .Taxable || 
                                    0 
                                  ) / 
                                  analytics.total 
                                ) * 
                                100 
                              : 0 
                          }%`, 
                        }} 
                      /> 
 
                    </div> 
 
                    <div className="flex items-center justify-between text-xs pt-2"> 
 
                      <span className="font-semibold text-slate-700"> 
                        Exempt 
                      </span> 
 
                      <span className="font-bold text-slate-600"> 
                        {analytics 
                          .taxabilityCounts 
                          .Exempt || 
                          0} 
                      </span> 
 
                    </div> 
 
                    <div className="w-full bg-slate-100 rounded-full h-2"> 
 
                      <div 
                        className="bg-slate-400 h-2 rounded-full" 
                        style={{ 
                          width: `${ 
                            analytics.total > 
                            0 
                              ? ( 
                                  ( 
                                    analytics 
                                      .taxabilityCounts 
                                      .Exempt || 
                                    0 
                                  ) / 
                                  analytics.total 
                                ) * 
                                100 
                              : 0 
                          }%`, 
                        }} 
                      /> 
 
                    </div> 
 
                  </div> 
                </div> 
 
              </div> 
 
              <div className="bg-white p-5 rounded-xl shadow border border-slate-200 space-y-3"> 
 
                <div className="flex items-center justify-between"> 
 
                  <h4 className="text-xs font-bold text-blue-900 uppercase"> 
                    Top Barangays by Record Count 
                  </h4> 
 
                  <span className="text-[10px] text-slate-500"> 
                    { 
                      analytics.barangayCount 
                    }{' '} 
                    barangay(s) 
                    represented 
                  </span> 
 
                </div> 
 
                {analytics 
                  .topBarangays 
                  .length === 0 ? ( 
 
                  <p className="text-xs text-slate-400 text-center py-6"> 
                    No location data yet. 
                  </p> 
 
                ) : ( 
 
                  <div className="space-y-2"> 
 
                    {analytics.topBarangays.map( 
                      ( 
                        [barangay, count] 
                      ) => ( 
 
                        <div 
                          key={barangay} 
                          className="flex items-center gap-3" 
                        > 
 
                          <span className="text-xs font-semibold text-slate-700 w-32 truncate"> 
                            {barangay} 
                          </span> 
 
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5"> 
 
                            <div 
                              className="bg-blue-900 h-2.5 rounded-full" 
                              style={{ 
                                width: `${ 
                                  analytics.total > 
                                  0 
                                    ? ( 
                                        count / 
                                        analytics.total 
                                      ) * 
                                      100 
                                    : 0 
                                }%`, 
                              }} 
                            /> 
 
                          </div> 
 
                          <span className="text-xs font-bold text-blue-900 w-6 text-right"> 
                            {count} 
                          </span> 
 
                        </div> 
 
                      ) 
                    )} 
 
                  </div> 
 
                )} 
 
              </div> 
 
            </div> 
          )} 
 
          {/* ================================================= 
              RECORDS 
          ================================================= */} 
 
          {activeTab === 'records' && ( 
 
            <div className="bg-white p-4 rounded-xl shadow border border-slate-200 space-y-4"> 
 
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center"> 
 
                <div> 
 
                  <h3 className="text-sm font-bold text-blue-900 uppercase"> 
                    Tax Form Manager 
                  </h3> 
 
                  <p className="text-[10px] text-slate-500 mt-1"> 
                    All approved database records are retained here even when hidden from the Dashboard. 
                  </p> 
 
                </div> 
 
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  value={searchTerm} 
                  onChange={(event) => 
                    setSearchTerm( 
                      event.target.value 
                    ) 
                  } 
                  className="w-full sm:w-80 border border-slate-300 p-2 rounded-lg text-xs bg-white" 
                /> 
 
              </div> 
 
              {/* DATABASE LOAD MESSAGE */} 
 
              {loadingRecords && ( 
 
                <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-xs font-semibold"> 
                  Loading approved records from database... 
                </div> 
 
              )} 
 
              {loadError && ( 
 
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs"> 
                  {loadError} 
                </div> 
 
              )} 
 
              {filteredRecords.length === 
              0 ? ( 
 
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300"> 
 
                  <p className="text-xs text-slate-500 uppercase font-semibold"> 
 
                    {safeRecords.length === 
                    0 
                      ? 'No approved tax records found.' 
                      : 'No tax records match your search.'} 
 
                  </p> 
 
                </div> 
 
              ) : ( 
 
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
 
                  {filteredRecords.map( 
                    (item, index) => { 
 
                      const imageUrl = 
                        getRecordImage(item); 
 
                      const isQuickSubmit = 
                        Boolean(imageUrl); 
 
                      return ( 
 
                        <div 
                          key={ 
                            getRecordKey( 
                              item 
                            ) || 
                            index 
                          } 
                          className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col overflow-hidden text-xs" 
                        > 
 
                          {/* IMAGE */} 
 
                          {imageUrl ? ( 
 
                            <div 
                              className="w-full h-40 bg-slate-100 cursor-pointer overflow-hidden relative group border-b flex-shrink-0" 
                              onClick={() => 
                                openImageViewer( 
                                  imageUrl 
                                ) 
                              } 
                            > 
 
                              <img 
                                src={imageUrl} 
                                alt={`Property ${ 
                                  item.td_no || 
                                  '' 
                                }`} 
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300" 
                                loading="lazy" 
                                onError={( 
                                  event 
                                ) => { 
 
                                  console.error( 
                                    '[TAX IMAGE LOAD ERROR]', 
                                    event 
                                      .currentTarget 
                                      .src 
                                  ); 
 
                                  event.currentTarget.style.display = 
                                    'none'; 
 
                                  const parent = 
                                    event 
                                      .currentTarget 
                                      .parentElement; 
 
                                  if ( 
                                    parent 
                                  ) { 
 
                                    parent.classList.add( 
                                      'flex', 
                                      'items-center', 
                                      'justify-center' 
                                    ); 
 
                                    const message = 
                                      document.createElement( 
                                        'span' 
                                      ); 
 
                                    message.className = 
                                      'text-[10px] text-slate-500'; 
 
                                    message.textContent = 
                                      'Image unavailable'; 
 
                                    parent.appendChild( 
                                      message 
                                    ); 
                                  } 
 
                                }} 
                              /> 
 
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold pointer-events-none"> 
                                🔍 View Image 
                              </div> 
 
                            </div> 
 
                          ) : ( 
 
                            <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"> 
 
                              <span className="text-xs font-bold bg-blue-50 text-blue-900 px-3 py-1 rounded-full border border-blue-200"> 
                                {item.td_no || 
                                  'No TD No.'} 
                              </span> 
 
                              <span className="text-xs font-mono text-slate-500"> 
                                PIN:{' '} 
                                {item.property_identification_no || 
                                  item.pin || 
                                  '---'} 
                              </span> 
 
                            </div> 
 
                          )} 
 
                          {/* CARD BODY */} 
 
                          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between"> 
 
                            {imageUrl && ( 
 
                              <div className="flex justify-between items-center pb-2 border-b"> 
 
                                <span className="text-xs font-bold text-blue-900"> 
                                  TD:{' '} 
                                  {item.td_no || 
                                    'N/A'} 
                                </span> 
 
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 text-amber-800"> 
                                  Quick Submit 
                                </span> 
 
                              </div> 
 
                            )} 
 
                            <div className="space-y-1.5 text-slate-700"> 
 
                              <p> 
                                <strong className="text-slate-900"> 
                                  Owner: 
                                </strong>{' '} 
 
                                {item.owner_name || 
                                  item.full_name || 
                                  '---'} 
                              </p> 
 
                              <p> 
                                <strong className="text-slate-900"> 
                                  Barangay: 
                                </strong>{' '} 
 
                                {item.location_barangay_district || 
                                  '---'} 
                              </p> 
 
                              
 
                            </div> 
 
                            <div className="pt-3 border-t grid grid-cols-3 gap-1"> 
 
                              {imageUrl ? ( 
 
                                <button 
                                  type="button" 
                                  onClick={() => 
                                    openImageViewer( 
                                      imageUrl 
                                    ) 
                                  } 
                                  className="bg-slate-900 text-white py-1 rounded" 
                                > 
                                  View 
                                </button> 
 
                              ) : ( 
 
                                <button 
                                  type="button" 
                                  onClick={() => 
                                    handleViewClick( 
                                      item 
                                    ) 
                                  } 
                                  className="bg-slate-900 text-white py-1 rounded" 
                                > 
                                  View Form 
                                </button> 
 
                              )} 
 
                              {!isQuickSubmit ? ( 
 
                                <button 
                                  type="button" 
                                  onClick={() => 
                                    handleEditClick( 
                                      item 
                                    ) 
                                  } 
                                  className="bg-blue-50 text-blue-900 border border-blue-200 py-1 rounded" 
                                > 
                                  Edit 
                                </button> 
 
                              ) : ( 
 
                                <button 
                                  type="button" 
                                  disabled 
                                  className="bg-slate-100 text-slate-400 border border-slate-200 py-1 rounded cursor-not-allowed" 
                                  title="Quick Submits cannot be edited" 
                                > 
                                  Edit 
                                </button> 
 
                              )} 
 
                              <button 
                                type="button" 
                                onClick={() => 
                                  handleDeleteClick( 
                                    item 
                                  ) 
                                } 
                                disabled={ 
                                  loading 
                                } 
                                className="bg-red-50 text-red-700 border border-red-200 py-1 rounded disabled:opacity-50" 
                              > 
                                Delete 
                              </button> 
 
                            </div> 
 
                          </div> 
 
                        </div> 
 
                      ); 
                    } 
                  )} 
 
                </div> 
 
              )} 
 
            </div> 
          )} 
 
        </main> 
      </div> 
 
      {/* ===================================================== 
          VIEW FORM MODAL 
      ===================================================== */} 
 
      {viewingRecord && ( 
 
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto"> 
 
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-8 space-y-6 my-auto max-h-[92vh] overflow-y-auto border-2 border-slate-900 font-serif"> 
 
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-3"> 
 
              <h2 className="text-base font-extrabold tracking-wide text-slate-900"> 
                TAX DECLARATION OF REAL PROPERTY 
                (VIEW ONLY) 
              </h2> 
 
              <button 
                type="button" 
                onClick={() => 
                  setViewingRecord(null) 
                } 
                className="text-slate-900 text-xl font-bold" 
              > 
                × 
              </button> 
 
            </div> 
 
            <div className="space-y-4 text-xs"> 
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-400 pb-3"> 
 
                <div className="flex items-baseline gap-2"> 
 
                  <span className="font-bold text-slate-900 whitespace-nowrap"> 
                    TD NO. 
                  </span> 
 
                  <span className="border-b border-slate-800 px-1 font-semibold w-full"> 
                    {viewingRecord.td_no || 
                      '---'} 
                  </span> 
 
                </div> 
 
                <div className="flex items-baseline gap-2"> 
 
                  <span className="font-bold text-slate-900 whitespace-nowrap"> 
                    PROPERTY IDENTIFICATION NO. 
                  </span> 
 
                  <span className="border-b border-slate-800 px-1 font-semibold w-full"> 
                    {viewingRecord.property_identification_no || 
                      '---'} 
                  </span> 
 
                </div> 
 
              </div> 
 
              <div className="space-y-2 border-b border-slate-400 pb-3"> 
 
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline"> 
 
                  <div className="md:col-span-10 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      OWNER: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.owner_name || 
                        viewingRecord.full_name || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="md:col-span-2 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900"> 
                      TIN: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.owner_tin || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline"> 
 
                  <div className="md:col-span-9 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      ADDRESS: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.owner_address || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="md:col-span-3 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      TELEPHONE NO.: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.owner_telephone || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
              </div> 
 
              <div className="space-y-2 border-b border-slate-400 pb-3"> 
 
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline"> 
 
                  <div className="md:col-span-10 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      ADMINISTRATOR/BENEFICIAL USER: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.administrator_name || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="md:col-span-2 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900"> 
                      TIN: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.administrator_tin || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline"> 
 
                  <div className="md:col-span-9 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      ADDRESS: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.administrator_address || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="md:col-span-3 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      TELEPHONE NO.: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.administrator_telephone || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
              </div> 
 
              <div className="border-b border-slate-400 pb-3 space-y-1"> 
 
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline"> 
 
                  <div className="md:col-span-4 flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      LOCATION OF PROPERTY: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 text-center w-full"> 
                      {viewingRecord.location_number_street || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="md:col-span-4"> 
 
                    <span className="border-b border-slate-800 px-1 text-center font-semibold w-full block"> 
                      {viewingRecord.location_barangay_district || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="md:col-span-4"> 
 
                    <span className="border-b border-slate-800 px-1 text-center font-semibold w-full block"> 
                      {viewingRecord.location_municipality_province_city || 
                        'San Fernando, Romblon'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
                <div className="grid grid-cols-3 text-[10px] text-slate-600 text-center font-sans"> 
 
                  <span> 
                    (Number and Street) 
                  </span> 
 
                  <span> 
                    (Barangay/District) 
                  </span> 
 
                  <span> 
                    (Municipality & Province/City) 
                  </span> 
 
                </div> 
 
              </div> 
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-400 pb-3"> 
 
                <div className="space-y-2"> 
 
                  <div className="flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      OCT/TCT/CLOA NO. 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.oct_tct_cloa_no || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900"> 
                      CCT: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.cct_no || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900"> 
                      DATED: 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.dated || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
                <div className="space-y-2"> 
 
                  <div className="flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900 whitespace-nowrap"> 
                      SURVEY NO. 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.survey_no || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900"> 
                      LOT NO. 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.lot_no || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                  <div className="flex items-baseline gap-2"> 
 
                    <span className="font-bold text-slate-900"> 
                      BLK NO. 
                    </span> 
 
                    <span className="border-b border-slate-800 px-1 w-full"> 
                      {viewingRecord.blk_no || 
                        '---'} 
                    </span> 
 
                  </div> 
 
                </div> 
 
              </div> 
 
              <div className="border-b border-slate-400 pb-3 space-y-2"> 
 
                <span className="font-bold text-slate-900 block"> 
                  BOUNDARIES: 
                </span> 
 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
 
                  {[ 
                    [ 
                      'NORTH', 
                      viewingRecord.boundary_north, 
                    ], 
                    [ 
                      'SOUTH', 
                      viewingRecord.boundary_south, 
                    ], 
                    [ 
                      'EAST', 
                      viewingRecord.boundary_east, 
                    ], 
                    [ 
                      'WEST', 
                      viewingRecord.boundary_west, 
                    ], 
                  ].map( 
                    ([label, value]) => ( 
 
                      <div 
                        key={label} 
                        className="flex items-baseline gap-2" 
                      > 
 
                        <span className="font-bold text-slate-900 w-16"> 
                          {label}: 
                        </span> 
 
                        <span className="border-b border-slate-800 px-1 w-full"> 
                          {value || '---'} 
                        </span> 
 
                      </div> 
 
                    ) 
                  )} 
 
                </div> 
 
              </div> 
 
              <div className="border-b border-slate-400 pb-3 space-y-2"> 
 
                <span className="font-bold text-slate-900 block"> 
                  KIND OF PROPERTY ASSESSED: 
                </span> 
 
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
 
                  <div className="space-y-2"> 
 
                    <div className="font-bold text-slate-900"> 
                      {viewingRecord.is_land 
                        ? '☑' 
                        : '☐'}{' '} 
                      LAND 
                    </div> 
 
                    <div className="font-bold text-slate-900 pt-1"> 
                      {viewingRecord.is_building 
                        ? '☑' 
                        : '☐'}{' '} 
                      BUILDING 
                    </div> 
 
                    <div className="pl-6 space-y-1 text-slate-700"> 
 
                      <div> 
                        No. of Storeys:{' '} 
                        {viewingRecord.building_no_of_storeys || 
                          '---'} 
                      </div> 
 
                      <div> 
                        Brief Description:{' '} 
                        {viewingRecord.building_brief_description || 
                          '---'} 
                      </div> 
 
                    </div> 
 
                  </div> 
 
                  <div className="space-y-2"> 
 
                    <div className="font-bold text-slate-900"> 
                      {viewingRecord.is_machinery 
                        ? '☑' 
                        : '☐'}{' '} 
                      MACHINERY 
                    </div> 
 
                    <div className="pl-6 text-slate-700"> 
                      Brief Description:{' '} 
                      {viewingRecord.machinery_brief_description || 
                        '---'} 
                    </div> 
 
                    <div className="font-bold text-slate-900 pt-2"> 
                      {viewingRecord.is_others 
                        ? '☑' 
                        : '☐'}{' '} 
                      OTHERS 
                    </div> 
 
                    <div className="pl-6 text-slate-700"> 
                      Specify:{' '} 
                      {viewingRecord.others_specify || 
                        '---'} 
                    </div> 
 
                  </div> 
 
                </div> 
 
              </div> 
 
              <div className="space-y-1 border-b border-slate-400 pb-3"> 
 
                <div className="overflow-x-auto"> 
 
                  <table className="w-full border-collapse border border-slate-900 text-center"> 
 
                    <thead> 
 
                      <tr className="bg-slate-100 border-b border-slate-900 text-[10px] font-bold"> 
 
                        <th className="p-1.5 border border-slate-900"> 
                          CLASSIFICATION 
                        </th> 
 
                        <th className="p-1.5 border border-slate-900"> 
                          AREA 
                        </th> 
 
                        <th className="p-1.5 border border-slate-900"> 
                          MARKET VALUE 
                        </th> 
 
                        <th className="p-1.5 border border-slate-900"> 
                          ACTUAL USE 
                        </th> 
 
                        <th className="p-1.5 border border-slate-900"> 
                          ASSESSMENT LEVEL 
                        </th> 
 
                        <th className="p-1.5 border border-slate-900"> 
                          ASSESSED VALUE 
                        </th> 
 
                      </tr> 
 
                    </thead> 
 
                    <tbody> 
 
                      {Array.isArray( 
                        viewingRecord.assessment_rows 
                      ) && 
                        viewingRecord.assessment_rows.map( 
                          (row, index) => ( 
 
                            <tr 
                              key={index} 
                              className="border-b border-slate-900 font-sans" 
                            > 
 
                              <td className="p-1.5 border border-slate-900"> 
                                {row?.classification || 
                                  '---'} 
                              </td> 
 
                              <td className="p-1.5 border border-slate-900"> 
                                {row?.area || 
                                  '---'} 
                              </td> 
 
                              <td className="p-1.5 border border-slate-900"> 
                                {row?.market_value || 
                                  '---'} 
                              </td> 
 
                              <td className="p-1.5 border border-slate-900"> 
                                {row?.actual_use || 
                                  '---'} 
                              </td> 
 
                              <td className="p-1.5 border border-slate-900"> 
                                {row?.assessment_level || 
                                  '---'} 
                              </td> 
 
                              <td className="p-1.5 border border-slate-900"> 
                                {row?.assessed_value || 
                                  '---'} 
                              </td> 
 
                            </tr> 
 
                          ) 
                        )} 
 
                    </tbody> 
 
                  </table> 
 
                </div> 
 
              </div> 
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-400 pb-3"> 
 
                <div> 
 
                  <p> 
                    <strong> 
                      Total Market Value: 
                    </strong>{' '} 
                    ₱ 
                    {viewingRecord.total_market_value || 
                      '0.00'} 
                  </p> 
 
                  <p> 
                    <strong> 
                      Total Assessed Value: 
                    </strong>{' '} 
                    ₱ 
                    {viewingRecord.total_assessed_value || 
                      '0.00'} 
                  </p> 
 
                  <p> 
                    <strong> 
                      In Words: 
                    </strong>{' '} 
                    {viewingRecord.total_assessed_value_words || 
                      '---'} 
                  </p> 
 
                </div> 
 
                <div> 
 
                  <p> 
                    <strong> 
                      Taxability Status: 
                    </strong>{' '} 
                    {viewingRecord.taxability_status || 
                      'Taxable'} 
                  </p> 
 
                  <p> 
                    <strong> 
                      Effectivity: 
                    </strong>{' '} 
                    Q 
                    {viewingRecord.effectivity_qtr || 
                      '1'}{' '} 
                    {viewingRecord.effectivity_yr || 
                      ''} 
                  </p> 
 
                  <p> 
                    <strong> 
                      Approved By: 
                    </strong>{' '} 
                    {viewingRecord.approved_by || 
                      '---'}{' '} 
                    ( 
                    {viewingRecord.approval_date || 
                      '---'} 
                    ) 
                  </p> 
 
                </div> 
 
              </div> 

              {/* =========================================
                  CANCELLATION / PREVIOUS A.V.
                  (Added: "This declaration cancels TD No."
                  section from the physical form)
              ========================================= */}

              <div className="border-b border-slate-400 pb-3 space-y-2">

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline">

                  <div className="md:col-span-5 flex items-baseline gap-2">

                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      THIS DECLARATION CANCELS TD NO.:
                    </span>

                    <span className="border-b border-slate-800 px-1 w-full">
                      {viewingRecord.cancels_td_no || '---'}
                    </span>

                  </div>

                  <div className="md:col-span-4 flex items-baseline gap-2">

                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      OWNER:
                    </span>

                    <span className="border-b border-slate-800 px-1 w-full">
                      {viewingRecord.owner_name ||
                        viewingRecord.full_name ||
                        '---'}
                    </span>

                  </div>

                  <div className="md:col-span-3 flex items-baseline gap-2">

                    <span className="font-bold text-slate-900 whitespace-nowrap">
                      PREVIOUS A.V.:
                    </span>

                    <span className="border-b border-slate-800 px-1 w-full">
                      ₱ {viewingRecord.previous_av || '0.00'}
                    </span>

                  </div>

                </div>

              </div>

              {/* =========================================
                  MEMORANDA
                  (Added: free-text memoranda field from
                  the physical form)
              ========================================= */}

              <div className="border-b border-slate-400 pb-3 space-y-2">

                <span className="font-bold text-slate-900 block">
                  MEMORANDA:
                </span>

                <p className="border-b border-slate-800 px-1 min-h-[2.5rem] whitespace-pre-wrap text-slate-700">
                  {viewingRecord.memoranda || '---'}
                </p>

              </div>

            </div> 
 
            <div className="flex justify-end pt-2"> 
 
              <button 
                type="button" 
                onClick={() => 
                  setViewingRecord(null) 
                } 
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-lg font-sans text-xs font-semibold" 
              > 
                Close View 
              </button> 
 
            </div> 
 
          </div> 
 
        </div> 
 
      )} 
 
      {/* ===================================================== 
          EDIT MODAL 
      ===================================================== */} 
 
      {editingRecord && ( 
 
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto"> 
 
          <form 
            onSubmit={handleSaveEdit} 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto border border-slate-300 font-sans text-xs" 
          > 
 
            <div className="flex justify-between items-center border-b pb-3"> 
 
              <h2 className="text-sm font-bold text-blue-900 uppercase"> 
                Edit Tax Declaration Record 
              </h2> 
 
              <button 
                type="button" 
                onClick={() => 
                  setEditingRecord(null) 
                } 
                className="text-slate-500 text-xl font-bold" 
              > 
                × 
              </button> 
 
            </div> 
 
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
 
              <div> 
 
                <label className="block font-semibold text-slate-700 mb-1"> 
                  TD Number 
                </label> 
 
                <input 
                  type="text" 
                  name="td_no" 
                  value={ 
                    editFormData.td_no || '' 
                  } 
                  onChange={ 
                    handleEditChange 
                  } 
                  className="w-full border p-2 rounded text-xs" 
                /> 
 
              </div> 
 
              <div> 
 
                <label className="block font-semibold text-slate-700 mb-1"> 
                  Property Identification No. 
                </label> 
 
                <input 
                  type="text" 
                  name="property_identification_no" 
                  value={ 
                    editFormData.property_identification_no || 
                    '' 
                  } 
                  onChange={ 
                    handleEditChange 
                  } 
                  className="w-full border p-2 rounded text-xs" 
                /> 
 
              </div> 
 
              <div> 
 
                <label className="block font-semibold text-slate-700 mb-1"> 
                  Owner Name 
                </label> 
 
                <input 
                  type="text" 
                  name="owner_name" 
                  value={ 
                    editFormData.owner_name || 
                    editFormData.full_name || 
                    '' 
                  } 
                  onChange={ 
                    handleEditChange 
                  } 
                  className="w-full border p-2 rounded text-xs" 
                /> 
 
              </div> 
 
              <div> 
 
                <label className="block font-semibold text-slate-700 mb-1"> 
                  Barangay / District 
                </label> 
 
                <input 
                  type="text" 
                  name="location_barangay_district" 
                  value={ 
                    editFormData.location_barangay_district || 
                    '' 
                  } 
                  onChange={ 
                    handleEditChange 
                  } 
                  className="w-full border p-2 rounded text-xs" 
                /> 
 
              </div> 
 
              <div> 
 
                <label className="block font-semibold text-slate-700 mb-1"> 
                  Total Assessed Value (₱) 
                </label> 
 
                <input 
                  type="text" 
                  name="total_assessed_value" 
                  value={ 
                    editFormData.total_assessed_value || 
                    '' 
                  } 
                  onChange={ 
                    handleEditChange 
                  } 
                  className="w-full border p-2 rounded text-xs" 
                /> 
 
              </div> 
 
              <div> 
 
                <label className="block font-semibold text-slate-700 mb-1"> 
                  Taxability Status 
                </label> 
 
                <select 
                  name="taxability_status" 
                  value={ 
                    editFormData.taxability_status || 
                    'Taxable' 
                  } 
                  onChange={ 
                    handleEditChange 
                  } 
                  className="w-full border p-2 rounded text-xs bg-white" 
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

                <label className="block font-semibold text-slate-700 mb-1">
                  This Declaration Cancels TD No.
                </label>

                <input
                  type="text"
                  name="cancels_td_no"
                  value={editFormData.cancels_td_no || ''}
                  onChange={handleEditChange}
                  className="w-full border p-2 rounded text-xs"
                />

              </div>

              <div>

                <label className="block font-semibold text-slate-700 mb-1">
                  Previous A.V. (₱)
                </label>

                <input
                  type="text"
                  name="previous_av"
                  value={editFormData.previous_av || ''}
                  onChange={handleEditChange}
                  className="w-full border p-2 rounded text-xs"
                />

              </div>

              <div className="md:col-span-2">

                <label className="block font-semibold text-slate-700 mb-1">
                  Memoranda
                </label>

                <textarea
                  name="memoranda"
                  value={editFormData.memoranda || ''}
                  onChange={handleEditChange}
                  rows={3}
                  className="w-full border p-2 rounded text-xs"
                />

              </div>
 
            </div> 
 
            <div className="pt-2"> 
 
              <span className="font-bold text-slate-900 block mb-2"> 
                Assessment Matrix 
              </span> 
 
              <div className="overflow-x-auto"> 
 
                <table className="w-full border text-center"> 
 
                  <thead> 
 
                    <tr className="bg-slate-100 text-[10px] font-bold"> 
 
                      <th className="p-1 border"> 
                        Classification 
                      </th> 
 
                      <th className="p-1 border"> 
                        Area 
                      </th> 
 
                      <th className="p-1 border"> 
                        Market Value 
                      </th> 
 
                      <th className="p-1 border"> 
                        Assessed Value 
                      </th> 
 
                    </tr> 
 
                  </thead> 
 
                  <tbody> 
 
                    {Array.isArray( 
                      editFormData.assessment_rows 
                    ) && 
                      editFormData.assessment_rows.map( 
                        (row, index) => ( 
 
                          <tr key={index}> 
 
                            <td className="p-1 border"> 
 
                              <input 
                                type="text" 
                                value={ 
                                  row.classification || 
                                  '' 
                                } 
                                onChange={( 
                                  event 
                                ) => 
                                  handleAssessmentChange( 
                                    index, 
                                    'classification', 
                                    event.target.value 
                                  ) 
                                } 
                                className="w-full border p-1 rounded text-center text-xs" 
                              /> 
 
                            </td> 
 
                            <td className="p-1 border"> 
 
                              <input 
                                type="text" 
                                value={ 
                                  row.area || 
                                  '' 
                                } 
                                onChange={( 
                                  event 
                                ) => 
                                  handleAssessmentChange( 
                                    index, 
                                    'area', 
                                    event.target.value 
                                  ) 
                                } 
                                className="w-full border p-1 rounded text-center text-xs" 
                              /> 
 
                            </td> 
 
                            <td className="p-1 border"> 
 
                              <input 
                                type="text" 
                                value={ 
                                  row.market_value || 
                                  '' 
                                } 
                                onChange={( 
                                  event 
                                ) => 
                                  handleAssessmentChange( 
                                    index, 
                                    'market_value', 
                                    event.target.value 
                                  ) 
                                } 
                                className="w-full border p-1 rounded text-center text-xs" 
                              /> 
 
                            </td> 
 
                            <td className="p-1 border"> 
 
                              <input 
                                type="text" 
                                value={ 
                                  row.assessed_value || 
                                  '' 
                                } 
                                onChange={( 
                                  event 
                                ) => 
                                  handleAssessmentChange( 
                                    index, 
                                    'assessed_value', 
                                    event.target.value 
                                  ) 
                                } 
                                className="w-full border p-1 rounded text-center text-xs" 
                              /> 
 
                            </td> 
 
                          </tr> 
 
                        ) 
                      )} 
 
                  </tbody> 
 
                </table> 
 
              </div> 
 
            </div> 
 
            <div className="flex justify-end gap-2 pt-4 border-t"> 
 
              <button 
                type="button" 
                onClick={() => 
                  setEditingRecord(null) 
                } 
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-semibold" 
              > 
                Cancel 
              </button> 
 
              <button 
                type="submit" 
                disabled={loading} 
                className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50" 
              > 
                {loading 
                  ? 'Saving...' 
                  : 'Save Changes'} 
              </button> 
 
            </div> 
 
          </form> 
 
        </div> 
 
      )} 
 
      {/* ===================================================== 
          IMAGE VIEWER 
      ===================================================== */} 
 
      {viewingImageModal && ( 
 
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col z-[100] overflow-hidden"> 
 
          <div className="w-full flex justify-between items-center text-white p-3 bg-black/50"> 
 
            <span className="text-xs font-semibold"> 
              Tax Declaration Document 
            </span> 
 
            <div className="flex gap-2 flex-wrap justify-end"> 
 
              <button 
                type="button" 
                onClick={() => 
                  setImageZoom( 
                    (previous) => 
                      Math.min( 
                        previous + 0.25, 
                        4 
                      ) 
                  ) 
                } 
                className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded text-xs" 
              > 
                Zoom In + 
              </button> 
 
              <button 
                type="button" 
                onClick={() => 
                  setImageZoom( 
                    (previous) => 
                      Math.max( 
                        previous - 0.25, 
                        0.5 
                      ) 
                  ) 
                } 
                className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded text-xs" 
              > 
                Zoom Out - 
              </button> 
 
              <button 
                type="button" 
                onClick={() => 
                  setImageRotation( 
                    (previous) => 
                      (previous + 90) % 
                      360 
                  ) 
                } 
                className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded text-xs" 
              > 
                Rotate 🔄 
              </button> 
 
              <button 
                type="button" 
                onClick={ 
                  closeImageViewer 
                } 
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold" 
              > 
                Close ✕ 
              </button> 
 
            </div> 
 
          </div> 
 
          <div 
            className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing" 
            onMouseDown={ 
              handleMouseDownImage 
            } 
            onMouseMove={ 
              handleMouseMoveImage 
            } 
            onMouseUp={ 
              handleMouseUpImage 
            } 
            onMouseLeave={ 
              handleMouseUpImage 
            } 
          > 
 
            <img 
              src={ 
                viewingImageModal.url 
              } 
              alt="Tax Declaration Attachment" 
              className="max-h-[85vh] max-w-[90vw] object-contain select-none" 
              style={{ 
                transform: 
                  `translate(${imagePosition.x}px, ${imagePosition.y}px) ` + 
                  `scale(${imageZoom}) ` + 
                  `rotate(${imageRotation}deg)`, 
              }} 
              draggable={false} 
              onError={(event) => { 
                console.error( 
                  '[FULLSCREEN IMAGE ERROR]', 
                  event.currentTarget.src 
                ); 
              }} 
            /> 
 
          </div> 
 
        </div> 
 
      )} 
 
    </div> 
  ); 
}