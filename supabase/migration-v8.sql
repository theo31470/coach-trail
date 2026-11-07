-- Monotrace v8 : courbes détaillées des sorties et mesures de nuit complètes (respiration, SpO2, température, stress).

create table if not exists public.courbes_activite (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'garmin',
  source_id text not null,
  date date not null,
  resume jsonb not null default '{}'::jsonb,
  echantillons jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);
alter table public.courbes_activite enable row level security;
create policy "courbes : les siennes" on public.courbes_activite for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "courbes : staff lecture" on public.courbes_activite for select to authenticated using (public.is_staff());
create index if not exists courbes_activite_user_date on public.courbes_activite (user_id, date desc);

alter table public.mesures_sante add column if not exists respiration_nuit numeric(4,1);
alter table public.mesures_sante add column if not exists spo2_moyen int;
alter table public.mesures_sante add column if not exists spo2_min int;
alter table public.mesures_sante add column if not exists temp_peau_ecart numeric(4,2);
alter table public.mesures_sante add column if not exists poids_kg numeric(5,1);
alter table public.mesures_sante add column if not exists courbe_stress jsonb;

drop function if exists public.garmin_ecrire(text, jsonb, jsonb, text[]);
create or replace function public.garmin_ecrire(p_secret text, p_mesures jsonb, p_seances jsonb, p_deconnexions text[], p_courbes jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb; s jsonb; c jsonb;
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_mesures, '[]'::jsonb)) loop
    insert into public.mesures_sante as t (user_id, date, source, sommeil_min, sommeil_profond_min, sommeil_paradoxal_min, sommeil_eveil_min,
      sommeil_score, fc_repos, vfc_ms, stress_moyen, body_battery_recharge, respiration_nuit, spo2_moyen, spo2_min, temp_peau_ecart, poids_kg, courbe_stress, maj_le)
    values ((m->>'user_id')::uuid, (m->>'date')::date, 'garmin', (m->>'sommeil_min')::int, (m->>'sommeil_profond_min')::int,
      (m->>'sommeil_paradoxal_min')::int, (m->>'sommeil_eveil_min')::int, (m->>'sommeil_score')::int, (m->>'fc_repos')::int,
      (m->>'vfc_ms')::int, (m->>'stress_moyen')::int, (m->>'body_battery_recharge')::int, (m->>'respiration_nuit')::numeric,
      (m->>'spo2_moyen')::int, (m->>'spo2_min')::int, (m->>'temp_peau_ecart')::numeric, (m->>'poids_kg')::numeric,
      case when m ? 'courbe_stress' and jsonb_typeof(m->'courbe_stress') = 'object' then m->'courbe_stress' end, now())
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
      respiration_nuit = coalesce(excluded.respiration_nuit, t.respiration_nuit),
      spo2_moyen = coalesce(excluded.spo2_moyen, t.spo2_moyen),
      spo2_min = coalesce(excluded.spo2_min, t.spo2_min),
      temp_peau_ecart = coalesce(excluded.temp_peau_ecart, t.temp_peau_ecart),
      poids_kg = coalesce(excluded.poids_kg, t.poids_kg),
      courbe_stress = coalesce(excluded.courbe_stress, t.courbe_stress),
      maj_le = now();
  end loop;

  for s in select * from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) loop
    insert into public.seances_realisees (user_id, plan_id, seance_id, type_prevu, date, duree_min, distance_km, dplus_m, rpe, douleur, source, source_id, commentaire)
    values ((s->>'user_id')::uuid, nullif(s->>'plan_id', '')::uuid, nullif(s->>'seance_id', ''), nullif(s->>'type_prevu', ''), (s->>'date')::date,
      (s->>'duree_min')::int, (s->>'distance_km')::numeric, (s->>'dplus_m')::int, (s->>'rpe')::int, 0, 'garmin', s->>'source_id', s->>'commentaire')
    on conflict (user_id, source, source_id) where source_id is not null do nothing;
  end loop;

  for c in select * from jsonb_array_elements(coalesce(p_courbes, '[]'::jsonb)) loop
    insert into public.courbes_activite (user_id, source, source_id, date, resume, echantillons)
    values ((c->>'user_id')::uuid, 'garmin', c->>'source_id', (c->>'date')::date, coalesce(c->'resume', '{}'::jsonb), c->'echantillons')
    on conflict (user_id, source, source_id) do update set resume = excluded.resume, echantillons = excluded.echantillons, date = excluded.date;
  end loop;

  delete from public.connexions where fournisseur = 'garmin' and compte_externe = any (coalesce(p_deconnexions, '{}'));
end;
$$;
revoke all on function public.garmin_ecrire(text, jsonb, jsonb, text[], jsonb) from public;
grant execute on function public.garmin_ecrire(text, jsonb, jsonb, text[], jsonb) to anon, authenticated;
