ALTER TABLE public.account_categories
ADD COLUMN IF NOT EXISTS delivery_limit smallint NOT NULL DEFAULT 2
CHECK (delivery_limit BETWEEN 1 AND 3);