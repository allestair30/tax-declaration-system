// src/assets/services/api.js

import { supabase } from './supabaseClient';


/* =========================================================
   SUPABASE CONFIGURATION
========================================================= */

const STORAGE_BUCKET = 'tax-declarations';


/* =========================================================
   AUTH STORAGE HELPERS
========================================================= */

function getAuthToken() {
  return (
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access_token') ||
    null
  );
}


function clearAuthSession() {
  const keys = [
    'token',
    'access_token',
    'userRole',
    'role',
    'authUser',
    'username',
    'user',
    'verified',
    'isAdminVerified',
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}


/* =========================================================
   SAVE AUTH SESSION

   IMPORTANT:
   Only a REAL Supabase Auth access token is stored.

   Do NOT create fake tokens here.
========================================================= */

function saveAuthSession(result, fallbackRole) {
  if (!result) {
    return;
  }

  const token =
    result.access_token ||
    result.session?.access_token ||
    null;

  const role =
    result.role ||
    result.user?.role ||
    fallbackRole ||
    '';

  const user =
    result.user ||
    {};

  /* -------------------------------------------------------
     SAVE REAL SUPABASE ACCESS TOKEN
  ------------------------------------------------------- */

  if (token) {
    localStorage.setItem(
      'token',
      token
    );

    localStorage.setItem(
      'access_token',
      token
    );
  }

  /* -------------------------------------------------------
     SAVE APPLICATION ROLE
  ------------------------------------------------------- */

  localStorage.setItem(
    'userRole',
    role
  );

  localStorage.setItem(
    'role',
    role
  );

  /* -------------------------------------------------------
     SAVE USER INFORMATION
  ------------------------------------------------------- */

  localStorage.setItem(
    'authUser',
    JSON.stringify(user)
  );

  localStorage.setItem(
    'user',
    JSON.stringify(user)
  );

  /* -------------------------------------------------------
     SAVE USERNAME / EMAIL
  ------------------------------------------------------- */

  if (user.username) {
    localStorage.setItem(
      'username',
      user.username
    );
  } else if (user.email) {
    localStorage.setItem(
      'username',
      user.email
    );
  }

  console.log(
    '[AUTH SESSION SAVED]',
    {
      role,
      username:
        user.username ||
        user.email ||
        '',
      user,
      hasRealSupabaseToken:
        Boolean(token),
    }
  );
}


/* =========================================================
   SUPABASE ERROR HANDLER
========================================================= */

function throwSupabaseError(
  error,
  fallbackMessage
) {
  console.error(
    '[SUPABASE ERROR]',
    error
  );

  const message =
    error?.message ||
    error?.details ||
    error?.hint ||
    fallbackMessage ||
    'Supabase request failed.';

  throw new Error(message);
}


/* =========================================================
   DATABASE VALUE CLEANERS

   IMPORTANT:

   The frontend may display values with commas:

       100,000
       1,250,500.50

   PostgreSQL numeric/integer fields must receive:

       100000
       1250500.50

   Empty numeric/integer fields must receive:

       null

   Property Identification No. is different:
   it remains TEXT so leading zeroes are preserved.
========================================================= */


/* ---------------------------------------------------------
   CLEAN NUMERIC

   Examples:

   "100,012"      -> 100012
   "10,000.50"    -> 10000.50
   "0"            -> 0
   0              -> 0
   ""             -> null
   null           -> null
--------------------------------------------------------- */

function cleanNumericValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const cleaned =
    String(value)
      .replace(/,/g, '')
      .trim();

  if (cleaned === '') {
    return null;
  }

  const number =
    Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}


/* ---------------------------------------------------------
   CLEAN INTEGER

   Examples:

   "1,000" -> 1000
   "10"    -> 10
   ""      -> null
   null    -> null
--------------------------------------------------------- */

function cleanIntegerValue(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const cleaned =
    String(value)
      .replace(/,/g, '')
      .trim();

  if (cleaned === '') {
    return null;
  }

  const number =
    Number(cleaned);

  return Number.isInteger(number)
    ? number
    : null;
}


/* ---------------------------------------------------------
   CLEAN PROPERTY IDENTIFICATION NO.

   IMPORTANT:

   This is NOT converted to Number.

   It remains TEXT because property identification
   numbers can contain leading zeroes.

   Example:

   "001,234,567" -> "001234567"
   "000123"      -> "000123"
--------------------------------------------------------- */

