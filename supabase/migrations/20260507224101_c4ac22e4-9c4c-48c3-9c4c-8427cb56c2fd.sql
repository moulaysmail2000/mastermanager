
-- Friends' bank accounts (isolated from main finance)
CREATE TABLE public.friend_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  owner_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own friend accounts" ON public.friend_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own friend accounts" ON public.friend_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own friend accounts" ON public.friend_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own friend accounts" ON public.friend_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER friend_accounts_updated_at
BEFORE UPDATE ON public.friend_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transactions log for friend accounts
CREATE TABLE public.friend_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.friend_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit','withdraw')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.friend_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own friend tx" ON public.friend_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own friend tx" ON public.friend_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own friend tx" ON public.friend_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_friend_tx_account ON public.friend_transactions(account_id, created_at DESC);
