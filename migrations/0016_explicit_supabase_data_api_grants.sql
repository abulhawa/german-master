DO $$
DECLARE
  data_api_role text;
  table_name text;
  sequence_name text;
  data_api_roles text[] := ARRAY['anon', 'authenticated', 'service_role'];
  exposed_tables text[] := ARRAY[
    'words',
    'lexemes',
    'inflections',
    'task_specs',
    'task_sync_state',
    'practice_history',
    'practice_log'
  ];
  exposed_sequences text[] := ARRAY[
    'words_id_seq',
    'practice_history_id_seq',
    'practice_log_id_seq'
  ];
BEGIN
  FOREACH data_api_role IN ARRAY data_api_roles LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = data_api_role) THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', data_api_role);

    FOREACH table_name IN ARRAY exposed_tables LOOP
      IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
        EXECUTE format(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO %I',
          table_name,
          data_api_role
        );
      END IF;
    END LOOP;

    FOREACH sequence_name IN ARRAY exposed_sequences LOOP
      IF to_regclass(format('public.%I', sequence_name)) IS NOT NULL THEN
        EXECUTE format(
          'GRANT USAGE, SELECT ON SEQUENCE public.%I TO %I',
          sequence_name,
          data_api_role
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
