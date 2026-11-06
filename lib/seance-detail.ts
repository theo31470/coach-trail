/**
 * Détail d'une séance : échauffement, corps de séance, retour au calme,
 * avec la cible de chaque bloc (zone, allure, FC, ressenti) et des conseils.
 * Sert à l'affichage et au lecteur de séance (mode guidé, minuté).
 */
import type { Seance, TypeSeance, Zone } from './moteur-entrainement';

export interface Bloc {
  titre: string;
  dureeSec: number;
  zone: 1 | 2 | 3 | 4 | 5;
  consigne: string;
  type: 'echauffement' | 'effort' | 'recup' | 'calme' | 'continu';
  repetition?: string; // « 3 / 8 »
  exercices?: string[]; // détail de l'échauffement
}

export interface DetailSeance {
  titre: string;
  resume: string;
  blocs: Bloc[];
  conseils: string[];
  technique: string[];   // points clés d'exécution
  materiel: string[];    // quoi emporter
  objectif: string;      // ce que la séance développe
}

export const NOMS_SEANCES: Record<TypeSeance, string> = {
  footing_ef: 'Footing en endurance fondamentale',
  sortie_longue: 'Sortie longue',
  sortie_longue_dplus: 'Sortie longue vallonnée',
  sortie_moyenne_dplus: 'Sortie moyenne vallonnée',
  fartlek: 'Fartlek',
  cotes_courtes: 'Côtes courtes',
  cotes_longues: 'Côtes longues',
  vma: 'Fractionné VMA',
  seuil: 'Seuil',
  allure_specifique: 'Allure de course',
  rappel_allure: 'Rappel d’allure',
  course: 'Jour de course',
};

const m = (min: number) => Math.round(min * 60);

/** Fractionne un effort en n répétitions effort / récupération. */
function series(n: number, effortSec: number, recupSec: number, zone: 1 | 2 | 3 | 4 | 5, consigneEffort: string, consigneRecup: string): Bloc[] {
  const blocs: Bloc[] = [];
  for (let i = 1; i <= n; i++) {
    blocs.push({ titre: `Effort ${i}`, dureeSec: effortSec, zone, consigne: consigneEffort, type: 'effort', repetition: `${i} / ${n}` });
    if (i < n) blocs.push({ titre: 'Récupération', dureeSec: recupSec, zone: 1, consigne: consigneRecup, type: 'recup', repetition: `${i} / ${n}` });
  }
  return blocs;
}

