ALTER TABLE public.unpaid_numbers ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.expiry_dates ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;