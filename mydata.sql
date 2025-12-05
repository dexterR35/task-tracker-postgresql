--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

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

DROP DATABASE IF EXISTS tasktracker;
--
-- Name: tasktracker; Type: DATABASE; Schema: -; Owner: tasktracker
--

CREATE DATABASE tasktracker WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.utf8';


ALTER DATABASE tasktracker OWNER TO tasktracker;


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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: tasktracker
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO tasktracker;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: deliverables; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.deliverables (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    department character varying(100),
    time_per_unit numeric(10,2),
    time_unit character varying(10) DEFAULT 'hr'::character varying,
    variations_time numeric(10,2),
    variations_time_unit character varying(10) DEFAULT 'min'::character varying,
    requires_quantity boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_UID" character varying(255),
    created_by_name character varying(255),
    "updated_by_UID" character varying(255),
    updated_by_name character varying(255),
    declinari_time numeric(10,2),
    declinari_time_unit character varying(10) DEFAULT 'min'::character varying
);


ALTER TABLE public.deliverables OWNER TO tasktracker;

--
-- Name: months; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.months (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    month_id character varying(50) NOT NULL,
    year_id character varying(10) NOT NULL,
    department character varying(100) DEFAULT 'design'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    month_name character varying(100),
    start_date date,
    end_date date,
    days_in_month integer,
    board_id character varying(255),
    month integer,
    year integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_UID" character varying(255),
    "updated_by_UID" character varying(255)
);


ALTER TABLE public.months OWNER TO tasktracker;

--
-- Name: reporters; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.reporters (
    name character varying(255) NOT NULL,
    email character varying(255),
    department character varying(100),
    channel character varying(100),
    channel_name character varying(100),
    country character varying(10),
    "reporter_UID" character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_UID" character varying(255),
    created_by_name character varying(255),
    "updated_by_UID" character varying(255),
    updated_by_name character varying(255),
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL
);


ALTER TABLE public.reporters OWNER TO tasktracker;

