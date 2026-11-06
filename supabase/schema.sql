-- Coach Trail — schéma de base de données (Supabase / Postgres)
-- Membres, objectifs, plans, séances réalisées, administration.

-- ───────────── Réglages de l'application ─────────────
create table public.reglages (
  id int primary key default 1 check (id = 1),
  inscriptions_ouvertes boolean not null default true,
  annonce text,
  duree_essai_jours int not null default 14 check (duree_essai_jours between 0 and 365),
  updated_at timestamptz not null default now()
);
insert into public.reglages (id) values (1);

-- E-mails promus administrateurs à l'inscription
create table public.admin_emails (email text primary key);

-- ───────────── Profils ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  prenom text,
  nom text,
  date_naissance date,
  sexe text check (sexe in ('femme', 'homme', 'autre')),
  ville text,
  poids_kg numeric(5,1),
  taille_cm int,
  niveau text not null default 'intermediaire' check (niveau in ('debutant', 'intermediaire', 'confirme')),
  fc_max int check (fc_max between 120 and 230),
  fc_repos int check (fc_repos between 30 and 110),
  ref_distance_km numeric(6,2),
  ref_temps_min numeric(7,2),
  volume_actuel_min int not null default 180,
  dplus_actuel_m int not null default 0,
  jours_dispo text[] not null default '{mar,jeu,sam,dim}',
  jour_longue text not null default 'dim',
  blessure_recente boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  consentement_sante boolean not null default false,
  consentement_ia boolean not null default false,
  onboarding_termine boolean not null default false,
  -- Champs réservés à l'administration
  role text not null default 'membre' check (role in ('membre', 'coach', 'admin')),
  statut text not null default 'actif' check (statut in ('actif', 'suspendu')),
  abonnement text not null default 'essai' check (abonnement in ('essai', 'premium', 'offert', 'expire')),
  abonnement_fin date,
  note_admin text,
  created_at timestamptz not null default now(),
  derniere_activite timestamptz not null default now()
);
create index on public.profiles (created_at);
create index on public.profiles (derniere_activite);

-- ───────────── Objectifs, plans, séances ─────────────
create table public.objectifs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  nom text,
  type text not null check (type in ('trail', 'route')),
  distance_km numeric(6,1) not null check (distance_km > 0),
  dplus_m int not null default 0,
  date date not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.objectifs (user_id);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  objectif_id uuid references public.objectifs (id) on delete set null,
  contenu jsonb not null,
  bilans jsonb not null default '[]'::jsonb,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.plans (user_id, actif);

create table public.seances_realisees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  seance_id text,
  type_prevu text,
  date date not null,
  duree_min int not null check (duree_min between 1 and 1440),
  distance_km numeric(6,2),
  dplus_m int,
  rpe int not null check (rpe between 1 and 10),
  douleur int not null default 0 check (douleur between 0 and 10),
  zone_douleur text,
  sommeil int check (sommeil between 1 and 5),
  commentaire text,
  alerte_traitee boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, plan_id, seance_id)
);
create index on public.seances_realisees (user_id, date);
create index on public.seances_realisees (date);

create table public.journal_admin (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  cible_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.journal_admin (created_at desc);

-- ───────────── Fonctions utilitaires ─────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and statut = 'actif');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'coach') and statut = 'actif');
$$;

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare essai int;
begin
  select duree_essai_jours into essai from public.reglages where id = 1;
  insert into public.profiles (id, email, prenom, nom, role, abonnement_fin)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'prenom', ''),
    nullif(new.raw_user_meta_data ->> 'nom', ''),
    case when exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email)) then 'admin' else 'membre' end,
    current_date + coalesce(essai, 14)
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Sécurité : RLS ─────────────
alter table public.reglages enable row level security;
alter table public.admin_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.objectifs enable row level security;
alter table public.plans enable row level security;
alter table public.seances_realisees enable row level security;
alter table public.journal_admin enable row level security;

create policy "reglages lisibles" on public.reglages for select to anon, authenticated using (true);

create policy "profil : lecture" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy "profil : mise à jour" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Un membre ne peut modifier que ses propres champs « membre » (jamais rôle, statut, abonnement, note)
revoke update on public.profiles from authenticated;
grant update (prenom, nom, date_naissance, sexe, ville, poids_kg, taille_cm, niveau, fc_max, fc_repos,
  ref_distance_km, ref_temps_min, volume_actuel_min, dplus_actuel_m, jours_dispo, jour_longue,
  blessure_recente, preferences, consentement_sante, consentement_ia, onboarding_termine, derniere_activite)
  on public.profiles to authenticated;

