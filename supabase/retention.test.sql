-- Run after the retention migration; all fixtures are rolled back.
BEGIN;
DO $test$
DECLARE owner_id uuid; qid uuid:=gen_random_uuid(); deadline timestamptz; extended timestamptz; denied boolean:=false;
BEGIN
 SELECT id INTO owner_id FROM public.profiles LIMIT 1;
 UPDATE public.profiles SET active_plan='free' WHERE id=owner_id;
 INSERT INTO public.quotes(id,user_id,quote_number,client_name,client_phone) VALUES(qid,owner_id,'RETENTION-TEST','Temporary test','000');
 IF (SELECT retention_expires_at IS NOT NULL FROM public.quotes WHERE id=qid) THEN RAISE EXCEPTION 'Draft expires'; END IF;
 INSERT INTO public.proposals(slug,quote_id,user_id) VALUES('TEST14DX',qid,owner_id);
 SELECT retention_expires_at INTO deadline FROM public.quotes WHERE id=qid;
 IF deadline IS DISTINCT FROM now()+interval '14 days' THEN RAISE EXCEPTION 'Incorrect first deadline'; END IF;
 UPDATE public.quotes SET sent_at=now()+interval '1 day' WHERE id=qid;
 IF (SELECT retention_expires_at FROM public.quotes WHERE id=qid) IS DISTINCT FROM deadline THEN RAISE EXCEPTION 'Resend reset deadline'; END IF;
 BEGIN PERFORM public.extend_quote_retention(qid,owner_id,deadline); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Free extension allowed'; END IF;
 UPDATE public.profiles SET active_plan='pro' WHERE id=owner_id;
 extended:=public.extend_quote_retention(qid,owner_id,deadline);
 IF extended IS DISTINCT FROM deadline+interval '14 days' THEN RAISE EXCEPTION 'Extension incorrect'; END IF;
 IF (SELECT expires_at FROM public.proposals WHERE quote_id=qid LIMIT 1) IS DISTINCT FROM extended THEN RAISE EXCEPTION 'Link not extended'; END IF;
 denied:=false;
 BEGIN PERFORM public.extend_quote_retention(qid,owner_id,deadline); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Duplicate extension accepted'; END IF;
 INSERT INTO public.payment_records(payment_id,user_id,quote_id,amount,status) VALUES('retention-test',owner_id,qid,1,'confirmed');
 UPDATE public.quotes SET retention_expires_at=now()-interval '1 second' WHERE id=qid;
 denied:=false;
 BEGIN PERFORM public.extend_quote_retention(qid,owner_id,extended); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Expired extension accepted'; END IF;
 DELETE FROM public.quotes WHERE id=qid AND retention_expires_at<=now();
 IF EXISTS(SELECT 1 FROM public.proposals WHERE quote_id=qid) THEN RAISE EXCEPTION 'Links survived purge'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.payment_records WHERE payment_id='retention-test') THEN RAISE EXCEPTION 'Financial record removed'; END IF;
END $test$;
ROLLBACK;
