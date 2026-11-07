'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adapterSemaine, appliquerDecision, type Jour, type Niveau, type SeanceRealisee } from '@/lib/moteur-entrainement';
import { ajouterJoursIso, isoAujourdhui } from '@/lib/format';
import { adapterSeanceDuJour, type Adaptation, type BilanMatin } from '@/lib/quotidien';
import { lectureDuJour } from '@/lib/donnees';
import { chargesHebdo, nouveauPlan } from '@/lib/plan-utils';
import { supabaseServeur } from '@/lib/supabase/server';
import type { Bilan, ObjectifDb, PlanDb, Preferences, Profil, SeanceRealiseeDb } from '@/lib/types';

async function session() {
  const supabase = await supabaseServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/connexion');
  return { supabase, userId: user.id };
}

export interface DonneesOnboarding {
  prenom: string;
  objectif: { nom: string; type: 'trail' | 'route'; distance_km: number; dplus_m: number; date: string };
  niveau: Niveau;
  volume_actuel_min: number;
  dplus_actuel_m: number;
  blessure_recente: boolean;
  jours_dispo: Jour[];
  jour_longue: Jour;
  ref_distance_km: number | null;
  ref_temps_min: number | null;
  fc_max: number | null;
  fc_repos: number | null;
  date_naissance: string | null;
  sexe: 'femme' | 'homme' | 'autre' | null;
  consentement_sante: boolean;
  consentement_ia: boolean;
}

/** Fin du questionnaire : enregistre le profil, l'objectif, et génère le plan. */
export async function terminerOnboarding(d: DonneesOnboarding): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  if (!d.consentement_sante) return { erreur: 'Le consentement aux données de santé est nécessaire pour adapter ton plan.' };
  const { error: e1 } = await supabase.from('profiles').update({
    prenom: d.prenom || null, niveau: d.niveau, volume_actuel_min: d.volume_actuel_min, dplus_actuel_m: d.dplus_actuel_m,
    blessure_recente: d.blessure_recente, jours_dispo: d.jours_dispo, jour_longue: d.jour_longue,
    ref_distance_km: d.ref_distance_km, ref_temps_min: d.ref_temps_min, fc_max: d.fc_max, fc_repos: d.fc_repos,
    date_naissance: d.date_naissance, sexe: d.sexe, consentement_sante: d.consentement_sante, consentement_ia: d.consentement_ia,
    onboarding_termine: true, derniere_activite: new Date().toISOString(),
  }).eq('id', userId);
  if (e1) return { erreur: 'Enregistrement du profil impossible : vérifie les valeurs saisies.' };
  return creerObjectifEtPlan(d.objectif);
}

async function creerObjectifEtPlan(o: DonneesOnboarding['objectif']): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  const { data: profil } = await supabase.from('profiles').select('*').eq('id', userId).single<Profil>();
  if (!profil) return { erreur: 'Profil introuvable.' };
  await supabase.from('objectifs').update({ actif: false }).eq('user_id', userId).eq('actif', true);
  const { data: objectif, error: e2 } = await supabase.from('objectifs')
    .insert({ user_id: userId, nom: o.nom || null, type: o.type, distance_km: o.distance_km, dplus_m: o.type === 'trail' ? o.dplus_m : 0, date: o.date })
    .select().single<ObjectifDb>();
  if (e2 || !objectif) return { erreur: 'Enregistrement de la course impossible.' };
  const contenu = nouveauPlan(profil, objectif);
  if (!contenu.semaines.length) return { erreur: 'La date de course est trop proche pour construire un plan.' };
  await supabase.from('plans').update({ actif: false }).eq('user_id', userId).eq('actif', true);
  const { error: e3 } = await supabase.from('plans').insert({ user_id: userId, objectif_id: objectif.id, contenu });
  if (e3) return { erreur: 'Génération du plan impossible.' };
  revalidatePath('/app', 'layout');
  return {};
}

/** Nouvelle course objectif : nouveau plan (l'historique des séances est conservé). */
export async function changerObjectif(o: DonneesOnboarding['objectif']) {
  return creerObjectifEtPlan(o);
}

/** Régénère le plan à partir du profil actuel, même course. */
export async function regenererPlan(): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  const { data: objectif } = await supabase.from('objectifs').select('*').eq('user_id', userId).eq('actif', true)
    .order('date').limit(1).maybeSingle<ObjectifDb>();
  if (!objectif) return { erreur: 'Aucune course objectif active.' };
  return creerObjectifEtPlan({ nom: objectif.nom ?? '', type: objectif.type, distance_km: Number(objectif.distance_km), dplus_m: objectif.dplus_m, date: objectif.date });
}

