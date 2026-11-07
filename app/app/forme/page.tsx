import Link from 'next/link';
import TendancesForme from '@/components/TendancesForme';
import { membreConnecte, mesuresSante, seancesRealisees } from '@/lib/donnees';
import { ajouterJoursIso, isoAujourdhui } from '@/lib/format';
import { analyserTendances, jours as construireJours, type Resume } from '@/lib/tendances';
import type { BilanMatinDb } from '@/lib/types';

export const metadata = { title: 'Ma forme' };

const PERIODES = { '28': '4 semaines', '84': '12 semaines' } as const;

function Tuile({ r }: { r: Resume }) {
  const f = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: r.decimales, minimumFractionDigits: r.decimales });
  const sens = r.ecart == null || Math.abs(r.ecart) < (r.decimales ? 0.3 : 1) ? 'stable' : (r.ecart > 0) === r.mieuxSiHausse ? 'mieux' : 'moins';
  return (
    <div className={`forme-tuile s-${sens}`}>
      <span className="forme-tuile-lib">{r.libelle}</span>
      <span className="forme-tuile-val">{r.recent == null ? '–' : `${f(r.recent)}`}<small> {r.recent == null ? '' : r.unite}</small></span>
      <span className="forme-tuile-det">
        {r.recent == null ? 'pas encore de mesure'
          : r.ecart == null ? 'moyenne 7 jours'
            : `${r.ecart > 0 ? '+' : ''}${f(r.ecart)} vs ta normale · ${sens === 'stable' ? 'stable' : sens === 'mieux' ? 'en mieux' : 'à surveiller'}`}
      </span>
    </div>
  );
}

export default async function MaForme({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const { periode: p } = await searchParams;
  const periode = p === '84' ? 84 : 28;
  const { supabase, user } = await membreConnecte();
  const aujourdhui = isoAujourdhui();
  const depuis = ajouterJoursIso(aujourdhui, -Math.max(periode, 35) - 6);

  const [mesures, realisees, { data: bilans }, { data: garmin }] = await Promise.all([
    mesuresSante(supabase, user.id, depuis),
    seancesRealisees(supabase, user.id, depuis),
    supabase.from('bilans_matin').select('*').eq('user_id', user.id).gte('date', depuis).returns<BilanMatinDb[]>(),
    supabase.from('connexions').select('fournisseur').eq('user_id', user.id).eq('fournisseur', 'garmin').maybeSingle(),
  ]);

  const tous = construireJours(depuis, aujourdhui, mesures, bilans ?? [], realisees);
  const affiches = tous.slice(-periode);
  const t = analyserTendances(tous);
  const ref = (cle: string) => t.resumes.find((r) => r.cle === cle)?.reference ?? null;

  return (
    <div>
      <div className="titre-page">
        <div><h1>Ma forme</h1><p>Ton sommeil, ta récupération et ta charge, semaine après semaine.</p></div>
        <nav className="forme-periodes" aria-label="Période affichée">
          {Object.entries(PERIODES).map(([k, v]) => (
            <Link key={k} href={`/app/forme?periode=${k}`} className={String(periode) === k ? 'actif' : undefined} aria-current={String(periode) === k ? 'page' : undefined}>{v}</Link>
          ))}
        </nav>
      </div>

      {!garmin && (
        <div className="carte forme-invite">
          <p><strong>Connecte ta montre Garmin</strong> pour suivre ici ton sommeil, ta FC au repos, ta VFC et ta respiration nuit après nuit.
            Sans montre, Monotrace suit déjà ta forme du matin et ta charge d’entraînement.</p>
          <Link href="/app/connexions" className="btn btn-primary btn-s">Connecter ma montre</Link>
        </div>
      )}

      <div className="forme-tuiles">
        {t.resumes.filter((r) => r.recent != null || garmin).map((r) => <Tuile key={r.cle} r={r} />)}
      </div>

      {t.constats.length > 0 ? (
        <div className="forme-constats">
          {t.constats.map((c) => (
            <div key={c.titre} className={`forme-constat t-${c.ton}`}>
              <strong>{c.titre}</strong>
              <p>{c.texte}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted mt-16">
          {t.joursMesures < 12
            ? 'Les tendances apparaissent après une douzaine de jours de mesures : le moteur compare toujours ta dernière semaine aux quatre précédentes.'
            : 'Rien à signaler : ta récupération suit ta charge d’entraînement.'}
        </p>
      )}

      <section className="carte mt-24">
        <h3>Jour après jour</h3>
        <p className="small muted mt-8">Survole les courbes pour voir chaque jour. Les pointillés montrent ta normale (moyenne des 4 semaines précédentes).</p>
        <div className="mt-16">
          <TendancesForme jours={affiches} refs={{ fcRepos: ref('fcRepos'), vfc: ref('vfc'), respiration: ref('respiration') }} />
        </div>
      </section>

      <p className="mt-24 small"><Link href="/app/progression">Voir le volume et la progression de ton entraînement</Link></p>
    </div>
  );
}
