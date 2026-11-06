import {
  genererPlan, type Jour, type Objectif, type Plan, type Profil as ProfilMoteur, type Seance, type SemainePlan,
} from './moteur-entrainement';
import { ajouterJoursIso, isoAujourdhui, prochainLundi } from './format';
import type { BilanMatinDb, ObjectifDb, Profil, SeanceRealiseeDb } from './types';

export function profilMoteur(p: Profil): ProfilMoteur {
  return {
    niveau: p.niveau,
    fcMax: p.fc_max ?? undefined,
    fcRepos: p.fc_repos ?? undefined,
    courseReference: p.ref_distance_km && p.ref_temps_min ? { distanceKm: Number(p.ref_distance_km), tempsMin: Number(p.ref_temps_min) } : undefined,
    volumeActuelMin: p.volume_actuel_min,
    dplusActuelM: p.dplus_actuel_m,
    joursDispo: p.jours_dispo as Jour[],
    jourSortieLongue: p.jour_longue as Jour,
    blessureRecente: p.blessure_recente,
  };
}

export const objectifMoteur = (o: ObjectifDb): Objectif => ({
  type: o.type, distanceKm: Number(o.distance_km), dplusM: o.dplus_m, date: o.date,
});

/** Plan démarrant le lundi qui vient. */
export const nouveauPlan = (p: Profil, o: ObjectifDb): Plan => genererPlan(profilMoteur(p), objectifMoteur(o), prochainLundi());

export function trouverSeance(plan: Plan, id: string): { seance: Seance; semaine: SemainePlan } | null {
  for (const semaine of plan.semaines) {
    const seance = semaine.seances.find((s) => s.id === id);
    if (seance) return { seance, semaine };
  }
  return null;
}

/** Semaine qui contient la date (ou la première / dernière si hors plan). */
export function semaineDu(plan: Plan, iso = isoAujourdhui()): { semaine: SemainePlan; index: number; avant: boolean; apres: boolean } {
  const i = plan.semaines.findIndex((s) => iso >= s.debut && iso <= ajouterJoursIso(s.debut, 6));
  if (i >= 0) return { semaine: plan.semaines[i], index: i, avant: false, apres: false };
  const avant = iso < plan.semaines[0].debut;
  const index = avant ? 0 : plan.semaines.length - 1;
  return { semaine: plan.semaines[index], index, avant, apres: !avant };
}

export type Statut = 'fait' | 'manque' | 'aujourdhui' | 'a_venir';

export function statutSeance(s: Seance, faites: Set<string>, iso = isoAujourdhui()): Statut {
  if (faites.has(s.id)) return 'fait';
  if (s.date < iso) return 'manque';
  if (s.date === iso) return 'aujourdhui';
  return 'a_venir';
}

export const idsFaits = (realisees: Pick<SeanceRealiseeDb, 'seance_id'>[]) =>
  new Set(realisees.map((r) => r.seance_id).filter((x): x is string => Boolean(x)));

/** Charge hebdomadaire réalisée (RPE × minutes) et ratio aigu / chronique par semaine. */
export function chargesHebdo(realisees: SeanceRealiseeDb[], lundis: string[]) {
  const chargeEntre = (debut: string, fin: string) =>
    realisees.filter((r) => r.date >= debut && r.date <= fin).reduce((t, r) => t + r.rpe * r.duree_min, 0);
  return lundis.map((lundi) => {
    const fin = ajouterJoursIso(lundi, 6);
    const aigue = chargeEntre(lundi, fin);
    const chronique = chargeEntre(ajouterJoursIso(fin, -27), fin) / 4;
    const premiere = realisees.length ? realisees.reduce((m, r) => (r.date < m ? r.date : m), realisees[0].date) : null;
    const assez = premiere !== null && ajouterJoursIso(premiere, 21) <= fin;
    return { lundi, aigue, acwr: assez && chronique > 0 ? Math.round((aigue / chronique) * 100) / 100 : null };
  });
}

export const COULEUR_ZONE = ['', 'var(--z1)', 'var(--z2)', 'var(--z3)', 'var(--z4)', 'var(--z5)'];

/** Séance telle qu'elle doit être faite : la version adaptée par le bilan du matin si elle existe. */
export function seanceAdaptee(s: Seance, bilan: BilanMatinDb | null): { seance: Seance | null; adaptee: boolean; repos: boolean } {
  if (!bilan || bilan.date !== s.date) return { seance: s, adaptee: false, repos: false };
  const a = bilan.adaptation;
  if (a.niveau === 'repos') return { seance: null, adaptee: true, repos: true };
  if (a.niveau === 'maintenue' || !a.seance) return { seance: s, adaptee: false, repos: false };
  return { seance: a.seance, adaptee: true, repos: false };
}
