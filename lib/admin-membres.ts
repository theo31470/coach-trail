import type { supabaseServeur } from './supabase/server';

export interface MembreLigne {
  id: string; email: string; prenom: string | null; nom: string | null; niveau: string; role: string; statut: string;
  abonnement: string; abonnement_fin: string | null; created_at: string; derniere_activite: string; onboarding_termine: boolean; ville: string | null;
  objectif_type: string | null; objectif_distance: number | null; objectif_dplus: number | null; objectif_date: string | null; objectif_nom: string | null;
  nb_seances: number; seances_30j: number; alertes: number; derniere_seance: string | null;
}

export interface FiltresMembres { q?: string; niveau?: string; statut?: string; abonnement?: string; role?: string; activite?: string; tri?: string; page?: string }

export const TRIS: Record<string, { colonne: string; asc: boolean; libelle: string }> = {
  recents: { colonne: 'created_at', asc: false, libelle: 'Plus récents' },
  anciens: { colonne: 'created_at', asc: true, libelle: 'Plus anciens' },
  actifs: { colonne: 'derniere_activite', asc: false, libelle: 'Activité récente' },
  seances: { colonne: 'seances_30j', asc: false, libelle: 'Séances sur 30 j' },
  course: { colonne: 'objectif_date', asc: true, libelle: 'Course la plus proche' },
  nom: { colonne: 'prenom', asc: true, libelle: 'Prénom A → Z' },
};

export const PAR_PAGE = 25;

export function requeteMembres(supabase: Awaited<ReturnType<typeof supabaseServeur>>, f: FiltresMembres, pagine = true) {
  let q = supabase.from('membres_admin').select('*', { count: 'exact' });
  const recherche = (f.q ?? '').replace(/[,()%*]/g, ' ').trim();
  if (recherche) q = q.or(`email.ilike.%${recherche}%,prenom.ilike.%${recherche}%,nom.ilike.%${recherche}%,ville.ilike.%${recherche}%`);
  if (f.niveau) q = q.eq('niveau', f.niveau);
  if (f.statut) q = q.eq('statut', f.statut);
  if (f.abonnement) q = q.eq('abonnement', f.abonnement);
  if (f.role) q = q.eq('role', f.role);
  if (f.activite === 'alertes') q = q.gt('alertes', 0);
  if (f.activite === 'inactifs') q = q.eq('seances_30j', 0);
  if (f.activite === 'actifs') q = q.gt('seances_30j', 0);
  if (f.activite === 'inscription') q = q.eq('onboarding_termine', false);
  const tri = TRIS[f.tri ?? 'recents'] ?? TRIS.recents;
  q = q.order(tri.colonne, { ascending: tri.asc, nullsFirst: false });
  if (pagine) {
    const page = Math.max(1, Number(f.page) || 1);
    q = q.range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1);
  }
  return q.returns<MembreLigne[]>();
}
