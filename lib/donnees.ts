import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ajouterJoursIso } from './format';
import { lireMontre, type MesureSanteDb } from './sante';
import { supabaseServeur } from './supabase/server';
import type { BilanMatinDb, ConnexionDb, ObjectifDb, PlanDb, Profil, SeanceRealiseeDb } from './types';

type Client = Awaited<ReturnType<typeof supabaseServeur>>;

/**
 * Utilisateur et profil de la requête en cours, lus une seule fois par requête
 * (le layout et la page partagent le même résultat au lieu de refaire les appels).
 */
export const contexte = cache(async () => {
  const supabase = await supabaseServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profil: null };
  const { data: profil } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profil>();
  return { supabase, user, profil: profil ?? null };
});

/** Membre connecté avec son profil ; redirige si besoin. */
export async function membreConnecte({ exigerOnboarding = true } = {}) {
  const { supabase, user, profil } = await contexte();
  if (!user || !profil) redirect('/connexion');
  if (exigerOnboarding && !profil.onboarding_termine) redirect('/app/onboarding');
  return { supabase, user, profil };
}

/** Plan actif et sa course, en un seul aller-retour. */
export async function planActif(supabase: Client, userId: string) {
  const { data } = await supabase.from('plans').select('*, objectif:objectifs(*)').eq('user_id', userId).eq('actif', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle<PlanDb & { objectif?: ObjectifDb | null }>();
  if (!data) return { plan: null, objectif: null };
  const { objectif: joint, ...plan } = data;
  let objectif = joint ?? null;
  if (objectif === null && plan.objectif_id && joint === undefined) {
    ({ data: objectif } = await supabase.from('objectifs').select('*').eq('id', plan.objectif_id).maybeSingle<ObjectifDb>());
  }
  return { plan: plan as PlanDb, objectif };
}

export async function seancesRealisees(supabase: Client, userId: string, depuis?: string) {
  let q = supabase.from('seances_realisees').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (depuis) q = q.gte('date', depuis);
  const { data } = await q.returns<SeanceRealiseeDb[]>();
  return data ?? [];
}

export async function staffConnecte() {
  const { supabase, user, profil } = await contexte();
  if (!user) redirect('/connexion?suite=/admin');
  if (!profil || !['admin', 'coach'].includes(profil.role) || profil.statut !== 'actif') redirect('/app');
  return { supabase, user, profil };
}

/** Bilan du matin du jour (null s'il n'est pas fait, ou si la table n'existe pas encore). */
export async function bilanDuJour(supabase: Client, userId: string, date: string) {
  const { data, error } = await supabase.from('bilans_matin').select('*').eq('user_id', userId).eq('date', date).maybeSingle<BilanMatinDb>();
  return error ? null : data;
}

/** Montres et applis connectées (sans les jetons). */
export async function connexions(supabase: Client, userId: string) {
  const { data, error } = await supabase.from('connexions').select('id, user_id, fournisseur, compte_externe, derniere_synchro, created_at')
    .eq('user_id', userId).returns<ConnexionDb[]>();
  return error ? [] : data ?? [];
}

/** Adresse d'abonnement agenda (webcal://) du membre. */
export async function urlAgenda(jeton: string | null | undefined) {
  if (!jeton) return null;
  const { headers } = await import('next/headers');
  const h = await headers();
  const hote = h.get('x-forwarded-host') ?? h.get('host');
  return hote ? `webcal://${hote}/api/calendrier/${jeton}.ics` : null;
}

/** Mesures santé des montres (sommeil, FC au repos, VFC…), les plus récentes d'abord. */
export async function mesuresSante(supabase: Client, userId: string, depuis: string) {
  const { data, error } = await supabase.from('mesures_sante').select('*').eq('user_id', userId).gte('date', depuis)
    .order('date', { ascending: false }).returns<MesureSanteDb[]>();
  return error ? [] : data ?? [];
}

/** Lecture de la nuit écoulée par le moteur, comparée aux 28 jours précédents. */
export async function lectureDuJour(supabase: Client, userId: string, date: string) {
  const mesures = await mesuresSante(supabase, userId, ajouterJoursIso(date, -29));
  return lireMontre(mesures.find((m) => m.date === date) ?? null, mesures.filter((m) => m.date < date));
}