create policy "objectifs : les siens" on public.objectifs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "objectifs : staff lecture" on public.objectifs for select to authenticated using (public.is_staff());

create policy "plans : les siens" on public.plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plans : staff" on public.plans for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "séances : les siennes" on public.seances_realisees for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "séances : staff lecture" on public.seances_realisees for select to authenticated using (public.is_staff());

create policy "journal : admin lecture" on public.journal_admin for select to authenticated using (public.is_admin());

-- ───────────── Fonctions membre ─────────────
create or replace function public.supprimer_mon_compte()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ───────────── Fonctions administration ─────────────
create or replace function public.admin_maj_membre(
  p_id uuid, p_role text default null, p_statut text default null,
  p_abonnement text default null, p_abonnement_fin date default null, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare avant public.profiles;
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if p_id = auth.uid() and (p_role is distinct from null and p_role <> 'admin' or p_statut = 'suspendu') then
    raise exception 'impossible de retirer ses propres droits';
  end if;
  select * into avant from public.profiles where id = p_id;
  update public.profiles set
    role = coalesce(p_role, role),
    statut = coalesce(p_statut, statut),
    abonnement = coalesce(p_abonnement, abonnement),
    abonnement_fin = coalesce(p_abonnement_fin, abonnement_fin),
    note_admin = coalesce(p_note, note_admin)
  where id = p_id;
  insert into public.journal_admin (admin_id, cible_id, action, details)
  values (auth.uid(), p_id, 'maj_membre', jsonb_strip_nulls(jsonb_build_object(
    'role', case when p_role is not null and p_role is distinct from avant.role then jsonb_build_array(avant.role, p_role) end,
    'statut', case when p_statut is not null and p_statut is distinct from avant.statut then jsonb_build_array(avant.statut, p_statut) end,
    'abonnement', case when p_abonnement is not null and p_abonnement is distinct from avant.abonnement then jsonb_build_array(avant.abonnement, p_abonnement) end,
    'abonnement_fin', case when p_abonnement_fin is not null and p_abonnement_fin is distinct from avant.abonnement_fin then p_abonnement_fin end,
    'note', case when p_note is not null and p_note is distinct from avant.note_admin then true end
  )));
end;
$$;

create or replace function public.admin_supprimer_membre(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  if p_id = auth.uid() then raise exception 'utilise la suppression de compte depuis ton propre profil'; end if;
  select email into v_email from public.profiles where id = p_id;
  insert into public.journal_admin (admin_id, cible_id, action, details)
  values (auth.uid(), null, 'suppression_membre', jsonb_build_object('email', v_email));
  delete from auth.users where id = p_id;
end;
$$;

create or replace function public.admin_traiter_alerte(p_id uuid, p_traitee boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_staff() then raise exception 'réservé à l''équipe'; end if;
  update public.seances_realisees set alerte_traitee = p_traitee where id = p_id returning user_id into v_user;
  insert into public.journal_admin (admin_id, cible_id, action, details)
  values (auth.uid(), v_user, case when p_traitee then 'alerte_traitee' else 'alerte_rouverte' end, jsonb_build_object('seance', p_id));
end;
$$;

create or replace function public.admin_journaliser(p_cible uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'réservé à l''équipe'; end if;
  insert into public.journal_admin (admin_id, cible_id, action, details) values (auth.uid(), p_cible, p_action, p_details);
end;
$$;

create or replace function public.admin_maj_reglages(p_inscriptions boolean, p_annonce text, p_essai int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'réservé aux administrateurs'; end if;
  update public.reglages set inscriptions_ouvertes = p_inscriptions, annonce = nullif(trim(p_annonce), ''),
    duree_essai_jours = p_essai, updated_at = now() where id = 1;
  insert into public.journal_admin (admin_id, action, details)
  values (auth.uid(), 'maj_reglages', jsonb_build_object('inscriptions', p_inscriptions, 'essai', p_essai, 'annonce', p_annonce));
end;
$$;

-- Statistiques du tableau de bord admin, calculées en une requête
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'réservé à l''équipe'; end if;
  select jsonb_build_object(
    'membres', (select count(*) from profiles),
    'nouveaux_7j', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'nouveaux_30j', (select count(*) from profiles where created_at > now() - interval '30 days'),
    'actifs_7j', (select count(distinct user_id) from seances_realisees where created_at > now() - interval '7 days'),
    'actifs_30j', (select count(distinct user_id) from seances_realisees where created_at > now() - interval '30 days'),
    'onboarding_termine', (select count(*) from profiles where onboarding_termine),
    'suspendus', (select count(*) from profiles where statut = 'suspendu'),
    'seances_30j', (select count(*) from seances_realisees where date > current_date - 30),
    'heures_30j', (select coalesce(round(sum(duree_min) / 60.0), 0) from seances_realisees where date > current_date - 30),
    'dplus_30j', (select coalesce(sum(dplus_m), 0) from seances_realisees where date > current_date - 30),
    'rpe_moyen_30j', (select round(avg(rpe)::numeric, 1) from seances_realisees where date > current_date - 30),
    'alertes_ouvertes', (select count(*) from seances_realisees where douleur >= 3 and not alerte_traitee),
    'plans_actifs', (select count(*) from plans where actif),
    'abonnements', (select coalesce(jsonb_object_agg(abonnement, n), '{}') from (select abonnement, count(*) n from profiles group by 1) t),
    'niveaux', (select coalesce(jsonb_object_agg(niveau, n), '{}') from (select niveau, count(*) n from profiles group by 1) t),
    'roles', (select coalesce(jsonb_object_agg(role, n), '{}') from (select role, count(*) n from profiles group by 1) t),
    'types_course', (select coalesce(jsonb_object_agg(type, n), '{}') from (select type, count(*) n from objectifs where actif group by 1) t),
    'distances', (select coalesce(jsonb_object_agg(tranche, n), '{}') from (
        select case when distance_km < 15 then 'Moins de 15 km' when distance_km < 30 then '15 à 30 km'
                    when distance_km < 50 then '30 à 50 km' when distance_km < 80 then '50 à 80 km' else '80 km et plus' end tranche,
               count(*) n from objectifs where actif group by 1) t),
    'inscriptions_semaines', (select coalesce(jsonb_agg(jsonb_build_object('semaine', s, 'n', coalesce(n, 0)) order by s), '[]') from (
        select gs::date s, (select count(*) from profiles p where p.created_at >= gs and p.created_at < gs + interval '7 days') n
        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') gs) t),
    'seances_semaines', (select coalesce(jsonb_agg(jsonb_build_object('semaine', s, 'n', n, 'heures', h) order by s), '[]') from (
        select gs::date s,
               (select count(*) from seances_realisees x where x.date >= gs::date and x.date < gs::date + 7) n,
               (select coalesce(round(sum(duree_min) / 60.0, 1), 0) from seances_realisees x where x.date >= gs::date and x.date < gs::date + 7) h
        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') gs) t),
    'prochaines_courses', (select coalesce(jsonb_agg(c order by c ->> 'date'), '[]') from (
        select jsonb_build_object('date', o.date, 'nom', o.nom, 'type', o.type, 'distance', o.distance_km, 'dplus', o.dplus_m,
                                  'membre', coalesce(nullif(trim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), p.email), 'user_id', p.id) c
        from objectifs o join profiles p on p.id = o.user_id
        where o.actif and o.date >= current_date order by o.date limit 8) t)
  ) into r;
  return r;
end;
$$;

-- Indicateurs par membre pour la liste admin
create or replace view public.membres_admin with (security_invoker = true) as
select p.id, p.email, p.prenom, p.nom, p.niveau, p.role, p.statut, p.abonnement, p.abonnement_fin,
       p.created_at, p.derniere_activite, p.onboarding_termine, p.ville,
       o.type as objectif_type, o.distance_km as objectif_distance, o.dplus_m as objectif_dplus, o.date as objectif_date, o.nom as objectif_nom,
       (select count(*) from public.seances_realisees s where s.user_id = p.id) as nb_seances,
       (select count(*) from public.seances_realisees s where s.user_id = p.id and s.date > current_date - 30) as seances_30j,
       (select count(*) from public.seances_realisees s where s.user_id = p.id and s.douleur >= 3 and not s.alerte_traitee) as alertes,
       (select max(s.date) from public.seances_realisees s where s.user_id = p.id) as derniere_seance
from public.profiles p
left join lateral (select * from public.objectifs o where o.user_id = p.id and o.actif order by o.date limit 1) o on true;

grant select on public.membres_admin to authenticated;
revoke execute on function public.admin_stats, public.admin_maj_membre, public.admin_supprimer_membre,
  public.admin_traiter_alerte, public.admin_journaliser, public.admin_maj_reglages, public.supprimer_mon_compte from anon;