function cleanPropertyIdentificationNo(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return '';
  }

  return String(value)
    .replace(/,/g, '')
    .trim();
}


/* ---------------------------------------------------------
   CLEAN ASSESSMENT ROWS
--------------------------------------------------------- */

function cleanAssessmentRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row = {}) => ({
    ...row,

    classification:
      row.classification ?? '',

    /*
     * NUMERIC
     */
    area:
      cleanNumericValue(
        row.area
      ),

    /*
     * NUMERIC
     */
    market_value:
      cleanNumericValue(
        row.market_value
      ),

    /*
     * VARCHAR / TEXT
     *
     * DO NOT convert this to Number.
     */
    actual_use:
      row.actual_use ?? '',

    /*
     * NUMERIC
     */
    assessment_level:
      cleanNumericValue(
        row.assessment_level
      ),

    /*
     * NUMERIC
     */
    assessed_value:
      cleanNumericValue(
        row.assessed_value
      ),
  }));
}


/* =========================================================
   NORMALIZE TAX DECLARATION
========================================================= */

function normalizeTaxDeclaration(data = {}) {
  /*
   * CLEAN ASSESSMENT ROWS
   */
  const assessmentRows =
    cleanAssessmentRows(
      data.assessment_rows
    );

  const firstRow =
    assessmentRows[0] || {};

  const submissionMode =
    String(
      data.submission_mode || ''
    )
      .toLowerCase()
      .trim();

  const isQuick =
    data.isQuickSubmit === true ||
    data.is_quick_submit === true ||
    data.isquicksubmit === true ||
    data.quick_submit === true ||
    data.quicksubmit === true ||
    data.quickSubmit === true ||
    submissionMode === 'quick' ||
    submissionMode === 'quick submit';

  return {
    submitted_by:
      data.submitted_by || null,

    submitted_by_email:
      data.submitted_by_email || '',

    td_no:
      String(
        data.td_no || ''
      ).trim(),

    /*
     * PROPERTY IDENTIFICATION NO.
     *
     * Remains TEXT.
     *
     * Removes commas only.
     */
    property_identification_no:
      cleanPropertyIdentificationNo(
        data.property_identification_no
      ),

    full_name:
      data.full_name || '',

    owner_name:
      data.owner_name ||
      data.full_name ||
      data.owner ||
      '',

    /*
     * NUMERIC
     *
     * Quick Submit never shows/fills this field, so it
     * arrives as "" — must be cleaned or it fails with
     * "invalid input syntax for type numeric: ''".
     */
    owner_tin:
      cleanNumericValue(
        data.owner_tin
      ),

    owner_address:
      data.owner_address || '',

    owner_telephone:
      data.owner_telephone ||
      data.owner_tel ||
      '',

    owner_tel:
      data.owner_tel ||
      data.owner_telephone ||
      '',

    administrator_name:
      data.administrator_name ||
      data.admin_user ||
      '',

    admin_user:
      data.admin_user ||
      data.administrator_name ||
      '',

    /*
     * NUMERIC
     *
     * Quick Submit never shows/fills this field, so it
     * arrives as "" — must be cleaned or it fails with
     * "invalid input syntax for type numeric: ''".
     */
    administrator_tin:
      cleanNumericValue(
        data.administrator_tin ??
        data.admin_tin
      ),

    admin_tin:
      cleanNumericValue(
        data.admin_tin ??
        data.administrator_tin
      ),

    administrator_address:
      data.administrator_address ||
      data.admin_address ||
      '',

    admin_address:
      data.admin_address ||
      data.administrator_address ||
      '',

    administrator_telephone:
      data.administrator_telephone ||
      data.admin_tel ||
      '',

    admin_tel:
      data.admin_tel ||
      data.administrator_telephone ||
      '',

    location_number_street:
      data.location_number_street || '',

    location_barangay_district:
      data.location_barangay_district ||
      data.barangay ||
      '',

    barangay:
      data.barangay ||
      data.location_barangay_district ||
      '',

    location_municipality_province_city:
      data.location_municipality_province_city ||
      'San Fernando, Romblon',

    municipality:
      data.municipality ||
      data.location_municipality_province_city ||
      'San Fernando, Romblon',

    oct_tct_cloa_no:
      data.oct_tct_cloa_no || '',

    oct_tct_no:
      data.oct_tct_no ||
      data.oct_tct_cloa_no ||
      '',

    cct_no:
      data.cct_no || '',

    dated:
      data.dated || '',

    survey_no:
      data.survey_no || '',

    /*
     * NUMERIC
     *
     * Quick Submit never shows/fills this field, so it
     * arrives as "" — must be cleaned or it fails with
     * "invalid input syntax for type numeric: ''".
     */
    lot_no:
      cleanNumericValue(
        data.lot_no
      ),

    /*
     * NUMERIC
     *
     * Quick Submit never shows/fills this field, so it
     * arrives as "" — must be cleaned or it fails with
     * "invalid input syntax for type numeric: ''".
     */
    blk_no:
      cleanNumericValue(
        data.blk_no
      ),

    boundary_north:
      data.boundary_north || '',

    boundary_south:
      data.boundary_south || '',

    boundary_east:
      data.boundary_east || '',

    boundary_west:
      data.boundary_west || '',

    is_land:
      data.is_land === true,

    is_building:
      data.is_building === true,

    /*
     * INTEGER
     *
     * Empty string becomes null.
     */
    building_no_of_storeys:
      cleanIntegerValue(
        data.building_no_of_storeys
      ),

    building_brief_description:
      data.building_brief_description || '',

    is_machinery:
      data.is_machinery === true,

    machinery_brief_description:
      data.machinery_brief_description || '',

    is_others:
      data.is_others === true,

    others_specify:
      data.others_specify || '',

    kind_property:
      data.kind_property ||
      data.property_kind ||
      '',

    property_kind:
      data.property_kind || '',

    /*
     * CLEANED ASSESSMENT ROWS
     */
    assessment_rows:
      assessmentRows,

    classification:
      data.classification ||
      firstRow.classification ||
      '',

    /*
     * NUMERIC
     */
    area:
      cleanNumericValue(
        data.area ??
        firstRow.area
      ),

    /*
     * NUMERIC
     */
    market_value:
      cleanNumericValue(
        data.market_value ??
        firstRow.market_value
      ),

    /*
     * VARCHAR / TEXT
     */
    actual_use:
      data.actual_use ??
      firstRow.actual_use ??
      '',

    /*
     * NUMERIC
     */
    assessment_level:
      cleanNumericValue(
        data.assessment_level ??
        firstRow.assessment_level
      ),

    /*
     * NUMERIC
     */
    assessed_value:
      cleanNumericValue(
        data.assessed_value ??
        firstRow.assessed_value
      ),

    /*
     * NUMERIC
     */
    total_market_value:
      cleanNumericValue(
        data.total_market_value
      ),

    /*
     * NUMERIC
     */
    total_assessed_value:
      cleanNumericValue(
        data.total_assessed_value
      ),

    total_assessed_value_words:
      data.total_assessed_value_words || '',

    taxability_status:
      data.taxability_status ||
      data.status ||
      'Taxable',

    status:
      data.status ||
      data.taxability_status ||
      'Taxable',

    effectivity_qtr:
      data.effectivity_qtr || '',

    /*
     * INTEGER
     */
    effectivity_yr:
      cleanIntegerValue(
        data.effectivity_yr
      ),

    effectivity_date:
      data.effectivity_date || '',

    approved_by:
      data.approved_by || '',

    approval_date:
      data.approval_date || '',

    cancels_td_no:
      data.cancels_td_no || '',

    cancels_owner:
      data.cancels_owner || '',

    previous_td_no:
      data.previous_td_no || '',

    /*
     * NUMERIC
     */
    previous_av:
      cleanNumericValue(
        data.previous_av
      ),

    memoranda:
      data.memoranda || '',

    submission_mode:
      isQuick
        ? 'quick'
        : 'full',

    isQuickSubmit:
      isQuick,

    is_quick_submit:
      isQuick,

    isquicksubmit:
      isQuick,

    quick_submit:
      isQuick,

    quicksubmit:
      isQuick,

    quickSubmit:
      isQuick,

    property_image:
      data.property_image ||
      data.document_image ||
      data.image_url ||
      '',

    document_image:
      data.document_image ||
      data.property_image ||
      data.image_url ||
      '',

    image_url:
      data.image_url ||
      data.property_image ||
      data.document_image ||
      '',

    file_path:
      data.file_path || '',

    verification_status:
      data.verification_status ||
      'Pending',

    rejection_reason:
      data.rejection_reason ||
      '',

    is_hidden:
      data.is_hidden === true,
  };
}


