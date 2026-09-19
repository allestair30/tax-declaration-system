# Property Owner Password Recovery

The Property Owner portal now uses Supabase Auth password recovery.

## Supabase Dashboard configuration

In Supabase Dashboard:

1. Authentication → URL Configuration.
2. Add your deployed site URL to Site URL if it is not already configured.
3. Add this redirect URL:
   `https://YOUR-DOMAIN/reset-password`
4. For local development, add:
   `http://localhost:5173/reset-password`

The app calls `supabase.auth.resetPasswordForEmail()` and redirects the user to `/reset-password`.
The reset page validates the Supabase recovery session and then calls `supabase.auth.updateUser({ password })`.

## Environment variables

Set:

VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY

Do not put a Supabase service-role key in the Vite frontend.
