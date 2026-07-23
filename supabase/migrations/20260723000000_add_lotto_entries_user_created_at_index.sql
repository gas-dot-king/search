-- Apply this migration to existing Supabase projects.
create index if not exists lotto_entries_user_created_at_idx
  on lotto_entries (user_id, created_at);
