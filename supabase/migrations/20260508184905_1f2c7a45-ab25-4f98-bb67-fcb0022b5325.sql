ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_sort ON public.bank_accounts(user_id, sort_order);