export interface Ressenti {
  planId: string | null;
  seanceId: string | null;
  typePrevu: string | null;
  date: string;
  duree_min: number;
  distance_km: number | null;
  dplus_m: number | null;
  rpe: number;
  douleur: number;
  zone_douleur: string | null;
  sommeil: number | null;
  commentaire: string | null;
}

export async function enregistrerSeance(r: Ressenti): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  const ligne = {
    user_id: userId, plan_id: r.planId, seance_id: r.seanceId, type_prevu: r.typePrevu, date: r.date,
    duree_min: Math.round(r.duree_min), distance_km: r.distance_km, dplus_m: r.dplus_m, rpe: r.rpe,
    douleur: r.douleur, zone_douleur: r.douleur >= 1 ? r.zone_douleur : null, sommeil: r.sommeil, commentaire: r.commentaire,
  };
  const requete = r.seanceId && r.planId
    ? supabase.from('seances_realisees').upsert(ligne, { onConflict: 'user_id,plan_id,seance_id' })
    : supabase.from('seances_realisees').insert(ligne);
  const { error } = await requete;
  if (error) return { erreur: 'Enregistrement impossible : vérifie la durée et le ressenti.' };
  await supabase.from('profiles').update({ derniere_activite: new Date().toISOString() }).eq('id', userId);
  revalidatePath('/app', 'layout');
  return {};
}

export async function supprimerSeanceRealisee(id: string) {
  const { supabase } = await session();
  await supabase.from('seances_realisees').delete().eq('id', id);
  revalidatePath('/app', 'layout');
}

/** Bilan d'une semaine : calcule l'adaptation et l'applique à la semaine suivante du plan. */
export async function faireBilan(planId: string, numero: number): Promise<{ erreur?: string; bilan?: Bilan }> {
  const { supabase, userId } = await session();
  const { data: plan } = await supabase.from('plans').select('*').eq('id', planId).eq('user_id', userId).single<PlanDb>();
  if (!plan) return { erreur: 'Plan introuvable.' };
  if (plan.bilans.some((b) => b.semaine === numero)) return { erreur: 'Le bilan de cette semaine est déjà fait.' };
  const i = plan.contenu.semaines.findIndex((s) => s.numero === numero);
  const semaine = plan.contenu.semaines[i];
  const suivante = plan.contenu.semaines[i + 1];
  if (!semaine || !suivante) return { erreur: 'Pas de semaine suivante à ajuster.' };

  const fin = ajouterJoursIso(semaine.debut, 6);
  const { data: historiqueDb } = await supabase.from('seances_realisees').select('*').eq('user_id', userId)
    .gte('date', ajouterJoursIso(fin, -27)).lte('date', fin).returns<SeanceRealiseeDb[]>();
  const versMoteur = (r: SeanceRealiseeDb): SeanceRealisee => ({
    date: r.date, dureeMin: r.duree_min, rpe: r.rpe, seancePrevueId: r.seance_id ?? undefined,
    douleur: r.douleur, zoneDouleur: r.zone_douleur ?? undefined,
  });
  const historique = (historiqueDb ?? []).map(versMoteur);
  const realisees = historique.filter((r) => r.date >= semaine.debut && r.date <= fin);
  // Mauvaises nuits : séances de la semaine notées 1 ou 2 sur 5 pour le sommeil
  const nuitsMauvaises = (historiqueDb ?? []).filter((r) => r.date >= semaine.debut && r.date <= fin && (r.sommeil ?? 5) <= 2).length;
  const decision = adapterSemaine({
    semaine, realisees, historique, ressenti: { nuitsMauvaises }, volumeSemaineSuivante: suivante.volumeMin,
  });
  const contenu = structuredClone(plan.contenu);
  if (decision.facteurVolume < 1 || decision.supprimerQualite) contenu.semaines[i + 1] = appliquerDecision(suivante, decision);
  const bilan: Bilan = { semaine: numero, date: new Date().toISOString(), decision };
  const { error } = await supabase.from('plans').update({ contenu, bilans: [...plan.bilans, bilan] }).eq('id', planId);
  if (error) return { erreur: 'Enregistrement du bilan impossible.' };
  revalidatePath('/app', 'layout');
  return { bilan };
}

export async function majProfil(champs: Partial<Profil>): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  const autorises = ['prenom', 'nom', 'date_naissance', 'sexe', 'ville', 'poids_kg', 'taille_cm', 'niveau', 'fc_max', 'fc_repos',
    'ref_distance_km', 'ref_temps_min', 'volume_actuel_min', 'dplus_actuel_m', 'jours_dispo', 'jour_longue', 'blessure_recente',
    'consentement_sante', 'consentement_ia'] as const;
  const maj = Object.fromEntries(Object.entries(champs).filter(([k]) => (autorises as readonly string[]).includes(k)));
  const { error } = await supabase.from('profiles').update(maj).eq('id', userId);
  if (error) return { erreur: 'Enregistrement impossible : vérifie les valeurs (FC entre 120 et 230, repos entre 30 et 110).' };
  revalidatePath('/app', 'layout');
  return {};
}

