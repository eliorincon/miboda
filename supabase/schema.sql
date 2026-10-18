-- ─────────────────────────────────────────────────────────────────────────────
-- Zequelly & Elio — Schema Supabase
-- Ejecutar en: Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists guests (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique not null,
  display_name          text not null,
  phone                 text,
  email                 text,
  group_name            text not null default '',
  max_guests            int  not null default 1,
  -- Integrantes de la invitación con su confirmación individual:
  -- [{ "name": "José Rojas", "confirmed": false }, { "name": "María Rojas", "confirmed": true }]
  members               jsonb not null default '[]'::jsonb,
  status                text not null default 'pending',
  confirmed_count       int  not null default 0,
  food_restrictions     text not null default '',
  message               text not null default '',
  has_opened_invitation boolean not null default false,
  opened_at             timestamptz,
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Migración para tablas ya existentes (añade la columna si falta):
alter table guests add column if not exists members jsonb not null default '[]'::jsonb;

-- Índices útiles
create index if not exists guests_status_idx    on guests (status);
create index if not exists guests_group_idx     on guests (group_name);
create index if not exists guests_opened_idx    on guests (has_opened_invitation);

-- Row Level Security (desactivar para uso con service_role)
alter table guests enable row level security;

-- Política: solo el service_role puede leer/escribir
-- (el cliente usa SUPABASE_SERVICE_ROLE_KEY desde el servidor, nunca desde el browser)
create policy "service role full access"
  on guests
  to service_role
  using (true)
  with check (true);
