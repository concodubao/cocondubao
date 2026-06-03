--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10
--
-- NOTE: Chỉnh sửa thủ công sau khi dump để file replay được trên project Supabase mới:
--   1. Bỏ các lệnh \restrict/\unrestrict (chỉ psql hiểu, supabase db push sẽ lỗi)
--   2. Thêm CREATE EXTENSION vector (pg_dump không tự xuất khi dump theo schema)
--   3. CREATE SCHEMA public + COMMENT đổi sang IF NOT EXISTS (public luôn tồn tại sẵn)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: vector; Type: EXTENSION; cần cho cột embedding + index ivfflat
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: match_knowledge_chunks(public.vector, double precision, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knowledge_chunks(query_embedding public.vector, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 5, filter_crop text DEFAULT NULL::text) RETURNS TABLE(id uuid, chunk_text text, similarity double precision, doc_id uuid)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.chunk_text,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.doc_id
  FROM knowledge_chunks kc
  JOIN knowledge_docs   kd ON kc.doc_id = kd.id
  WHERE
    kd.status = 'approved'
    AND (filter_crop IS NULL OR filter_crop = ANY(kd.crop_tags))
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_error_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_error_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid,
    user_id uuid,
    error_type text NOT NULL,
    note text,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_error_reports_error_type_check CHECK ((error_type = ANY (ARRAY['wrong_info'::text, 'irrelevant'::text, 'hard_to_understand'::text])))
);


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    crop_type text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])))
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT comments_content_check CHECK (((length(content) >= 1) AND (length(content) <= 500)))
);


--
-- Name: engineer_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineer_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid,
    assigned_to uuid,
    status text DEFAULT 'pending'::text,
    answer text,
    add_to_knowledge boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    CONSTRAINT engineer_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'resolved'::text])))
);


--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_id uuid,
    chunk_text text NOT NULL,
    embedding public.vector(1536),
    chunk_index integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: knowledge_docs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_docs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    source text,
    crop_tags text[] DEFAULT '{}'::text[],
    content text,
    status text DEFAULT 'draft'::text,
    uploaded_by uuid,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT knowledge_docs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'archived'::text])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    role text NOT NULL,
    content text NOT NULL,
    image_url text,
    confidence double precision,
    source text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'engineer'::text, 'system'::text]))),
    CONSTRAINT messages_source_check CHECK ((source = ANY (ARRAY['rag'::text, 'llm'::text, 'engineer'::text])))
);


--
-- Name: notification_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    notification_id uuid,
    user_id uuid,
    read_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    type text NOT NULL,
    image_url text,
    crop_tags text[] DEFAULT '{}'::text[],
    region text,
    sent_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['alert'::text, 'promotion'::text, 'weather'::text])))
);


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    image_url text,
    crop_tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT posts_content_check CHECK (((length(content) >= 1) AND (length(content) <= 1000)))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    endpoint text NOT NULL,
    keys jsonb NOT NULL,
    crops_filter text[] DEFAULT '{}'::text[],
    notif_types text[] DEFAULT '{alert,promotion,weather}'::text[],
    quiet_start time without time zone DEFAULT '22:00:00'::time without time zone,
    quiet_end time without time zone DEFAULT '06:00:00'::time without time zone,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text,
    role text DEFAULT 'farmer'::text NOT NULL,
    name text,
    village text,
    crops text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    email text,
    password_hash text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['farmer'::text, 'engineer'::text, 'admin'::text])))
);


--
-- Name: ai_error_reports ai_error_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_error_reports
    ADD CONSTRAINT ai_error_reports_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: engineer_queue engineer_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_queue
    ADD CONSTRAINT engineer_queue_pkey PRIMARY KEY (id);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_docs knowledge_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_docs
    ADD CONSTRAINT knowledge_docs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notification_reads notification_reads_notification_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_notification_id_user_id_key UNIQUE (notification_id, user_id);


--
-- Name: notification_reads notification_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: comments_post_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_post_id_created_at_idx ON public.comments USING btree (post_id, created_at);


--
-- Name: idx_chunks_doc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chunks_doc_id ON public.knowledge_chunks USING btree (doc_id);


--
-- Name: idx_docs_status_crop; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_docs_status_crop ON public.knowledge_docs USING btree (status, crop_tags);


--
-- Name: idx_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_session ON public.messages USING btree (session_id, created_at);


--
-- Name: idx_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_queue_status ON public.engineer_queue USING btree (status, created_at);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.chat_sessions USING btree (user_id, created_at DESC);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: knowledge_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_embedding_idx ON public.knowledge_chunks USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: post_likes_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_likes_user_id_idx ON public.post_likes USING btree (user_id);


--
-- Name: posts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at DESC);


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: ai_error_reports ai_error_reports_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_error_reports
    ADD CONSTRAINT ai_error_reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: ai_error_reports ai_error_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_error_reports
    ADD CONSTRAINT ai_error_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: ai_error_reports ai_error_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_error_reports
    ADD CONSTRAINT ai_error_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chat_sessions chat_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: engineer_queue engineer_queue_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_queue
    ADD CONSTRAINT engineer_queue_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: engineer_queue engineer_queue_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_queue
    ADD CONSTRAINT engineer_queue_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_doc_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_doc_id_fkey FOREIGN KEY (doc_id) REFERENCES public.knowledge_docs(id) ON DELETE CASCADE;


--
-- Name: knowledge_docs knowledge_docs_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_docs
    ADD CONSTRAINT knowledge_docs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: messages messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_reads notification_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_reads
    ADD CONSTRAINT notification_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_error_reports ai_error_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_error_insert ON public.ai_error_reports FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_error_reports ai_error_read_eng; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_error_read_eng ON public.ai_error_reports FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['engineer'::text, 'admin'::text]))))));


--
-- Name: ai_error_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_error_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: engineer_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engineer_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_docs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_docs knowledge_farmer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_farmer_read ON public.knowledge_docs FOR SELECT USING (((status = 'approved'::text) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['engineer'::text, 'admin'::text])))))));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_owner ON public.messages FOR SELECT USING ((session_id IN ( SELECT chat_sessions.id
   FROM public.chat_sessions
  WHERE (chat_sessions.user_id = auth.uid()))));


--
-- Name: notifications notif_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_read ON public.notifications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users u
  WHERE ((u.id = auth.uid()) AND ((notifications.crop_tags = '{}'::text[]) OR (u.crops && notifications.crop_tags))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sessions sessions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sessions_owner ON public.chat_sessions USING ((user_id = auth.uid()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_self ON public.users USING ((auth.uid() = id));


--
-- PostgreSQL database dump complete
--

