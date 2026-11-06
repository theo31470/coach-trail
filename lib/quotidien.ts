/**
 * Accompagnement quotidien, calculé par le moteur interne (aucune IA) :
 *  - bilan du matin → score de forme → adaptation de la séance du jour ;
 *  - retour après séance → comparaison prévu / réalisé → conseils et récupération.
 */
import type { Seance, TypeSeance } from './moteur-entrainement';

// ─────────────────────────── Bilan du matin ───────────────────────────

export interface BilanMatin {
  sommeil: number;   // 1 (très mauvais) à 5 (excellent)
  energie: number;   // 1 (vidé) à 5 (plein d'énergie)
  jambes: number;    // 1 (très lourdes, courbatures) à 5 (légères)
  douleur: number;   // 0 à 10
  zoneDouleur?: string | null;
}

export type NiveauAdaptation = 'maintenue' | 'allegee' | 'remplacee' | 'repos';

export interface Adaptation {
  score: number;                 // forme du jour, 0 à 100
  niveau: NiveauAdaptation;
  seance: Seance | null;         // séance à faire aujourd'hui (null = repos)
  titre: string;                 // phrase courte affichée en tête
  raisons: string[];             // pourquoi le moteur a décidé ça
  conseils: string[];
}

const QUALITE: TypeSeance[] = ['fartlek', 'cotes_courtes', 'cotes_longues', 'vma', 'seuil', 'allure_specifique', 'rappel_allure'];
export const estQualite = (t: TypeSeance) => QUALITE.includes(t);

/** Score de forme : sommeil 30 %, énergie 35 %, jambes 35 %, moins la douleur. */
export function scoreForme(b: BilanMatin): number {
  const base = ((b.sommeil - 1) / 4) * 30 + ((b.energie - 1) / 4) * 35 + ((b.jambes - 1) / 4) * 35;
  return Math.max(0, Math.min(100, Math.round(base - b.douleur * 6)));
}

export function libelleForme(score: number) {
  if (score >= 75) return { mot: 'En pleine forme', ton: 'ok' as const };
  if (score >= 55) return { mot: 'Bonne forme', ton: 'ok' as const };
  if (score >= 40) return { mot: 'Forme moyenne', ton: 'warn' as const };
  return { mot: 'Fatigué', ton: 'danger' as const };
}

/**
 * Adapte la séance du jour au bilan du matin.
 * `acwr` (charge aiguë / chronique) affine la décision quand il est connu.
 */
