import { supabase } from './supabaseClient';

export async function registerPropertyOwner({ fullName, email, contactNumber, address, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(fullName || '').trim();
  const cleanPassword = String(password || '');

  if (!cleanName || !cleanEmail || !cleanPassword) {
    throw new Error('Full name, email, and password are required.');
  }
  if (cleanPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      data: {
        full_name: cleanName,
        contact_number: contactNumber || '',
        address: address || '',
        account_type: 'property_owner',
      },
    },
  });

  if (error) throw new Error(error.message || 'Unable to create account.');

  // Keep a separate Property Owner profile so the Assessor dashboard can
  // manage account status without changing the existing Supabase Auth flow.
  if (data?.user?.id) {
    const { error: profileError } = await supabase
      .from('property_owner_accounts')
      .upsert({
        id: data.user.id,
        full_name: cleanName,
        email: cleanEmail,
        contact_number: contactNumber || '',
        address: address || '',
        account_status: 'Pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      console.warn('[PROPERTY OWNER PROFILE] Unable to save profile:', profileError);
    }
  }

  return data;
}

export async function loginPropertyOwner(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanEmail || !cleanPassword) {
    throw new Error('Email and password are required.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });

  if (error) throw new Error(error.message || 'Invalid email or password.');

  const user = data?.user;
  if (!user) throw new Error('Unable to load your account.');

  const accountType = user.user_metadata?.account_type;
  if (accountType && accountType !== 'property_owner') {
    await supabase.auth.signOut();
    throw new Error('This account is not a Property Owner account.');
  }

  let { data: profile, error: profileError } = await supabase
    .from('property_owner_accounts')
    .select('account_status, full_name, email, contact_number, address')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.warn('[PROPERTY OWNER PROFILE] Unable to load profile:', profileError);
  }

  // If email confirmation prevented the registration-time profile insert,
  // create the profile automatically on the first successful login.
  if (!profile) {
    const { data: createdProfile, error: createProfileError } = await supabase
      .from('property_owner_accounts')
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        contact_number: user.user_metadata?.contact_number || '',
        address: user.user_metadata?.address || '',
        account_status: 'Pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('account_status, full_name, email, contact_number, address')
      .single();

    if (createProfileError) {
      console.warn('[PROPERTY OWNER PROFILE] Unable to create profile:', createProfileError);
    } else {
      profile = createdProfile;
    }
  }

  if (profile?.account_status === 'Locked') {
    await supabase.auth.signOut();
    throw new Error('Your Property Owner account is locked. Please contact the Assessor’s Office.');
  }

  return data;
}

export async function getPropertyOwnerSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export async function logoutPropertyOwner() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}


export async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error('Email address is required.');
  }

  const redirectTo = `${window.location.origin}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message || 'Unable to send password reset email.');
  }

  return true;
}

export async function updatePropertyOwnerPassword(newPassword) {
  const password = String(newPassword || '');

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw new Error(error.message || 'Unable to update your password.');
  }

  return data;
}
