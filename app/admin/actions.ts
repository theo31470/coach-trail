'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { planActif, staffConnecte } from '@/lib/donnees';
import { chrono, duree, ecartJours, isoAujourdhui } from '@/lib/format';
import { emailDuMatin, envoyerEmailDetail } from '@/lib/notifier';
import { cibleBloc, detaillerSeance } from '@/lib/seance-detail';
import { nouveauPlan } from '@/lib/plan-utils';
import type { ObjectifDb, Profil } from '@/lib/types';

const message = (e: { message: string } | null) =>
  e ? { erreur: e.message.includes('propres droits') ? 'Tu ne peux pas retirer tes propres droits d’administrateur.' : e.message.includes('réservé') ? 'Action réservée aux administrateurs.' : 'Action impossible.' } : {};

export async function majMembre(id: string, champs: { role?: string; statut?: string; abonnement?: string; abonnement_fin?: string; note?: string }) {
  const { supabase } = await staffConnecte();
  const { error } = await supabase.rpc('admin_maj_membre', {
    p_id: id, p_role: champs.role ?? null, p_statut: champs.statut ?? null, p_abonnement: champs.abonnement ?? null,
    p_abonnement_fin: champs.abonnement_fin ?? null, p_note: champs.note ?? null,
  });
  revalidatePath('/admin', 'layout');
  return message(error);
}

export async function supprimerMembre(id: string) {
  const { supabase } = await staffConnecte();
  const { error } = await supabase.rpc('admin_supprimer_membre', { p_id: id });
  if (error) return message(error);
  revalidatePath('/admin', 'layout');
  redirect('/admin/membres?supprime=1');
}

export async function traiterAlerte(id: string, traitee: boolean) {
  const { supabase } = await staffConnecte();
  const { error } = await supabase.rpc('admin_traiter_alerte', { p_id: id, p_traitee: traitee });
  revalidatePath('/admin', 'layout');
  return message(error);
}

export async function regenererPlanMembre(userId: string) {
  const { supabase } = await staffConnecte();
  const { data: profil } = await supabase.from('profiles').select('*').eq('id', userId).single<Profil>();
  const { data: objectif } = await supabase.from('objectifs').select('*').eq('user_id', userId).eq('actif', true)
    .order('date').limit(1).maybeSingle<ObjectifDb>();
  if (!profil || !objectif) return { erreur: 'Ce membre n’a pas de course objectif active.' };
  const contenu = nouveauPlan(profil, objectif);
  if (!contenu.semaines.length) return { erreur: 'La course est trop proche pour générer un plan.' };
  await supabase.from('plans').update({ actif: false }).eq('user_id', userId).eq('actif', true);
  const { error } = await supabase.from('plans').insert({ user_id: userId, objectif_id: objectif.id, contenu });
  if (error) return { erreur: 'Génération impossible.' };
  await supabase.rpc('admin_journaliser', { p_cible: userId, p_action: 'plan_regenere', p_details: { semaines: contenu.semaines.length } });
  revalidatePath('/admin', 'layout');
  return {};
}

export async function majReglages(inscriptions: boolean, annonce: string, essai: number) {
  const { supabase } = await staffConnecte();
  const { error } = await supabase.rpc('admin_maj_reglages', { p_inscriptions: inscriptions, p_annonce: annonce, p_essai: essai });
  revalidatePath('/', 'layout');
  return message(error);
}

/** Envoie à l'administrateur connecté l'e-mail du matin de sa prochaine séance, pour vérifier le rendu. */
export async function emailTestMatin(): Promise<{ ok: boolean; texte: string }> {
  const { supabase, user, profil } = await staffConnecte();
  if (!user.email) return { ok: false, texte: 'Ton compte n’a pas d’adresse e-mail.' };
  const { plan, objectif } = await planActif(supabase, user.id);
  if (!plan) return { ok: false, texte: 'Crée d’abord ton plan dans l’app : l’e-mail présente la séance du jour.' };
  const aujourdhui = isoAujourdhui();
  const seance = plan.contenu.semaines.flatMap((s) => s.seances).find((s) => s.date >= aujourdhui && s.type !== 'course');
  if (!seance) return { ok: false, texte: 'Aucune séance à venir dans ton plan.' };
  const detail = detaillerSeance(seance);
  const titre = `${detail.titre} · ${duree(seance.dureeMin)}`;
  const { html, texte } = emailDuMatin({
    prenom: profil.prenom ?? null, site: process.env.SITE_URL ?? 'https://monotrace.fr', titre, resume: detail.resume, pourquoi: seance.pourquoi,
    joursAvant: objectif?.date ? ecartJours(aujourdhui, objectif.date) : null, course: objectif?.nom ?? null, seanceId: seance.id,
    blocs: detail.blocs.filter((b) => b.type !== 'recup').slice(0, 8).map((b) => ({ titre: b.repetition ? `${b.titre} (${b.repetition})` : b.titre, duree: chrono(b.dureeSec), cible: cibleBloc(b.zone, plan.contenu.zones) })),
  });
  const r = await envoyerEmailDetail(user.email, `[Test] ☀️ ${titre}`, html, texte);
  return r.ok
    ? { ok: true, texte: `E-mail envoyé à ${user.email} (séance du ${new Date(`${seance.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}). Pense à regarder dans les spams.` }
    : { ok: false, texte: `Échec de l’envoi : ${r.erreur}` };
}
