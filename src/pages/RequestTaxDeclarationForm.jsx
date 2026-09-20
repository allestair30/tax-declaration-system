import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../assets/services/supabaseClient';

const BUCKET = 'tax-declarations';

/*
 * Formats the Supabase numeric id (1, 2, 3 ...) as a
 * zero-padded request number (001, 002, 003 ...).
 * The database id itself stays a plain number.
 */
const formatRequestId = (id) => String(id).padStart(3, '0');

async function uploadRequestFile(file, userId, label) {
  if (!file) return null;

  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    throw new Error(`${label} must be an image or PDF file.`);
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`${label} must be smaller than 10MB.`);
  }

  const ext =
    file.name.split('.').pop()?.toLowerCase() || 'bin';

  const path =
    `requests/${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(
      error.message || `Unable to upload ${label}.`
    );
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data?.publicUrl || '';
}

function FileField({
  label,
  required,
  value,
  onChange,
  onRemove,
  accept = 'image/*,.pdf',
}) {
  const inputRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState('');

  const [viewerOpen, setViewerOpen] = useState(false);

  /*
   * Create a temporary local URL for the selected file so
   * it can be previewed and opened before submitting.
   * The URL is released when the file changes or is removed.
   */
  useEffect(() => {
    if (!value) {
      setPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(value);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  /*
   * Close the viewer with the Escape key.
   */
  useEffect(() => {
    if (!viewerOpen) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setViewerOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [viewerOpen]);

  const isImage =
    !!value && value.type.startsWith('image/');

  const isPdf =
    !!value && value.type === 'application/pdf';

  const removeFile = () => {
    setViewerOpen(false);

    if (inputRef.current) {
      inputRef.current.value = '';
    }

    if (onRemove) {
      onRemove();
    }
  };

  return (
    <div>
      <label className="block">
        <span className="block text-xs font-bold uppercase tracking-wide text-slate-700">
          {label}
          {required ? ' *' : ' (Optional)'}
        </span>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          required={required}
          onChange={onChange}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
        />

        {value && (
          <span className="mt-1 block text-[10px] text-emerald-700">
            ✓ Document uploaded
          </span>
        )}
      </label>

      {/* ===================================================
          VIEW / CHANGE / REMOVE SELECTED DOCUMENT
      =================================================== */}

      {value && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {/* Click the preview to view it larger */}

          <button
            type="button"
            onClick={() =>
              setViewerOpen(true)
            }
            title="Click to view"
            className="h-32 w-full overflow-hidden rounded-md border border-slate-200 bg-white flex items-center justify-center cursor-zoom-in"
          >
            {isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt={label}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-center">
                <div className="text-3xl">
                  📄
                </div>

                <p className="mt-1 text-[10px] text-slate-500">
                  {isPdf
                    ? 'PDF document'
                    : 'Document file'}
                </p>
              </div>
            )}
          </button>

          <p
            className="mt-2 truncate text-[10px] text-slate-600"
            title={value.name}
          >
            {value.name} ·{' '}
            {Math.max(
              1,
              Math.round(value.size / 1024)
            )}{' '}
            KB
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setViewerOpen(true)
              }
              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-bold"
            >
              View
            </button>

            <button
              type="button"
              onClick={() =>
                inputRef.current?.click()
              }
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold"
            >
              Change
            </button>

            <button
              type="button"
              onClick={removeFile}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* ===================================================
          FULL-SIZE VIEWER
      =================================================== */}

      {value && viewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() =>
            setViewerOpen(false)
          }
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {label}
                </p>

                <p
                  className="truncate text-[10px] text-slate-500"
                  title={value.name}
                >
                  {value.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewerOpen(false)
                }
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-3 flex items-center justify-center">
              {isImage && previewUrl && (
                <img
                  src={previewUrl}
                  alt={label}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              )}

              {isPdf && previewUrl && (
                <iframe
                  src={previewUrl}
                  title={label}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                />
              )}

              {!isImage && !isPdf && (
                <p className="text-xs text-slate-500">
                  Preview is not available for this file.
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-[10px] font-bold"
              >
                Open in New Tab ↗
              </a>

              <button
                type="button"
                onClick={() =>
                  inputRef.current?.click()
                }
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold"
              >
                Change
              </button>

              <button
                type="button"
                onClick={removeFile}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestTaxDeclarationForm() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);

  const [form, setForm] = useState({
    td_no: '',
    property_identification_no: '',
    purpose: '',
  });

  const [files, setFiles] = useState({
    validGovernmentId: null,
    proofOfOwnership: null,
    supportingDocument: null,
    authorizationLetter: null,
  });

  const [existingDeclaration, setExistingDeclaration] =
    useState(null);

  const [loadingLookup, setLoadingLookup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (!data?.session) {
        navigate('/user-login', {
          replace: true,
          state: {
            from: '/request-form',
          },
        });
      } else {
        setSession(data.session);
      }
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  const change = (e) =>
    setForm((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));

  const lookupDeclaration = async () => {
    setError('');
    setMessage('');
    setExistingDeclaration(null);

    if (
      !form.td_no.trim() ||
      !form.property_identification_no.trim()
    ) {
      setError(
        'Please enter both TD Number and Property Identification Number.'
      );

      return null;
    }

    setLoadingLookup(true);

    try {
      const {
        data,
        error: queryError,
      } = await supabase
        .from('tax_declarations')
        .select(
          'id, td_no, property_identification_no, owner_name, full_name, owner_address, verification_status'
        )
        .eq('td_no', form.td_no.trim())
        .eq(
          'property_identification_no',
          form.property_identification_no.trim()
        )
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (!data) {
        throw new Error(
          'No matching Tax Declaration was found. Please check the TD Number and Property Identification Number.'
        );
      }

      setExistingDeclaration(data);

      setMessage(
        `Tax Declaration ${data.td_no} was found. You may now submit your request.`
      );

      return data;
    } catch (err) {
      setError(
        err?.message ||
          'Unable to find the Tax Declaration.'
      );

      return null;
    } finally {
      setLoadingLookup(false);
    }
  };

  const submitRequest = async (e) => {
    e.preventDefault();

    setError('');
    setMessage('');

    if (!session?.user) {
      navigate('/user-login', {
        replace: true,
        state: {
          from: '/request-form',
        },
      });

      return;
    }

    if (!form.purpose.trim()) {
      setError('Purpose is required.');
      return;
    }

    if (
      !files.validGovernmentId ||
      !files.proofOfOwnership ||
      !files.supportingDocument
    ) {
      setError(
        'Valid Government ID, Proof of Ownership, and PSA BIRTH are required.'
      );

      return;
    }

    setSubmitting(true);

    try {
      const declaration =
        existingDeclaration ||
        (await lookupDeclaration());

      if (!declaration) {
        return;
      }

      /*
       * IMPORTANT:
       * This is the authenticated Supabase user's UUID.
       * It is saved as requester_id so the request belongs
       * to the property owner's account.
       */
      const userId = session.user.id;

      if (!userId) {
        throw new Error(
          'Unable to identify the logged-in property owner.'
        );
      }

      const [
        validIdUrl,
        ownershipUrl,
        supportingUrl,
        authorizationUrl,
      ] = await Promise.all([
        uploadRequestFile(
          files.validGovernmentId,
          userId,
          'Valid Government ID'
        ),

        uploadRequestFile(
          files.proofOfOwnership,
          userId,
          'Proof of Ownership'
        ),

        uploadRequestFile(
          files.supportingDocument,
          userId,
          'PSA BIRTH'
        ),

        files.authorizationLetter
          ? uploadRequestFile(
              files.authorizationLetter,
              userId,
              'Authorization Letter'
            )
          : Promise.resolve(null),
      ]);

      /*
       * FIX:
       * requester_id is required by tax_declaration_requests.
       *
       * Keep submitted_by as well because your existing
       * schema/code already uses it.
       */
      const {
        data,
        error: insertError,
      } = await supabase
        .from('tax_declaration_requests')
        .insert({
          requester_id: userId,

          submitted_by: userId,

          submitted_by_email:
            session.user.email || '',

          tax_declaration_id:
            declaration.id,

          td_no:
            declaration.td_no,

          property_identification_no:
            declaration.property_identification_no,

          purpose:
            form.purpose.trim(),

          valid_government_id_url:
            validIdUrl,

          proof_of_ownership_url:
            ownershipUrl,

          supporting_document_image_url:
            supportingUrl,

          authorization_letter_url:
            authorizationUrl,

          verification_status:
            'Pending',
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      /*
       * Notify other parts of the application that
       * a new Tax Declaration Request was created.
       *
       * This does not change your existing workflow.
       */
      window.dispatchEvent(
        new Event('taxDeclarationRequestUpdated')
      );

      window.dispatchEvent(
        new Event('taxDeclarationUpdated')
      );

      window.dispatchEvent(
        new Event('tax_records_updated')
      );

      setMessage(
        `Request ${
          data?.id ? `#${formatRequestId(data.id)}` : ''
        } submitted successfully. Please wait for the Assessor's verification and release.`
      );

      setForm({
        td_no: '',
        property_identification_no: '',
        purpose: '',
      });

      setFiles({
        validGovernmentId: null,
        proofOfOwnership: null,
        supportingDocument: null,
        authorizationLetter: null,
      });

      setExistingDeclaration(null);

      document
        .querySelectorAll('input[type="file"]')
        .forEach((input) => {
          input.value = '';
        });
    } catch (err) {
      console.error(
        'Tax Declaration Request submission error:',
        err
      );

      setError(
        err?.message ||
          'Unable to submit the Tax Declaration request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="bg-blue-950 text-white rounded-2xl p-6 shadow mb-5">
          <p className="text-[10px] uppercase tracking-widest text-blue-300 font-bold">
            Property Owner Portal
          </p>

          <h1 className="text-2xl font-extrabold mt-1">
            Request Tax Declaration
          </h1>

          <p className="text-blue-200 text-sm mt-1">
            Submit your supporting documents for Assessor verification and release.
          </p>
        </div>

        <form
          onSubmit={submitRequest}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6"
        >

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
              {message}
            </div>
          )}

          <section>
            <h2 className="font-bold text-slate-900 mb-3">
              Tax Declaration Identification
            </h2>

            <div className="grid md:grid-cols-2 gap-4">

              <label className="block text-sm font-semibold text-slate-700">
                TD Number *

                <input
                  name="td_no"
                  value={form.td_no}
                  onChange={change}
                  required
                  className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Property Identification Number *

                <input
                  name="property_identification_no"
                  value={
                    form.property_identification_no
                  }
                  onChange={change}
                  required
                  className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5"
                />
              </label>

            </div>

            <button
              type="button"
              onClick={lookupDeclaration}
              disabled={loadingLookup}
              className="mt-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-bold"
            >
              {loadingLookup
                ? 'Checking...'
                : 'Check Tax Declaration'}
            </button>

            {existingDeclaration && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">

                <strong>
                  {existingDeclaration.td_no}
                </strong>

                {' · '}

                {
                  existingDeclaration.property_identification_no
                }

                <br />

                Owner:{' '}

                {existingDeclaration.owner_name ||
                  existingDeclaration.full_name ||
                  '—'}

              </div>
            )}
          </section>

          <label className="block text-sm font-semibold text-slate-700">
            Purpose *

            <textarea
              name="purpose"
              value={form.purpose}
              onChange={change}
              required
              rows="3"
              placeholder="State the purpose of requesting the Tax Declaration."
              className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5"
            />
          </label>

          <section className="grid md:grid-cols-2 gap-5 border-t pt-5">

            <FileField
              label="Valid Government ID"
              required
              value={files.validGovernmentId}
              onChange={(e) =>
                setFiles((p) => ({
                  ...p,
                  validGovernmentId:
                    e.target.files?.[0] || null,
                }))
              }
              onRemove={() =>
                setFiles((p) => ({
                  ...p,
                  validGovernmentId: null,
                }))
              }
            />

            <FileField
              label="Proof of Ownership"
              required
              value={files.proofOfOwnership}
              onChange={(e) =>
                setFiles((p) => ({
                  ...p,
                  proofOfOwnership:
                    e.target.files?.[0] || null,
                }))
              }
              onRemove={() =>
                setFiles((p) => ({
                  ...p,
                  proofOfOwnership: null,
                }))
              }
            />

            <FileField
              label="PSA BIRTH"
              required
              value={files.supportingDocument}
              onChange={(e) =>
                setFiles((p) => ({
                  ...p,
                  supportingDocument:
                    e.target.files?.[0] || null,
                }))
              }
              onRemove={() =>
                setFiles((p) => ({
                  ...p,
                  supportingDocument: null,
                }))
              }
            />

            <FileField
              label="Authorization Letter"
              value={files.authorizationLetter}
              onChange={(e) =>
                setFiles((p) => ({
                  ...p,
                  authorizationLetter:
                    e.target.files?.[0] || null,
                }))
              }
              onRemove={() =>
                setFiles((p) => ({
                  ...p,
                  authorizationLetter: null,
                }))
              }
            />

          </section>

          <div className="flex justify-between gap-3 border-t pt-5">

            <button
              type="button"
              onClick={() =>
                navigate('/user-dashboard')
              }
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2.5 rounded-lg text-xs font-bold"
            >
              ← Back to User Dashboard
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow"
            >
              {submitting
                ? 'Submitting Request...'
                : 'Submit Request'}
            </button>

          </div>

        </form>
      </div>
    </div>
  );
}