export function adapterSeanceDuJour(seance: Seance | null, b: BilanMatin, acwr: number | null = null): Adaptation {
  const score = scoreForme(b);
  const raisons: string[] = [];
  const conseils: string[] = [];

  if (b.sommeil <= 2) raisons.push('Nuit difficile : la récupération n’est pas complète.');
  if (b.energie <= 2) raisons.push('Énergie basse ce matin.');
  if (b.jambes <= 2) raisons.push('Jambes lourdes ou courbatures marquées.');
  if (b.douleur >= 3) raisons.push(`Douleur à ${b.douleur}/10${b.zoneDouleur ? ` (${b.zoneDouleur})` : ''}.`);
  if (acwr !== null && acwr > 1.5) raisons.push(`Charge des 7 derniers jours très au-dessus de tes habitudes (ratio ${acwr.toLocaleString('fr-FR')}).`);

  // Pas de séance prévue : simple conseil du jour
  if (!seance) {
    conseils.push(score >= 55
      ? 'Jour sans course : 15 min de mobilité ou de gainage entretiennent ta forme.'
      : 'Jour sans course : profites-en pour récupérer vraiment. Marche, étirements doux, coucher tôt.');
    return { score, niveau: 'repos', seance: null, titre: 'Journée de récupération', raisons, conseils };
  }
  if (seance.type === 'course') {
    conseils.push('C’est le jour J : échauffe-toi 10 à 15 min, pars prudemment, bois et mange régulièrement.');
    if (b.douleur >= 5) conseils.push('Avec une douleur à ce niveau, demande l’avis d’un professionnel avant de prendre le départ.');
    return { score, niveau: 'maintenue', seance, titre: 'Jour de course : tout le travail est fait', raisons, conseils };
  }

  // 1. Douleur importante : repos
  if (b.douleur >= 5) {
    conseils.push('Ne cours pas aujourd’hui. Si la douleur persiste plus de 48 h ou augmente, consulte un professionnel de santé.');
    conseils.push('Glace 15 min, repos relatif, et note l’évolution demain matin.');
    return { score, niveau: 'repos', seance: null, titre: 'Repos aujourd’hui : on protège ton corps', raisons, conseils };
  }

  const qualite = estQualite(seance.type);
  const surcharge = acwr !== null && acwr > 1.5;

  // 2. Douleur modérée, forme très basse ou surcharge : séance remplacée par un footing court
  if (b.douleur >= 3 || score < 35 || (surcharge && qualite)) {
    const duree = Math.max(20, Math.min(35, Math.round(seance.dureeMin * 0.55)));
    const remplacee: Seance = {
      ...seance, type: 'footing_ef', dureeMin: duree, zonePrincipale: 2, rpePrevu: 3,
      dplusM: seance.dplusM ? Math.round(seance.dplusM * 0.4) : undefined,
      pourquoi: 'Séance remplacée par le moteur après ton bilan du matin : on entretient sans ajouter de fatigue.',
    };
    conseils.push('Cours au ressenti, très facilement. Si la douleur apparaît en courant, arrête-toi et marche.');
    if (qualite) conseils.push('La séance de qualité n’est pas rattrapée : la suite du plan reste cohérente.');
    return { score, niveau: 'remplacee', seance: remplacee, titre: `Séance remplacée par ${duree} min de footing facile`, raisons, conseils };
  }

  // 3. Forme moyenne : séance allégée
  if (score < 55 || surcharge) {
    const facteur = qualite ? 0.8 : 0.8;
    const allegee: Seance = {
      ...seance, dureeMin: Math.max(25, Math.round(seance.dureeMin * facteur)),
      dplusM: seance.dplusM ? Math.round(seance.dplusM * 0.8) : undefined,
      rpePrevu: Math.max(2, seance.rpePrevu - (qualite ? 1 : 0)),
      zonePrincipale: qualite && seance.zonePrincipale === 5 ? 4 : seance.zonePrincipale,
      pourquoi: `${seance.pourquoi} Allégée de 20 % après ton bilan du matin.`,
    };
    conseils.push(qualite
      ? 'Moins de répétitions et un cran d’intensité en dessous : la qualité d’exécution prime.'
      : 'Même séance, un peu plus courte. Reste vraiment facile.');
    return { score, niveau: 'allegee', seance: allegee, titre: 'Séance allégée de 20 %', raisons, conseils };
  }

  // 4. Bonne forme : séance maintenue
  if (score >= 75) conseils.push('Tout est au vert : fais la séance telle que prévue, sans en rajouter.');
  else conseils.push('Séance maintenue. Écoute tes sensations pendant l’échauffement.');
  return { score, niveau: 'maintenue', seance, titre: 'Séance maintenue', raisons, conseils };
}

// ─────────────────────────── Retour après séance ───────────────────────────

export interface Realise { dureeMin: number; rpe: number; douleur: number; dplusM?: number | null; distanceKm?: number | null }

export interface Analyse {
  verdict: 'reussie' | 'trop_dure' | 'trop_facile' | 'ecourtee' | 'prolongee' | 'alerte';
  titre: string;
  respect: number;               // 0 à 100 : fidélité au plan
  charge: number;                // ressenti × minutes
  recuperationH: number;         // délai conseillé avant la prochaine séance intense
  observations: string[];
  conseils: string[];
}

