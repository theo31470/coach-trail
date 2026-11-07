-- Monotrace v7 : données santé des montres (Garmin Health API) et réception automatique des sorties.
-- Les écritures venant de Garmin passent par des fonctions protégées par le secret serveur (« secret_cron »).

-- ───────────── Mesures santé quotidiennes ─────────────
create table if not exists public.mesures_sante (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  source text not null default 'garmin',
  sommeil_min int check (sommeil_min between 0 and 1440),
  sommeil_profond_min int,
  sommeil_paradoxal_min int,
  sommeil_eveil_min int,
  sommeil_score int check (sommeil_score between 0 and 100),
  fc_repos int check (fc_repos between 20 and 140),
  vfc_ms int check (vfc_ms between 1 and 400),
  stress_moyen int check (stress_moyen between 0 and 100),
  body_battery_recharge int check (body_battery_recharge between 0 and 100),
  maj_le timestamptz not null default now(),
  unique (user_id, date, source)
);
alter table public.mesures_sante enable row level security;
create policy "mesures : les siennes" on public.mesures_sante for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mesures : staff lecture" on public.mesures_sante for select to authenticated using (public.is_staff());
create index if not exists mesures_sante_user_date on public.mesures_sante (user_id, date desc);

create index if not exists connexions_compte_externe on public.connexions (fournisseur, compte_externe);

-- Comptes Monotrace liés à des identifiants Garmin, avec le plan actif et les séances déjà faites
create or replace function public.garmin_comptes(p_secret text, p_ids text[])
returns json language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'garmin_id', c.compte_externe, 'user_id', c.user_id,
      'plan_id', pl.id, 'plan', pl.contenu,
      'faites', coalesce((select json_agg(s.seance_id) from public.seances_realisees s where s.user_id = c.user_id and s.seance_id is not null), '[]'::json)
    ))
    from public.connexions c
    left join lateral (select id, contenu from public.plans where user_id = c.user_id and actif order by created_at desc limit 1) pl on true
    where c.fournisseur = 'garmin' and c.compte_externe = any (p_ids)
  ), '[]'::json);
end;
$$;
revoke all on function public.garmin_comptes(text, text[]) from public;
grant execute on function public.garmin_comptes(text, text[]) to anon, authenticated;

-- Écrit les mesures et les sorties reçues, et coupe les comptes que l'utilisateur a déconnectés côté Garmin
create or replace function public.garmin_ecrire(p_secret text, p_mesures jsonb, p_seances jsonb, p_deconnexions text[])
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb; s jsonb;
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_mesures, '[]'::jsonb)) loop
    insert into public.mesures_sante as t (user_id, date, source, sommeil_min, sommeil_profond_min, sommeil_paradoxal_min, sommeil_eveil_min,
      sommeil_score, fc_repos, vfc_ms, stress_moyen, body_battery_recharge, maj_le)
    values ((m->>'user_id')::uuid, (m->>'date')::date, 'garmin', (m->>'sommeil_min')::int, (m->>'sommeil_profond_min')::int,
      (m->>'sommeil_paradoxal_min')::int, (m->>'sommeil_eveil_min')::int, (m->>'sommeil_score')::int, (m->>'fc_repos')::int,
      (m->>'vfc_ms')::int, (m->>'stress_moyen')::int, (m->>'body_battery_recharge')::int, now())
    on conflict (user_id, date, source) do update set
      sommeil_min = coalesce(excluded.sommeil_min, t.sommeil_min),
      sommeil_profond_min = coalesce(excluded.sommeil_profond_min, t.sommeil_profond_min),
      sommeil_paradoxal_min = coalesce(excluded.sommeil_paradoxal_min, t.sommeil_paradoxal_min),
      sommeil_eveil_min = coalesce(excluded.sommeil_eveil_min, t.sommeil_eveil_min),
      sommeil_score = coalesce(excluded.sommeil_score, t.sommeil_score),
      fc_repos = coalesce(excluded.fc_repos, t.fc_repos),
      vfc_ms = coalesce(excluded.vfc_ms, t.vfc_ms),
      stress_moyen = coalesce(excluded.stress_moyen, t.stress_moyen),
      body_battery_recharge = coalesce(excluded.body_battery_recharge, t.body_battery_recharge),
      maj_le = now();
  end loop;

  for s in select * from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) loop
    insert into public.seances_realisees (user_id, plan_id, seance_id, type_prevu, date, duree_min, distance_km, dplus_m, rpe, douleur, source, source_id, commentaire)
    values ((s->>'user_id')::uuid, nullif(s->>'plan_id', '')::uuid, nullif(s->>'seance_id', ''), nullif(s->>'type_prevu', ''), (s->>'date')::date,
      (s->>'duree_min')::int, (s->>'distance_km')::numeric, (s->>'dplus_m')::int, (s->>'rpe')::int, 0, 'garmin', s->>'source_id', s->>'commentaire')
    on conflict (user_id, source, source_id) where source_id is not null do nothing;
  end loop;

  delete from public.connexions where fournisseur = 'garmin' and compte_externe = any (coalesce(p_deconnexions, '{}'));
end;
$$;
revoke all on function public.garmin_ecrire(text, jsonb, jsonb, text[]) from public;
grant execute on function public.garmin_ecrire(text, jsonb, jsonb, text[]) to anon, authenticated;
