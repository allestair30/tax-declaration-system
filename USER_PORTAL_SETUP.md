# Property Owner User Portal Setup

The project now has a separate Property Owner portal for submitting Real Property Tax Declarations.

## Flow

Landing Page -> Access Tax Declaration Form -> Terms -> User Login -> Create Account/Login -> User Dashboard -> Pass Tax Declaration -> Tax Declaration Form.

The existing Admin/Assessor login at `/login` is kept separate.

## Supabase setup

1. Open the Supabase project used by this app.
2. Open **SQL Editor**.
3. Run `supabase/property_owner_portal.sql`.
4. In **Authentication -> URL Configuration**, configure the production Site URL and redirect URLs for the deployed application.
5. If email confirmation is enabled, new property owners must verify their email before logging in.

The migration adds `submitted_by` and `submitted_by_email` to `tax_declarations`, so each online submission is linked to the authenticated Property Owner.

## Routes

- `/user-login` - Property Owner login
- `/user-register` - Property Owner account registration
- `/user-dashboard` - authenticated Property Owner dashboard
- `/form` - authenticated Tax Declaration form
- `/login` - existing Admin/Assessor portal

## Security

Property Owner authentication uses Supabase Auth. Passwords are handled by Supabase Auth and are not stored by this React application. The supplied SQL migration adds RLS policies so a Property Owner can insert and view only Tax Declaration records linked to their own authenticated user ID.
