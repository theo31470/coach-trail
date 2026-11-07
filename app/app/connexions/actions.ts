'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { FOURNISSEURS, activitesRecentes, envoyerVersGarmin, estActif, rafraichir, revoquerGarmin } from '@/lib/connexions';
import { ajouterJoursIso } from '@/lib/format';
import { seanceAdaptee, trouverSeance } from '@/lib/plan-utils';
import { detaillerSeance } from '@/lib/seance-detail';
import { supabaseServeur } from '@/lib/supabase/server';
import type { BilanMatinDb, Fournisseur, PlanDb } from '@/lib/types';

async function session() {
  const supabase = await supabaseServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/connexion');
  return { supabase, userId: user.id };
}

interface LigneConnexion { fournisseur: Fournisseur; access_token: string; refresh_token: string | null; expire_le: string | null }

async function jetonValide(supabase: Awaited<ReturnType<typeof supabaseServeur>>, userId: string, c: LigneConnexion) {
  const f = FOURNISSEURS[c.fournisseur as keyof typeof FOURNISSEURS];
  const neuf = await rafraichir(f, c);
  if (!neuf) return c.access_token;
  await supabase.from('connexions').update({ access_token: neuf.access_token, refresh_token: neuf.refresh_token, expire_le: neuf.expire_le })
    .eq('user_id', userId).eq('fournisseur', c.fournisseur);
  return neuf.access_token;
}

/** Récupère les sorties des 30 derniers jours et les rattache aux séances du plan. */
export async function synchroniser(): Promise<{ erreur?: string; importees?: number }> {
  const { supabase, userId } = await session();
  const [{ data: liens }, { data: plan }, { data: deja }] = await Promise.all([
    supabase.from('connexions').select('fournisseur, access_token, refresh_token, expire_le').eq('user_id', userId).returns<LigneConnexion[]>(),
    supabase.from('plans').select('id, contenu').eq('user_id', userId).eq('actif', true).order('created_at', { ascending: false }).limit(1).maybeSingle<Pick<PlanDb, 'id' | 'contenu'>>(),
    supabase.from('seances_realisees').select('source, source_id, seance_id').eq('user_id', userId),
  ]);
  if (!liens?.length) return { erreur: 'Aucune montre ni appli connectée.' };
  const connus = new Set((deja ?? []).map((d) => `${d.source}:${d.source_id}`));
  const seancesFaites = new Set((deja ?? []).map((d) => d.seance_id).filter(Boolean));
  const prevues = plan?.contenu.semaines.flatMap((s) => s.seances) ?? [];
  const depuis = new Date(`${ajouterJoursIso(new Date().toISOString().slice(0, 10), -30)}T00:00:00Z`);
  let importees = 0;
  const erreurs: string[] = [];

  for (const c of liens) {
    const f = FOURNISSEURS[c.fournisseur as keyof typeof FOURNISSEURS];
    if (!f || !estActif(f) || !f.capacites.importer) continue;
    try {
      const jeton = await jetonValide(supabase, userId, c);
      const activites = await activitesRecentes(f, jeton, depuis);
      for (const a of activites) {
        if (connus.has(`${f.id}:${a.sourceId}`) || a.dureeMin < 5) continue;
        const prevue = prevues.find((s) => s.date === a.date && s.type !== 'course' && !seancesFaites.has(s.id));
        const { error } = await supabase.from('seances_realisees').insert({
          user_id: userId, plan_id: prevue ? plan!.id : plan?.id ?? null, seance_id: prevue?.id ?? null, type_prevu: prevue?.type ?? null,
          date: a.date, duree_min: Math.min(1440, a.dureeMin), distance_km: a.distanceKm, dplus_m: a.dplusM,
          rpe: prevue?.rpePrevu ?? 4, douleur: 0, source: f.id, source_id: a.sourceId,
          commentaire: `Importée depuis ${f.nom}${a.nom ? ` · ${a.nom}` : ''}${a.fcMoyenne ? ` · FC moyenne ${a.fcMoyenne} bpm` : ''}. Pense à ajuster ton ressenti.`,
        });
        if (!error) { importees++; connus.add(`${f.id}:${a.sourceId}`); if (prevue) seancesFaites.add(prevue.id); }
      }
      await supabase.from('connexions').update({ derniere_synchro: new Date().toISOString() }).eq('user_id', userId).eq('fournisseur', f.id);
    } catch (e) {
      erreurs.push(e instanceof Error ? e.message : `${f.nom} indisponible`);
    }
  }
  revalidatePath('/app', 'layout');
  if (erreurs.length && !importees) return { erreur: erreurs.join(' · ') };
  return { importees };
}

/** Déconnecte un service : ses accès sont effacés, et ses sorties importées aussi si le membre le demande. */
export async function deconnecter(fournisseur: Fournisseur, supprimerSorties = false) {
  const { supabase, userId } = await session();
  if (fournisseur === 'garmin') {
    const { data: c } = await supabase.from('connexions').select('fournisseur, access_token, refresh_token, expire_le').eq('user_id', userId).eq('fournisseur', 'garmin').maybeSingle<LigneConnexion>();
    if (c) await revoquerGarmin(await jetonValide(supabase, userId, c).catch(() => c.access_token));
    if (supprimerSorties) await supabase.from('mesures_sante').delete().eq('user_id', userId).eq('source', 'garmin');
  }
  await supabase.from('connexions').delete().eq('user_id', userId).eq('fournisseur', fournisseur);
  if (supprimerSorties) await supabase.from('seances_realisees').delete().eq('user_id', userId).eq('source', fournisseur);
  revalidatePath('/app', 'layout');
}

/** Envoie la séance (adaptée au bilan du matin si besoin) vers Garmin Connect. */
export async function envoyerSeanceGarmin(seanceId: string): Promise<{ erreur?: string }> {
  const { supabase, userId } = await session();
  const [{ data: c }, { data: plan }, { data: profil }] = await Promise.all([
    supabase.from('connexions').select('fournisseur, access_token, refresh_token, expire_le').eq('user_id', userId).eq('fournisseur', 'garmin').maybeSingle<LigneConnexion>(),
    supabase.from('plans').select('id, contenu').eq('user_id', userId).eq('actif', true).order('created_at', { ascending: false }).limit(1).maybeSingle<Pick<PlanDb, 'id' | 'contenu'>>(),
    supabase.from('profiles').select('preferences').eq('id', userId).single(),
  ]);
  if (!c) return { erreur: 'Connecte d’abord Garmin Connect.' };
  const trouve = plan && trouverSeance(plan.contenu, seanceId);
  if (!plan || !trouve) return { erreur: 'Séance introuvable.' };
  const { data: bilan } = await supabase.from('bilans_matin').select('*').eq('user_id', userId).eq('date', trouve.seance.date).maybeSingle<BilanMatinDb>();
  const { seance } = seanceAdaptee(trouve.seance, bilan ?? null);
  if (!seance) return { erreur: 'Repos aujourd’hui : rien à envoyer.' };
  try {
    const jeton = await jetonValide(supabase, userId, c);
    await envoyerVersGarmin(jeton, seance, detaillerSeance(seance), plan.contenu.zones, profil?.preferences?.pilotage ?? 'rpe');
    return {};
  } catch (e) {
    return { erreur: e instanceof Error ? e.message : 'Envoi impossible' };
  }
}
