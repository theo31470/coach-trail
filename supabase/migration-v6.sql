-- Coach Trail v6 : suivi quotidien, connexions montres, notifications, calendrier.
-- Le secret du cron (ligne « secret_cron ») est inséré à part, hors du dépôt.

-- ───────────── Bilan du matin ─────────────
create table if not exists public.bilans_matin (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  sommeil int not null check (sommeil between 1 and 5),
  energie int not null check (energie between 1 and 5),
  jambes int not null check (jambes between 1 and 5),
  douleur int not null default 0 check (douleur between 0 and 10),
  zone_douleur text,
  score int not null check (score between 0 and 100),
  adaptation jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.bilans_matin enable row level security;
create policy "bilans matin : les siens" on public.bilans_matin for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bilans matin : staff lecture" on public.bilans_matin for select to authenticated using (public.is_staff());

-- ───────────── Connexions montres et applis ─────────────
create table if not exists public.connexions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fournisseur text not null check (fournisseur in ('garmin', 'coros', 'polar', 'strava', 'suunto')),
  compte_externe text,
  access_token text not null,
  refresh_token text,
  expire_le timestamptz,
  derniere_synchro timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, fournisseur)
);
alter table public.connexions enable row level security;
create policy "connexions : les siennes" on public.connexions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Séances importées depuis une montre ou une appli
alter table public.seances_realisees add column if not exists source text not null default 'manuel';
alter table public.seances_realisees add column if not exists source_id text;
create unique index if not exists seances_realisees_source_unique
  on public.seances_realisees (user_id, source, source_id) where source_id is not null;

-- ───────────── Notifications ─────────────
create table if not exists public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_abonnements enable row level security;
create policy "push : les siens" on public.push_abonnements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────── Calendrier (abonnement .ics) ─────────────
alter table public.profiles add column if not exists jeton_calendrier text unique
  default replace(gen_random_uuid()::text, '-', '');
update public.profiles set jeton_calendrier = replace(gen_random_uuid()::text, '-', '') where jeton_calendrier is null;

create or replace function public.calendrier_par_jeton(p_jeton text)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'prenom', p.prenom,
    'plan', pl.contenu,
    'course', o.nom, 'date_course', o.date, 'distance_km', o.distance_km, 'dplus_m', o.dplus_m
  )
  from public.profiles p
  join public.plans pl on pl.user_id = p.id and pl.actif
  left join public.objectifs o on o.id = pl.objectif_id
  where length(p_jeton) >= 24 and p.jeton_calendrier = p_jeton and p.statut = 'actif'
  order by pl.created_at desc limit 1;
$$;
revoke all on function public.calendrier_par_jeton(text) from public;
grant execute on function public.calendrier_par_jeton(text) to anon, authenticated;

-- ───────────── Envois quotidiens (cron) ─────────────
create table if not exists public.secrets_internes (cle text primary key, valeur text not null);
alter table public.secrets_internes enable row level security; -- aucune règle : invisible depuis l'API

create or replace function public.envois_du_jour(p_secret text, p_date date)
returns json language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', p.id, 'email', p.email, 'prenom', p.prenom, 'preferences', p.preferences,
      'plan', pl.contenu, 'course', o.nom, 'date_course', o.date,
      'bilan_fait', exists (select 1 from public.bilans_matin b where b.user_id = p.id and b.date = p_date),
      'push', coalesce((select json_agg(json_build_object('endpoint', a.endpoint, 'keys', json_build_object('p256dh', a.p256dh, 'auth', a.auth)))
                        from public.push_abonnements a where a.user_id = p.id), '[]'::json)
    ))
    from public.profiles p
    join public.plans pl on pl.user_id = p.id and pl.actif
    left join public.objectifs o on o.id = pl.objectif_id
    where p.statut = 'actif' and p.onboarding_termine
  ), '[]'::json);
end;
$$;
revoke all on function public.envois_du_jour(text, date) from public;
grant execute on function public.envois_du_jour(text, date) to anon, authenticated;

-- Abonnement push expiré : le cron le supprime
create or replace function public.supprimer_push(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;
  delete from public.push_abonnements where endpoint = p_endpoint;
end;
$$;
revoke all on function public.supprimer_push(text, text) from public;
grant execute on function public.supprimer_push(text, text) to anon, authenticated;