/* =========================================================
   ADMINISTRATOR LOGIN
   SUPABASE AUTHENTICATION

   DESTINATION:
   /analytics
========================================================= */

export async function loginAdmin(
  username,
  password
) {
  const email =
    String(username || '')
      .trim()
      .toLowerCase();

  const cleanPassword =
    String(password || '');

  if (
    !email ||
    !cleanPassword
  ) {
    throw new Error(
      'Username/email and password are required.'
    );
  }

  console.log(
    '[ADMIN LOGIN] Supabase Auth attempt:',
    email
  );

  const {
    data,
    error,
  } =
    await supabase.auth.signInWithPassword({
      email,
      password: cleanPassword,
    });

  console.log(
    '[ADMIN LOGIN] SUPABASE AUTH RESPONSE:',
    {
      user:
        data?.user
          ? {
              id:
                data.user.id,

              email:
                data.user.email,
            }
          : null,

      hasSession:
        Boolean(data?.session),

      error,
    }
  );

  if (error) {
    console.error(
      '[ADMIN LOGIN ERROR]',
      error
    );

    throw new Error(
      error.message ||
      'Invalid administrator credentials.'
    );
  }

  if (!data?.user) {
    throw new Error(
      'Supabase authentication did not return a user.'
    );
  }

  if (!data?.session) {
    throw new Error(
      'Supabase authentication succeeded, but no session was created.'
    );
  }

  const result = {
    success:
      true,

    authenticated:
      true,

    role:
      'administrator',

    verified:
      true,

    isAdminVerified:
      true,

    user:
      data.user,

    session:
      data.session,

    access_token:
      data.session.access_token,

    username:
      data.user.email ||
      email,

    email:
      data.user.email ||
      email,

    message:
      'Administrator login successful.',
  };

  saveAuthSession(
    result,
    'administrator'
  );

  console.log(
    '[ADMIN LOGIN] SUCCESS:',
    {
      userId:
        data.user.id,

      email:
        data.user.email,

      hasRealToken:
        Boolean(
          data.session.access_token
        ),
    }
  );

  return result;
}


