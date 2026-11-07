import Link from 'next/link';
import AnalyseSeance from '@/components/AnalyseSeance';
import BilanMatin from '@/components/BilanMatin';
import CarteNuit from '@/components/CarteNuit';
import BoutonBilan, { ResumeBilan } from '@/components/BoutonBilan';
import EnvoiMontre from '@/components/EnvoiMontre';
import { Anneau } from '@/components/Graphiques';
import { IcCoche, IcCourir, IcLecture, IcLune, IcSoleilLeve, IcSync } from '@/components/Icones';
import MontagnePlan from '@/components/MontagnePlan';
import ProfilSeance from '@/components/ProfilSeance';
import { bilanDuJour, connexions, lectureDuJour, membreConnecte, planActif, seancesRealisees, urlAgenda } from '@/lib/donnees';
import {
  JOURS, PHASES, PHASES_TEXTE, ajouterJoursIso, dateLongue, duree, ecartJours, isoAujourdhui, majuscule,
} from '@/lib/format';
import type { Seance } from '@/lib/moteur-entrainement';
import { COULEUR_ZONE, chargesHebdo, idsFaits, seanceAdaptee, semaineDu, statutSeance } from '@/lib/plan-utils';
import { estQualite } from '@/lib/quotidien';
import { NOMS_SEANCES, detaillerSeance } from '@/lib/seance-detail';

export const metadata = { title: 'Ma journée' };

const salut = () => {
  const h = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }).format(new Date()));
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour';
};

