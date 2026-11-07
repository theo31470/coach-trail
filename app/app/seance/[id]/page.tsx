import Link from 'next/link';
import { notFound } from 'next/navigation';
import AnalyseSeance from '@/components/AnalyseSeance';
import CourbesSeance from '@/components/CourbesSeance';
import { analyserCourbes } from '@/lib/analyse-courbes';
import type { Echantillons } from '@/lib/garmin';
import EnvoiMontre from '@/components/EnvoiMontre';
import { IcRetour } from '@/components/Icones';
import { bilanDuJour, connexions, membreConnecte, planActif, urlAgenda } from '@/lib/donnees';
import { PHASES } from '@/lib/format';
import { seanceAdaptee, trouverSeance } from '@/lib/plan-utils';
import { detaillerSeance } from '@/lib/seance-detail';
import type { SeanceRealiseeDb } from '@/lib/types';
import SeanceImmersive from './SeanceImmersive';

export const metadata = { title: 'Séance' };

export default async function PageSeance({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lecteur?: string }> }) {
  const { id } = await params;
  const { lecteur } = await searchParams;
  const { supabase, user, profil } = await membreConnecte();
  const { plan } = await planActif(supabase, user.id);
  if (!plan) notFound();
  const trouve = trouverSeance(plan.contenu, decodeURIComponent(id));
  if (!trouve) notFound();
  const { semaine } = trouve;
  const [{ data: realisee }, bilan, liens, agenda] = await Promise.all([
    supabase.from('seances_realisees').select('*').eq('user_id', user.id).eq('plan_id', plan.id).eq('seance_id', trouve.seance.id).maybeSingle<SeanceRealiseeDb>(),
    bilanDuJour(supabase, user.id, trouve.seance.date),
    connexions(supabase, user.id),
    urlAgenda(profil.jeton_calendrier),
  ]);
  const { seance: adaptee, adaptee: estAdaptee, repos } = seanceAdaptee(trouve.seance, bilan);
  const seance = adaptee ?? trouve.seance;
  const { data: courbe } = realisee?.source_id
    ? await supabase.from('courbes_activite').select('echantillons').eq('user_id', user.id).eq('source', realisee.source ?? 'garmin').eq('source_id', realisee.source_id).maybeSingle<{ echantillons: Echantillons }>()
    : { data: null };
  const detailCourbes = courbe?.echantillons?.t?.length
    ? <CourbesSeance echantillons={courbe.echantillons} analyse={analyserCourbes(courbe.echantillons, plan.contenu.zones, seance)} />
    : null;

  return (
    <div>
      <Link href={`/app/plan?semaine=${semaine.numero}`} className="lien small row" style={{ gap: 4, marginBottom: 16 }}>
        <IcRetour /> Semaine {semaine.numero} · {PHASES[semaine.phase]}
      </Link>
      {repos && <p className="alerte alerte-warn" style={{ marginBottom: 16 }}><b>Repos conseillé aujourd’hui.</b> {bilan?.adaptation.raisons.join(' ')} Tu peux consulter la séance prévue, mais ne la fais pas.</p>}
      <SeanceImmersive
        planId={plan.id}
        seance={seance}
        detail={detaillerSeance(seance)}
        zones={plan.contenu.zones}
        realisee={realisee ?? null}
        preferences={profil.preferences}
        ouvrirLecteur={lecteur === '1' && !realisee && !repos}
        adaptation={estAdaptee && bilan ? { titre: bilan.adaptation.titre, raisons: bilan.adaptation.raisons } : null}
        analyse={realisee ? <><AnalyseSeance prevue={seance} realisee={realisee} />{detailCourbes}</> : null}
        envoi={seance.type !== 'course' && !realisee ? <EnvoiMontre seanceId={seance.id} garmin={liens.some((l) => l.fournisseur === 'garmin')} urlAgenda={agenda} /> : null}
      />
    </div>
  );
}
