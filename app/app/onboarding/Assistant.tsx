'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Marque } from '@/components/Logo';
import { JOURS, ajouterJoursIso, isoAujourdhui } from '@/lib/format';
import type { Jour, Niveau } from '@/lib/moteur-entrainement';
import { terminerOnboarding } from '../actions';
import './montee.css';

/**
 * « La montée » : l'arrivée dans Coach Trail.
 * Une question par écran, uniquement des choix à toucher. Les chiffres que beaucoup
 * de coureurs ne connaissent pas (volume, D+, FC, chrono) sont estimés à partir des réponses.
 * Le ciel passe de la nuit à l'aube et le coureur grimpe d'une balise à l'autre.
 */

type TypeCourse = 'trail' | 'route' | 'aucune';
interface Reponses {
  prenom: string;
  type?: TypeCourse;
  distance?: number;
  relief?: 'roulant' | 'vallonne' | 'montagne' | 'inconnu';
  semaines?: number;
  date?: string;
  sorties?: number;
  duree?: number;
  terrain?: 'plat' | 'vallonne' | 'montagne';
  niveau?: Niveau;
  jours: Jour[];
  blessure?: boolean;
  sante: boolean;
  ia: boolean;
}

type Etape = 'accueil' | 'course' | 'distance' | 'relief' | 'quand' | 'sorties' | 'duree' | 'terrain' | 'experience' | 'jours' | 'blessure' | 'sommet';

const DISTANCES = {
  trail: [[12, 'Court', 'Moins de 15 km'], [25, 'Trail découverte', 'Autour de 25 km'], [42, 'Marathon trail', 'Autour de 42 km'], [60, 'Trail long', '50 à 70 km'], [85, 'Ultra', '80 km et plus']],
  route: [[10, '10 km', 'La distance reine'], [21.1, 'Semi-marathon', '21,1 km'], [42.2, 'Marathon', '42,2 km']],
} as const;

const RELIEF_M_PAR_KM = { roulant: 22, vallonne: 42, montagne: 68, inconnu: 40 };
const TERRAIN_D_PAR_HEURE = { plat: 30, vallonne: 200, montagne: 450 };

/** Tracé du sentier en pourcentages (x vers la droite, y vers le haut). */
const SENTIER: [number, number][] = [[3, 14], [12, 20], [20, 17], [29, 29], [37, 26], [46, 40], [54, 36], [63, 51], [71, 47], [80, 63], [88, 60], [96, 78]];
const longueurs = SENTIER.slice(1).map((p, i) => Math.hypot(p[0] - SENTIER[i][0], p[1] - SENTIER[i][1]));
const TOTAL = longueurs.reduce((a, b) => a + b, 0);

function pointSur(p: number): [number, number] {
  let reste = Math.max(0, Math.min(1, p)) * TOTAL;
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i]) {
      const t = reste / longueurs[i];
      return [SENTIER[i][0] + (SENTIER[i + 1][0] - SENTIER[i][0]) * t, SENTIER[i][1] + (SENTIER[i + 1][1] - SENTIER[i][1]) * t];
    }
    reste -= longueurs[i];
  }
  return SENTIER[SENTIER.length - 1];
}

function Tuile({ cle, titre, sous, n, maj, choisi, choisir }: {
  cle: string; titre: string; sous?: string; n: number; maj: Partial<Reponses>; choisi: string | null; choisir: (cle: string, maj: Partial<Reponses>) => void;
}) {
  return (
    <button type="button" className="tuile" style={{ '--n': n } as React.CSSProperties} aria-pressed={choisi === cle} onClick={() => choisir(cle, maj)}>
      <b>{titre}</b>{sous && <span>{sous}</span>}
    </button>
  );
}

function joursParDefaut(sorties: number): Jour[] {
  if (sorties >= 4) return ['mar', 'jeu', 'ven', 'dim'];
  if (sorties >= 3) return ['mar', 'jeu', 'dim'];
  return ['mer', 'dim'];
}

