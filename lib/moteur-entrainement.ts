/**
 * Moteur d'entraînement trail / running — v0.1
 *
 * Construit un plan jusqu'à une course objectif, puis l'ajuste chaque semaine
 * à partir des séances réalisées. L'IA ne modifie jamais le plan directement :
 * elle propose, et `validerSemaine` vérifie avant tout enregistrement.
 *
 * Toutes les constantes (pourcentages, plafonds, seuils) sont des valeurs de
 * départ, à faire relire et valider par un coach diplômé avant le lancement.
 * Aucune dépendance : fonctionne tel quel dans Node, Next.js, Expo ou une
 * fonction Supabase.
 */

// ───────────────────────────── Types ─────────────────────────────

export type Niveau = 'debutant' | 'intermediaire' | 'confirme';
export type TypeCourse = 'route' | 'trail';
export type Jour = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim';
export type Phase = 'foncier' | 'developpement' | 'specifique' | 'recuperation' | 'affutage' | 'course';

export type TypeSeance =
  | 'footing_ef'          // endurance fondamentale
  | 'sortie_longue'
  | 'sortie_longue_dplus' // sortie longue vallonnée (trail)
  | 'sortie_moyenne_dplus'// veille de sortie longue : enchaînement « back-to-back »
  | 'fartlek'
  | 'cotes_courtes'
  | 'cotes_longues'
  | 'vma'
  | 'seuil'
  | 'allure_specifique'
  | 'rappel_allure'       // séance courte d'affûtage
  | 'course';

export interface CourseReference { distanceKm: number; tempsMin: number }

export interface Profil {
  niveau: Niveau;
  fcMax?: number;
  fcRepos?: number;
  courseReference?: CourseReference; // une course ou un test récent (moins de 3 mois)
  volumeActuelMin: number;           // minutes de course par semaine, moyenne des 4 dernières semaines
  dplusActuelM?: number;             // D+ hebdo moyen
  joursDispo: Jour[];
  jourSortieLongue?: Jour;
  blessureRecente?: boolean;         // blessure dans les 6 derniers mois
}

export interface Objectif {
  type: TypeCourse;
  distanceKm: number;
  dplusM: number;
  date: string; // AAAA-MM-JJ
}

export interface Zone {
  zone: 1 | 2 | 3 | 4 | 5;
  nom: string;
  rpe: [number, number];
  fc?: [number, number];
  allureMinKm?: [string, string]; // [plus rapide, plus lente]
}

export interface Seance {
  id: string;
  date: string;
  jour: Jour;
  type: TypeSeance;
  dureeMin: number;
  dplusM?: number;
  rpePrevu: number;
  zonePrincipale: 1 | 2 | 3 | 4 | 5;
  ppg?: PPG;
  pourquoi: string;
}

export interface PPG { dureeMin: number; contenu: string[] }

export interface SemainePlan {
  numero: number;
  debut: string; // lundi
  phase: Phase;
  volumeMin: number;
  dplusM: number;
  seances: Seance[];
  ppgSeparees: { jour: Jour; date: string; ppg: PPG }[]; // PPG un jour sans course
}

export interface Plan {
  zones: Zone[];
  vmaKmh?: number;
  semaines: SemainePlan[];
  avertissements: string[];
}

export interface SeanceRealisee {
  date: string;
  dureeMin: number;
  rpe: number;          // 1 à 10, échelle CR-10
  seancePrevueId?: string;
  douleur?: number;     // 0 à 10
  zoneDouleur?: string; // « genou droit », « tendon d'Achille »…
}

export interface Ressenti {
  malade?: boolean;
  nuitsMauvaises?: number; // sur les 7 derniers jours
}

export interface Decision {
  facteurVolume: number;      // appliqué à la semaine suivante
  supprimerQualite: boolean;
  alerteSante?: string;
  acwr: number | null;
  raisons: string[];          // explications que l'IA reformule pour l'athlète
}

// ─────────────────────────── Constantes ───────────────────────────

