import Link from 'next/link';
import { IcAgenda, IcCoche, IcCourir, IcEclair, IcEnvoyer, IcLune, IcSync, IcTelecharger } from '@/components/Icones';
import Paysage from '@/components/Paysage';
import Topo from '@/components/Topo';
import './vitrine.css';

const ZONE = ['', '#9CC9E0', '#3DBE8B', '#F2C12E', '#FF8A3D', '#E5484D'];

/** Séances types : [zone, durée relative] pour dessiner leur profil d'intensité. */
const SEANCES: { titre: string; detail: string; blocs: [number, number][] }[] = [
  { titre: 'Côtes longues', detail: '4 × 4 min au seuil · 55 min · 300 m D+', blocs: [[2, 4], [4, 2], [1, 1.5], [4, 2], [1, 1.5], [4, 2], [1, 1.5], [4, 2], [1, 2]] },
  { titre: 'Sortie longue vallonnée', detail: '2 h 05 en endurance · 900 m D+', blocs: [[2, 3], [2, 6], [3, 1], [2, 5], [3, 1], [2, 4], [1, 1]] },
  { titre: 'Fractionné VMA', detail: '12 × 30 s / 30 s · 45 min', blocs: [[2, 4], ...Array.from({ length: 12 }, (_, i) => [i % 2 ? 1 : 5, 0.6] as [number, number]), [1, 2]] },
  { titre: 'Footing en endurance', detail: '50 min en aisance respiratoire', blocs: [[1, 1], [2, 8], [1, 1]] },
  { titre: 'Seuil', detail: '3 × 10 min · 60 min', blocs: [[2, 4], [4, 3], [1, 1], [4, 3], [1, 1], [4, 3], [1, 2]] },
  { titre: 'Allure de course', detail: '3 × 12 min à ton allure du jour J', blocs: [[2, 3], [3, 3], [1, 1], [3, 3], [1, 1], [3, 3], [1, 2]] },
  { titre: 'Côtes courtes', detail: '10 × 30 s en montée · 50 min', blocs: [[2, 4], ...Array.from({ length: 19 }, (_, i) => [i % 2 ? 1 : 5, 0.5] as [number, number]), [1, 2]] },
  { titre: 'Fartlek', detail: '8 × 1 min au ressenti · 45 min', blocs: [[2, 3], ...Array.from({ length: 15 }, (_, i) => [i % 2 ? 1 : 3, 0.8] as [number, number]), [1, 2]] },
];

const JOURNEE = [
  { heure: '07:00', icone: <IcLune />, titre: 'Bilan du matin', texte: 'Sommeil, énergie, jambes, douleur : quatre touches, dix secondes.', visuel: 'bilan' },
  { heure: '07:01', icone: <IcEclair />, titre: 'Séance adaptée', texte: 'Le moteur maintient, allège ou remplace la séance, et t’explique pourquoi.', visuel: 'adapte' },
  { heure: '07:02', icone: <IcEnvoyer />, titre: 'Sur ta montre', texte: 'La séance part vers ta Garmin, bloc par bloc, avec ses cibles cardio ou d’allure.', visuel: 'montre' },
  { heure: '18:30', icone: <IcCourir />, titre: 'Tu cours, guidé', texte: 'Ta montre ou le lecteur de l’app t’annonce chaque bloc, chaque récupération.', visuel: 'guide' },
  { heure: '19:45', icone: <IcSync />, titre: 'Retour du moteur', texte: 'Ta sortie revient toute seule : fidélité au plan, récupération conseillée, conseils.', visuel: 'analyse' },
] as const;

const REGLES = [
  ['+10 %', 'de volume au maximum d’une semaine à l’autre'],
  ['75 %', 'du temps au minimum en endurance facile'],
  ['1 sur 4', 'semaine allégée pour assimiler le travail'],
  ['0', 'séance dure deux jours de suite'],
  ['0,8 à 1,3', 'le ratio de charge surveillé chaque jour'],
];

