ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;
UPDATE public.quotes SET retention_expires_at=greatest(sent_at + interval '14 days',now()+interval '14 days') WHERE sent_at IS NOT NULL AND retention_expires_at IS NULL;
CREATE INDEX IF NOT EXISTS quotes_retention_expiry ON public.quotes(retention_expires_at) WHERE retention_expires_at IS NOT NULL;
CREATE TABLE public.quote_extensions (
 id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
 user_id uuid not null, previous_expiry timestamptz not null, new_expiry timestamptz not null, created_at timestamptz not null default now()
);
ALTER TABLE public.quote_extensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_extensions FROM anon,authenticated;
CREATE TABLE public.payment_records (
 payment_id text primary key, user_id uuid not null, quote_id uuid, amount numeric(12,2) not null,
 status text not null, confirmed_at timestamptz not null default now()
);
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_records FROM anon,authenticated;
GRANT SELECT ON public.payment_records TO authenticated;
CREATE POLICY payment_records_owner ON public.payment_records FOR SELECT TO authenticated USING ((select auth.uid())=user_id);

CREATE OR REPLACE FUNCTION public.guard_quote_retention() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE plan text; quota integer; used integer;
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM 1 FROM public.profiles WHERE id=NEW.user_id FOR UPDATE;
  SELECT active_plan INTO plan FROM public.profiles WHERE id=NEW.user_id;
  quota:=CASE plan WHEN 'pro' THEN 50 WHEN 'business' THEN 999 ELSE 5 END;
  SELECT count(*) INTO used FROM public.quotes WHERE user_id=NEW.user_id AND status NOT IN ('rejected','expired') AND (retention_expires_at IS NULL OR retention_expires_at>now());
  IF used>=quota THEN RAISE EXCEPTION 'Limite de orçamentos ativos do plano atingido'; END IF;
  NEW.retention_expires_at:=CASE WHEN NEW.sent_at IS NOT NULL THEN now()+interval '14 days' ELSE NULL END;
  IF NEW.sent_at IS NOT NULL THEN NEW.sent_at:=now(); END IF;
 ELSE
  IF OLD.retention_expires_at IS NOT NULL AND OLD.retention_expires_at<=now() THEN RAISE EXCEPTION 'Orçamento expirado'; END IF;
  IF OLD.sent_at IS NOT NULL THEN NEW.sent_at:=OLD.sent_at; END IF;
  IF NEW.retention_expires_at IS DISTINCT FROM OLD.retention_expires_at AND current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'Prazo controlado pelo servidor'; END IF;
  IF OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN NEW.sent_at:=now(); NEW.retention_expires_at:=now()+interval '14 days'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_quote_retention BEFORE INSERT OR UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.guard_quote_retention();

CREATE OR REPLACE FUNCTION public.bind_proposal_retention() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q public.quotes;
BEGIN
 SELECT * INTO q FROM public.quotes WHERE id=NEW.quote_id AND user_id=NEW.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
 IF q.retention_expires_at IS NOT NULL AND q.retention_expires_at<=now() THEN RAISE EXCEPTION 'Orçamento expirado'; END IF;
 IF q.sent_at IS NULL THEN
  UPDATE public.quotes SET sent_at=now(),status='sent' WHERE id=q.id RETURNING * INTO q;
 END IF;
 NEW.expires_at:=q.retention_expires_at;
 RETURN NEW;
END $$;
CREATE TRIGGER aaa_bind_proposal_retention BEFORE INSERT OR UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.bind_proposal_retention();
UPDATE public.proposals p SET expires_at=q.retention_expires_at FROM public.quotes q WHERE p.quote_id=q.id AND q.retention_expires_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.extend_quote_retention(p_quote_id uuid,p_user_id uuid,p_expected_expiry timestamptz) RETURNS timestamptz LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q public.quotes; plan text; expiry timestamptz;
BEGIN
 SELECT active_plan INTO plan FROM public.profiles WHERE id=p_user_id;
 IF plan IS NULL OR plan NOT IN ('pro','business') THEN RAISE EXCEPTION 'Prorrogação disponível nos planos Pro e Business'; END IF;
 SELECT * INTO q FROM public.quotes WHERE id=p_quote_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
 IF q.retention_expires_at IS NULL OR q.retention_expires_at<=now() THEN RAISE EXCEPTION 'Envie o orçamento antes de prorrogar; orçamentos expirados não podem ser recuperados'; END IF;
 IF q.retention_expires_at IS DISTINCT FROM p_expected_expiry THEN RAISE EXCEPTION 'O prazo já mudou. Atualize a página'; END IF;
 expiry:=q.retention_expires_at+interval '14 days';
 UPDATE public.quotes SET retention_expires_at=expiry WHERE id=q.id;
 UPDATE public.proposals SET expires_at=expiry WHERE quote_id=q.id;
 INSERT INTO public.quote_extensions(quote_id,user_id,previous_expiry,new_expiry) VALUES(q.id,p_user_id,q.retention_expires_at,expiry);
 RETURN expiry;
END $$;
REVOKE ALL ON FUNCTION public.extend_quote_retention(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.extend_quote_retention(uuid,uuid,timestamptz) TO service_role;
