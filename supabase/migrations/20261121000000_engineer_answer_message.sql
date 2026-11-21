BEGIN;

ALTER TABLE public.engineer_queue
  ADD COLUMN answer_message_id uuid UNIQUE REFERENCES public.messages(id) ON DELETE SET NULL;

-- Lock the queue item while saving its reply. The chat message and its queue
-- record commit together, including when an engineer answers a pending item.
CREATE FUNCTION public.save_engineer_answer(
  p_queue_id uuid, p_engineer_id uuid, p_is_admin boolean, p_answer text, p_add_to_knowledge boolean
) RETURNS TABLE (question text, farmer_id uuid, previous_answer text, overwritten boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  item public.engineer_queue%ROWTYPE;
  session_id_value uuid;
  reply_id uuid;
  candidates uuid[];
BEGIN
  SELECT * INTO STRICT item FROM public.engineer_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT p_is_admin AND item.assigned_to IS NOT NULL AND item.assigned_to <> p_engineer_id THEN
    RAISE EXCEPTION 'Already assigned' USING ERRCODE = '42501';
  END IF;

  SELECT m.session_id, m.content, s.user_id INTO STRICT session_id_value, question, farmer_id
    FROM public.messages m JOIN public.chat_sessions s ON s.id = m.session_id
    WHERE m.id = item.message_id;
  previous_answer := item.answer;
  reply_id := item.answer_message_id;

  -- Older answers have no stored link. Adopt a reply only when both sides
  -- of the match are unique. Leave ambiguous history intact for reconciliation.
  IF reply_id IS NULL AND item.status = 'resolved' AND previous_answer IS NOT NULL THEN
    SELECT array_agg(m.id) INTO candidates FROM public.messages m
      WHERE m.session_id = session_id_value AND m.role = 'engineer' AND m.content = previous_answer
        AND NOT EXISTS (SELECT 1 FROM public.engineer_queue q WHERE q.answer_message_id = m.id);
    IF cardinality(candidates) > 1 OR (candidates IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.engineer_queue q JOIN public.messages m ON m.id = q.message_id
      WHERE q.id <> item.id AND q.status = 'resolved' AND q.answer_message_id IS NULL
        AND q.answer = previous_answer AND m.session_id = session_id_value
    )) THEN
      RAISE EXCEPTION 'Ambiguous legacy reply' USING ERRCODE = 'PT409';
    END IF;
    reply_id := candidates[1];
  END IF;

  overwritten := reply_id IS NOT NULL;
  IF overwritten THEN
    UPDATE public.messages SET content = p_answer WHERE id = reply_id;
  ELSE
    INSERT INTO public.messages (session_id, role, content, source)
      VALUES (session_id_value, 'engineer', p_answer, 'engineer') RETURNING id INTO reply_id;
  END IF;
  UPDATE public.engineer_queue SET answer_message_id = reply_id, answer = p_answer,
    status = 'resolved', resolved_at = now(), add_to_knowledge = p_add_to_knowledge,
    assigned_to = coalesce(item.assigned_to, p_engineer_id)
    WHERE id = item.id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_engineer_answer(uuid, uuid, boolean, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_engineer_answer(uuid, uuid, boolean, text, boolean)
  TO service_role;

COMMIT;
