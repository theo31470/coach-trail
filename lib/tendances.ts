/**
 * Tendances de forme sur plusieurs semaines (règles fixes, pas d'IA).
 * On compare toujours la moyenne des 7 derniers jours à celle des 28 jours d'avant :
 * ce sont les évolutions durables qui comptent, pas une nuit isolée.
 */
import { ajouterJoursIso } from './format';
import type { MesureSanteDb } from './sante';
import type { BilanMatinDb, SeanceRealiseeDb } from './types';

export interface Jour {
  date: string;
  forme: number | null;          // score du bilan du matin
  sommeilH: number | null;
  sommeilScore: number | null;
  fcRepos: number | null;
  vfc: number | null;
  respiration: number | null;
  charge: number;                // ressenti × minutes du jour
}

export interface Resume { cle: string; libelle: string; unite: string; recent: number | null; reference: number | null; ecart: number | null; mieuxSiHausse: boolean; decimales: number }
export interface Constat { ton: 'bien' | 'info' | 'vigilance' | 'alerte'; titre: string; texte: string }

const moy = (l: (number | null)[]) => { const ok = l.filter((x): x is number => x != null); return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null; };
const arr = (x: number | null, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

export function jours(depuis: string, jusqua: string, mesures: MesureSanteDb[], bilans: BilanMatinDb[], realisees: SeanceRealiseeDb[]): Jour[] {
  const m = new Map(mesures.map((x) => [x.date, x]));
  const b = new Map(bilans.map((x) => [x.date, x]));
  const out: Jour[] = [];
  for (let d = depuis; d <= jusqua; d = ajouterJoursIso(d, 1)) {
    const x = m.get(d);
    out.push({
      date: d,
      forme: b.get(d)?.adaptation?.score ?? b.get(d)?.score ?? null,
      sommeilH: x?.sommeil_min != null ? Math.round((x.sommeil_min / 60) * 10) / 10 : null,
      sommeilScore: x?.sommeil_score ?? null,
      fcRepos: x?.fc_repos ?? null,
      vfc: x?.vfc_ms ?? null,
      respiration: x?.respiration_nuit != null ? Number(x.respiration_nuit) : null,
      charge: realisees.filter((r) => r.date === d).reduce((t, r) => t + r.rpe * r.duree_min, 0),
    });
  }
  return out;
}

export function analyserTendances(j: Jour[]) {
  const recents = j.slice(-7);
  const avant = j.slice(-35, -7);
  const resume = (cle: keyof Jour, libelle: string, unite: string, mieuxSiHausse: boolean, decimales = 0): Resume => {
    const r = moy(recents.map((x) => x[cle] as number | null));
    const a = moy(avant.map((x) => x[cle] as number | null));
    const nbAvant = avant.filter((x) => x[cle] != null).length;
    const ref = nbAvant >= 5 ? a : null;
    return { cle, libelle, unite, recent: arr(r, decimales), reference: arr(ref, decimales), ecart: r != null && ref != null ? arr(r - ref, decimales) : null, mieuxSiHausse, decimales };
  };
  const resumes = [
    resume('forme', 'Forme du matin', '/100', true),
    resume('sommeilH', 'Sommeil', 'h', true, 1),
    resume('fcRepos', 'FC au repos', 'bpm', false),
    resume('vfc', 'VFC', 'ms', true),
    resume('respiration', 'Respiration', '/min', false, 1),
  ];
  const [, sommeil, fc, vfc, resp] = resumes;

  const chargeRecente = recents.reduce((t, x) => t + x.charge, 0);
  const chargeRef = avant.length >= 21 ? avant.reduce((t, x) => t + x.charge, 0) / (avant.length / 7) : null;
  const ratio = chargeRef && chargeRef > 0 ? Math.round((chargeRecente / chargeRef) * 100) / 100 : null;

  const constats: Constat[] = [];
  const fcHausse = fc.ecart != null && fc.ecart >= 3;
  const vfcBaisse = vfc.ecart != null && vfc.reference != null && vfc.ecart / vfc.reference <= -0.1;
  const vfcHausse = vfc.ecart != null && vfc.reference != null && vfc.ecart / vfc.reference >= 0.05;

  if ((fcHausse || vfcBaisse) && ratio != null && ratio > 1.3) {
    constats.push({ ton: 'alerte', titre: 'Ton corps encaisse mal la charge actuelle', texte: `Charge des 7 derniers jours à ${Math.round(ratio * 100)} % de ton habitude, avec ${fcHausse ? `une FC au repos en hausse de ${fc.ecart} bpm` : ''}${fcHausse && vfcBaisse ? ' et ' : ''}${vfcBaisse ? `une VFC en baisse de ${Math.abs(Math.round((vfc.ecart! / vfc.reference!) * 100))} %` : ''}. Le moteur allège tes prochaines séances ; garde au moins une vraie journée de repos cette semaine.` });
  } else if (fcHausse || vfcBaisse) {
    constats.push({ ton: 'vigilance', titre: 'Récupération en baisse', texte: `${fcHausse ? `FC au repos +${fc.ecart} bpm sur 7 jours. ` : ''}${vfcBaisse ? `VFC ${Math.round((vfc.ecart! / vfc.reference!) * 100)} % sous ta normale. ` : ''}Sans hausse de l'entraînement, cherche du côté du sommeil, du stress ou d'un début de maladie.` });
  } else if (vfcHausse && fc.ecart != null && fc.ecart <= 0) {
    constats.push({ ton: 'bien', titre: 'Ta forme progresse', texte: `VFC en hausse de ${Math.round((vfc.ecart! / vfc.reference!) * 100)} % et FC au repos stable ou en baisse : tu assimiles bien l'entraînement.` });
  }

  if (sommeil.recent != null && sommeil.recent < 7) {
    const dette = Math.round(recents.reduce((t, x) => t + (x.sommeilH != null ? Math.max(0, 7.5 - x.sommeilH) : 0), 0) * 10) / 10;
    constats.push({ ton: sommeil.recent < 6.3 ? 'alerte' : 'vigilance', titre: 'Dette de sommeil', texte: `${sommeil.recent.toLocaleString('fr-FR')} h par nuit en moyenne cette semaine : il te manque environ ${dette.toLocaleString('fr-FR')} h de sommeil sur 7 jours par rapport aux 7 h 30 conseillées chaque nuit. C'est le premier levier de performance : couche-toi 30 min plus tôt.` });
  } else if (sommeil.recent != null && sommeil.recent >= 7.5) {
    constats.push({ ton: 'bien', titre: 'Sommeil au rendez-vous', texte: `${sommeil.recent.toLocaleString('fr-FR')} h par nuit en moyenne cette semaine : idéal pour assimiler l'entraînement.` });
  }

  if (resp.ecart != null && resp.ecart >= 1) {
    constats.push({ ton: 'vigilance', titre: 'Respiration nocturne en hausse', texte: `+${resp.ecart.toLocaleString('fr-FR')} respiration par minute sur 7 jours. Si tu te sens patraque, privilégie le repos : c'est souvent le premier signe d'une infection.` });
  }

  if (ratio != null && ratio < 0.7 && !constats.some((c) => c.ton === 'alerte')) {
    constats.push({ ton: 'info', titre: 'Semaine plus légère', texte: `Charge à ${Math.round(ratio * 100)} % de ton habitude. Normal en semaine de récupération ou d'affûtage ; sinon, reprends progressivement.` });
  }

  const mesures = j.filter((x) => x.fcRepos != null || x.vfc != null || x.sommeilH != null).length;
  return { resumes, constats, charge: { recente: chargeRecente, reference: chargeRef, ratio }, joursMesures: mesures };
}