const JOURS: Jour[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/** Part de la VMA tenable selon la durée de l'effort (approximation). */
const FRACTION_VMA: [number, number][] = [
  [6, 1.0], [15, 0.95], [40, 0.9], [90, 0.85], [210, 0.8], [600, 0.7],
];

/** Hausse maximale du volume d'une semaine de développement à la suivante. */
const HAUSSE_MAX: Record<Niveau, number> = { debutant: 0.08, intermediaire: 0.1, confirme: 0.12 };
const HAUSSE_MAX_APRES_BLESSURE = 0.05;

/** Volume hebdo visé au pic (minutes), selon les « km-effort » de la course. */
const PIC_PAR_KM_EFFORT: { jusqua: number; pic: Record<Niveau, number> }[] = [
  { jusqua: 12, pic: { debutant: 180, intermediaire: 240, confirme: 330 } },
  { jusqua: 25, pic: { debutant: 240, intermediaire: 300, confirme: 400 } },
  { jusqua: 45, pic: { debutant: 300, intermediaire: 390, confirme: 500 } },
  { jusqua: 80, pic: { debutant: 360, intermediaire: 480, confirme: 600 } },
  { jusqua: Infinity, pic: { debutant: 420, intermediaire: 540, confirme: 720 } },
];

const PLAFOND_SORTIE_LONGUE: Record<TypeCourse, Record<Niveau, number>> = {
  route: { debutant: 120, intermediaire: 140, confirme: 160 },
  trail: { debutant: 180, intermediaire: 240, confirme: 300 },
};

/** Part du plafond de sortie longue autorisée selon le bloc. */
const PART_PLAFOND_LONGUE: Partial<Record<Phase, number>> = { foncier: 0.6, developpement: 0.85 };

/** Durée maximale d'un footing. */
const FOOTING_MAX: Record<Niveau, number> = { debutant: 60, intermediaire: 75, confirme: 90 };

const PLAFOND_DPLUS_HEBDO: Record<Niveau, number> = { debutant: 1500, intermediaire: 2500, confirme: 4000 };

const RPE_PREVU: Record<TypeSeance, number> = {
  footing_ef: 3, sortie_longue: 4, sortie_longue_dplus: 5, sortie_moyenne_dplus: 4,
  fartlek: 6, cotes_courtes: 7, cotes_longues: 7, vma: 8, seuil: 7,
  allure_specifique: 6, rappel_allure: 5, course: 9,
};

const ZONE_PRINCIPALE: Record<TypeSeance, 1 | 2 | 3 | 4 | 5> = {
  footing_ef: 2, sortie_longue: 2, sortie_longue_dplus: 2, sortie_moyenne_dplus: 2,
  fartlek: 3, cotes_courtes: 5, cotes_longues: 4, vma: 5, seuil: 4,
  allure_specifique: 3, rappel_allure: 3, course: 4,
};

/** Séances « dures » : jamais deux jours de suite. */
const DURES: TypeSeance[] = [
  'sortie_longue', 'sortie_longue_dplus', 'fartlek', 'cotes_courtes', 'cotes_longues',
  'vma', 'seuil', 'allure_specifique', 'course',
];

/** Part du temps d'une séance de qualité réellement passée en zone 3 à 5 (le reste : échauffement, récup). */
const PART_INTENSE_QUALITE = 0.4;

const POURQUOI: Record<TypeSeance, string> = {
  footing_ef: "Construit l'endurance de base et aide à récupérer des séances dures, à allure où tu peux parler.",
  sortie_longue: "Développe l'endurance sur la durée et habitue le corps à l'effort long.",
  sortie_longue_dplus: "Prépare les jambes et le cardio au dénivelé, et permet de tester matériel et ravitaillement.",
  sortie_moyenne_dplus: "Courue la veille de la sortie longue : tu arrives fatigué le lendemain, comme en fin de trail.",
  fartlek: "Réintroduit des changements de rythme en douceur, sans structure stricte.",
  cotes_courtes: "Renforce la foulée et la puissance avec un faible impact sur les articulations.",
  cotes_longues: "Travaille la montée prolongée, au cœur de l'effort en trail.",
  vma: "Élève ta vitesse maximale aérobie, ce qui rend toutes les autres allures plus faciles.",
  seuil: "Repousse le moment où l'effort devient difficile à tenir.",
  allure_specifique: "T'apprend à tenir l'allure ou l'effort du jour de course.",
  rappel_allure: "Garde les jambes vives pendant l'affûtage, sans fatigue.",
  course: "Le jour J.",
};

// ───────────────────────────── Dates ─────────────────────────────

const JOUR_MS = 86_400_000;
const versDate = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const versIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const ajouterJours = (iso: string, n: number) => versIso(versDate(iso) + n * JOUR_MS);
const jourDe = (iso: string): Jour => JOURS[(new Date(versDate(iso)).getUTCDay() + 6) % 7];
const lundiDe = (iso: string) => ajouterJours(iso, -JOURS.indexOf(jourDe(iso)));

const arrondir = (x: number, pas = 5) => Math.round(x / pas) * pas;
const borner = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

// ─────────────────────── Étape 1 : niveau et zones ───────────────────────

export function fractionVMA(dureeMin: number): number {
  if (dureeMin <= FRACTION_VMA[0][0]) return FRACTION_VMA[0][1];
  for (let i = 1; i < FRACTION_VMA.length; i++) {
    const [d1, f1] = FRACTION_VMA[i - 1];
    const [d2, f2] = FRACTION_VMA[i];
    if (dureeMin <= d2) return f1 + ((dureeMin - d1) / (d2 - d1)) * (f2 - f1);
  }
  return FRACTION_VMA[FRACTION_VMA.length - 1][1];
}

/** VMA estimée (km/h) à partir d'une course ou d'un test récent sur terrain plat. */
export function estimerVMA(ref: CourseReference): number {
  const vitesse = ref.distanceKm / (ref.tempsMin / 60);
  return Math.round((vitesse / fractionVMA(ref.tempsMin)) * 10) / 10;
}

function allure(vmaKmh: number, pct: number): string {
  const minKm = 60 / (vmaKmh * pct);
  const min = Math.floor(minKm);
  const sec = Math.round((minKm - min) * 60);
  return sec === 60 ? `${min + 1}'00` : `${min}'${String(sec).padStart(2, '0')}`;
}

export function calculerZones(profil: Profil): { zones: Zone[]; vmaKmh?: number } {
  const def: { zone: 1 | 2 | 3 | 4 | 5; nom: string; rpe: [number, number]; fcPct: [number, number]; vmaPct: [number, number] }[] = [
    { zone: 1, nom: 'Récupération', rpe: [1, 2], fcPct: [0.5, 0.6], vmaPct: [0.6, 0.65] },
    { zone: 2, nom: 'Endurance fondamentale', rpe: [3, 4], fcPct: [0.6, 0.7], vmaPct: [0.65, 0.75] },
    { zone: 3, nom: 'Tempo / allure marathon', rpe: [5, 6], fcPct: [0.7, 0.8], vmaPct: [0.75, 0.85] },
    { zone: 4, nom: 'Seuil', rpe: [7, 8], fcPct: [0.8, 0.9], vmaPct: [0.85, 0.92] },
    { zone: 5, nom: 'VMA', rpe: [9, 10], fcPct: [0.9, 1.0], vmaPct: [0.92, 1.05] },
  ];
  const vmaKmh = profil.courseReference ? estimerVMA(profil.courseReference) : undefined;
  const avecFc = profil.fcMax && profil.fcRepos;
  const zones = def.map<Zone>((d) => ({
    zone: d.zone,
    nom: d.nom,
    rpe: d.rpe,
    // Méthode de Karvonen : FC repos + % de la FC de réserve
    fc: avecFc
      ? [
          Math.round(profil.fcRepos! + d.fcPct[0] * (profil.fcMax! - profil.fcRepos!)),
          Math.round(profil.fcRepos! + d.fcPct[1] * (profil.fcMax! - profil.fcRepos!)),
        ]
      : undefined,
    allureMinKm: vmaKmh ? [allure(vmaKmh, d.vmaPct[1]), allure(vmaKmh, d.vmaPct[0])] : undefined,
  }));
  return { zones, vmaKmh };
}

// ─────────────────────── Étape 2 : périodisation ───────────────────────

export function periodiser(nbSemaines: number, objectif: Objectif): Phase[] {
  if (nbSemaines < 1) return [];
  const longue = objectif.distanceKm >= 42 || objectif.dplusM >= 2000;
  const affutage = nbSemaines >= 8 && longue ? 2 : nbSemaines >= 3 ? 1 : 0;
  const avantAffutage = nbSemaines - 1 - affutage; // la dernière semaine est celle de la course

  const phases: Phase[] = [];
  const specifique = Math.round(avantAffutage * 0.3);
  const developpement = Math.round(avantAffutage * 0.35);
  const foncier = Math.max(0, avantAffutage - specifique - developpement);
  for (let i = 0; i < foncier; i++) phases.push('foncier');
  for (let i = 0; i < developpement; i++) phases.push('developpement');
  for (let i = 0; i < specifique; i++) phases.push('specifique');

  // Cycle 3 semaines de charge pour 1 de récupération, jamais juste avant l'affûtage.
  for (let i = 3; i < phases.length - 1; i += 4) phases[i] = 'recuperation';

  for (let i = 0; i < affutage; i++) phases.push('affutage');
  phases.push('course');
  return phases;
}

/** Pour une semaine de récupération, le bloc dans lequel elle s'insère (foncier, développement…). */
export function blocDe(phases: Phase[], i: number): Phase {
  for (let k = i; k >= 0; k--) if (phases[k] !== 'recuperation') return phases[k];
  return 'foncier';
}

// ─────────────────── Étape 3 : volume et D+ par semaine ───────────────────

export const kmEffort = (o: Objectif) => o.distanceKm + o.dplusM / 100;

export function volumePic(profil: Profil, objectif: Objectif): number {
  const palier = PIC_PAR_KM_EFFORT.find((p) => kmEffort(objectif) <= p.jusqua)!;
  return Math.max(palier.pic[profil.niveau], profil.volumeActuelMin);
}

export function haussemax(profil: Profil): number {
  return profil.blessureRecente ? HAUSSE_MAX_APRES_BLESSURE : HAUSSE_MAX[profil.niveau];
}

/** D+ visé pour une semaine, proportionnel au volume, réduit en phase foncière. */
export function dplusSemaine(volumeMin: number, pic: number, phase: Phase, bloc: Phase, profil: Profil, objectif: Objectif): number {
  if (objectif.type === 'route' || phase === 'course') return 0;
  const dplusPic = Math.min(objectif.dplusM * 0.8, PLAFOND_DPLUS_HEBDO[profil.niveau]);
  const coefBloc = bloc === 'foncier' ? 0.6 : 1;
  const plancher = phase === 'foncier' ? (profil.dplusActuelM ?? 0) : 0;
  return arrondir(Math.max(dplusPic * Math.min(1, volumeMin / pic) * coefBloc, plancher), 50);
}

// ────────────── Étape 4 : composition et placement des séances ──────────────

function typesQualite(phase: Phase, profil: Profil, objectif: Objectif, nbSeances: number): TypeSeance[] {
  const conf = profil.niveau === 'confirme';
  const deux = conf && nbSeances >= 5;
  const trail = objectif.type === 'trail';
  switch (phase) {
    case 'foncier':
      return profil.niveau === 'debutant' ? [] : [profil.blessureRecente ? 'fartlek' : 'cotes_courtes'];
    case 'developpement':
      return deux ? ['vma', trail ? 'cotes_longues' : 'seuil'] : [trail ? 'cotes_longues' : 'vma'];
    case 'specifique':
      return deux
        ? [trail ? 'cotes_longues' : 'allure_specifique', 'seuil']
        : [trail ? 'cotes_longues' : 'allure_specifique'];
    case 'affutage':
    case 'course':
      return ['rappel_allure'];
    default:
      return [];
  }
}

function ppgDeLaSemaine(phase: Phase, objectif: Objectif): PPG[] {
  const base = ['Gainage (planche, latéral) 3 × 30 s', 'Fentes et squats 3 × 12', 'Proprioception sur une jambe 3 × 30 s', 'Mollets excentriques 3 × 15'];
  const trail = objectif.type === 'trail' && (phase === 'developpement' || phase === 'specifique');
  const contenu = trail ? [...base, 'Descente de marche lente (excentrique quadriceps) 3 × 10'] : base;
  if (phase === 'course') return [];
  if (phase === 'affutage' || phase === 'recuperation') return [{ dureeMin: 20, contenu: base.slice(0, 3) }];
  return [{ dureeMin: 25, contenu }, { dureeMin: 20, contenu: ['Mobilité hanches et chevilles 10 min', ...base.slice(0, 2)] }];
}

/** Distance circulaire entre deux jours (dimanche et lundi sont voisins d'une semaine à l'autre). */
const ecart = (a: Jour, b: Jour) => {
  const d = Math.abs(JOURS.indexOf(a) - JOURS.indexOf(b));
  return Math.min(d, 7 - d);
};

/**
 * Choisit les jours de qualité : le plus grand nombre possible sans jamais enchaîner deux séances dures,
 * puis, à nombre égal, la combinaison où les séances dures sont le plus espacées.
 */
function placerQualite(dispo: Jour[], jourLongue: Jour, nb: number): Jour[] {
  const candidats = dispo.filter((j) => j !== jourLongue);
  const combinaisons = (k: number, depuis = 0): Jour[][] =>
    k === 0 ? [[]] : candidats.slice(depuis).flatMap((j, i) => combinaisons(k - 1, depuis + i + 1).map((c) => [j, ...c]));
  for (let k = nb; k > 0; k--) {
    let meilleure: Jour[] | null = null;
    let meilleurEcart = -1;
    for (const c of combinaisons(k)) {
      const dures = [jourLongue, ...c];
      let mini = Infinity;
      for (let a = 0; a < dures.length; a++) for (let b = a + 1; b < dures.length; b++) mini = Math.min(mini, ecart(dures[a], dures[b]));
      if (mini >= 2 && mini > meilleurEcart) { meilleure = c; meilleurEcart = mini; }
    }
    if (meilleure) return meilleure;
  }
  return [];
}

export function composerSemaine(
  numero: number, debut: string, phase: Phase, volumeMin: number, dplusM: number,
  profil: Profil, objectif: Objectif, bloc: Phase = phase,
): SemainePlan {
  const avertir: string[] = [];
  const trail = objectif.type === 'trail';
  let dispo = JOURS.filter((j) => profil.joursDispo.includes(j));
  if (phase === 'course') {
    // Semaine de course : pas de séance la veille ni après la course.
    const jourCourse = jourDe(objectif.date);
    const iCourse = JOURS.indexOf(jourCourse);
    dispo = dispo.filter((j) => JOURS.indexOf(j) < iCourse - 1);
  }
  const jourLongue =
    phase === 'course'
      ? jourDe(objectif.date)
      : profil.jourSortieLongue && dispo.includes(profil.jourSortieLongue)
        ? profil.jourSortieLongue
        : (['dim', 'sam'] as Jour[]).find((j) => dispo.includes(j)) ?? dispo[dispo.length - 1];

  const plafondLongue = Math.round(PLAFOND_SORTIE_LONGUE[objectif.type][profil.niveau] * (PART_PLAFOND_LONGUE[bloc] ?? 1));
  const footingMax = FOOTING_MAX[profil.niveau];
  const seances: Seance[] = [];
  const ajouter = (jour: Jour, type: TypeSeance, dureeMin: number, dplus?: number) => {
    const date = ajouterJours(debut, JOURS.indexOf(jour));
    seances.push({
      id: `S${numero}-${jour}`, date, jour, type, dureeMin: Math.round(dureeMin),
      dplusM: dplus ? arrondir(dplus, 50) : undefined,
      rpePrevu: RPE_PREVU[type], zonePrincipale: ZONE_PRINCIPALE[type], pourquoi: POURQUOI[type],
    });
  };

  // 1. Sortie longue (ou la course elle-même)
  const autres = dispo.filter((j) => j !== jourLongue);
  let reste = volumeMin;
  if (phase === 'course') {
    ajouter(jourLongue, 'course', 0, objectif.dplusM);
  } else {
    const part = dispo.length <= 3 ? 0.38 : 0.32;
    const plafond = plafondLongue;
    const longue = borner(volumeMin * part, 45, plafond);
    const typeLongue: TypeSeance = trail && bloc !== 'foncier' ? 'sortie_longue_dplus' : 'sortie_longue';
    ajouter(jourLongue, typeLongue, longue, trail ? dplusM * 0.5 : undefined);
    reste -= longue;
  }

  // 2. Séances de qualité
  const qualites = typesQualite(phase, profil, objectif, dispo.length);
  const joursQualite = placerQualite(autres, jourLongue, qualites.length);
  if (joursQualite.length < qualites.length) {
    avertir.push('Jours disponibles trop rapprochés : une séance de qualité a été remplacée par du footing.');
  }
  const dureeQualite = phase === 'affutage' || phase === 'course' ? 35 : borner(volumeMin * 0.17, 40, 75);
  joursQualite.forEach((j, i) => {
    ajouter(j, qualites[i], dureeQualite, qualites[i] === 'cotes_longues' ? dplusM * 0.25 : undefined);
    reste -= dureeQualite;
  });

  // 3. Back-to-back : sortie moyenne vallonnée la veille de la sortie longue (trail, confirmé, phase spécifique)
  const veille = JOURS[(JOURS.indexOf(jourLongue) + 6) % 7];
  const footings = autres.filter((j) => !joursQualite.includes(j));
  if (trail && profil.niveau === 'confirme' && phase === 'specifique' && kmEffort(objectif) > 45 && footings.includes(veille)) {
    const moyenne = borner(reste * 0.5, 45, 120);
    ajouter(veille, 'sortie_moyenne_dplus', moyenne, dplusM * 0.25);
    reste -= moyenne;
    footings.splice(footings.indexOf(veille), 1);
  }

  // 4. Footings en endurance fondamentale avec le temps restant, plafonnés selon le niveau
  if (footings.length) {
    const parFooting = reste / footings.length;
    if (parFooting >= 25) footings.forEach((j) => ajouter(j, 'footing_ef', Math.min(parFooting, footingMax)));
    else {
      // Pas assez de temps pour tout le monde : moins de footings, mais de 30 min minimum
      const n = Math.max(0, Math.floor(reste / 30));
      footings.slice(0, n).forEach((j) => ajouter(j, 'footing_ef', 30));
    }
  }

  // Le temps qui ne rentre pas dans les footings va à la sortie longue, dans la limite de son plafond
  const sortieLongue = seances.find((s) => s.type.startsWith('sortie_longue'));
  const prevu = seances.reduce((t, s) => t + s.dureeMin, 0);
  if (sortieLongue && volumeMin - prevu > 5) {
    sortieLongue.dureeMin = Math.round(Math.max(sortieLongue.dureeMin, Math.min(plafondLongue, sortieLongue.dureeMin + volumeMin - prevu)));
  }

  // En trail, le D+ restant est réparti sur les footings (parcours vallonnés)
  if (trail && phase !== 'course') {
    const dplusPlace = seances.reduce((t, s) => t + (s.dplusM ?? 0), 0);
    const fts = seances.filter((s) => s.type === 'footing_ef');
    const parFt = arrondir((dplusM - dplusPlace) / Math.max(1, fts.length), 50);
    if (parFt > 0) fts.forEach((s) => { s.dplusM = parFt; });
  }

  // 5. PPG : après un footing si possible, sinon un jour sans course
  const ppgs = ppgDeLaSemaine(phase, objectif);
  const ppgSeparees: SemainePlan['ppgSeparees'] = [];
  const supports = seances.filter((s) => s.type === 'footing_ef');
  const libres = JOURS.filter((j) => !seances.some((s) => s.jour === j) && j !== veille);
  ppgs.forEach((ppg, i) => {
    if (supports[i]) supports[i].ppg = ppg;
    else if (libres[i]) ppgSeparees.push({ jour: libres[i], date: ajouterJours(debut, JOURS.indexOf(libres[i])), ppg });
  });

  seances.sort((a, b) => a.date.localeCompare(b.date));
  const courues = seances.filter((s) => s.type !== 'course');
  const semaine: SemainePlan = {
    numero, debut, phase, seances, ppgSeparees,
    // Totaux réels de la semaine, une fois les plafonds appliqués
    volumeMin: courues.reduce((t, s) => t + s.dureeMin, 0),
    dplusM: courues.reduce((t, s) => t + (s.dplusM ?? 0), 0),
  };
  if (avertir.length) (semaine as SemainePlan & { avertissements?: string[] }).avertissements = avertir;
  return semaine;
}

// ─────────────────────────── Génération du plan ───────────────────────────

export function genererPlan(profil: Profil, objectif: Objectif, dateDebut: string): Plan {
  const avertissements: string[] = [];
  const debut = lundiDe(dateDebut);
  const nbSemaines = Math.floor((versDate(lundiDe(objectif.date)) - versDate(debut)) / (7 * JOUR_MS)) + 1;

  if (profil.joursDispo.length < 3) avertissements.push('Moins de 3 jours disponibles : la progression sera limitée.');
  if (nbSemaines < 6) avertissements.push(`Seulement ${nbSemaines} semaines avant la course : plan de maintien, pas de vraie progression.`);
  if (!profil.courseReference) avertissements.push('Pas de course de référence : zones d’allure indisponibles, le plan se pilote au RPE et à la FC.');

  const pic = volumePic(profil, objectif);
  const besoin = Math.log(pic / Math.max(profil.volumeActuelMin, 90)) / Math.log(1 + haussemax(profil));
  if (besoin > nbSemaines * 0.6) {
    avertissements.push('Le volume visé ne sera pas atteint dans le temps disponible : objectif ambitieux, à discuter avec l’athlète.');
  }

  const { zones, vmaKmh } = calculerZones(profil);
  const phases = periodiser(nbSemaines, objectif);
  const h = haussemax(profil);
  const nbAffutage = phases.filter((p) => p === 'affutage').length;
  const coefAffutage = nbAffutage === 2 ? [0.75, 0.55] : [0.6];
  let iAffutage = 0;

  // La progression repart toujours du volume réellement planifié la semaine de charge précédente :
  // si un plafond (sortie longue, footings) a limité une semaine, la suivante ne fait pas de bond.
  let charge = Math.max(profil.volumeActuelMin, 90) / (1 + h);
  let atteint = Math.max(profil.volumeActuelMin, 90);
  const semaines: SemainePlan[] = phases.map((phase, i) => {
    const bloc = blocDe(phases, i);
    const enCharge = !['recuperation', 'affutage', 'course'].includes(phase);
    const cible =
      phase === 'recuperation' ? charge * 0.7
      : phase === 'affutage' ? atteint * coefAffutage[iAffutage++]
      : phase === 'course' ? atteint * 0.35
      : Math.min(charge * (1 + h), pic);
    const volume = arrondir(cible);
    const semaine = composerSemaine(
      i + 1, ajouterJours(debut, i * 7), phase, volume,
      dplusSemaine(volume, pic, phase, bloc, profil, objectif), profil, objectif, bloc,
    );
    if (enCharge) { charge = semaine.volumeMin; atteint = Math.max(atteint, charge); }
    return semaine;
  });
  return { zones, vmaKmh, semaines, avertissements };
}

// ───────────────────── Étape 5 : charge et adaptation ─────────────────────

/** Charge d'une séance : RPE × durée en minutes (méthode « session RPE » de Foster). */
export const chargeSeance = (s: { rpe: number; dureeMin: number }) => s.rpe * s.dureeMin;

/**
 * Ratio charge aiguë / charge chronique.
 * Aiguë = charge des 7 derniers jours ; chronique = moyenne hebdomadaire sur 28 jours.
 * Renvoie null s'il manque de l'historique (moins de 21 jours de données).
 */
export function acwr(seances: SeanceRealisee[], ce_jour: string): number | null {
  const fin = versDate(ce_jour);
  const dansLes = (n: number) =>
    seances.filter((s) => { const t = versDate(s.date); return t <= fin && t > fin - n * JOUR_MS; });
  const premiere = Math.min(...seances.map((s) => versDate(s.date)));
  if (!seances.length || fin - premiere < 21 * JOUR_MS) return null;
  const aigue = dansLes(7).reduce((t, s) => t + chargeSeance(s), 0);
  const chronique = dansLes(28).reduce((t, s) => t + chargeSeance(s), 0) / 4;
  return chronique === 0 ? null : Math.round((aigue / chronique) * 100) / 100;
}

export function adapterSemaine(p: {
  semaine: SemainePlan;              // la semaine qui se termine
  realisees: SeanceRealisee[];       // séances de cette semaine
  historique: SeanceRealisee[];      // au moins les 28 derniers jours, cette semaine comprise
  ressenti: Ressenti;
  volumeSemaineSuivante: number;     // volume prévu par le plan pour la semaine suivante
}): Decision {
  const raisons: string[] = [];
  let facteur = 1;
  let supprimerQualite = false;
  let alerteSante: string | undefined;
  const limiter = (f: number, raison: string) => { if (f < facteur) facteur = f; raisons.push(raison); };

  // Santé d'abord
  const douleurs = p.realisees.filter((s) => (s.douleur ?? 0) >= 3);
  const douleurForte = p.realisees.some((s) => (s.douleur ?? 0) >= 5);
  if (douleurForte || douleurs.length >= 2) {
    const ou = [...new Set(douleurs.map((s) => s.zoneDouleur).filter(Boolean))].join(', ');
    alerteSante = `Douleur ${douleurForte ? 'forte' : 'répétée'}${ou ? ` (${ou})` : ''} : consulte un médecin ou un kiné avant de reprendre l’intensité.`;
    supprimerQualite = true;
    limiter(0.5, 'Douleur signalée : volume divisé par deux et plus aucune séance intense en attendant un avis médical.');
  }
  if (p.ressenti.malade) {
    supprimerQualite = true;
    limiter(0.5, 'Maladie : reprise progressive, uniquement en endurance fondamentale. Pas de course en cas de fièvre.');
  }

  // Charge
  const ratio = acwr(p.historique, ajouterJours(p.semaine.debut, 6));
  if (ratio !== null && ratio > 1.5) {
    supprimerQualite = true;
    limiter(0.7, `Charge de la semaine bien au-dessus de tes habitudes (ratio ${ratio}) : semaine allégée pour éviter la blessure.`);
  } else if (ratio !== null && ratio > 1.3) {
    limiter(0.85, `Charge en hausse rapide (ratio ${ratio}) : on stabilise au lieu d’augmenter.`);
  }

  // Ressenti plus dur que prévu
  const prevues = new Map(p.semaine.seances.map((s) => [s.id, s]));
  const tropDures = p.realisees.filter((r) => {
    const prevue = r.seancePrevueId ? prevues.get(r.seancePrevueId) : undefined;
    return prevue && r.rpe - prevue.rpePrevu >= 2;
  });
  if (tropDures.length >= 2) {
    supprimerQualite = true;
    limiter(0.85, `${tropDures.length} séances ressenties nettement plus dures que prévu : signe de fatigue, la semaine suivante est allégée.`);
  }

  // Sommeil
  if ((p.ressenti.nuitsMauvaises ?? 0) >= 3) {
    limiter(0.9, 'Plusieurs mauvaises nuits : un peu moins de volume pour laisser le corps récupérer.');
  }

  // Séances manquées : on ne rattrape pas, on repart de ce qui a été fait
  const prevuMin = p.semaine.seances.reduce((t, s) => t + s.dureeMin, 0);
  const faitMin = p.realisees.reduce((t, s) => t + s.dureeMin, 0);
  if (prevuMin > 0 && faitMin / prevuMin < 0.6) {
    const f = Math.round(((faitMin * 1.1) / p.volumeSemaineSuivante) * 100) / 100;
    limiter(Math.min(1, f), `Seulement ${Math.round((faitMin / prevuMin) * 100)} % du volume réalisé : on ne rattrape pas, on repart de ce que tu as fait.`);
  }

  if (!raisons.length) raisons.push('Semaine conforme au plan : la progression continue comme prévu.');
  return { facteurVolume: Math.round(facteur * 100) / 100, supprimerQualite, alerteSante, acwr: ratio, raisons };
}

/** Applique une décision d'adaptation à la semaine suivante du plan. */
export function appliquerDecision(semaine: SemainePlan, d: Decision): SemainePlan {
  const seances = semaine.seances.map((s) => {
    if (s.type === 'course') return s;
    const qualite = !['footing_ef', 'sortie_longue', 'sortie_longue_dplus', 'sortie_moyenne_dplus'].includes(s.type);
    const type: TypeSeance = d.supprimerQualite && qualite ? 'footing_ef' : s.type;
    return {
      ...s, type,
      dureeMin: Math.max(20, arrondir(s.dureeMin * d.facteurVolume)),
      dplusM: s.dplusM ? arrondir(s.dplusM * d.facteurVolume, 50) : undefined,
      rpePrevu: RPE_PREVU[type], zonePrincipale: ZONE_PRINCIPALE[type], pourquoi: POURQUOI[type],
    };
  });
  return {
    ...semaine, seances,
    volumeMin: seances.reduce((t, s) => t + s.dureeMin, 0),
    dplusM: arrondir(semaine.dplusM * d.facteurVolume, 50),
  };
}

// ──────────────── Étape 6 : validation des propositions de l'IA ────────────────

export interface Violation { regle: string; detail: string }

export function validerSemaine(
  proposee: SemainePlan,
  ctx: { profil: Profil; objectif: Objectif; volumeReferenceMin: number; alerteSanteActive?: boolean },
): { valide: boolean; violations: Violation[] } {
  const v: Violation[] = [];
  const { profil, objectif } = ctx;
  const volume = proposee.seances.filter((s) => s.type !== 'course').reduce((t, s) => t + s.dureeMin, 0);

  // 1. Hausse de volume plafonnée
  const max = ctx.volumeReferenceMin * (1 + haussemax(profil));
  if (volume > max + 5) {
    v.push({ regle: 'hausse_volume', detail: `${volume} min proposées pour ${Math.round(max)} min maximum (+${Math.round(haussemax(profil) * 100)} %).` });
  }

  // 2. Au moins 75 % du temps en zones 1 et 2
  const intense = proposee.seances
    .filter((s) => s.zonePrincipale >= 3 && s.type !== 'course')
    .reduce((t, s) => t + s.dureeMin * PART_INTENSE_QUALITE, 0);
  const affutage = proposee.phase === 'affutage' || proposee.phase === 'course';
  if (!affutage && volume > 0 && intense / volume > 0.25) {
    v.push({ regle: 'repartition_intensite', detail: `${Math.round((intense / volume) * 100)} % du temps en intensité, 25 % maximum.` });
  }

  // 3. Jamais deux séances dures d'affilée (dimanche et lundi comptent comme consécutifs)
  const dures = proposee.seances.filter((s) => DURES.includes(s.type)).map((s) => s.jour);
  for (let i = 0; i < dures.length; i++) {
    for (let k = i + 1; k < dures.length; k++) {
      if (ecart(dures[i], dures[k]) < 2) v.push({ regle: 'enchainement', detail: `Deux séances dures consécutives : ${dures[i]} et ${dures[k]}.` });
    }
  }

  // 4. Au moins un jour de repos complet
  if (new Set(proposee.seances.map((s) => s.jour)).size >= 7) {
    v.push({ regle: 'repos', detail: 'Aucun jour de repos dans la semaine.' });
  }

  // 5. Sortie longue plafonnée
  const plafond = PLAFOND_SORTIE_LONGUE[objectif.type][profil.niveau];
  proposee.seances
    .filter((s) => s.type.startsWith('sortie_longue') && s.dureeMin > plafond)
    .forEach((s) => v.push({ regle: 'sortie_longue', detail: `Sortie longue de ${s.dureeMin} min, plafond ${plafond} min.` }));

  // 6. Pas d'intensité pendant une alerte santé
  if (ctx.alerteSanteActive && proposee.seances.some((s) => s.zonePrincipale >= 3 && s.type !== 'course')) {
    v.push({ regle: 'alerte_sante', detail: 'Séance intense proposée alors qu’une douleur est en cours de suivi.' });
  }

  return { valide: v.length === 0, violations: v };
}
