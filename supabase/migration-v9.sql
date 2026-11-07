-- Monotrace v9 : récapitulatif quotidien envoyé à la synchronisation de la montre (un seul e-mail par jour).

create table if not exists public.envois_email (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  declencheur text not null,
  envoye_le timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.envois_email enable row level security;
create policy "envois : staff lecture" on public.envois_email for select to authenticated using (public.is_staff());

-- Réserve l'envoi du jour : vrai si personne ne l'a encore envoyé, faux sinon (garantit 1 e-mail par jour)
create or replace function public.email_matin_reserver(p_secret text, p_user uuid, p_date date, p_declencheur text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;
  insert into public.envois_email (user_id, date, declencheur) values (p_user, p_date, p_declencheur) on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.email_matin_reserver(text, uuid, date, text) from public;
grant execute on function public.email_matin_reserver(text, uuid, date, text) to anon, authenticated;

-- Tout ce qu'il faut pour composer le récapitulatif : profil, plan, objectif, mesures des 36 derniers jours
create or replace function public.recap_membres(p_secret text, p_date date, p_ids uuid[] default null)
returns json language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from public.secrets_internes where cle = 'secret_cron' and valeur = p_secret) then
    raise exception 'accès refusé';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', p.id, 'email', p.email, 'prenom', p.prenom, 'preferences', p.preferences,
      'plan', pl.contenu, 'course', o.nom, 'date_course', o.date,
      'garmin', exists (select 1 from public.connexions c where c.user_id = p.id and c.fournisseur = 'garmin'),
      'email_envoye', exists (select 1 from public.envois_email e where e.user_id = p.id and e.date = p_date),
      'mesures', coalesce((select json_agg(m order by m.date desc) from public.mesures_sante m
                           where m.user_id = p.id and m.date between p_date - 36 and p_date), '[]'::json)
    ))
    from public.profiles p
    join public.plans pl on pl.user_id = p.id and pl.actif
    left join public.objectifs o on o.id = pl.objectif_id
    where p.statut = 'actif' and p.onboarding_termine and (p_ids is null or p.id = any (p_ids))
  ), '[]'::json);
end;
$$;
revoke all on function public.recap_membres(text, date, uuid[]) from public;
grant execute on function public.recap_membres(text, date, uuid[]) to anon, authenticated;