export function analyserSeance(prevue: Seance, r: Realise): Analyse {
  const ratio = r.dureeMin / Math.max(1, prevue.dureeMin);
  const ecartRpe = r.rpe - prevue.rpePrevu;
  const charge = r.rpe * r.dureeMin;
  const observations: string[] = [];
  const conseils: string[] = [];

  observations.push(`Durée : ${r.dureeMin} min pour ${prevue.dureeMin} prévues (${Math.round(ratio * 100)} %).`);
  observations.push(`Ressenti : ${r.rpe}/10 pour ${prevue.rpePrevu}/10 visé.`);
  if (prevue.dplusM && r.dplusM != null) observations.push(`Dénivelé : ${r.dplusM} m pour ${prevue.dplusM} m prévus.`);
  if (r.distanceKm && r.dureeMin) {
    const allure = r.dureeMin / r.distanceKm;
    observations.push(`Allure moyenne : ${Math.floor(allure)}:${String(Math.round((allure % 1) * 60)).padStart(2, '0')} /km.`);
  }

  // Respect du plan : durée (60 %) + ressenti (40 %)
  const respect = Math.max(0, Math.round(100 - Math.min(60, Math.abs(1 - ratio) * 120) - Math.min(40, Math.abs(ecartRpe) * 12)));

  // Récupération : base selon intensité et charge
  const recuperationH = Math.round(Math.min(72, 12 + charge / 12 + (r.rpe >= 8 ? 12 : 0)) / 6) * 6;

  let verdict: Analyse['verdict'] = 'reussie';
  let titre = 'Séance réussie, exactement ce qu’il fallait';

  if (r.douleur >= 5) {
    verdict = 'alerte'; titre = 'Douleur signalée : on lève le pied';
    conseils.push('Pas d’intensité tant que la douleur n’est pas redescendue sous 3/10. Le bilan de demain matin adaptera ta séance.');
    conseils.push('Si la douleur dure plus de 48 h, consulte un professionnel de santé.');
  } else if (ratio < 0.75) {
    verdict = 'ecourtee'; titre = 'Séance écourtée';
    conseils.push('Pas de rattrapage : la prochaine séance reste telle que prévue. Si ça se répète, le bilan de fin de semaine ajustera le volume.');
  } else if (ecartRpe >= 2) {
    verdict = 'trop_dure'; titre = 'Plus dur que prévu';
    conseils.push(estQualite(prevue.type)
      ? 'Sur la prochaine séance de qualité, pars un cran plus lentement : la régularité des répétitions compte plus que la vitesse.'
      : 'Une séance facile doit rester facile : ralentis, marche dans les côtes, quitte à voir une allure qui te paraît lente.');
    conseils.push('Soigne ta récupération ce soir : hydratation, repas complet, sommeil.');
  } else if (ecartRpe <= -2 && estQualite(prevue.type)) {
    verdict = 'trop_facile'; titre = 'Plus facile que prévu';
    conseils.push('Bon signe de progression. Garde la même allure la prochaine fois : si ça se confirme, le bilan hebdomadaire augmentera la charge.');
  } else if (ratio > 1.25) {
    verdict = 'prolongee'; titre = 'Séance prolongée';
    conseils.push('Attention à ne pas en faire plus que prévu : le volume progresse déjà de façon calculée semaine après semaine.');
  } else {
    conseils.push(estQualite(prevue.type)
      ? 'Séance de qualité bien gérée. Les 24 prochaines heures sont faites pour assimiler : reste facile demain.'
      : 'Endurance bien respectée : c’est ce travail facile qui construit ton moteur.');
  }
  if (r.douleur >= 3 && r.douleur < 5) conseils.push(`Douleur à ${r.douleur}/10 : surveille-la demain matin dans ton bilan.`);
  if (r.dureeMin >= 90) conseils.push('Sortie longue : recharge-toi dans l’heure (glucides + protéines) et bois régulièrement ce soir.');

  return { verdict, titre, respect, charge, recuperationH, observations, conseils };
}