const PHASES = [
  { nom: 'Foncier', semaines: 4, couleur: '#BCD2FF' },
  { nom: 'Développement', semaines: 5, couleur: '#6F9BFF' },
  { nom: 'Spécifique', semaines: 4, couleur: '#2F62F5' },
  { nom: 'Affûtage', semaines: 2, couleur: '#7DD3FC' },
  { nom: 'Course', semaines: 1, couleur: '#FFFFFF' },
];

const MONTRES = [
  { nom: 'Garmin', role: 'Séances envoyées sur la montre', couleur: '#007CC3' },
  { nom: 'COROS', role: 'Séances envoyées, sorties récupérées', couleur: '#111' },
  { nom: 'Polar', role: 'Sorties récupérées', couleur: '#D10027' },
  { nom: 'Strava', role: 'Sorties récupérées', couleur: '#FC4C02' },
  { nom: 'Apple Watch', role: 'Via Strava, app iPhone en préparation', couleur: '#1D1D1F' },
];

const FAQ = [
  { q: 'Est-ce une intelligence artificielle ?', r: 'Non. Coach Trail repose sur un logiciel d’entraînement écrit pour le trail : périodisation, calcul de la charge, règles de sécurité. Les mêmes données donnent toujours le même plan, et chaque décision t’est expliquée.' },
  { q: 'Quelles montres sont compatibles ?', r: 'Toutes les montres Garmin récentes reçoivent tes séances bloc par bloc. COROS et Polar remontent tes sorties, Strava aussi (y compris celles d’une Apple Watch). Sans connexion, chaque séance se télécharge en fichier .FIT ou s’ajoute à ton agenda.' },
  { q: 'Faut-il une montre ?', r: 'Non. Le plan se pilote aussi au ressenti, et le lecteur de l’app te guide bloc par bloc avec un signal sonore. Note ta durée et ton ressenti après la séance : c’est tout ce dont le moteur a besoin.' },
  { q: 'Comment fonctionne le suivi quotidien ?', r: 'Chaque matin, une notification et un e-mail te présentent ta séance. Tu fais ton bilan en dix secondes, le moteur adapte la séance. Après ta sortie, il l’analyse et te dit quand tu seras prêt pour la prochaine séance intense.' },
  { q: 'Pour quel niveau et quelles distances ?', r: 'Du premier trail court à l’ultra, et sur route du 10 km au marathon. Le questionnaire de départ fixe ton niveau, ton volume actuel et tes disponibilités ; le plan part de là.' },
  { q: 'Et si j’ai mal ?', r: 'Signale-le dans ton bilan du matin ou après ta séance. Une douleur forte transforme la séance en repos et t’invite à consulter un professionnel de santé. Coach Trail ne pose pas de diagnostic.' },
  { q: 'Où sont stockées mes données ?', r: 'Dans une base hébergée en Europe (Paris). Tu peux exporter ou supprimer toutes tes données à tout moment depuis ton compte.' },
];

