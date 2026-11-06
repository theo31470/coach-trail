import { NextResponse } from 'next/server';
import { bilanDuJour, contexte, planActif } from '@/lib/donnees';
import { seanceVersFit, nomFichierFit } from '@/lib/fit';
import { seanceAdaptee, trouverSeance } from '@/lib/plan-utils';
import { detaillerSeance } from '@/lib/seance-detail';

/** Téléchargement de la séance au format .FIT, prête à être copiée sur une montre. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profil } = await contexte();
  if (!user || !profil) return NextResponse.json({ erreur: 'Connexion requise' }, { status: 401 });
  const { plan } = await planActif(supabase, user.id);
  const trouve = plan && trouverSeance(plan.contenu, decodeURIComponent(id));
  if (!plan || !trouve) return NextResponse.json({ erreur: 'Séance introuvable' }, { status: 404 });
  const bilan = await bilanDuJour(supabase, user.id, trouve.seance.date);
  const { seance } = seanceAdaptee(trouve.seance, bilan);
  if (!seance || seance.type === 'course') return NextResponse.json({ erreur: 'Rien à envoyer pour cette séance' }, { status: 404 });
  const detail = detaillerSeance(seance);
  const pilotage = profil.preferences?.pilotage ?? 'rpe';
  const octets = seanceVersFit(seance, detail, plan.contenu.zones, pilotage);
  return new NextResponse(Buffer.from(octets), {
    headers: {
      'Content-Type': 'application/vnd.ant.fit',
      'Content-Disposition': `attachment; filename="${nomFichierFit(seance, detail.titre)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