/* =========================================================
   ASSESSOR LOGIN
   SUPABASE AUTHENTICATION

   DESTINATION:
   /dashboard
========================================================= */

export async function loginAssessor(
  username,
  password
) {
  const email =
    String(username || '')
      .trim()
      .toLowerCase();

  const cleanPassword =
    String(password || '');

  if (
    !email ||
    !cleanPassword
  ) {
    throw new Error(
      'Username/email and password are required.'
    );
  }

  console.log(
    '[ASSESSOR LOGIN] Supabase Auth attempt:',
    email
  );

  const {
    data,
    error,
  } =
    await supabase.auth.signInWithPassword({
      email,
      password: cleanPassword,
    });

  console.log(
    '[ASSESSOR LOGIN] SUPABASE AUTH RESPONSE:',
    {
      user:
        data?.user
          ? {
              id:
                data.user.id,

              email:
                data.user.email,

              role:
                data.user.user_metadata?.role ||
                data.user.app_metadata?.role ||
                null,
            }
          : null,

      hasSession:
        Boolean(data?.session),

      error,
    }
  );

  if (error) {
    console.error(
      '[ASSESSOR LOGIN ERROR]',
      error
    );

    throw new Error(
      error.message ||
      'Invalid assessor credentials.'
    );
  }

  if (!data?.user) {
    throw new Error(
      'Supabase authentication did not return a user.'
    );
  }

  if (!data?.session) {
    throw new Error(
      'Supabase authentication succeeded, but no session was created.'
    );
  }

  const accountRole =
    data.user.user_metadata?.role ||
    data.user.app_metadata?.role ||
    '';

  if (
    accountRole !== 'assessor'
  ) {
    console.error(
      '[ASSESSOR LOGIN] ROLE MISMATCH:',
      {
        email:
          data.user.email,

        expected:
          'assessor',

        actual:
          accountRole || 'none',
      }
    );

    await supabase.auth.signOut();

    clearAuthSession();

    throw new Error(
      'This account is not authorized to access the Assessor Portal.'
    );
  }

  const result = {
    success:
      true,

    authenticated:
      true,

    role:
      'assessor',

    verified:
      true,

    isAdminVerified:
      true,

    user:
      data.user,

    session:
      data.session,

    access_token:
      data.session.access_token,

    username:
      data.user.email ||
      email,

    email:
      data.user.email ||
      email,

    message:
      'Assessor login successful.',
  };

  saveAuthSession(
    result,
    'assessor'
  );

  console.log(
    '[ASSESSOR LOGIN] SUCCESS:',
    {
      userId:
        data.user.id,

      email:
        data.user.email,

      role:
        accountRole,

      hasRealToken:
        Boolean(
          data.session.access_token
        ),
    }
  );

  return result;
}