export default function Accueil() {
  return (
    <div className="vitrine">
      {/* ───── Accroche ───── */}
      <section className="v-hero">
        <div className="conteneur v-hero-grille">
          <div className="v-hero-texte">
            <p className="v-pastille"><span /> Bêta gratuite · trail et running</p>
            <h1>Chaque matin, ta séance s’adapte à toi.</h1>
            <p className="v-lead">Coach Trail construit ton plan jusqu’au jour de ta course, l’ajuste à ta forme chaque matin, l’envoie à ta montre et analyse chacune de tes sorties.</p>
            <div className="v-cta">
              <Link href="/inscription" className="btn btn-primary btn-l">Créer mon plan gratuit</Link>
              <Link href="#journee" className="btn btn-ghost btn-l">Voir une journée type</Link>
            </div>
            <ul className="v-preuves">
              <li><IcCoche /> Plan prêt en 3 minutes</li>
              <li><IcCoche /> Garmin, COROS, Polar, Strava</li>
              <li><IcCoche /> Données hébergées à Paris</li>
            </ul>
          </div>
          <Telephone />
        </div>
        <Paysage />
      </section>

      {/* ───── Une journée ───── */}
      <section className="v-section" id="journee">
        <div className="conteneur">
          <div className="v-intro">
            <p className="v-surtitre">Accompagné tous les jours</p>
            <h2>Une journée avec Coach Trail</h2>
            <p>Pas un PDF de douze semaines qu’on oublie au bout de dix jours : un coach qui te suit du réveil jusqu’au soir, chaque jour de ta préparation.</p>
          </div>
          <ol className="v-journee">
            {JOURNEE.map((m, k) => (
              <li key={m.heure} className="v-moment" style={{ '--k': k } as React.CSSProperties}>
                <div className="v-moment-tete"><span className="v-heure">{m.heure}</span><span className="v-moment-icone">{m.icone}</span></div>
                <Visuel type={m.visuel} />
                <h3>{m.titre}</h3>
                <p>{m.texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── Le moteur ───── */}
      <section className="v-section v-nuit" id="moteur">
        <Topo />
        <div className="conteneur v-moteur">
          <div>
            <p className="v-surtitre">Un logiciel d’entraînement, pas une IA</p>
            <h2>Chaque séance est calculée, chaque décision expliquée.</h2>
            <p className="v-texte-nuit">Le moteur de Coach Trail applique les principes des entraîneurs de trail : périodisation en cinq phases, progression du volume et du dénivelé, contrôle de la charge et règles de sécurité. Les mêmes données donnent toujours le même plan.</p>
            <dl className="v-regles">
              {REGLES.map(([v, t]) => <div key={t}><dt>{v}</dt><dd>{t}</dd></div>)}
            </dl>
          </div>
          <div className="v-moteur-visuel">
            <div className="v-frise" aria-label="Exemple de plan de 16 semaines en cinq phases">
              {PHASES.map((p) => (
                <div key={p.nom} style={{ flex: p.semaines }}>
                  <span style={{ background: p.couleur }} />
                  <b>{p.nom}</b><small>{p.semaines} sem.</small>
                </div>
              ))}
            </div>
            <div className="v-decision">
              <p className="v-decision-titre">Bilan du matin de Léa · mardi</p>
              <div className="v-entrees">
                <span>Sommeil <b>2/5</b></span><span>Énergie <b>2/5</b></span><span>Jambes <b>2/5</b></span><span>Douleur <b>0</b></span>
              </div>
              <div className="v-fleche" aria-hidden="true">↓</div>
              <div className="v-sortie">
                <span className="v-score">38</span>
                <div>
                  <b>Séance allégée de 20 %</b>
                  <p>Côtes longues : 3 répétitions au lieu de 4, un cran d’intensité en dessous. Nuit difficile, énergie basse : la qualité d’exécution prime.</p>
                </div>
              </div>
            </div>
            <Link href="/methode" className="btn btn-verre mt-24">Tout comprendre de la méthode</Link>
          </div>
        </div>
      </section>

      {/* ───── Séances ───── */}
      <section className="v-section v-seances">
        <div className="conteneur">
          <div className="v-intro">
            <p className="v-surtitre">Des séances détaillées bloc par bloc</p>
            <h2>Toutes les séances du trail, avec leur pourquoi.</h2>
            <p>Échauffement précis, cibles de chaque bloc, technique de montée et de descente, matériel à emporter : tu sais quoi faire, comment, et pourquoi.</p>
          </div>
        </div>
        <div className="v-defilement" aria-label="Exemples de séances">
          <div className="v-piste">
            {[...SEANCES, ...SEANCES].map((s, i) => (
              <article key={i} className="v-seance" aria-hidden={i >= SEANCES.length}>
                <div className="v-intervalles" aria-hidden="true">
                  {s.blocs.map(([z, d], j) => <i key={j} style={{ flex: d, height: `${20 + z * 16}%`, background: ZONE[z] }} />)}
                </div>
                <h3>{s.titre}</h3>
                <p>{s.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Montres ───── */}
      <section className="v-section v-blanc" id="montres">
        <div className="conteneur v-montres">
          <Montre />
          <div>
            <p className="v-surtitre">Ta montre fait le reste</p>
            <h2>Ta séance au poignet, ta sortie dans ton plan.</h2>
            <p className="v-texte">Connecte ton compte une fois. Chaque séance part vers ta montre avec ses blocs et ses cibles, et chaque sortie revient dans Coach Trail pour l’analyse du soir.</p>
            <ul className="v-marques">
              {MONTRES.map((m) => (
                <li key={m.nom} style={{ '--marque': m.couleur } as React.CSSProperties}><span className="v-marque-logo">{m.nom[0]}</span><div><b>{m.nom}</b><small>{m.role}</small></div></li>
              ))}
              <li style={{ '--marque': '#1D5BFF' } as React.CSSProperties}><span className="v-marque-logo"><IcTelecharger /></span><div><b>Fichier .FIT</b><small>Pour toutes les montres, sans connexion</small></div></li>
              <li style={{ '--marque': '#0A1A3F' } as React.CSSProperties}><span className="v-marque-logo"><IcAgenda /></span><div><b>Ton agenda</b><small>iPhone, Google, Outlook</small></div></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ───── Tarifs ───── */}
      <section className="v-section" id="tarifs">
        <div className="conteneur">
          <div className="v-intro">
            <p className="v-surtitre">Tarifs</p>
            <h2>Ton dossard est gratuit pendant la bêta.</h2>
            <p>Toutes les fonctionnalités sont ouvertes, connexions aux montres comprises. Tu seras prévenu avant toute facturation.</p>
          </div>
          <div className="dossards">
            <Dossard vedette titre="Bêta" etat="Disponible" prix="0 €" sous="Pendant toute la durée de la bêta"
              lignes={['Plan complet jusqu’à ta course', 'Bilan du matin et séance adaptée', 'Envoi des séances à ta montre', 'Analyse après chaque sortie', 'Notifications et e-mail du matin']}
              action={<Link href="/inscription" className="btn btn-primary btn-block">Prendre mon dossard</Link>} />
            <Dossard titre="Premium" etat="Bientôt" prix="À venir" sous="Abonnement mensuel ou annuel"
              lignes={['Tout ce qui est dans la bêta', 'Plusieurs objectifs dans la saison', 'Analyses avancées : allure, cardio, dénivelé', 'App iPhone avec Apple Santé']}
              action={<span className="btn btn-ghost btn-block" aria-disabled="true">Bientôt disponible</span>} />
            <Dossard titre="Clubs et coachs" etat="Sur demande" prix="Sur mesure" sous="Pour encadrer un groupe"
              lignes={['Espace coach et suivi d’athlètes', 'Bilans du matin de tout le groupe', 'Alertes santé centralisées']}
              action={<Link href="/inscription" className="btn btn-ghost btn-block">Rejoindre la bêta</Link>} />
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="v-section v-blanc" id="faq">
        <div className="conteneur faq-wrap">
          <div className="v-intro" style={{ marginBottom: 0 }}><p className="v-surtitre">Questions fréquentes</p><h2>Tout ce que tu te demandes.</h2></div>
          <div className="faq">
            {FAQ.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.r}</p></details>)}
          </div>
        </div>
      </section>

      <section className="v-section">
        <div className="conteneur">
          <div className="bandeau-cta">
            <Topo />
            <div>
              <h2>Demain matin, ton coach t’attend.</h2>
              <p>Ton plan est prêt en trois minutes, ta première séance part sur ta montre ce soir.</p>
            </div>
            <Link href="/inscription" className="btn btn-blanc btn-l">Créer mon plan</Link>
          </div>
          <p className="tiny mt-16">Coach Trail ne remplace pas un avis médical. Un certificat d’aptitude est recommandé avant de reprendre l’entraînement.</p>
        </div>
      </section>
    </div>
  );
}

function Dossard({ titre, etat, prix, sous, lignes, action, vedette }: {
  titre: string; etat: string; prix: string; sous: string; lignes: string[]; action: React.ReactNode; vedette?: boolean;
}) {
  return (
    <div className={`dossard${vedette ? ' vedette' : ''}`}>
      <i className="epingle" /><i className="epingle" /><i className="epingle" /><i className="epingle" />
      <div className="dossard-bande"><span>{titre}</span><span>{etat}</span></div>
      <div className="dossard-num">{prix}</div>
      <p className="dossard-sous">{sous}</p>
      <ul>{lignes.map((l) => <li key={l}>{l}</li>)}</ul>
      {action}
    </div>
  );
}

/** Mini-visuels de la journée type, dessinés en CSS. */
function Visuel({ type }: { type: string }) {
  if (type === 'bilan') return (
    <div className="v-visuel v-vis-bilan" aria-hidden="true">
      <small>Comment as-tu dormi ?</small>
      <div>{['Mal', 'Correct', 'Bien'].map((c, i) => <span key={c} className={i === 2 ? 'on' : ''}>{c}</span>)}</div>
    </div>
  );
  if (type === 'adapte') return (
    <div className="v-visuel v-vis-adapte" aria-hidden="true">
      <s>Côtes longues · 4 × 4 min</s>
      <b>3 × 4 min, un cran plus bas</b>
      <small>Forme du jour : 52/100</small>
    </div>
  );
  if (type === 'montre') return (
    <div className="v-visuel v-vis-montre" aria-hidden="true">
      <div className="v-mini-montre"><small>Effort 2/3</small><b>4:00</b><small>160-172</small></div>
    </div>
  );
  if (type === 'guide') return (
    <div className="v-visuel v-vis-guide" aria-hidden="true">
      <div className="v-intervalles">{([[2, 3], [4, 2], [1, 1.2], [4, 2], [1, 1.2], [4, 2], [1, 2]] as [number, number][]).map(([z, d], i) => <i key={i} style={{ flex: d, height: `${20 + z * 16}%`, background: ZONE[z] }} />)}</div>
      <span className="v-curseur" />
    </div>
  );
  return (
    <div className="v-visuel v-vis-analyse" aria-hidden="true">
      <span className="v-jauge"><b>94%</b></span>
      <div><b>Séance réussie</b><small>Prochaine séance intense dans 36 h</small></div>
    </div>
  );
}

function Telephone() {
  return (
    <div className="v-telephone" aria-label="Aperçu de l’app : la journée de Léa">
      <div className="v-ecran">
        <div className="v-encoche" />
        <p className="v-tel-date">Mardi 12 novembre · J-58</p>
        <p className="v-tel-titre">Bonjour Léa</p>
        <div className="v-tel-etape fait"><i><IcCoche /></i><div><small>Bilan du matin</small><b>Forme 78 · séance maintenue</b></div></div>
        <div className="v-tel-seance">
          <small>Ta séance du jour</small>
          <b>Côtes longues</b>
          <span>4 × 4 min au seuil · 55 min · 300 m D+</span>
          <div className="v-intervalles">{([[2, 4], [4, 2], [1, 1.5], [4, 2], [1, 1.5], [4, 2], [1, 1.5], [4, 2], [1, 2]] as [number, number][]).map(([z, d], i) => <i key={i} style={{ flex: d, height: `${20 + z * 16}%`, background: ZONE[z] }} />)}</div>
          <div className="v-tel-boutons"><em>▶ Séance guidée</em><em>Envoyer à ma Garmin</em></div>
        </div>
        <div className="v-toast"><IcCoche /> Séance envoyée à ta Garmin</div>
        <div className="v-tel-etape"><i><IcSync /></i><div><small>Après ta sortie</small><b>Analyse du moteur</b></div></div>
        <div className="v-tel-etape"><i><IcLune /></i><div><small>Ce soir</small><b>Récupération et sommeil</b></div></div>
      </div>
    </div>
  );
}

function Montre() {
  return (
    <div className="v-montre" aria-label="Aperçu d’une séance sur une montre">
      <div className="v-bracelet haut" />
      <div className="v-cadran">
        <small>Côtes longues</small>
        <span className="v-etape-montre">Effort 3 / 4</span>
        <b>3:42</b>
        <span className="v-cible">FC 162-174</span>
        <div className="v-arc" />
        <small className="v-suivant">Ensuite : récup 3:00</small>
      </div>
      <div className="v-bracelet bas" />
    </div>
  );
}