function detailBase(s: Seance): Omit<DetailSeance, 'technique' | 'materiel' | 'objectif'> {
  const d = s.dureeMin;
  const ech = (min: number, plus = ''): Bloc => ({
    titre: 'Échauffement', dureeSec: m(min), zone: 2, type: 'echauffement',
    consigne: `Commence très doucement puis monte progressivement en endurance fondamentale.${plus}`,
  });
  const calme = (min: number): Bloc => ({
    titre: 'Retour au calme', dureeSec: m(min), zone: 1, type: 'calme',
    consigne: 'Trottine très lentement ou marche, laisse redescendre le cœur et le souffle.',
  });
  const titre = NOMS_SEANCES[s.type];

  switch (s.type) {
    case 'footing_ef':
      return {
        titre, resume: `${d} min en aisance respiratoire${s.dplusM ? `, sur un parcours vallonné (${s.dplusM} m D+)` : ''}.`,
        blocs: [ech(10), { titre: 'Endurance fondamentale', dureeSec: m(d - 15), zone: 2, type: 'continu', consigne: 'Tu dois pouvoir parler en phrases complètes. En côte, marche si le cœur s’emballe.' }, calme(5)],
        conseils: ['Si tu es essoufflé, ralentis : c’est la séance la plus utile quand elle est vraiment facile.', 'Termine par 5 min d’étirements doux ou de mobilité.'],
      };
    case 'sortie_longue':
    case 'sortie_longue_dplus': {
      const trail = s.type === 'sortie_longue_dplus';
      return {
        titre, resume: `${Math.floor(d / 60) ? `${Math.floor(d / 60)} h ${String(d % 60).padStart(2, '0')}` : `${d} min`} d’endurance${trail && s.dplusM ? ` avec ${s.dplusM} m de D+` : ''}.`,
        blocs: [
          ech(15),
          { titre: trail ? 'Endurance en terrain vallonné' : 'Endurance', dureeSec: m(d - 20), zone: 2, type: 'continu',
            consigne: trail ? 'Monte en marche active dès que la pente l’impose, relâche-toi en descente, petits pas rapides.' : 'Allure régulière et facile, du début à la fin.' },
          calme(5),
        ],
        conseils: [
          d >= 90 ? 'Au-delà d’1 h 30, emporte de l’eau et de quoi t’alimenter : c’est le moment de tester ton ravitaillement de course.' : 'Hydrate-toi avant de partir.',
          trail ? 'Choisis un parcours proche de celui de ta course : type de terrain, pentes, technicité.' : 'Choisis un parcours plat ou roulant.',
          'Mieux vaut finir avec de la réserve que dans le dur.',
        ],
      };
    }
    case 'sortie_moyenne_dplus':
      return {
        titre, resume: `${d} min vallonnées, la veille de ta sortie longue.`,
        blocs: [ech(10), { titre: 'Endurance vallonnée', dureeSec: m(d - 15), zone: 2, type: 'continu', consigne: 'Allure facile, travaille la technique de descente.' }, calme(5)],
        conseils: ['Demain tu enchaînes la sortie longue : garde de la fraîcheur, c’est le principe du back-to-back.'],
      };
    case 'fartlek': {
      const n = Math.max(6, Math.min(10, Math.floor((d - 25) / 2.5)));
      return {
        titre, resume: `${n} accélérations d’1 min au ressenti, sans pression.`,
        blocs: [ech(15), ...series(n, 60, 90, 3, 'Accélère jusqu’à un effort soutenu mais contrôlé.', 'Reviens à un trot léger.'), calme(10)],
        conseils: ['Pas de montre obligatoire : joue avec le terrain et tes sensations.'],
      };
    }
    case 'cotes_courtes': {
      const n = Math.max(6, Math.min(12, Math.floor((d - 30) / 1.5)));
      return {
        titre, resume: `${n} montées de 30 s, récupération en descente.`,
        blocs: [ech(20, ' Finis par 3 accélérations progressives.'), ...series(n, 30, 60, 5, 'Monte vite et tonique : genoux hauts, bras actifs, buste droit.', 'Redescends en trottinant tranquillement.'), calme(10)],
        conseils: ['Choisis une pente de 6 à 10 % sans obstacle.', 'L’objectif est la qualité de foulée, pas l’épuisement.'],
      };
    }
    case 'cotes_longues': {
      const n = Math.max(3, Math.min(6, Math.floor((d - 30) / 7)));
      return {
        titre, resume: `${n} montées de 4 min à effort de seuil${s.dplusM ? ` (≈ ${s.dplusM} m D+)` : ''}.`,
        blocs: [ech(20), ...series(n, 240, 180, 4, 'Effort soutenu et régulier. Si la pente est raide, passe en marche active rapide, mains sur les cuisses.', 'Redescends en trottinant, relâché, petits pas.'), calme(10)],
        conseils: ['Garde le même effort sur toutes les répétitions : la dernière doit ressembler à la première.', 'Bonne séance pour tester tes bâtons si tu en utilises en course.'],
      };
    }
    case 'vma': {
      const n = Math.max(8, Math.min(16, Math.floor((d - 30) / 1.2)));
      return {
        titre, resume: `${n} × 30 s vite / 30 s lent.`,
        blocs: [ech(20, ' Finis par 3 lignes droites en accélération.'), ...series(n, 30, 30, 5, 'Vite mais en contrôle : une allure que tu tiendrais environ 6 min.', 'Trottine sans t’arrêter.'), calme(10)],
        conseils: ['Sur piste ou terrain plat et roulant.', 'Si tu ne tiens plus l’allure, arrête la série : la qualité prime.'],
      };
    }
    case 'seuil': {
      const n = 3;
      const effort = Math.max(6, Math.min(12, Math.floor((d - 30 - 4) / n)));
      return {
        titre, resume: `${n} × ${effort} min au seuil, 2 min de récupération.`,
        blocs: [ech(20), ...series(n, effort * 60, 120, 4, 'Effort « confortablement difficile » : tu peux dire quelques mots, pas tenir une conversation.', 'Trottine lentement.'), calme(10)],
        conseils: ['Régularité avant tout : ne pars pas trop vite sur la première.'],
      };
    }
    case 'allure_specifique': {
      const n = 3;
      const effort = Math.max(8, Math.min(15, Math.floor((d - 25 - 6) / n)));
      return {
        titre, resume: `${n} × ${effort} min à ton allure de course.`,
        blocs: [ech(15), ...series(n, effort * 60, 180, 3, 'Ton allure ou ton effort du jour J, ni plus, ni moins.', 'Trottine facilement.'), calme(10)],
        conseils: ['Mémorise les sensations : c’est elles que tu chercheras le jour de la course.'],
      };
    }
    case 'rappel_allure':
      return {
        titre, resume: '4 × 2 min dynamiques pour garder les jambes vives.',
        blocs: [ech(15), ...series(4, 120, 90, 3, 'Dynamique et facile, sans forcer.', 'Trottine.'), calme(8)],
        conseils: ['C’est l’affûtage : la fraîcheur compte plus que tout. Dors bien, mange normalement.'],
      };
    case 'course':
      return {
        titre, resume: 'Le jour J. Tout le travail est fait.',
        blocs: [],
        conseils: [
          'Ne teste rien de nouveau : chaussures, tenue, ravitaillement déjà essayés à l’entraînement.',
          'Pars plus lentement que tu ne le voudrais : les premiers kilomètres doivent sembler faciles.',
          'En trail, marche dans les montées raides dès le début, économise-toi pour la fin.',
          'Hydrate-toi et alimente-toi régulièrement, avant d’avoir soif ou faim.',
        ],
      };
  }
}

