ALTER TABLE public.expiry_dates
  ADD COLUMN IF NOT EXISTS account_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_password text NOT NULL DEFAULT '';