export async function majPreferences(prefs: Preferences): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  const { data } = await supabase.from('profiles').select('preferences').eq('id', userId).single<Pick<Profil, 'preferences'>>();
  const { error } = await supabase.from('profiles').update({ preferences: { ...(data?.preferences ?? {}), ...prefs } }).eq('id', userId);
  if (error) return { erreur: 'Enregistrement impossible.' };
  revalidatePath('/app', 'layout');
  return {};
}

export async function exporterDonnees() {
  const { supabase, userId } = await session();
  const [profil, objectifs, plans, seances] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('objectifs').select('*').eq('user_id', userId),
    supabase.from('plans').select('*').eq('user_id', userId),
    supabase.from('seances_realisees').select('*').eq('user_id', userId),
  ]);
  return { exporte_le: new Date().toISOString(), profil: profil.data, objectifs: objectifs.data, plans: plans.data, seances_realisees: seances.data };
}

export async function supprimerCompte() {
  const { supabase } = await session();
  const { error } = await supabase.rpc('supprimer_mon_compte');
  if (error) return { erreur: 'Suppression impossible, réessaie.' };
  await supabase.auth.signOut();
  redirect('/');
}

export async function deconnexion() {
  const supabase = await supabaseServeur();
  await supabase.auth.signOut();
  redirect('/');
}

// ───────────── Suivi quotidien ─────────────

/** Bilan du matin : calcule la forme du jour et adapte la séance prévue aujourd'hui. */
export async function enregistrerBilanMatin(b: BilanMatin): Promise<{ erreur?: string; adaptation?: Adaptation }> {
  const { supabase, userId } = await session();
  const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
  const bilan: BilanMatin = {
    sommeil: borne(b.sommeil, 1, 5), energie: borne(b.energie, 1, 5), jambes: borne(b.jambes, 1, 5),
    douleur: borne(b.douleur, 0, 10), zoneDouleur: b.douleur > 0 ? (b.zoneDouleur ?? '').slice(0, 80) || null : null,
  };
  const date = isoAujourdhui();
  const [{ data: plan }, { data: realisees }] = await Promise.all([
    supabase.from('plans').select('contenu').eq('user_id', userId).eq('actif', true).order('created_at', { ascending: false }).limit(1).maybeSingle<Pick<PlanDb, 'contenu'>>(),
    supabase.from('seances_realisees').select('*').eq('user_id', userId).gte('date', ajouterJoursIso(date, -35)).returns<SeanceRealiseeDb[]>(),
  ]);
  const prevue = plan?.contenu.semaines.flatMap((s) => s.seances).find((s) => s.date === date) ?? null;
  const [charge] = chargesHebdo(realisees ?? [], [ajouterJoursIso(date, -6)]);
  const montre = await lectureDuJour(supabase, userId, date);
  const adaptation = adapterSeanceDuJour(prevue, bilan, charge?.acwr ?? null, montre);
  adaptation.montre = montre ? { points: montre.points, indicateurs: montre.indicateurs } : null;
  const { error } = await supabase.from('bilans_matin').upsert({
    user_id: userId, date, sommeil: bilan.sommeil, energie: bilan.energie, jambes: bilan.jambes,
    douleur: bilan.douleur, zone_douleur: bilan.zoneDouleur, score: adaptation.score, adaptation,
  }, { onConflict: 'user_id,date' });
  if (error) return { erreur: 'Bilan non enregistré. Réessaie dans un instant.' };
  await supabase.from('profiles').update({ derniere_activite: new Date().toISOString() }).eq('id', userId);
  revalidatePath('/app', 'layout');
  return { adaptation };
}

export async function refaireBilanMatin() {
  const { supabase, userId } = await session();
  await supabase.from('bilans_matin').delete().eq('user_id', userId).eq('date', isoAujourdhui());
  revalidatePath('/app', 'layout');
}

// ───────────── Notifications ─────────────

export async function abonnerNotifications(a: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  if (!a?.endpoint?.startsWith('https://') || !a.keys?.p256dh || !a.keys?.auth) return { erreur: 'Abonnement invalide.' };
  const { error } = await supabase.from('push_abonnements').upsert(
    { user_id: userId, endpoint: a.endpoint, p256dh: a.keys.p256dh, auth: a.keys.auth }, { onConflict: 'endpoint' });
  return error ? { erreur: 'Activation impossible pour le moment.' } : {};
}

export async function desabonnerNotifications(endpoint: string) {
  const { supabase, userId } = await session();
  await supabase.from('push_abonnements').delete().eq('user_id', userId).eq('endpoint', endpoint);
}
