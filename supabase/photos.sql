-- ─────────────────────────────────────────────────────────────────────────────
-- Zequelly & Elio — Galería "Nuestra noche en fotos"
-- Ejecutar SOLO este archivo en: Supabase > SQL Editor (es idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists photos (
  id               uuid primary key default gen_random_uuid(),
  guest_id         uuid references guests(id) on delete set null,
  uploader_name    text not null,
  uploader_key     text not null,                    -- 'guest:<uuid>' | 'qr:<nombre-normalizado>' | 'admin'
  access_mode      text not null default 'guest'
                   check (access_mode in ('guest', 'qr', 'admin')),
  status           text not null default 'pending'
                   check (status in ('pending', 'ready')),
  storage_path     text not null unique,             -- foto principal
  thumb_path       text not null unique,             -- miniatura
  content_type     text not null default 'image/jpeg',
  size_bytes       int  not null default 0,
  thumb_size_bytes int  not null default 0,
  width            int,
  height           int,
  taken_at         timestamptz,
  created_at       timestamptz not null default now(),
  ready_at         timestamptz
);

create index if not exists photos_status_created_idx on photos (status, created_at desc);
create index if not exists photos_uploader_key_idx   on photos (uploader_key);
create index if not exists photos_guest_idx          on photos (guest_id);

alter table photos enable row level security;

drop policy if exists "service role full access photos" on photos;
create policy "service role full access photos"
  on photos to service_role using (true) with check (true);

-- Total de bytes ocupados (fotos listas + subidas en curso de las últimas 2 horas)
create or replace function photos_total_bytes()
returns bigint
language sql
stable
as $$
  select coalesce(sum(size_bytes + thumb_size_bytes), 0)::bigint
  from photos
  where status = 'ready'
     or created_at > now() - interval '2 hours';
$$;

revoke all on function photos_total_bytes() from public, anon, authenticated;
grant execute on function photos_total_bytes() to service_role;

-- Bucket PRIVADO para las fotos (máx. 15 MB, solo imágenes)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-photos', 'wedding-photos', false, 15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
