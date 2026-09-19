import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerPropertyOwner } from '../assets/services/userAuth';

export default function PropertyOwnerRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    email: '',
    contactNumber: '',
    dateOfBirth: '',
    sex: '',
    civilStatus: '',
    barangay: '',
    municipality: 'San Fernando',
    province: 'Romblon',
    address: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  /* =========================================================
     CHANGE HANDLER
  ========================================================= */

  const change = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError('');
  };

  /* =========================================================
     PASSWORD STRENGTH
  ========================================================= */

  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };

  const passwordStrong =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number &&
    passwordChecks.special;

  /* =========================================================
     EMAIL VALIDATION
  ========================================================= */

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email.trim()
    );
  };

  /* =========================================================
     CONTACT VALIDATION
  ========================================================= */

  const isValidContactNumber = (number) => {
    const cleaned = number.replace(/\s|-/g, '');

    return /^(\+63|09)\d{9}$/.test(cleaned);
  };

  /* =========================================================
     AGE VALIDATION
  ========================================================= */

  const getAge = (dateOfBirth) => {
    if (!dateOfBirth) {
      return null;
    }

    const birthDate = new Date(dateOfBirth);

    if (Number.isNaN(birthDate.getTime())) {
      return null;
    }

    const today = new Date();

    let age =
      today.getFullYear() -
      birthDate.getFullYear();

    const monthDifference =
      today.getMonth() -
      birthDate.getMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() < birthDate.getDate()
      )
    ) {
      age -= 1;
    }

    return age;
  };

  /* =========================================================
     HANDLE SUBMIT
  ========================================================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError('');
    setSuccess('');

    /* =======================================================
       CLEAN FORM DATA
    ======================================================= */

    const firstName = form.firstName.trim();
    const middleName = form.middleName.trim();
    const lastName = form.lastName.trim();
    const suffix = form.suffix.trim();

    /*
     * Build full name from the individual name fields.
     *
     * First Name + Middle Name + Last Name + Suffix
     *
     * Middle name and suffix are optional.
     */

    const fullName = [
      firstName,
      middleName,
      lastName,
      suffix,
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    /*
     * IMPORTANT FULL NAME FIX
     *
     * Some versions of registerPropertyOwner()
     * expect "fullName".
     *
     * Other parts of the application/Supabase metadata
     * may use "full_name".
     *
     * Both are now supplied with the exact same value.
     */

    const cleanForm = {
      ...form,

      firstName,
      middleName,
      lastName,
      suffix,

      // Camel-case version expected by registerPropertyOwner()
      fullName: fullName,

      // Snake-case version used by Supabase/database metadata
      full_name: fullName,

      email: form.email
        .trim()
        .toLowerCase(),

      contactNumber: form.contactNumber
        .trim()
        .replace(/\s+/g, ''),

      barangay: form.barangay.trim(),

      municipality: form.municipality.trim(),

      province: form.province.trim(),

      address: form.address.trim(),
    };

    /* =======================================================
       REQUIRED FIRST NAME
    ======================================================= */

    if (!cleanForm.firstName) {
      setError('Please enter your first name.');
      return;
    }

    /* =======================================================
       REQUIRED LAST NAME
    ======================================================= */

    if (!cleanForm.lastName) {
      setError('Please enter your last name.');
      return;
    }

    /* =======================================================
       FULL NAME SAFETY CHECK
    ======================================================= */

    if (!cleanForm.fullName) {
      setError('Please enter your full name.');
      return;
    }

    /* =======================================================
       REQUIRED EMAIL
    ======================================================= */

    if (!cleanForm.email) {
      setError('Please enter your email address.');
      return;
    }

    /* =======================================================
       EMAIL VALIDATION
    ======================================================= */

    if (!isValidEmail(cleanForm.email)) {
      setError(
        'Please enter a valid email address.'
      );
      return;
    }

    /* =======================================================
       CONTACT NUMBER
       OPTIONAL
    ======================================================= */

    if (
      cleanForm.contactNumber &&
      !isValidContactNumber(
        cleanForm.contactNumber
      )
    ) {
      setError(
        'Please enter a valid Philippine contact number, such as 09171234567 or +639171234567.'
      );
      return;
    }

    /* =======================================================
       DATE OF BIRTH
    ======================================================= */

    if (!cleanForm.dateOfBirth) {
      setError(
        'Please enter your date of birth.'
      );
      return;
    }

    const age = getAge(
      cleanForm.dateOfBirth
    );

    if (age === null) {
      setError(
        'Please enter a valid date of birth.'
      );
      return;
    }

    if (age < 18) {
      setError(
        'You must be at least 18 years old to create a property owner account.'
      );
      return;
    }

    if (age > 120) {
      setError(
        'Please enter a valid date of birth.'
      );
      return;
    }

    /* =======================================================
       SEX
    ======================================================= */

    if (!cleanForm.sex) {
      setError(
        'Please select your sex.'
      );
      return;
    }

    /* =======================================================
       CIVIL STATUS
    ======================================================= */

    if (!cleanForm.civilStatus) {
      setError(
        'Please select your civil status.'
      );
      return;
    }

    /* =======================================================
       BARANGAY
    ======================================================= */

    if (!cleanForm.barangay) {
      setError(
        'Please enter your barangay.'
      );
      return;
    }

    /* =======================================================
       MUNICIPALITY
    ======================================================= */

    if (!cleanForm.municipality) {
      setError(
        'Please enter your municipality.'
      );
      return;
    }

    /* =======================================================
       PROVINCE
    ======================================================= */

    if (!cleanForm.province) {
      setError(
        'Please enter your province.'
      );
      return;
    }

    /* =======================================================
       COMPLETE ADDRESS
    ======================================================= */

    if (!cleanForm.address) {
      setError(
        'Please enter your complete address.'
      );
      return;
    }

    /* =======================================================
       PASSWORD REQUIRED
    ======================================================= */

    if (!cleanForm.password) {
      setError(
        'Please enter your password.'
      );
      return;
    }

    /* =======================================================
       PASSWORD STRENGTH
    ======================================================= */

    if (!passwordStrong) {
      setError(
        'Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.'
      );
      return;
    }

    /* =======================================================
       CONFIRM PASSWORD REQUIRED
    ======================================================= */

    if (!cleanForm.confirmPassword) {
      setError(
        'Please confirm your password.'
      );
      return;
    }

    /* =======================================================
       CONFIRM PASSWORD
    ======================================================= */

    if (
      cleanForm.password !==
      cleanForm.confirmPassword
    ) {
      setError(
        'Passwords do not match.'
      );
      return;
    }

    /* =======================================================
       TERMS
    ======================================================= */

    if (!agreeTerms) {
      setError(
        'You must agree to the Terms and Privacy Notice before creating an account.'
      );
      return;
    }

    /* =======================================================
       SUBMIT
    ======================================================= */

    setLoading(true);

    try {
      /*
       * Password is NOT stored in localStorage.
       *
       * It is passed only to registerPropertyOwner()
       * which should send it to Supabase Auth.
       */

      const data =
        await registerPropertyOwner(
          cleanForm
        );

      /* =====================================================
         AUTHENTICATED SESSION CREATED
      ===================================================== */

      if (data?.session) {
        setSuccess(
          'Account created successfully.'
        );

        setTimeout(() => {
          navigate(
            '/user-dashboard',
            {
              replace: true,
            }
          );
        }, 500);

        return;
      }

      /* =====================================================
         EMAIL VERIFICATION REQUIRED
      ===================================================== */

      setSuccess(
        'Account created successfully. Please check your email to verify your account, then log in.'
      );

    } catch (err) {
      console.error(
        '[PROPERTY OWNER REGISTRATION ERROR]',
        err
      );

      const message =
        String(
          err?.message || ''
        ).toLowerCase();

      /* =====================================================
         DUPLICATE EMAIL
      ===================================================== */

      if (
        message.includes(
          'already registered'
        ) ||
        message.includes(
          'already exists'
        ) ||
        message.includes(
          'duplicate'
        ) ||
        message.includes(
          'user already'
        )
      ) {
        setError(
          'An account with this email address already exists. Please use another email or log in to your existing account.'
        );
        return;
      }

      /* =====================================================
         INVALID EMAIL
      ===================================================== */

      if (
        message.includes(
          'invalid email'
        )
      ) {
        setError(
          'Please enter a valid email address.'
        );
        return;
      }

      /* =====================================================
         WEAK PASSWORD
      ===================================================== */

      if (
        message.includes(
          'password'
        ) &&
        (
          message.includes(
            'weak'
          ) ||
          message.includes(
            'at least'
          ) ||
          message.includes(
            'should'
          )
        )
      ) {
        setError(
          'Your password does not meet the required security requirements.'
        );
        return;
      }

      /* =====================================================
         MISSING REQUIRED DATA
      ===================================================== */

      if (
        message.includes(
          'full name, email, and password are required'
        )
      ) {
        setError(
          'Registration information is incomplete. Please make sure your first name, last name, email, and password are entered.'
        );
        return;
      }

      /*
       * Handle other common full-name validation messages.
       */

      if (
        message.includes(
          'full name is required'
        ) ||
        message.includes(
          'fullname is required'
        ) ||
        message.includes(
          'full_name is required'
        )
      ) {
        setError(
          'Please enter your first name and last name.'
        );
        return;
      }

      /* =====================================================
         NETWORK ERROR
      ===================================================== */

      if (
        message.includes(
          'failed to fetch'
        ) ||
        message.includes(
          'network error'
        ) ||
        message.includes(
          'fetch failed'
        )
      ) {
        setError(
          'Unable to connect to the server. Please check your internet connection and try again.'
        );
        return;
      }

      /* =====================================================
         DEFAULT ERROR
      ===================================================== */

      setError(
        err?.message ||
        'Unable to create account. Please try again.'
      );

    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     INPUT HELPER
  ========================================================= */

  const input = (
    name,
    label,
    type = 'text',
    required = false,
    options = {}
  ) => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}

      {required && (
        <span className="text-red-500">
          {' '}*
        </span>
      )}

      <input
        name={name}
        type={type}
        required={required}
        value={form[name]}
        onChange={change}
        maxLength={
          options.maxLength
        }
        autoComplete={
          options.autoComplete
        }
        placeholder={
          options.placeholder
        }
        className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );

  /* =========================================================
     SELECT HELPER
  ========================================================= */

  const select = (
    name,
    label,
    options,
    required = false
  ) => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}

      {required && (
        <span className="text-red-500">
          {' '}*
        </span>
      )}

      <select
        name={name}
        value={form[name]}
        onChange={change}
        required={required}
        className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">
          Select {label.toLowerCase()}
        </option>

        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          )
        )}
      </select>
    </label>
  );

  /* =========================================================
     PASSWORD REQUIREMENT COMPONENT
  ========================================================= */

  const PasswordRequirement = ({
    valid,
    children,
  }) => (
    <div
      className={`flex items-center gap-1.5 ${
        valid
          ? 'text-emerald-600'
          : 'text-slate-400'
      }`}
    >
      <span className="text-[10px] font-bold">
        {valid ? '✓' : '○'}
      </span>

      <span>
        {children}
      </span>
    </div>
  );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">

      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="bg-blue-900 text-white p-7">

          <p className="text-blue-300 text-xs font-bold uppercase tracking-wider">
            LGU San Fernando, Romblon
          </p>

          <h1 className="text-2xl font-bold mt-1">
            Create Property Owner Account
          </h1>

          <p className="text-blue-200 text-sm mt-1">
            Your account will be used for Tax Declaration submissions.
          </p>

        </div>

        {/* =================================================
            FORM
        ================================================= */}

        <form
          onSubmit={handleSubmit}
          className="p-7 space-y-5"
        >

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          {/* =================================================
              SUCCESS
          ================================================= */}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              {success}
            </div>
          )}

          {/* =================================================
              PERSONAL INFORMATION
          ================================================= */}

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Personal Information
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Enter your information exactly as it appears on your valid government ID.
            </p>
          </div>

          {/* NAME */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {input(
              'firstName',
              'First Name',
              'text',
              true,
              {
                maxLength: 80,
                autoComplete: 'given-name',
                placeholder: 'Enter first name',
              }
            )}

            {input(
              'middleName',
              'Middle Name',
              'text',
              false,
              {
                maxLength: 80,
                autoComplete: 'additional-name',
                placeholder: 'Enter middle name (Optional)',
              }
            )}

            {input(
              'lastName',
              'Last Name',
              'text',
              true,
              {
                maxLength: 80,
                autoComplete: 'family-name',
                placeholder: 'Enter last name',
              }
            )}

            {input(
              'suffix',
              'Suffix',
              'text',
              false,
              {
                maxLength: 20,
                placeholder: 'Jr., Sr., III (Optional)',
              }
            )}

          </div>

          {/* DOB / SEX */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {input(
              'dateOfBirth',
              'Date of Birth',
              'date',
              true,
              {
                autoComplete: 'bday',
              }
            )}

            {select(
              'sex',
              'Sex',
              [
                'Male',
                'Female',
              ],
              true
            )}

          </div>

          {/* CIVIL STATUS */}

          {select(
            'civilStatus',
            'Civil Status',
            [
              'Single',
              'Married',
              'Widowed',
              'Separated',
              'Divorced',
            ],
            true
          )}

          {/* =================================================
              CONTACT INFORMATION
          ================================================= */}

          <div className="border-t border-slate-200 pt-5">

            <h2 className="text-sm font-bold text-slate-900">
              Contact and Address
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Provide accurate contact information for official notifications.
            </p>

          </div>

          {/* EMAIL */}

          {input(
            'email',
            'Email Address',
            'email',
            true,
            {
              maxLength: 150,
              autoComplete: 'email',
              placeholder: 'example@email.com',
            }
          )}

          {/* CONTACT */}

          {input(
            'contactNumber',
            'Contact Number',
            'tel',
            false,
            {
              maxLength: 13,
              autoComplete: 'tel',
              placeholder: '09171234567 (Optional)',
            }
          )}

          {/* BARANGAY / MUNICIPALITY */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {input(
              'barangay',
              'Barangay',
              'text',
              true,
              {
                maxLength: 100,
                autoComplete: 'address-level3',
                placeholder: 'Enter barangay',
              }
            )}

            {input(
              'municipality',
              'Municipality',
              'text',
              true,
              {
                maxLength: 100,
                autoComplete: 'address-level2',
              }
            )}

          </div>

          {/* PROVINCE */}

          {input(
            'province',
            'Province',
            'text',
            true,
            {
              maxLength: 100,
              autoComplete: 'address-level1',
            }
          )}

          {/* COMPLETE ADDRESS */}

          <label className="block text-sm font-semibold text-slate-700">

            Complete Address

            <span className="text-red-500">
              {' '}*
            </span>

            <textarea
              name="address"
              value={form.address}
              onChange={change}
              rows="3"
              required
              maxLength={300}
              placeholder="House/Block/Lot, Street, Sitio/Purok"
              autoComplete="street-address"
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />

          </label>

          {/* =================================================
              IDENTIFICATION
          ================================================= */}

          {/* Government ID section intentionally retained */}

          {/* =================================================
              PASSWORD
          ================================================= */}

          <div className="border-t border-slate-200 pt-5">

            <h2 className="text-sm font-bold text-slate-900">
              Account Security
            </h2>

            <p className="text-xs text-slate-500 mt-0.5">
              Create a strong password to protect your account.
            </p>

          </div>

          {/* PASSWORD */}

          <label className="block text-sm font-semibold text-slate-700">

            Password

            <span className="text-red-500">
              {' '}*
            </span>

            <div className="relative">

              <input
                name="password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                required
                value={form.password}
                onChange={change}
                autoComplete="new-password"
                maxLength={128}
                placeholder="Create a strong password"
                className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-20 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700 hover:text-blue-900"
              >
                {showPassword
                  ? 'Hide'
                  : 'Show'}
              </button>

            </div>

          </label>

          {/* PASSWORD REQUIREMENTS */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px]">

            <PasswordRequirement
              valid={
                passwordChecks.length
              }
            >
              At least 8 characters
            </PasswordRequirement>

            <PasswordRequirement
              valid={
                passwordChecks.uppercase
              }
            >
              One uppercase letter
            </PasswordRequirement>

            <PasswordRequirement
              valid={
                passwordChecks.lowercase
              }
            >
              One lowercase letter
            </PasswordRequirement>

            <PasswordRequirement
              valid={
                passwordChecks.number
              }
            >
              One number
            </PasswordRequirement>

            <PasswordRequirement
              valid={
                passwordChecks.special
              }
            >
              One special character
            </PasswordRequirement>

          </div>

          {/* CONFIRM PASSWORD */}

          <label className="block text-sm font-semibold text-slate-700">

            Confirm Password

            <span className="text-red-500">
              {' '}*
            </span>

            <div className="relative">

              <input
                name="confirmPassword"
                type={
                  showConfirmPassword
                    ? 'text'
                    : 'password'
                }
                required
                value={
                  form.confirmPassword
                }
                onChange={change}
                autoComplete="new-password"
                maxLength={128}
                placeholder="Re-enter your password"
                className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-20 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) => !value
                  )
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700 hover:text-blue-900"
              >
                {showConfirmPassword
                  ? 'Hide'
                  : 'Show'}
              </button>

            </div>

          </label>

          {/* =================================================
              TERMS
          ================================================= */}

          <div className="border-t border-slate-200 pt-5">

            <label className="flex items-start gap-2 cursor-pointer">

              <input
                type="checkbox"
                checked={
                  agreeTerms
                }
                onChange={(e) =>
                  setAgreeTerms(
                    e.target.checked
                  )
                }
                className="mt-0.5 h-4 w-4 accent-blue-700"
              />

              <span className="text-[11px] text-slate-600 leading-relaxed">
                I confirm that the information I provided
                is accurate and belongs to me. I agree to
                the system's Terms of Use and Privacy Notice
                and understand that my information may be
                processed for Tax Declaration-related services.
              </span>

            </label>

          </div>

          {/* =================================================
              CREATE ACCOUNT
          ================================================= */}

          <button
            type="submit"
            disabled={
              loading ||
              !!success
            }
            className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition"
          >
            {loading
              ? 'Creating Account...'
              : 'Create Account'}
          </button>

          {/* =================================================
              LOGIN
          ================================================= */}

          <div className="text-center text-sm text-slate-600">

            Already registered?{' '}

            <Link
              to="/user-login"
              className="text-blue-700 font-bold hover:underline"
            >
              Login
            </Link>

          </div>

          {/* =================================================
              BACK HOME
          ================================================= */}

          <button
            type="button"
            onClick={() =>
              navigate('/')
            }
            className="w-full text-xs text-slate-500 hover:text-slate-800"
          >
            ← Back to Home
          </button>

        </form>

      </div>

    </div>
  );
}