import { NextResponse, type NextRequest } from 'next/server';
import { requeteMembres } from '@/lib/admin-membres';
import { supabaseServeur } from '@/lib/supabase/server';

const cellule = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export CSV des membres (filtres de la liste appliqués), séparateur « ; » pour Excel en français. */
export async function GET(request: NextRequest) {
  const supabase = await supabaseServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Non connecté', { status: 401 });
  const { data: profil } = await supabase.from('profiles').select('role, statut').eq('id', user.id).single();
  if (!profil || !['admin', 'coach'].includes(profil.role) || profil.statut !== 'actif') return new NextResponse('Accès refusé', { status: 403 });

  const f = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { data } = await requeteMembres(supabase, f, false);
  const colonnes = ['email', 'prenom', 'nom', 'ville', 'niveau', 'role', 'statut', 'abonnement', 'abonnement_fin', 'objectif_nom', 'objectif_type',
    'objectif_distance', 'objectif_dplus', 'objectif_date', 'nb_seances', 'seances_30j', 'alertes', 'derniere_seance', 'derniere_activite', 'created_at'] as const;
  const lignes = [colonnes.join(';'), ...(data ?? []).map((m) => colonnes.map((c) => cellule(m[c])).join(';'))];
  await supabase.rpc('admin_journaliser', { p_cible: null, p_action: 'export_membres', p_details: { lignes: data?.length ?? 0 } });
  return new NextResponse(`﻿${lignes.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="membres-monotrace-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