/** Libellé de la cible d'un bloc à partir des zones calculées. */
export function cibleBloc(zone: number, zones: Zone[]): string {
  const z = zones.find((x) => x.zone === zone);
  if (!z) return '';
  const parts = [`Zone ${z.zone}`, `ressenti ${z.rpe[0]}-${z.rpe[1]}/10`];
  if (z.fc) parts.push(`${z.fc[0]}-${z.fc[1]} bpm`);
  if (z.allureMinKm) parts.push(`${z.allureMinKm[0]} à ${z.allureMinKm[1]} /km`);
  return parts.join(' · ');
}

const OBJECTIFS: Record<TypeSeance, string> = {
  footing_ef: 'Développe ton endurance de base : plus de capillaires, plus de mitochondries, un cœur plus efficace.',
  sortie_longue: 'Habitue ton corps à durer : économie de course, utilisation des graisses, solidité des tendons.',
  sortie_longue_dplus: 'Prépare tes jambes au dénivelé : force en montée, résistance musculaire en descente.',
  sortie_moyenne_dplus: 'Accumule du dénivelé sans fatigue excessive, en préparation de la sortie longue.',
  fartlek: 'Réveille la vitesse en douceur et apprends à changer de rythme selon le terrain.',
  cotes_courtes: 'Gagne en puissance et en qualité de foulée : la force spécifique du traileur.',
  cotes_longues: 'Augmente ta puissance en montée à une intensité proche de la course.',
  vma: 'Élève ton plafond aérobie (VO2max) : toutes les autres allures en profitent.',
  seuil: 'Repousse le moment où l’acide lactique s’accumule : tu tiens plus vite plus longtemps.',
  allure_specifique: 'Grave dans ton corps l’allure ou l’effort exact du jour J.',
  rappel_allure: 'Garde de la vivacité pendant l’affûtage, sans ajouter de fatigue.',
  course: 'Le jour de vérité : profite, tout le travail est fait.',
};

/** Détail complet : déroulé, échauffement précis, technique et matériel. */
export function detaillerSeance(s: Seance): DetailSeance {
  const base = detailBase(s);
  const intense = s.zonePrincipale >= 3;
  const trail = Boolean(s.dplusM) || ['sortie_longue_dplus', 'sortie_moyenne_dplus', 'cotes_courtes', 'cotes_longues'].includes(s.type);
  const blocs = base.blocs.map((b) => b.type !== 'echauffement' ? b : {
    ...b,
    exercices: intense
      ? ['8 à 10 min de footing très facile', 'Mobilité : 10 cercles de chevilles et de hanches', 'Gammes sur 20 m : montées de genoux, talons-fesses, pas chassés', '3 accélérations progressives de 80 m, retour en marchant']
      : ['5 min de marche rapide ou de trot très lent', 'Mobilité : 10 cercles de chevilles et de hanches', 'Monte progressivement jusqu’à l’allure facile'],
  });
  const technique: string[] = [];
  if (['cotes_courtes', 'cotes_longues', 'sortie_longue_dplus', 'sortie_moyenne_dplus'].includes(s.type)) {
    technique.push('En montée : regard 3 à 4 m devant, buste légèrement penché vers l’avant, bras qui rythment.');
    technique.push('Quand la pente dépasse 15 %, la marche active est souvent plus économique que la course.');
    technique.push('En descente : pas courts et rapides, appuis sur l’avant du pied, bras écartés pour l’équilibre.');
  } else if (['vma', 'seuil', 'fartlek', 'allure_specifique', 'rappel_allure'].includes(s.type)) {
    technique.push('Foulée haute et tonique, pied qui se pose sous le bassin, pas devant.');
    technique.push('Épaules relâchées, mains souples : la crispation coûte de l’énergie.');
    technique.push('Expire longuement pendant les récupérations pour redescendre plus vite.');
  } else if (s.type !== 'course') {
    technique.push('Cadence légère autour de 165 à 180 pas par minute, sans allonger la foulée.');
    technique.push('Respiration par le ventre : si tu ne peux plus parler, ralentis.');
  }
  const materiel: string[] = [];
  if (s.type !== 'course') {
    materiel.push(trail ? 'Chaussures de trail adaptées au terrain' : 'Chaussures de route');
    if (s.dureeMin >= 75) materiel.push('Eau (500 ml par heure environ) et un ravitaillement à tester');
    if (s.dureeMin >= 120 || (trail && s.dureeMin >= 90)) materiel.push('Sac ou ceinture, coupe-vent, téléphone chargé');
    if (s.zonePrincipale >= 4 || s.type === 'seuil') materiel.push('Montre ou cardio pour contrôler l’intensité');
    if (s.type === 'cotes_longues' && s.dplusM) materiel.push('Bâtons si tu comptes les utiliser en course');
  }
  return { ...base, blocs, technique, materiel, objectif: OBJECTIFS[s.type] };
}