export default async function Aujourdhui({ searchParams }: { searchParams: Promise<{ bienvenue?: string; bilan?: string }> }) {
  const { bienvenue, bilan: ouvrirBilan } = await searchParams;
  const { supabase, user, profil } = await membreConnecte();
  const aujourdhui = isoAujourdhui();
  const [{ plan, objectif }, realisees, bilan, liens, agenda, nuit] = await Promise.all([
    planActif(supabase, user.id),
    seancesRealisees(supabase, user.id, ajouterJoursIso(aujourdhui, -70)),
    bilanDuJour(supabase, user.id, aujourdhui),
    connexions(supabase, user.id),
    urlAgenda(profil.jeton_calendrier),
    lectureDuJour(supabase, user.id, aujourdhui),
  ]);
  const sommeilMontre = nuit?.sommeilSuggere ? { note: nuit.sommeilSuggere, texte: nuit.indicateurs.find((i) => i.cle === 'sommeil')?.valeur + ' de sommeil' } : null;

  if (!plan || !objectif) {
    return (
      <div className="carte vide">
        <h2>Pas encore de plan</h2>
        <p className="mt-8">Décris ta prochaine course pour générer ton plan.</p>
        <Link href="/app/onboarding" className="btn btn-primary mt-24">Créer mon plan</Link>
      </div>
    );
  }

  const toutesSeances = plan.contenu.semaines.flatMap((s) => s.seances);
  const faites = idsFaits(realisees.filter((r) => r.plan_id === plan.id));
  const { semaine, index, avant } = semaineDu(plan.contenu, aujourdhui);
  const prevueJour = toutesSeances.find((s) => s.date === aujourdhui) ?? null;
  const { seance: duJour, adaptee, repos: reposImpose } = prevueJour ? seanceAdaptee(prevueJour, bilan) : { seance: null, adaptee: false, repos: false };
  const realiseeJour = prevueJour ? realisees.find((r) => r.seance_id === prevueJour.id) ?? null : null;
  const prochaine = toutesSeances.find((s) => s.date > aujourdhui && !faites.has(s.id)) ?? null;
  const demain = toutesSeances.find((s) => s.date === ajouterJoursIso(aujourdhui, 1)) ?? null;
  const joursAvantCourse = ecartJours(aujourdhui, objectif.date);
  const garmin = liens.some((l) => l.fournisseur === 'garmin');
  const importe = liens.some((l) => l.fournisseur !== 'garmin');

  // Indicateurs
  const passees = toutesSeances.filter((s) => s.type !== 'course' && s.date <= aujourdhui);
  const observance = passees.length ? passees.filter((s) => faites.has(s.id)).length / passees.length : 0;
  const prevuSemaine = semaine.seances.filter((s) => s.type !== 'course').reduce((t, s) => t + s.dureeMin, 0);
  const faitSemaine = realisees.filter((r) => r.date >= semaine.debut && r.date <= ajouterJoursIso(semaine.debut, 6)).reduce((t, r) => t + r.duree_min, 0);
  const [charge] = chargesHebdo(realisees, [ajouterJoursIso(aujourdhui, -6)]);
  const ratio = charge.acwr?.toLocaleString('fr-FR');
  const precedente = index > 0 && !avant ? plan.contenu.semaines[index - 1] : null;
  const bilanAFaire = precedente && !plan.bilans.some((b) => b.semaine === precedente.numero) ? precedente : null;
  const dernierBilan = plan.bilans.at(-1);

  const etatMatin = bilan ? 'fait' : 'actif';
  const etatSeance = !duJour ? 'fait' : realiseeJour ? 'fait' : bilan ? 'actif' : 'a-venir';
  const etatApres = realiseeJour ? 'fait' : duJour ? 'a-venir' : 'fait';

  return (
    <div className="journee">
      <header className="journee-tete">
        <div>
          <p className="journee-date">{majuscule(dateLongue(aujourdhui))}{!avant && ` · semaine ${semaine.numero}/${plan.contenu.semaines.length} · ${PHASES[semaine.phase]}`}</p>
          <h1>{salut()} {profil.prenom ?? ''}</h1>
        </div>
        <Link href="/app/plan?vue=calendrier" className="compte-a-rebours" aria-label={`${joursAvantCourse} jours avant ${objectif.nom || 'ta course'}`}>
          <b>{joursAvantCourse > 0 ? `J-${joursAvantCourse}` : joursAvantCourse === 0 ? 'Jour J' : 'Terminé'}</b>
          <span>{objectif.nom || (objectif.type === 'trail' ? 'Trail' : 'Course')} · {Number(objectif.distance_km)} km{objectif.dplus_m ? ` · ${objectif.dplus_m} m D+` : ''}</span>
        </Link>
      </header>

      {bienvenue && <p className="alerte alerte-ok" style={{ marginBottom: 20 }}>Ton plan est prêt : {plan.contenu.semaines.length} semaines jusqu’à ta course. Chaque matin, ton bilan adaptera la séance du jour.</p>}
      {dernierBilan?.decision.alerteSante && ecartJours(dernierBilan.date.slice(0, 10), aujourdhui) <= 7 && (
        <p className="alerte alerte-danger" style={{ marginBottom: 20 }}><b>Douleur signalée. </b>{dernierBilan.decision.alerteSante}</p>
      )}

      <div className="journee-grille">
        <ol className="fil" aria-label="Ta journée">
          {/* 1. Matin */}
          <li className={`moment ${etatMatin}`}>
            <span className="moment-point" aria-hidden="true">{bilan ? <IcCoche /> : <IcSoleilLeve />}</span>
            <div className="moment-corps">
              <p className="moment-titre">Ce matin · bilan de forme</p>
              {nuit && <CarteNuit lecture={nuit} />}
              <BilanMatin fait={bilan} ouvrir={ouvrirBilan === '1' && !bilan} sommeilMontre={sommeilMontre} />
            </div>
          </li>

          {/* 2. Séance */}
          <li className={`moment ${etatSeance}`}>
            <span className="moment-point" aria-hidden="true">{realiseeJour ? <IcCoche /> : <IcCourir />}</span>
            <div className="moment-corps">
              <p className="moment-titre">{duJour ? 'Ta séance du jour' : 'Aujourd’hui'}</p>
              {duJour
                ? <CarteSeance seance={duJour} adaptee={adaptee} fait={Boolean(realiseeJour)} garmin={garmin} agenda={agenda} />
                : <CarteRepos impose={reposImpose} prochaine={prochaine} />}
            </div>
          </li>

          {/* 3. Après la séance */}
          {prevueJour && duJour && (
            <li className={`moment ${etatApres}`}>
              <span className="moment-point" aria-hidden="true">{realiseeJour ? <IcCoche /> : <IcSync />}</span>
              <div className="moment-corps">
                <p className="moment-titre">Après ta sortie · retour du moteur</p>
                {realiseeJour ? <AnalyseSeance prevue={duJour} realisee={realiseeJour} compact /> : (
                  <div className="carte apres">
                    <p className="small muted">Note ton ressenti{importe ? ' ou synchronise ta montre' : ''} : le moteur compare ta sortie au prévu, te donne ses conseils et ton temps de récupération.</p>
                    <div className="row mt-16" style={{ gap: 8 }}>
                      <Link className="btn btn-primary btn-s" href={`/app/seance/${encodeURIComponent(prevueJour.id)}#ressenti`}>Noter mon ressenti</Link>
                      {importe && <Link className="btn btn-ghost btn-s" href="/app/connexions"><IcSync /> Synchroniser</Link>}
                    </div>
                  </div>
                )}
              </div>
            </li>
          )}

          {/* 4. Ce soir */}
          <li className="moment a-venir">
            <span className="moment-point" aria-hidden="true"><IcLune /></span>
            <div className="moment-corps">
              <p className="moment-titre">Ce soir · récupération</p>
              <div className="carte soir">
                <ul>{conseilsDuSoir(duJour, Boolean(realiseeJour)).map((c) => <li key={c}>{c}</li>)}</ul>
                {demain && <p className="small mt-16"><b>Demain :</b> {demain.type === 'course' ? 'jour de course !' : `${NOMS_SEANCES[demain.type]} · ${duree(demain.dureeMin)}`}</p>}
              </div>
            </div>
          </li>
        </ol>

        <aside className="journee-cote">
          <div className="carte row" style={{ gap: 16, flexWrap: 'nowrap' }}>
            <Anneau pct={observance} libelle={`${Math.round(observance * 100)} %`} sous="réalisé" taille={96} />
            <div className="grow">
              <h3>Régularité</h3>
              <p className="small muted mt-8">{passees.filter((s) => faites.has(s.id)).length} séances sur {passees.length} prévues jusqu’ici.</p>
            </div>
          </div>
          <div className="carte">
            <div className="carte-titre"><h3>Cette semaine</h3><span className="tiny">{duree(faitSemaine)} / {duree(prevuSemaine)}</span></div>
            <div className="barre-prog"><span style={{ width: `${Math.min(100, (faitSemaine / Math.max(1, prevuSemaine)) * 100)}%` }} /></div>
            <p className="small muted mt-16">{PHASES_TEXTE[semaine.phase]}</p>
          </div>
          <div className="carte">
            <h3>Charge des 7 derniers jours</h3>
            <div className="row mt-8" style={{ alignItems: 'baseline', gap: 8 }}>
              <span className="chiffre-fort">{charge.aigue}</span><span className="muted small">points</span>
            </div>
            <p className="small muted mt-8">
              {charge.acwr === null ? 'Le ratio de charge s’affiche après 3 semaines de séances notées.'
                : charge.acwr > 1.5 ? `Ratio ${ratio} : charge bien au-dessus de tes habitudes, attention.`
                  : charge.acwr > 1.3 ? `Ratio ${ratio} : hausse rapide, reste à l’écoute.`
                    : charge.acwr < 0.8 ? `Ratio ${ratio} : charge en dessous de tes habitudes.`
                      : `Ratio ${ratio} : zone idéale de progression.`}
            </p>
          </div>
          {bilanAFaire ? (
            <div className="carte">
              <div className="carte-titre"><h3>Bilan de la semaine {bilanAFaire.numero}</h3><span className="badge badge-accent">À faire</span></div>
              <p className="small muted" style={{ marginBottom: 14 }}>Le moteur compare la semaine au prévu et ajuste la suivante.</p>
              <BoutonBilan planId={plan.id} numero={bilanAFaire.numero} />
            </div>
          ) : dernierBilan && (
            <div className="carte">
              <div className="carte-titre"><h3>Dernier bilan · semaine {dernierBilan.semaine}</h3></div>
              <ResumeBilan bilan={dernierBilan} />
            </div>
          )}
          {!liens.length && (
            <Link href="/app/connexions" className="carte invite-montre">
              <b>Connecte ta montre</b>
              <span className="small muted">Garmin, COROS, Polar, Strava : séances envoyées, sorties récupérées.</span>
            </Link>
          )}
        </aside>
      </div>

      <MontagnePlan semaines={plan.contenu.semaines} index={index} avant={avant} joursAvant={joursAvantCourse}
        course={objectif.nom || (objectif.type === 'trail' ? 'ton trail' : 'ta course')} />

      <div className="carte">
        <div className="carte-titre">
          <h3>Ta semaine</h3>
          <Link href={`/app/plan?semaine=${semaine.numero}`} className="lien small">Tout le plan →</Link>
        </div>
        <div className="semaine">
          {JOURS.map((j, i) => {
            const date = ajouterJoursIso(semaine.debut, i);
            const s = semaine.seances.find((x) => x.date === date);
            const statut = s ? statutSeance(s, faites, aujourdhui) : null;
            const contenu = (
              <>
                <span className="nom">{j.court}</span>
                <span className="num">{Number(date.slice(8))}</span>
                {s ? <>
                  <span className="zone-tag" style={{ background: COULEUR_ZONE[s.zonePrincipale] }}>{statut === 'fait' ? '✓' : `Z${s.zonePrincipale}`}</span>
                  <span className="type">{NOMS_SEANCES[s.type].split(' ')[0]}</span>
                </> : <span className="type">Repos</span>}
              </>
            );
            const classe = `jour ${date === aujourdhui ? 'aujourdhui' : ''} ${statut === 'fait' ? 'fait' : statut === 'manque' ? 'manque' : ''}`;
            return s
              ? <Link key={j.id} href={`/app/seance/${s.id}`} className={classe}>{contenu}</Link>
              : <div key={j.id} className={classe}>{contenu}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

function CarteSeance({ seance, adaptee, fait, garmin, agenda }: { seance: Seance; adaptee: boolean; fait: boolean; garmin: boolean; agenda: string | null }) {
  const detail = detaillerSeance(seance);
  const course = seance.type === 'course';
  return (
    <div className="seance-jour">
      <div className="row" style={{ gap: 8 }}>
        {adaptee && <span className="pastille-verre">Adaptée ce matin</span>}
        {fait && <span className="pastille-verre"><IcCoche /> Faite</span>}
        {estQualite(seance.type) && <span className="pastille-verre">Séance de qualité</span>}
      </div>
      <h2>{detail.titre}</h2>
      <p className="seance-resume">{detail.resume}</p>
      <div className="faits">
        {!course && <span><b>{duree(seance.dureeMin)}</b>durée</span>}
        {seance.dplusM ? <span><b>{seance.dplusM} m</b>D+</span> : null}
        <span><b>Z{seance.zonePrincipale}</b>zone</span>
        <span><b>{seance.rpePrevu}/10</b>ressenti visé</span>
      </div>
      <ProfilSeance blocs={detail.blocs} clair />
      <div className="row mt-24" style={{ gap: 10 }}>
        {!course && !fait && <Link href={`/app/seance/${encodeURIComponent(seance.id)}?lecteur=1`} className="btn btn-primary btn-l"><IcLecture /> Lancer la séance guidée</Link>}
        <Link href={`/app/seance/${encodeURIComponent(seance.id)}`} className="btn btn-verre">Détail bloc par bloc</Link>
      </div>
      {!course && !fait && <EnvoiMontre seanceId={seance.id} garmin={garmin} urlAgenda={agenda} compact />}
    </div>
  );
}

function CarteRepos({ impose, prochaine }: { impose: boolean; prochaine: Seance | null }) {
  return (
    <div className="carte repos-jour">
      <h3>{impose ? 'Repos décidé par ton bilan du matin' : 'Pas de course aujourd’hui'}</h3>
      <p className="small muted mt-8">{impose
        ? 'Ton corps a besoin de récupérer : c’est aujourd’hui que tu progresses. Marche, mobilité douce, sommeil.'
        : 'La récupération fait partie du plan. 15 min de mobilité ou de gainage si tu en as envie.'}</p>
      {prochaine && (
        <Link href={`/app/seance/${encodeURIComponent(prochaine.id)}`} className="prochaine">
          <span className="zone-tag" style={{ background: COULEUR_ZONE[prochaine.zonePrincipale] }}>Z{prochaine.zonePrincipale}</span>
          <span className="grow prochaine-texte"><b>{NOMS_SEANCES[prochaine.type]}</b><span className="tiny">Prochaine séance · {dateLongue(prochaine.date)}{prochaine.type !== 'course' ? ` · ${duree(prochaine.dureeMin)}` : ''}</span></span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

function conseilsDuSoir(s: Seance | null, fait: boolean): string[] {
  if (!s) return ['Couche-toi à heure fixe : le sommeil est ton meilleur outil de récupération.', '10 min d’étirements doux ou de mobilité des hanches et des chevilles.'];
  const c: string[] = [];
  if (s.dureeMin >= 90) c.push('Recharge en glucides au dîner (riz, pâtes, patates douces) et bois régulièrement.');
  if (estQualite(s.type)) c.push('Séance intense : 7 à 9 h de sommeil cette nuit, c’est là que tu progresses.');
  else c.push('Une séance facile se récupère vite : hydrate-toi et dors bien.');
  c.push(fait ? 'Pense à noter une éventuelle gêne demain matin dans ton bilan.' : 'Pas encore couru ? Une séance décalée au soir reste utile si tu te sens bien.');
  return c;
}
