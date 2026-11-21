-- Run with psql -v ON_ERROR_STOP=1 against a migrated test database.
BEGIN;
DO $test$
DECLARE
  engineer uuid;
  farmer uuid;
  session uuid;
  question1 uuid;
  question2 uuid;
  item1 uuid;
  item2 uuid;
  reply1 uuid;
  reply2 uuid;
  saved record;
BEGIN
  INSERT INTO public.users(role) VALUES ('engineer') RETURNING id INTO engineer;
  INSERT INTO public.users(role) VALUES ('farmer') RETURNING id INTO farmer;
  INSERT INTO public.chat_sessions(user_id) VALUES (farmer) RETURNING id INTO session;
  INSERT INTO public.messages(session_id, role, content) VALUES (session, 'user', 'First?') RETURNING id INTO question1;
  INSERT INTO public.messages(session_id, role, content) VALUES (session, 'user', 'Second?') RETURNING id INTO question2;
  INSERT INTO public.engineer_queue(message_id) VALUES (question1) RETURNING id INTO item1;
  INSERT INTO public.engineer_queue(message_id) VALUES (question2) RETURNING id INTO item2;

  SELECT * INTO saved FROM public.save_engineer_answer(item1, engineer, false, 'Same', false);
  ASSERT NOT saved.overwritten AND saved.farmer_id = farmer AND saved.question = 'First?';
  PERFORM public.save_engineer_answer(item2, engineer, false, 'Same', false);
  SELECT answer_message_id INTO reply1 FROM public.engineer_queue WHERE id = item1;
  SELECT answer_message_id INTO reply2 FROM public.engineer_queue WHERE id = item2;
  ASSERT reply1 <> reply2;
  SELECT * INTO saved FROM public.save_engineer_answer(item1, engineer, false, 'Edited', false);
  ASSERT saved.overwritten AND saved.previous_answer = 'Same';
  ASSERT (SELECT content = 'Edited' FROM public.messages WHERE id = reply1);
  ASSERT (SELECT content = 'Same' FROM public.messages WHERE id = reply2);
  ASSERT (SELECT count(*) = 2 FROM public.messages WHERE session_id = session AND role = 'engineer');

  -- A unique historical reply can still be edited and gains a permanent link.
  UPDATE public.engineer_queue SET answer_message_id = NULL WHERE id = item1;
  PERFORM public.save_engineer_answer(item1, engineer, false, 'Same', false);
  ASSERT (SELECT answer_message_id = reply1 FROM public.engineer_queue WHERE id = item1);

  UPDATE public.engineer_queue SET answer_message_id = NULL WHERE id IN (item1, item2);
  BEGIN
    PERFORM public.save_engineer_answer(item1, engineer, false, 'Wrong', false);
    RAISE EXCEPTION 'Ambiguous edit unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  ASSERT (SELECT count(*) = 2 FROM public.messages WHERE session_id = session AND content = 'Same');

  BEGIN
    PERFORM public.save_engineer_answer(item1, farmer, false, 'Wrong', false);
    RAISE EXCEPTION 'Assignment check unexpectedly passed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  DELETE FROM public.messages WHERE id IN (reply1, reply2);
  SELECT * INTO saved FROM public.save_engineer_answer(item1, engineer, false, 'Restored', true);
  ASSERT NOT saved.overwritten;
  ASSERT (SELECT add_to_knowledge AND answer_message_id IS NOT NULL FROM public.engineer_queue WHERE id = item1);
END
$test$;
ROLLBACK;