export default function Assistant({ prenom: prenomInitial, dejaFait }: { prenom: string; dejaFait: boolean }) {
  const router = useRouter();
  const [r, setR] = useState<Reponses>({ prenom: prenomInitial, jours: ['mar', 'jeu', 'dim'], sante: false, ia: false });
  const [i, setI] = useState(0);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, demarrer] = useTransition();
  const [arrive, setArrive] = useState(false);

  const etapes = useMemo<Etape[]>(() => {
    const e: Etape[] = ['accueil', 'course'];
    if (r.type !== 'aucune') {
      e.push('distance');
      if (r.type !== 'route') e.push('relief');
      e.push('quand');
    }
    e.push('sorties');
    if (r.sorties !== 0) e.push('duree');
    e.push('terrain', 'experience', 'jours', 'blessure', 'sommet');
    return e;
  }, [r.type, r.sorties]);

  const etape = etapes[Math.min(i, etapes.length - 1)];
  const progression = arrive ? 1 : i / (etapes.length - 1);
  const [cx, cy] = pointSur(progression);

  useEffect(() => { setChoisi(null); setErreur(''); }, [i]);

  const suivant = () => setI((x) => Math.min(x + 1, etapes.length - 1));
  const precedent = () => setI((x) => Math.max(0, x - 1));
  /** Choix unique : on montre la sélection un instant puis on avance. */
  const choisir = (cle: string, maj: Partial<Reponses>) => {
    setChoisi(cle);
    setR((x) => {
      const n = { ...x, ...maj };
      if (maj.sorties !== undefined) n.jours = joursParDefaut(maj.sorties || 3);
      return n;
    });
    window.setTimeout(suivant, 320);
  };

  // ── Estimations à partir des réponses ──
  const distance = r.type === 'aucune' ? 20 : r.distance ?? 25;
  const dplusCourse = r.type === 'route' ? 0 : Math.round((distance * RELIEF_M_PAR_KM[r.type === 'aucune' ? 'vallonne' : r.relief ?? 'inconnu']) / 50) * 50;
  const dateCourse = r.date ?? ajouterJoursIso(isoAujourdhui(), (r.type === 'aucune' ? 16 : r.semaines ?? 16) * 7);
  const volumeMin = r.sorties ? Math.round((r.sorties * (r.duree ?? 45)) / 5) * 5 : 60;
  const dplusHebdo = Math.round(((volumeMin / 60) * TERRAIN_D_PAR_HEURE[r.terrain ?? 'vallonne']) / 50) * 50;
  const longue: Jour = (['dim', 'sam'] as Jour[]).find((j) => r.jours.includes(j)) ?? r.jours[r.jours.length - 1] ?? 'dim';

  function creer() {
    if (!r.sante) return setErreur('Coche l’accord sur les données de santé : ton ressenti et tes douleurs servent à ajuster ton plan.');
    setErreur('');
    setArrive(true);
    demarrer(async () => {
      const [res] = await Promise.all([
        terminerOnboarding({
          prenom: r.prenom.trim(),
          objectif: {
            nom: r.type === 'aucune' ? 'Mon défi trail' : '',
            type: r.type === 'route' ? 'route' : 'trail',
            distance_km: distance, dplus_m: dplusCourse, date: dateCourse,
          },
          niveau: r.niveau ?? 'intermediaire', volume_actuel_min: volumeMin, dplus_actuel_m: dplusHebdo,
          blessure_recente: r.blessure ?? false, jours_dispo: r.jours, jour_longue: longue,
          ref_distance_km: null, ref_temps_min: null, fc_max: null, fc_repos: null,
          date_naissance: null, sexe: null, consentement_sante: r.sante, consentement_ia: r.ia,
        }),
        new Promise((ok) => setTimeout(ok, 1600)),
      ]);
      if (res.erreur) { setArrive(false); return setErreur(res.erreur); }
      router.replace('/app?bienvenue=1');
      router.refresh();
    });
  }

  return (
    <div className="montee" style={{ '--p': progression } as React.CSSProperties}>
      <div className="montee-ciel" aria-hidden="true"><i className="etoiles" /><i className="soleil" /></div>

      <header className="montee-haut">
        <span className="montee-marque"><Marque taille={26} /> Coach Trail</span>
        <span className="montee-compte">{etape === 'sommet' ? 'Sommet' : `Balise ${i + 1} sur ${etapes.length - 1}`}</span>
      </header>

      <main className="montee-scene">
        <section key={arrive ? 'arrive' : etape} className="montee-carte" aria-live="polite">
          {arrive ? (
            <div className="montee-final">
              <svg viewBox="0 0 48 48" className="drapeau" aria-hidden="true"><path d="M12 44V6" stroke="#fff" strokeWidth="3" strokeLinecap="round" /><path d="M13 7h22l-5 7 5 7H13z" fill="#1D5BFF" /></svg>
              <h1>Sommet atteint.</h1>
              <p>On trace ton plan semaine par semaine jusqu’au jour J…</p>
              <div className="trace-chargement" aria-hidden="true"><span /></div>
              {erreur && <p className="montee-erreur" role="alert">{erreur}</p>}
            </div>
          ) : (
            <>
              {etape === 'accueil' && (
                <>
                  <p className="montee-sur">{dejaFait ? 'Nouveau plan' : 'Bienvenue au départ'}</p>
                  <h1>On prépare ta course ensemble.</h1>
                  <p className="montee-texte">Une dizaine de questions, que des choix à toucher. Pas besoin de connaître ta fréquence cardiaque ni tes chronos : on estime le reste pour toi.</p>
                  <label className="montee-champ">Comment on t’appelle ?
                    <input value={r.prenom} autoComplete="given-name" placeholder="Ton prénom" onChange={(e) => setR({ ...r, prenom: e.target.value })} />
                  </label>
                  <button className="btn btn-primary btn-l montee-go" onClick={suivant}>C’est parti</button>
                </>
              )}

              {etape === 'course' && (
                <>
                  <h1>{r.prenom ? `${r.prenom}, tu` : 'Tu'} prépares quoi ?</h1>
                  <div className="tuiles">
                    <Tuile choisi={choisi} choisir={choisir} n={0} cle="trail" titre="Un trail" sous="Sentiers, dénivelé, montagne" maj={{ type: 'trail' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={1} cle="route" titre="Une course sur route" sous="10 km, semi, marathon" maj={{ type: 'route', relief: undefined }} />
                    <Tuile choisi={choisi} choisir={choisir} n={2} cle="aucune" titre="Pas encore de course" sous="Je veux progresser, on fixe un défi de 16 semaines" maj={{ type: 'aucune' }} />
                  </div>
                </>
              )}

              {etape === 'distance' && (
                <>
                  <h1>Quelle distance ?</h1>
                  <div className="tuiles">
                    {DISTANCES[r.type === 'route' ? 'route' : 'trail'].map(([km, titre, sous], n) => (
                      <Tuile choisi={choisi} choisir={choisir} key={km} n={n} cle={String(km)} titre={titre} sous={sous} maj={{ distance: km }} />
                    ))}
                  </div>
                </>
              )}

              {etape === 'relief' && (
                <>
                  <h1>Et côté dénivelé ?</h1>
                  <div className="tuiles">
                    <Tuile choisi={choisi} choisir={choisir} n={0} cle="roulant" titre="Plutôt roulant" sous="Quelques bosses" maj={{ relief: 'roulant' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={1} cle="vallonne" titre="Vallonné" sous="Des montées régulières" maj={{ relief: 'vallonne' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={2} cle="montagne" titre="Montagne" sous="De grosses ascensions" maj={{ relief: 'montagne' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={3} cle="inconnu" titre="Je ne sais pas encore" sous="On part sur une moyenne" maj={{ relief: 'inconnu' }} />
                  </div>
                </>
              )}

              {etape === 'quand' && (
                <>
                  <h1>C’est pour quand ?</h1>
                  <div className="tuiles tuiles-serrees">
                    {[[8, 'Dans 2 mois'], [12, 'Dans 3 mois'], [16, 'Dans 4 mois'], [26, 'Dans 6 mois']].map(([s, t], n) => (
                      <Tuile choisi={choisi} choisir={choisir} key={s} n={n} cle={String(s)} titre={t as string} maj={{ semaines: s as number, date: undefined }} />
                    ))}
                  </div>
                  <label className="montee-champ">Ou la date exacte
                    <input type="date" min={ajouterJoursIso(isoAujourdhui(), 21)} value={r.date ?? ''} onChange={(e) => setR({ ...r, date: e.target.value || undefined })} />
                  </label>
                  {r.date && <button className="btn btn-primary montee-go" onClick={suivant}>Valider cette date</button>}
                </>
              )}

              {etape === 'sorties' && (
                <>
                  <h1>En ce moment, tu cours combien de fois par semaine ?</h1>
                  <div className="tuiles tuiles-serrees">
                    <Tuile choisi={choisi} choisir={choisir} n={0} cle="0" titre="Je reprends" sous="Peu ou pas en ce moment" maj={{ sorties: 0 }} />
                    <Tuile choisi={choisi} choisir={choisir} n={1} cle="1.5" titre="1 à 2 fois" maj={{ sorties: 1.5 }} />
                    <Tuile choisi={choisi} choisir={choisir} n={2} cle="3" titre="3 fois" maj={{ sorties: 3 }} />
                    <Tuile choisi={choisi} choisir={choisir} n={3} cle="4.5" titre="4 fois ou plus" maj={{ sorties: 4.5 }} />
                  </div>
                </>
              )}

              {etape === 'duree' && (
                <>
                  <h1>Une sortie dure en général…</h1>
                  <div className="tuiles tuiles-serrees">
                    {[[30, '30 min'], [45, '45 min'], [60, '1 heure'], [90, '1 h 30 et plus']].map(([m, t], n) => (
                      <Tuile choisi={choisi} choisir={choisir} key={m} n={n} cle={String(m)} titre={t as string} maj={{ duree: m as number }} />
                    ))}
                  </div>
                </>
              )}

              {etape === 'terrain' && (
                <>
                  <h1>Tu cours surtout…</h1>
                  <div className="tuiles">
                    <Tuile choisi={choisi} choisir={choisir} n={0} cle="plat" titre="Sur du plat" sous="Route, chemins, bords de rivière" maj={{ terrain: 'plat' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={1} cle="vallonne" titre="Dans les collines" sous="Ça monte et ça descend" maj={{ terrain: 'vallonne' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={2} cle="montagne" titre="En montagne" sous="Gros dénivelé chaque semaine" maj={{ terrain: 'montagne' }} />
                  </div>
                </>
              )}

              {etape === 'experience' && (
                <>
                  <h1>Ton expérience de coureur ?</h1>
                  <div className="tuiles">
                    <Tuile choisi={choisi} choisir={choisir} n={0} cle="debutant" titre="Je débute" sous="Moins d’un an de course régulière" maj={{ niveau: 'debutant' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={1} cle="intermediaire" titre="Quelques dossards" sous="J’ai déjà fini plusieurs courses" maj={{ niveau: 'intermediaire' }} />
                    <Tuile choisi={choisi} choisir={choisir} n={2} cle="confirme" titre="Des années de pratique" sous="Je m’entraîne de façon structurée" maj={{ niveau: 'confirme' }} />
                  </div>
                </>
              )}

              {etape === 'jours' && (
                <>
                  <h1>Quels jours peux-tu courir ?</h1>
                  <p className="montee-texte">On a présélectionné des jours bien espacés. Touche pour ajuster.</p>
                  <div className="jours-montee">
                    {JOURS.map((j, n) => (
                      <button key={j.id} type="button" className="jour-montee" style={{ '--n': n } as React.CSSProperties} aria-pressed={r.jours.includes(j.id)}
                        onClick={() => setR({ ...r, jours: r.jours.includes(j.id) ? r.jours.filter((x) => x !== j.id) : JOURS.map((x) => x.id).filter((x) => x === j.id || r.jours.includes(x)) })}>
                        {j.court}
                      </button>
                    ))}
                  </div>
                  <p className="montee-texte petit">{r.jours.length} jour{r.jours.length > 1 ? 's' : ''} · sortie longue le {JOURS.find((j) => j.id === longue)?.long}</p>
                  <button className="btn btn-primary montee-go" disabled={r.jours.length < 2} onClick={suivant}>{r.jours.length < 2 ? 'Choisis au moins 2 jours' : 'Valider mes jours'}</button>
                </>
              )}

              {etape === 'blessure' && (
                <>
                  <h1>Une blessure ces 6 derniers mois ?</h1>
                  <div className="tuiles tuiles-serrees">
                    <Tuile choisi={choisi} choisir={choisir} n={0} cle="non" titre="Non, tout va bien" maj={{ blessure: false }} />
                    <Tuile choisi={choisi} choisir={choisir} n={1} cle="oui" titre="Oui" sous="La progression sera plus douce" maj={{ blessure: true }} />
                  </div>
                </>
              )}

              {etape === 'sommet' && (
                <>
                  <h1>Dernière balise avant le sommet.</h1>
                  <ul className="recap">
                    <li><span>Objectif</span><b>{r.type === 'aucune' ? 'Défi trail de 20 km' : `${r.type === 'route' ? 'Route' : 'Trail'} · ${distance.toLocaleString('fr-FR')} km${dplusCourse ? ` · ≈ ${dplusCourse.toLocaleString('fr-FR')} m D+` : ''}`}</b></li>
                    <li><span>Jour J</span><b>{new Date(`${dateCourse}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</b></li>
                    <li><span>Point de départ</span><b>{volumeMin >= 60 ? `${Math.floor(volumeMin / 60)} h ${String(volumeMin % 60).padStart(2, '0')}` : `${volumeMin} min`} par semaine</b></li>
                    <li><span>Entraînements</span><b>{r.jours.length} par semaine</b></li>
                  </ul>
                  <label className="accord">
                    <input type="checkbox" checked={r.sante} onChange={(e) => setR({ ...r, sante: e.target.checked })} />
                    <span><b>J’accepte que mon ressenti, mes douleurs et mon sommeil servent à ajuster mon plan.</b> Obligatoire, retirable à tout moment dans ton compte.</span>
                  </label>
                  <label className="accord">
                    <input type="checkbox" checked={r.ia} onChange={(e) => setR({ ...r, ia: e.target.checked })} />
                    <span>J’accepte que le futur coach IA lise mes séances pour me conseiller. Facultatif.</span>
                  </label>
                  {erreur && <p className="montee-erreur" role="alert">{erreur}</p>}
                  <button className="btn btn-primary btn-l montee-go" disabled={enCours} onClick={creer}>Atteindre le sommet</button>
                  <p className="montee-texte petit">Tu connais ta FC ou un chrono récent ? Ajoute-les plus tard dans ton compte pour des allures précises.</p>
                </>
              )}
            </>
          )}
        </section>
        {i > 0 && !arrive && <button className="montee-retour" onClick={precedent}>Retour</button>}
      </main>

      <div className="montee-sol" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="crete-loin" d="M0 100V58L9 44L17 52L27 30L36 44L47 22L58 40L68 18L79 36L90 20L100 34V100Z" />
          <path className="crete-milieu" d="M0 100V70L11 60L22 66L33 50L44 60L55 44L66 54L77 38L88 48L100 40V100Z" />
          <path className="crete-proche" d={`M0 100V${100 - SENTIER[0][1] + 4}${SENTIER.map(([x, y]) => `L${x} ${100 - y + 4}`).join('')}L100 ${100 - SENTIER[SENTIER.length - 1][1] + 4}V100Z`} />
          <path className="sentier" d={`M${SENTIER.map(([x, y]) => `${x} ${100 - y}`).join('L')}`} />
          <defs>
            <clipPath id="sentier-parcouru" clipPathUnits="userSpaceOnUse">
              <rect className="revele" x="0" y="0" width="100" height="100" style={{ transform: `scaleX(${cx / 100})` }} />
            </clipPath>
          </defs>
          <path className="sentier-fait" clipPath="url(#sentier-parcouru)" d={`M${SENTIER.map(([x, y]) => `${x} ${100 - y}`).join('L')}`} />
        </svg>
        {etapes.slice(1).map((e, k) => {
          const [bx, by] = pointSur((k + 1) / (etapes.length - 1));
          const passee = k + 1 <= i || arrive;
          return <i key={e + k} className={`balise-montee${passee ? ' passee' : ''}`} style={{ left: `${bx}%`, bottom: `${by}%` }} />;
        })}
        <span className={`coureur${arrive ? ' au-sommet' : ''}`} style={{ left: `${cx}%`, bottom: `${cy}%` }}><i /></span>
      </div>
    </div>
  );
}
