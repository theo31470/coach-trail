import Link from 'next/link';
import { Barres, Courbe, Repartition } from '@/components/Graphiques';
import { membreConnecte, planActif, seancesRealisees } from '@/lib/donnees';
import { ajouterJoursIso, dateCourte, duree, isoAujourdhui, nombre, prochainLundi } from '@/lib/format';
import { chargesHebdo, idsFaits } from '@/lib/plan-utils';
import { NOMS_SEANCES } from '@/lib/seance-detail';
import type { TypeSeance } from '@/lib/moteur-entrainement';

export const metadata = { title: 'Progression' };

export default async function Progression() {
  const { supabase, user } = await membreConnecte();
  const [{ plan }, realisees] = await Promise.all([planActif(supabase, user.id), seancesRealisees(supabase, user.id)]);
  const aujourdhui = isoAujourdhui();

  // 12 dernières semaines (lundis)
  const lundiCourant = ajouterJoursIso(prochainLundi(aujourdhui), aujourdhui === prochainLundi(aujourdhui) ? 0 : -7);
  const lundis = Array.from({ length: 12 }, (_, k) => ajouterJoursIso(lundiCourant, (k - 11) * 7));
  const parSemaine = lundis.map((l) => {
    const r = realisees.filter((x) => x.date >= l && x.date <= ajouterJoursIso(l, 6));
    const prevue = plan?.contenu.semaines.find((s) => s.debut === l);
    return {
      lundi: l,
      minutes: r.reduce((t, x) => t + x.duree_min, 0),
      prevu: prevue?.seances.filter((s) => s.type !== 'course').reduce((t, s) => t + s.dureeMin, 0) ?? 0,
      dplus: r.reduce((t, x) => t + (x.dplus_m ?? 0), 0),
      km: r.reduce((t, x) => t + Number(x.distance_km ?? 0), 0),
      rpe: r.length ? r.reduce((t, x) => t + x.rpe, 0) / r.length : null,
    };
  });
  const charges = chargesHebdo(realisees, lundis);

  const total = {
    seances: realisees.length,
    minutes: realisees.reduce((t, x) => t + x.duree_min, 0),
    km: realisees.reduce((t, x) => t + Number(x.distance_km ?? 0), 0),
    dplus: realisees.reduce((t, x) => t + (x.dplus_m ?? 0), 0),
  };
  const faites = plan ? idsFaits(realisees.filter((r) => r.plan_id === plan.id)) : new Set<string>();
  const prevuesPassees = plan ? plan.contenu.semaines.flatMap((s) => s.seances).filter((s) => s.date <= aujourdhui && s.type !== 'course') : [];
  const observance = prevuesPassees.length ? Math.round((prevuesPassees.filter((s) => faites.has(s.id)).length / prevuesPassees.length) * 100) : null;

  const parType = new Map<string, number>();
  realisees.forEach((r) => { const t = r.type_prevu ?? 'libre'; parType.set(t, (parType.get(t) ?? 0) + 1); });
  const douleurs = realisees.filter((r) => r.douleur >= 3);

  return (
    <div>
      <div className="titre-page"><div><h1>Progression</h1><p>Ton entraînement réel, semaine après semaine.</p></div></div>

      <div className="grille-4">
        <div className="kpi"><div className="valeur">{total.seances}</div><div className="libelle">séances enregistrées</div></div>
        <div className="kpi"><div className="valeur">{duree(total.minutes)}</div><div className="libelle">de course au total</div></div>
        <div className="kpi"><div className="valeur">{nombre(Math.round(total.km))} km</div><div className="libelle">parcourus (déclarés)</div></div>
        <div className="kpi"><div className="valeur">{nombre(total.dplus)} m</div><div className="libelle">de dénivelé positif</div></div>
        <div className="kpi"><div className="valeur">{observance === null ? '—' : `${observance} %`}</div><div className="libelle">des séances du plan réalisées</div></div>
      </div>

      {!realisees.length ? (
        <div className="carte vide mt-24">
          <h3>Pas encore de séance enregistrée</h3>
          <p className="mt-8">Après chaque séance, note ton ressenti : tes graphiques apparaîtront ici.</p>
          <Link href="/app" className="btn btn-primary mt-16">Voir ma séance du jour</Link>
        </div>
      ) : (
        <>
          <div className="carte mt-24">
            <div className="carte-titre"><h3>Volume : prévu et réalisé</h3><span className="tiny">12 dernières semaines, en minutes</span></div>
            <Barres legende={['Prévu', 'Réalisé']} couleur="var(--line-2)" couleur2="var(--forest-2)"
              donnees={parSemaine.map((s) => ({ libelle: dateCourte(s.lundi), valeur: s.prevu, valeur2: s.minutes }))} />
          </div>
          <div className="grille-2 mt-24">
            <div className="carte">
              <div className="carte-titre"><h3>Ratio de charge</h3><span className="tiny">zone verte : 0,8 à 1,3</span></div>
              <Courbe largeur={480} bande={[0.8, 1.3]} min={0} max={2} format={(v) => v.toLocaleString('fr-FR')}
                points={charges.map((c) => ({ libelle: dateCourte(c.lundi), valeur: c.acwr }))} />
              <p className="tiny mt-8">Charge des 7 derniers jours divisée par ta moyenne des 4 dernières semaines. Au-dessus de 1,5, le risque de blessure augmente.</p>
            </div>
            <div className="carte">
              <div className="carte-titre"><h3>Effort ressenti moyen</h3><span className="tiny">sur 10</span></div>
              <Courbe largeur={480} min={0} max={10} format={(v) => v.toLocaleString('fr-FR')}
                points={parSemaine.map((s) => ({ libelle: dateCourte(s.lundi), valeur: s.rpe === null ? null : Math.round(s.rpe * 10) / 10 }))} />
            </div>
            <div className="carte">
              <div className="carte-titre"><h3>Dénivelé positif</h3><span className="tiny">par semaine, en mètres</span></div>
              <Barres largeur={480} couleur="var(--accent)" donnees={parSemaine.map((s) => ({ libelle: dateCourte(s.lundi), valeur: s.dplus }))} />
            </div>
            <div className="carte">
              <div className="carte-titre"><h3>Types de séances</h3></div>
              <Repartition elements={[...parType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ libelle: NOMS_SEANCES[t as TypeSeance] ?? 'Sortie libre', valeur: n }))} />
            </div>
          </div>

          <div className="carte mt-24">
            <div className="carte-titre"><h3>Historique</h3><span className="tiny">{realisees.length} séances</span></div>
            <div className="defile">
              <table className="tableau">
                <thead><tr><th>Date</th><th>Séance</th><th>Durée</th><th>Distance</th><th>D+</th><th>Effort</th><th>Douleur</th></tr></thead>
                <tbody>
                  {realisees.slice(0, 40).map((r) => (
                    <tr key={r.id}>
                      <td>{dateCourte(r.date)}</td>
                      <td>{r.seance_id ? <Link className="lien" href={`/app/seance/${r.seance_id}`}>{NOMS_SEANCES[r.type_prevu as TypeSeance] ?? 'Séance'}</Link> : 'Sortie libre'}</td>
                      <td>{duree(r.duree_min)}</td>
                      <td>{r.distance_km ? `${Number(r.distance_km).toLocaleString('fr-FR')} km` : '—'}</td>
                      <td>{r.dplus_m ? `${r.dplus_m} m` : '—'}</td>
                      <td>{r.rpe}/10</td>
                      <td>{r.douleur ? <span className={`badge ${r.douleur >= 5 ? 'badge-danger' : r.douleur >= 3 ? 'badge-warn' : ''}`}>{r.douleur}/10{r.zone_douleur ? ` · ${r.zone_douleur}` : ''}</span> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {douleurs.length > 0 && (
            <p className="alerte alerte-warn mt-24 small">{douleurs.length} séance{douleurs.length > 1 ? 's' : ''} avec une douleur de 3/10 ou plus. Si une douleur revient, consulte un professionnel de santé.</p>
          )}
        </>
      )}
    </div>
  );
}