/* =========================================================
   FETCH TAX DECLARATIONS
========================================================= */

export async function fetchTaxDeclarations() {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .select('*')
      .order(
        'id',
        {
          ascending:
            false,
        }
      );

  if (error) {
    throwSupabaseError(
      error,
      'Failed to fetch Tax Declarations.'
    );
  }

  return data || [];
}


/* =========================================================
   SUBMIT TAX DECLARATION
========================================================= */

export async function submitTaxDeclaration(
  formData
) {
  const payload =
    normalizeTaxDeclaration(
      formData
    );

  if (!payload.td_no) {
    throw new Error(
      'TD No. is required.'
    );
  }

  /* -------------------------------------------------------
     CHECK DUPLICATE TD NUMBER
  ------------------------------------------------------- */

  const {
    data: existing,
    error:
      duplicateCheckError,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .select(
        'id, td_no'
      )
      .eq(
        'td_no',
        payload.td_no
      )
      .limit(1);

  if (duplicateCheckError) {
    throwSupabaseError(
      duplicateCheckError,
      'Unable to check TD No.'
    );
  }

  if (
    existing &&
    existing.length > 0
  ) {
    const duplicateError =
      new Error(
        `TD No. "${payload.td_no}" already exists.`
      );

    duplicateError.duplicate =
      true;

    duplicateError.field =
      'td_no';

    duplicateError.existing_id =
      existing[0].id;

    throw duplicateError;
  }

  /* -------------------------------------------------------
     INSERT
  ------------------------------------------------------- */

  const {
    data,
    error,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .insert(
        payload
      )
      .select()
      .single();

  if (error) {
    console.error(
      '[TAX DECLARATION INSERT ERROR]',
      error
    );

    if (
      error.code ===
      '23505'
    ) {
      const duplicateError =
        new Error(
          `TD No. "${payload.td_no}" already exists.`
        );

      duplicateError.duplicate =
        true;

      duplicateError.field =
        'td_no';

      throw duplicateError;
    }

    throwSupabaseError(
      error,
      'Failed to save Tax Declaration.'
    );
  }

  return {
    success:
      true,

    message:
      'Tax declaration saved to Supabase successfully!',

    insertId:
      data.id,

    td_no:
      data.td_no,

    data,
  };
}


/* =========================================================
   UPDATE TAX DECLARATION
========================================================= */

export async function updateTaxDeclaration(
  id,
  data
) {
  if (!id) {
    throw new Error(
      'Tax Declaration ID is required for updating.'
    );
  }

  if (
    !data ||
    typeof data !== 'object'
  ) {
    throw new Error(
      'Tax Declaration update data is required.'
    );
  }

  /*
   * CLEAN ASSESSMENT ROWS
   */
  const cleanedAssessmentRows =
    Array.isArray(
      data.assessment_rows
    )
      ? cleanAssessmentRows(
          data.assessment_rows
        )
      : undefined;

  const updateData = {
    td_no:
      data.td_no,

    /*
     * PROPERTY IDENTIFICATION NO.
     *
     * Keep TEXT.
     */
    property_identification_no:
      cleanPropertyIdentificationNo(
        data.property_identification_no
      ),

    full_name:
      data.full_name,

    owner_name:
      data.owner_name,

    /*
     * NUMERIC
     */
    owner_tin:
      cleanNumericValue(
        data.owner_tin
      ),

    owner_address:
      data.owner_address,

    owner_telephone:
      data.owner_telephone,

    owner_tel:
      data.owner_tel,

    administrator_name:
      data.administrator_name,

    admin_user:
      data.admin_user,

    /*
     * NUMERIC
     */
    administrator_tin:
      cleanNumericValue(
        data.administrator_tin ??
        data.admin_tin
      ),

    /*
     * NUMERIC
     */
    admin_tin:
      cleanNumericValue(
        data.admin_tin ??
        data.administrator_tin
      ),

    administrator_address:
      data.administrator_address,

    admin_address:
      data.admin_address,

    administrator_telephone:
      data.administrator_telephone,

    admin_tel:
      data.admin_tel,

    location_number_street:
      data.location_number_street,

    location_barangay_district:
      data.location_barangay_district,

    barangay:
      data.barangay,

    location_municipality_province_city:
      data.location_municipality_province_city,

    municipality:
      data.municipality,

    oct_tct_cloa_no:
      data.oct_tct_cloa_no,

    oct_tct_no:
      data.oct_tct_no,

    cct_no:
      data.cct_no,

    dated:
      data.dated,

    survey_no:
      data.survey_no,

    /*
     * NUMERIC
     */
    lot_no:
      cleanNumericValue(
        data.lot_no
      ),

    /*
     * NUMERIC
     */
    blk_no:
      cleanNumericValue(
        data.blk_no
      ),

    boundary_north:
      data.boundary_north,

    boundary_south:
      data.boundary_south,

    boundary_east:
      data.boundary_east,

    boundary_west:
      data.boundary_west,

    is_land:
      data.is_land,

    is_building:
      data.is_building,

    /*
     * INTEGER
     */
    building_no_of_storeys:
      cleanIntegerValue(
        data.building_no_of_storeys
      ),

    building_brief_description:
      data.building_brief_description,

    is_machinery:
      data.is_machinery,

    machinery_brief_description:
      data.machinery_brief_description,

    is_others:
      data.is_others,

    others_specify:
      data.others_specify,

    kind_property:
      data.kind_property,

    property_kind:
      data.property_kind,

    classification:
      data.classification,

    /*
     * NUMERIC
     */
    area:
      cleanNumericValue(
        data.area
      ),

    /*
     * NUMERIC
     */
    market_value:
      cleanNumericValue(
        data.market_value
      ),

    /*
     * VARCHAR / TEXT
     */
    actual_use:
      data.actual_use,

    /*
     * NUMERIC
     */
    assessment_level:
      cleanNumericValue(
        data.assessment_level
      ),

    /*
     * NUMERIC
     */
    assessed_value:
      cleanNumericValue(
        data.assessed_value
      ),

    /*
     * CLEANED ASSESSMENT ROWS
     */
    assessment_rows:
      cleanedAssessmentRows,

    /*
     * NUMERIC
     */
    total_market_value:
      cleanNumericValue(
        data.total_market_value
      ),

    /*
     * NUMERIC
     */
    total_assessed_value:
      cleanNumericValue(
        data.total_assessed_value
      ),

    total_assessed_value_words:
      data.total_assessed_value_words,

    taxability_status:
      data.taxability_status,

    status:
      data.status,

    effectivity_qtr:
      data.effectivity_qtr,

    /*
     * INTEGER
     */
    effectivity_yr:
      cleanIntegerValue(
        data.effectivity_yr
      ),

    effectivity_date:
      data.effectivity_date,

    approved_by:
      data.approved_by,

    approval_date:
      data.approval_date,

    cancels_td_no:
      data.cancels_td_no,

    cancels_owner:
      data.cancels_owner,

    previous_td_no:
      data.previous_td_no,

    /*
     * NUMERIC
     */
    previous_av:
      cleanNumericValue(
        data.previous_av
      ),

    memoranda:
      data.memoranda,

    submission_mode:
      data.submission_mode,

    is_quick_submit:
      data.is_quick_submit ??
      data.isQuickSubmit,

    isquicksubmit:
      data.isquicksubmit ??
      data.isQuickSubmit ??
      data.is_quick_submit,

    quick_submit:
      data.quick_submit ??
      data.quickSubmit,

    quicksubmit:
      data.quicksubmit ??
      data.quickSubmit ??
      data.quick_submit,

    isQuickSubmit:
      data.isQuickSubmit ??
      data.is_quick_submit,

    quickSubmit:
      data.quickSubmit ??
      data.quick_submit,

    property_image:
      data.property_image,

    document_image:
      data.document_image,

    image_url:
      data.image_url,

    file_path:
      data.file_path,

    verification_status:
      data.verification_status,

    rejection_reason:
      data.rejection_reason,

    is_hidden:
      data.is_hidden,
  };

  /* -------------------------------------------------------
     REMOVE UNDEFINED VALUES
  ------------------------------------------------------- */

  Object.keys(
    updateData
  ).forEach(
    (key) => {
      if (
        updateData[key] ===
        undefined
      ) {
        delete updateData[key];
      }
    }
  );

  /* -------------------------------------------------------
     UPDATE
  ------------------------------------------------------- */

  const {
    data: updated,
    error,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .update({
        ...updateData,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        id
      )
      .select()
      .single();

  if (error) {
    throwSupabaseError(
      error,
      'Failed to update Tax Declaration.'
    );
  }

  return updated;
}


/* =========================================================
   DELETE TAX DECLARATION
========================================================= */

export async function deleteTaxDeclaration(
  id
) {
  if (!id) {
    throw new Error(
      'Tax Declaration ID is required for deletion.'
    );
  }

  /* -------------------------------------------------------
     GET STORAGE PATH
  ------------------------------------------------------- */

  const {
    data: record,
    error: findError,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .select(
        'file_path'
      )
      .eq(
        'id',
        id
      )
      .maybeSingle();

  if (findError) {
    throwSupabaseError(
      findError,
      'Unable to find Tax Declaration.'
    );
  }

  /* -------------------------------------------------------
     DELETE STORAGE FILE
  ------------------------------------------------------- */

  if (
    record?.file_path
  ) {
    const {
      error:
        storageError,
    } =
      await supabase
        .storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          record.file_path,
        ]);

    if (storageError) {
      console.warn(
        '[STORAGE DELETE WARNING]',
        storageError
      );
    }
  }

  /* -------------------------------------------------------
     DELETE DATABASE RECORD
  ------------------------------------------------------- */

  const {
    error,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .delete()
      .eq(
        'id',
        id
      );

  if (error) {
    throwSupabaseError(
      error,
      'Failed to delete Tax Declaration.'
    );
  }

  return {
    success:
      true,

    message:
      'Tax declaration deleted successfully.',
  };
}


/* =========================================================
   DELETE ALIAS
========================================================= */

export const deleteTaxRecord =
  deleteTaxDeclaration;


/* =========================================================
   UPLOAD TAX DECLARATION IMAGE
========================================================= */

export async function uploadTaxDeclarationImage(
  file,
  recordId
) {
  if (!file) {
    throw new Error(
      'No image file selected.'
    );
  }

  if (!recordId) {
    throw new Error(
      'Tax Declaration record ID is required for image upload.'
    );
  }

  /* -------------------------------------------------------
     IMAGE VALIDATION
  ------------------------------------------------------- */

  if (
    !file.type ||
    !file.type.startsWith(
      'image/'
    )
  ) {
    throw new Error(
      'Only image files are allowed.'
    );
  }

  const MAX_SIZE =
    10 * 1024 * 1024;

  if (
    file.size >
    MAX_SIZE
  ) {
    throw new Error(
      'Image file must not exceed 10 MB.'
    );
  }

  /* -------------------------------------------------------
     EXTENSION
  ------------------------------------------------------- */

  const originalName =
    file.name ||
    'image.jpg';

  let extension =
    originalName
      .split('.')
      .pop()
      ?.toLowerCase() ||
    'jpg';

  const allowedExtensions = [
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
  ];

  if (
    !allowedExtensions.includes(
      extension
    )
  ) {
    extension =
      'jpg';
  }

  /* -------------------------------------------------------
     UNIQUE FILE NAME
  ------------------------------------------------------- */

  const randomPart =
    Math.random()
      .toString(36)
      .substring(
        2,
        10
      );

  const fileName =
    `${Date.now()}-${randomPart}.${extension}`;

  /* -------------------------------------------------------
     STORAGE PATH
  ------------------------------------------------------- */

  const filePath =
    `tax-declarations/${recordId}/${fileName}`;

  console.log(
    '[SUPABASE IMAGE UPLOAD]',
    {
      bucket:
        STORAGE_BUCKET,

      filePath,

      size:
        file.size,

      type:
        file.type,
    }
  );

  /* -------------------------------------------------------
     UPLOAD
  ------------------------------------------------------- */

  const {
    error:
      uploadError,
  } =
    await supabase
      .storage
      .from(
        STORAGE_BUCKET
      )
      .upload(
        filePath,
        file,
        {
          contentType:
            file.type,

          upsert:
            true,
        }
      );

  if (uploadError) {
    throwSupabaseError(
      uploadError,
      'Failed to upload image to Supabase Storage.'
    );
  }

  /* -------------------------------------------------------
     PUBLIC URL
  ------------------------------------------------------- */

  const {
    data:
      publicUrlData,
  } =
    supabase
      .storage
      .from(
        STORAGE_BUCKET
      )
      .getPublicUrl(
        filePath
      );

  const publicUrl =
    publicUrlData?.publicUrl ||
    '';

  if (!publicUrl) {
    try {
      await supabase
        .storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          filePath,
        ]);
    } catch {
      // Ignore cleanup failure.
    }

    throw new Error(
      'Image uploaded, but no public URL was returned.'
    );
  }

  /* -------------------------------------------------------
     UPDATE DATABASE
  ------------------------------------------------------- */

  const {
    data,
    error:
      updateError,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .update({
        property_image:
          publicUrl,

        document_image:
          publicUrl,

        image_url:
          publicUrl,

        file_path:
          filePath,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        recordId
      )
      .select()
      .single();

  if (updateError) {
    console.error(
      '[IMAGE DATABASE UPDATE ERROR]',
      updateError
    );

    try {
      await supabase
        .storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          filePath,
        ]);
    } catch (
      cleanupError
    ) {
      console.warn(
        '[IMAGE CLEANUP WARNING]',
        cleanupError
      );
    }

    throwSupabaseError(
      updateError,
      'Image uploaded but Tax Declaration could not be updated.'
    );
  }

  return {
    success:
      true,

    message:
      'Tax Declaration image uploaded successfully.',

    property_image:
      publicUrl,

    document_image:
      publicUrl,

    image_url:
      publicUrl,

    file_path:
      filePath,

    data,
  };
}


/* =========================================================
   UPDATE VERIFICATION STATUS
========================================================= */

export async function updateVerificationStatus(
  id,
  data
) {
  if (!id) {
    throw new Error(
      'Tax Declaration ID is required.'
    );
  }

  const allowedStatuses = [
    'Pending',
    'Approved',
    'Passed',
    'Rejected',
  ];

  const verificationStatus =
    data?.verification_status;

  if (
    !allowedStatuses.includes(
      verificationStatus
    )
  ) {
    throw new Error(
      `Invalid verification status: ${verificationStatus}`
    );
  }

  const rejectionReason =
    data?.rejection_reason ||
    '';

  const {
    data: updated,
    error,
  } =
    await supabase
      .from(
        'tax_declarations'
      )
      .update({
        verification_status:
          verificationStatus,

        rejection_reason:
          rejectionReason,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        id
      )
      .select()
      .single();

  if (error) {
    throwSupabaseError(
      error,
      'Failed to update verification status.'
    );
  }

  return {
    success:
      true,

    databaseUpdated:
      true,

    id,

    verification_status:
      verificationStatus,

    rejection_reason:
      rejectionReason,

    message:
      `Record verification status successfully updated to ${verificationStatus}.`,

    data:
      updated,
  };
}


/* =========================================================
   LOGOUT
========================================================= */

export async function logout() {
  try {
    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        '[LOGOUT] Supabase signOut error:',
        error
      );
    }
  } finally {
    clearAuthSession();
  }
}


/* =========================================================
   AUTH STATUS
========================================================= */

export function isAuthenticated() {
  return Boolean(
    getAuthToken()
  );
}


/* =========================================================
   CURRENT USER
========================================================= */

export function getCurrentUser() {
  const raw =
    localStorage.getItem(
      'authUser'
    );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(
      raw
    );
  } catch {
    return null;
  }
}


/* =========================================================
   CURRENT ROLE
========================================================= */

export function getCurrentRole() {
  return (
    localStorage.getItem(
      'userRole'
    ) ||
    localStorage.getItem(
      'role'
    ) ||
    null
  );
}


/* =========================================================
   LEGACY FETCH COMPATIBILITY

   The application no longer uses the old Express
   authentication/server API.

   Supabase functions above should be used instead.
========================================================= */

export async function customFetch(
  endpoint,
  options = {}
) {
  console.warn(
    '[customFetch] Legacy server request detected:',
    endpoint,
    options
  );

  throw new Error(
    'This application no longer uses the Express server. Please use the Supabase API functions instead.'
  );
}