--
-- Name: task_ai_usage; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.task_ai_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    ai_models text[],
    ai_time numeric(10,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_ai_usage OWNER TO tasktracker;

--
-- Name: task_deliverables; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.task_deliverables (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    deliverable_name character varying(255) NOT NULL,
    count integer DEFAULT 1,
    variations_enabled boolean DEFAULT false,
    variations_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_deliverables OWNER TO tasktracker;

--
-- Name: task_departments; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.task_departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    department character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_departments OWNER TO tasktracker;

--
-- Name: task_markets; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.task_markets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    market character varying(10) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.task_markets OWNER TO tasktracker;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    month_id character varying(50) NOT NULL,
    "user_UID" character varying(255) NOT NULL,
    board_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_UID" character varying(255),
    created_by_name character varying(255),
    "updated_by_UID" character varying(255),
    updated_by_name character varying(255),
    task_name character varying(255),
    products character varying(255),
    time_in_hours numeric(10,2),
    is_vip boolean DEFAULT false,
    reworked boolean DEFAULT false,
    use_shutterstock boolean DEFAULT false,
    observations text,
    "reporter_UID" character varying(255),
    reporter_name character varying(255),
    start_date date,
    end_date date,
    department character varying(100)
);


ALTER TABLE public.tasks OWNER TO tasktracker;

--
-- Name: team_days_off; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.team_days_off (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "user_UID" character varying(255) NOT NULL,
    user_name character varying(255),
    base_days numeric(10,2) DEFAULT 0,
    days_off numeric(10,2) DEFAULT 0,
    days_remaining numeric(10,2) DEFAULT 0,
    days_total numeric(10,2) DEFAULT 0,
    monthly_accrual numeric(10,2) DEFAULT 1.75,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_UID" character varying(255),
    created_by_name character varying(255),
    "updated_by_UID" character varying(255),
    updated_by_name character varying(255)
);


ALTER TABLE public.team_days_off OWNER TO tasktracker;

--
-- Name: team_days_off_dates; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.team_days_off_dates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    team_days_off_id uuid NOT NULL,
    "user_UID" character varying(255) NOT NULL,
    date_string character varying(50) NOT NULL,
    day integer,
    month integer,
    year integer,
    "timestamp" bigint,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.team_days_off_dates OWNER TO tasktracker;

--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    "user_UID" character varying(255) NOT NULL,
    permission character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_permissions OWNER TO tasktracker;

--
-- Name: users; Type: TABLE; Schema: public; Owner: tasktracker
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "user_UID" character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying,
    password_hash character varying(255) NOT NULL,
    color_set character varying(7),
    is_active boolean DEFAULT true,
    occupation character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_UID" character varying(255),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_color_set_check CHECK (((color_set IS NULL) OR ((color_set)::text ~* '^#[0-9A-Fa-f]{6}$'::text))),
    CONSTRAINT users_email_check CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO tasktracker;

--
-- Data for Name: deliverables; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.deliverables (id, name, description, department, time_per_unit, time_unit, variations_time, variations_time_unit, requires_quantity, created_at, updated_at, "created_by_UID", created_by_name, "updated_by_UID", updated_by_name, declinari_time, declinari_time_unit) FROM stdin;


--
-- Data for Name: months; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.months (id, month_id, year_id, department, status, month_name, start_date, end_date, days_in_month, board_id, month, year, created_at, updated_at, "created_by_UID", "updated_by_UID") FROM stdin;
e5382d4e-06cb-4758-82b3-9bd6261a207f	2025-12	2025	design	active	December	2025-11-30	2025-12-31	31	board_2025-12_1764943707503	12	2025	2025-12-05 14:08:27.508848	2025-12-05 14:08:27.508848	admin_1764943498956_0z407sksz	\N


--
-- Data for Name: reporters; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.reporters (name, email, department, channel, channel_name, country, "reporter_UID", created_at, updated_at, "created_by_UID", created_by_name, "updated_by_UID", updated_by_name, id) FROM stdin;
marian iordache	iordache.marian21@gmail.com	games team	acq	acq	ro	reporter_1764943913777_g3drsi95b	2025-12-05 14:11:53.778366	2025-12-05 14:11:53.778366	admin_1764943498956_0z407sksz	\N	\N	\N	21b77160-b6b3-42df-8cc7-3150bb419483


--
-- Data for Name: task_ai_usage; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.task_ai_usage (id, task_id, ai_models, ai_time, created_at) FROM stdin;


--
-- Data for Name: task_deliverables; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.task_deliverables (id, task_id, deliverable_name, count, variations_enabled, variations_count, created_at) FROM stdin;


--
-- Data for Name: task_departments; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.task_departments (id, task_id, department, created_at) FROM stdin;
50d772ba-eb79-4969-99d6-29c3cbb25608	e3dccda5-b392-4069-8195-d6ca6050969a	video	2025-12-05 14:12:26.203073


--
-- Data for Name: task_markets; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.task_markets (id, task_id, market, created_at) FROM stdin;
3a2e3281-6421-4952-adab-16a80faf905d	e3dccda5-b392-4069-8195-d6ca6050969a	ro	2025-12-05 14:12:26.201895


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.tasks (id, month_id, "user_UID", board_id, created_at, updated_at, "created_by_UID", created_by_name, "updated_by_UID", updated_by_name, task_name, products, time_in_hours, is_vip, reworked, use_shutterstock, observations, "reporter_UID", reporter_name, start_date, end_date, department) FROM stdin;
e3dccda5-b392-4069-8195-d6ca6050969a	2025-12	admin_1764943498956_0z407sksz	2025-12	2025-12-05 14:12:26.200095	2025-12-05 14:12:26.200095	admin_1764943498956_0z407sksz	\N	\N	\N	GIMODEAR-13415	marketing casino	2.00	f	f	f	\N	reporter_1764943913777_g3drsi95b	marian iordache	2025-12-05	2025-12-05	video


--
-- Data for Name: team_days_off; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.team_days_off (id, "user_UID", user_name, base_days, days_off, days_remaining, days_total, monthly_accrual, created_at, updated_at, "created_by_UID", created_by_name, "updated_by_UID", updated_by_name) FROM stdin;


--
-- Data for Name: team_days_off_dates; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.team_days_off_dates (id, team_days_off_id, "user_UID", date_string, day, month, year, "timestamp", created_at) FROM stdin;


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.user_permissions (id, user_id, "user_UID", permission, created_at) FROM stdin;
e2d58e49-1642-4c5a-89d4-a529a2ffcd2e	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	create_tasks	2025-12-05 14:04:58.96917
ba62c5a8-0023-45ae-8b6d-369f3b067c73	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	update_tasks	2025-12-05 14:04:58.96917
ed578cf1-7969-4162-ad7b-0628c59685f1	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	delete_tasks	2025-12-05 14:04:58.96917
f6f29f19-5902-4e9c-ba55-c54a933c3796	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	view_tasks	2025-12-05 14:04:58.96917
fd0d864b-e1d8-46b5-abad-c78074faef0a	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	create_boards	2025-12-05 14:04:58.96917
840fcf2a-271e-4eba-965d-a6e497027073	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	submit_forms	2025-12-05 14:04:58.96917
b9125d63-0bae-452e-be68-cd256117d64a	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	delete_data	2025-12-05 14:04:58.96917
3ae16310-9c14-48e7-a7b2-b86b20f29943	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	view_analytics	2025-12-05 14:04:58.96917
cb132042-caf9-4cff-a507-80c7f27a8c20	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	manage_users	2025-12-05 14:04:58.96917
8c895f71-d71e-4073-8826-d7d03cad43a8	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	manage_reporters	2025-12-05 14:04:58.96917
b204fee4-d7eb-45e1-a350-2a611e0472a8	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	manage_deliverables	2025-12-05 14:04:58.96917
c72c4480-bd4c-4cf7-b141-f49b12637de1	bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	has_permission	2025-12-05 14:04:58.96917


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: tasktracker
--

COPY public.users (id, "user_UID", email, name, role, password_hash, color_set, is_active, occupation, created_at, "created_by_UID", updated_at) FROM stdin;
bbe5ea84-5896-47fd-a7b6-6d27fb66dbd8	admin_1764943498956_0z407sksz	admin@example.com	Admin User	admin	$2a$10$oP4OWn.9UKA/a9KjKyCpte1aeNl2JvjdGHomXYAGJvRS7JIhp53CK	\N	t	\N	2025-12-05 14:04:58.957348	\N	2025-12-05 14:04:58.957348


--
-- Name: deliverables deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_pkey PRIMARY KEY (id);


--
-- Name: months months_month_id_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.months
    ADD CONSTRAINT months_month_id_key UNIQUE (month_id);


--
-- Name: months months_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.months
    ADD CONSTRAINT months_pkey PRIMARY KEY (id);


--
-- Name: reporters reporters_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.reporters
    ADD CONSTRAINT reporters_pkey PRIMARY KEY (id);


--
-- Name: reporters reporters_reporter_uid_unique; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.reporters
    ADD CONSTRAINT reporters_reporter_uid_unique UNIQUE ("reporter_UID");


--
-- Name: task_ai_usage task_ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_ai_usage
    ADD CONSTRAINT task_ai_usage_pkey PRIMARY KEY (id);


--
-- Name: task_deliverables task_deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_deliverables
    ADD CONSTRAINT task_deliverables_pkey PRIMARY KEY (id);


--
-- Name: task_departments task_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_departments
    ADD CONSTRAINT task_departments_pkey PRIMARY KEY (id);


--
-- Name: task_departments task_departments_task_id_department_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_departments
    ADD CONSTRAINT task_departments_task_id_department_key UNIQUE (task_id, department);


--
-- Name: task_markets task_markets_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_markets
    ADD CONSTRAINT task_markets_pkey PRIMARY KEY (id);


--
-- Name: task_markets task_markets_task_id_market_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_markets
    ADD CONSTRAINT task_markets_task_id_market_key UNIQUE (task_id, market);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: team_days_off_dates team_days_off_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.team_days_off_dates
    ADD CONSTRAINT team_days_off_dates_pkey PRIMARY KEY (id);


--
-- Name: team_days_off_dates team_days_off_dates_team_days_off_id_date_string_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.team_days_off_dates
    ADD CONSTRAINT team_days_off_dates_team_days_off_id_date_string_key UNIQUE (team_days_off_id, date_string);


--
-- Name: team_days_off team_days_off_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.team_days_off
    ADD CONSTRAINT team_days_off_pkey PRIMARY KEY (id);


--
-- Name: team_days_off team_days_off_user_UID_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.team_days_off
    ADD CONSTRAINT "team_days_off_user_UID_key" UNIQUE ("user_UID");


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_UID_permission_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT "user_permissions_user_UID_permission_key" UNIQUE ("user_UID", permission);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_user_UID_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_user_UID_key" UNIQUE ("user_UID");


--
-- Name: users users_user_uid_key; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_uid_key UNIQUE ("user_UID");


--
-- Name: users users_user_uid_unique; Type: CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_uid_unique UNIQUE ("user_UID");


--
-- Name: idx_deliverables_name; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_deliverables_name ON public.deliverables USING btree (name);


--
-- Name: idx_months_board_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_months_board_id ON public.months USING btree (board_id);


--
-- Name: idx_months_end_date; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_months_end_date ON public.months USING btree (end_date);


--
-- Name: idx_months_month_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_months_month_id ON public.months USING btree (month_id);


--
-- Name: idx_months_month_name; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_months_month_name ON public.months USING btree (month_name);


--
-- Name: idx_months_start_date; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_months_start_date ON public.months USING btree (start_date);


--
-- Name: idx_months_year_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_months_year_id ON public.months USING btree (year_id);


--
-- Name: idx_reporters_name; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_reporters_name ON public.reporters USING btree (name);


--
-- Name: idx_task_ai_usage_task_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_task_ai_usage_task_id ON public.task_ai_usage USING btree (task_id);


--
-- Name: idx_task_deliverables_task_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_task_deliverables_task_id ON public.task_deliverables USING btree (task_id);


--
-- Name: idx_task_departments_department; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_task_departments_department ON public.task_departments USING btree (department);


--
-- Name: idx_task_departments_task_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_task_departments_task_id ON public.task_departments USING btree (task_id);


--
-- Name: idx_task_markets_market; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_task_markets_market ON public.task_markets USING btree (market);


--
-- Name: idx_task_markets_task_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_task_markets_task_id ON public.task_markets USING btree (task_id);


--
-- Name: idx_tasks_created_at; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_created_at ON public.tasks USING btree (created_at);


--
-- Name: idx_tasks_department; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_department ON public.tasks USING btree (department);


--
-- Name: idx_tasks_end_date; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_end_date ON public.tasks USING btree (end_date);


--
-- Name: idx_tasks_is_vip; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_is_vip ON public.tasks USING btree (is_vip);


--
-- Name: idx_tasks_month_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_month_id ON public.tasks USING btree (month_id);


--
-- Name: idx_tasks_products; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_products ON public.tasks USING btree (products);


--
-- Name: idx_tasks_reporter_uid; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_reporter_uid ON public.tasks USING btree ("reporter_UID");


--
-- Name: idx_tasks_reworked; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_reworked ON public.tasks USING btree (reworked);


--
-- Name: idx_tasks_start_date; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_start_date ON public.tasks USING btree (start_date);


--
-- Name: idx_tasks_task_name; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_task_name ON public.tasks USING btree (task_name);


--
-- Name: idx_tasks_user_uid; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_tasks_user_uid ON public.tasks USING btree ("user_UID");


--
-- Name: idx_team_days_off_dates_date_string; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_team_days_off_dates_date_string ON public.team_days_off_dates USING btree (date_string);


--
-- Name: idx_team_days_off_dates_team_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_team_days_off_dates_team_id ON public.team_days_off_dates USING btree (team_days_off_id);


--
-- Name: idx_team_days_off_dates_user_uid; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_team_days_off_dates_user_uid ON public.team_days_off_dates USING btree ("user_UID");


--
-- Name: idx_team_days_off_dates_year_month; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_team_days_off_dates_year_month ON public.team_days_off_dates USING btree (year, month);


--
-- Name: idx_team_days_off_user_uid; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_team_days_off_user_uid ON public.team_days_off USING btree ("user_UID");


--
-- Name: idx_user_permissions_permission; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_user_permissions_permission ON public.user_permissions USING btree (permission);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_user_permissions_user_uid; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_user_permissions_user_uid ON public.user_permissions USING btree ("user_UID");


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_active; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_users_email_active ON public.users USING btree (email, is_active);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_user_uid; Type: INDEX; Schema: public; Owner: tasktracker
--

CREATE INDEX idx_users_user_uid ON public.users USING btree ("user_UID");


--
-- Name: deliverables update_deliverables_updated_at; Type: TRIGGER; Schema: public; Owner: tasktracker
--

CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: months update_months_updated_at; Type: TRIGGER; Schema: public; Owner: tasktracker
--

CREATE TRIGGER update_months_updated_at BEFORE UPDATE ON public.months FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reporters update_reporters_updated_at; Type: TRIGGER; Schema: public; Owner: tasktracker
--

CREATE TRIGGER update_reporters_updated_at BEFORE UPDATE ON public.reporters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: tasktracker
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: tasktracker
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users fk_users_created_by; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY ("created_by_UID") REFERENCES public.users("user_UID") ON DELETE SET NULL;


--
-- Name: months months_created_by_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.months
    ADD CONSTRAINT months_created_by_uid_fkey FOREIGN KEY ("created_by_UID") REFERENCES public.users("user_UID") ON DELETE SET NULL;


--
-- Name: months months_updated_by_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.months
    ADD CONSTRAINT months_updated_by_uid_fkey FOREIGN KEY ("updated_by_UID") REFERENCES public.users("user_UID") ON DELETE SET NULL;


--
-- Name: task_ai_usage task_ai_usage_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_ai_usage
    ADD CONSTRAINT task_ai_usage_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_deliverables task_deliverables_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_deliverables
    ADD CONSTRAINT task_deliverables_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_departments task_departments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_departments
    ADD CONSTRAINT task_departments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_markets task_markets_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.task_markets
    ADD CONSTRAINT task_markets_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: team_days_off_dates team_days_off_dates_team_days_off_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.team_days_off_dates
    ADD CONSTRAINT team_days_off_dates_team_days_off_id_fkey FOREIGN KEY (team_days_off_id) REFERENCES public.team_days_off(id) ON DELETE CASCADE;


--
-- Name: team_days_off_dates team_days_off_dates_user_UID_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tasktracker
--

ALTER TABLE ONLY public.team_days_off_dates
    ADD CONSTRAINT "team_days_off_dates_user_UID_fkey" FOREIGN KEY ("user_UID") REFERENCES public.users("user_UID") ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


