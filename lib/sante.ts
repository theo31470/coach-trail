/**
 * Lecture des mesures de la montre par le moteur (règles fixes, pas d'IA) :
 * la nuit et la récupération du coureur, comparées à SES propres valeurs habituelles.
 *
 *  - Sommeil : score de la montre s'il existe, sinon durée → note de 1 à 5 (pré-remplit le bilan).
 *  - FC au repos : écart à la moyenne des 28 derniers jours. +4 à +6 bpm → −8 pts ; +7 bpm et plus → −18 pts.
 *  - VFC (variabilité cardiaque) nocturne : rapport à la moyenne des 28 derniers jours.
 *    < 85 % → −8 pts ; < 75 % → −16 pts ; ≥ 105 % → +3 pts.
 *  - Body Battery rechargée pendant la nuit : < 25 → −5 pts.
 *  Le total des pénalités est plafonné à −30 pts. Il faut au moins 5 jours de mesures pour comparer.
 */

export interface MesureSanteDb {
  id: string;
  user_id: string;
  date: string;
  source: string;
  sommeil_min: number | null;
  sommeil_profond_min: number | null;
  sommeil_paradoxal_min: number | null;
  sommeil_eveil_min: number | null;
  sommeil_score: number | null;
  fc_repos: number | null;
  vfc_ms: number | null;
  stress_moyen: number | null;
  body_battery_recharge: number | null;
  maj_le: string;
}

export type Tendance = 'mieux' | 'normal' | 'vigilance' | 'alerte';

export interface Indicateur { cle: string; libelle: string; valeur: string; detail?: string; tendance: Tendance }

export interface LectureMontre {
  date: string;
  points: number;                // ajustement du score de forme (−30 à +3)
  signaux: string[];             // phrases ajoutées aux raisons du moteur
  sommeilSuggere: number | null; // 1 à 5
  indicateurs: Indicateur[];
  joursReference: number;        // jours de mesures disponibles pour comparer
}

const JOURS_MIN = 5;

const moyenne = (v: (number | null | undefined)[]) => {
  const ok = v.filter((x): x is number => typeof x === 'number');
  return ok.length >= JOURS_MIN ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
};

export const dureeSommeil = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;

export function noteSommeil(m: Pick<MesureSanteDb, 'sommeil_score' | 'sommeil_min'>): number | null {
  if (m.sommeil_score != null) {
    const s = m.sommeil_score;
    return s >= 80 ? 5 : s >= 70 ? 4 : s >= 60 ? 3 : s >= 50 ? 2 : 1;
  }
  if (m.sommeil_min != null && m.sommeil_min > 0) {
    const h = m.sommeil_min / 60;
    return h >= 8 ? 5 : h >= 7 ? 4 : h >= 6 ? 3 : h >= 5 ? 2 : 1;
  }
  return null;
}

/**
 * `jour` = mesures de la nuit écoulée ; `historique` = mesures des jours précédents (hors `jour`).
 * Renvoie null s'il n'y a rien d'exploitable.
 */
export function lireMontre(jour: MesureSanteDb | null, historique: MesureSanteDb[]): LectureMontre | null {
  if (!jour) return null;
  const precedents = historique.filter((h) => h.date < jour.date).slice(0, 28);
  const refFc = moyenne(precedents.map((h) => h.fc_repos));
  const refVfc = moyenne(precedents.map((h) => h.vfc_ms));
  const signaux: string[] = [];
  const indicateurs: Indicateur[] = [];
  let points = 0;

  // Sommeil
  const sommeilSuggere = noteSommeil(jour);
  if (jour.sommeil_min != null || jour.sommeil_score != null) {
    const t: Tendance = sommeilSuggere == null ? 'normal' : sommeilSuggere >= 4 ? 'mieux' : sommeilSuggere === 3 ? 'normal' : sommeilSuggere === 2 ? 'vigilance' : 'alerte';
    const phases = jour.sommeil_profond_min != null ? `${jour.sommeil_profond_min} min profond` : '';
    indicateurs.push({
      cle: 'sommeil', libelle: 'Sommeil',
      valeur: jour.sommeil_min != null ? dureeSommeil(jour.sommeil_min) : `${jour.sommeil_score}/100`,
      detail: [jour.sommeil_score != null && jour.sommeil_min != null ? `score ${jour.sommeil_score}` : '', phases].filter(Boolean).join(' · ') || undefined,
      tendance: t,
    });
    if (sommeilSuggere != null && sommeilSuggere <= 2) signaux.push(`Ta montre a mesuré une nuit courte ou agitée (${jour.sommeil_min != null ? dureeSommeil(jour.sommeil_min) : `score ${jour.sommeil_score}`}).`);
  }

  // FC au repos
  if (jour.fc_repos != null) {
    const ecart = refFc != null ? Math.round(jour.fc_repos - refFc) : null;
    let t: Tendance = 'normal';
    if (ecart != null) {
      if (ecart >= 7) { points -= 18; t = 'alerte'; signaux.push(`FC au repos à ${jour.fc_repos} bpm, ${ecart} au-dessus de ta normale : fatigue marquée, stress ou début de maladie.`); }
      else if (ecart >= 4) { points -= 8; t = 'vigilance'; signaux.push(`FC au repos à ${jour.fc_repos} bpm, ${ecart} au-dessus de ta normale : récupération incomplète.`); }
      else if (ecart <= -2) t = 'mieux';
    }
    indicateurs.push({ cle: 'fc', libelle: 'FC au repos', valeur: `${jour.fc_repos} bpm`, detail: ecart == null ? 'référence en cours' : `${ecart > 0 ? '+' : ''}${ecart} vs ta normale`, tendance: t });
  }

  // VFC
  if (jour.vfc_ms != null) {
    const ratio = refVfc != null ? jour.vfc_ms / refVfc : null;
    let t: Tendance = 'normal';
    if (ratio != null) {
      if (ratio < 0.75) { points -= 16; t = 'alerte'; signaux.push(`Variabilité cardiaque à ${jour.vfc_ms} ms, ${Math.round((1 - ratio) * 100)} % sous ta normale : ton système nerveux n'a pas récupéré.`); }
      else if (ratio < 0.85) { points -= 8; t = 'vigilance'; signaux.push(`Variabilité cardiaque ${Math.round((1 - ratio) * 100)} % sous ta normale.`); }
      else if (ratio >= 1.05) { points += 3; t = 'mieux'; }
    }
    indicateurs.push({ cle: 'vfc', libelle: 'VFC nocturne', valeur: `${jour.vfc_ms} ms`, detail: ratio == null ? 'référence en cours' : `${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)} % vs ta normale`, tendance: t });
  }

  // Body Battery
  if (jour.body_battery_recharge != null) {
    const bb = jour.body_battery_recharge;
    if (bb < 25) { points -= 5; signaux.push(`Body Battery peu rechargée cette nuit (+${bb}).`); }
    indicateurs.push({ cle: 'bb', libelle: 'Body Battery', valeur: `+${bb}`, detail: 'rechargée cette nuit', tendance: bb >= 50 ? 'mieux' : bb >= 25 ? 'normal' : 'vigilance' });
  }

  if (!indicateurs.length) return null;
  const joursReference = Math.max(...[precedents.filter((h) => h.fc_repos != null).length, precedents.filter((h) => h.vfc_ms != null).length]);
  return { date: jour.date, points: Math.max(-30, points), signaux, sommeilSuggere, indicateurs, joursReference };
}
