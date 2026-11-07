/**
 * Données envoyées par Garmin (Health API et Activity API, mode « push ») :
 * Garmin appelle notre adresse avec un JSON dont chaque clé est un type de résumé
 * (dailies, sleeps, hrv, stressDetails, activities, deregistrations, userPermissionsChange…),
 * chacun étant une liste d'éléments portant le `userId` Garmin.
 * La lecture est volontairement tolérante : un champ absent est simplement ignoré.
 */
import { createHash } from 'node:crypto';
import type { Plan } from './moteur-entrainement';

type Brut = Record<string, unknown>;
const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const texte = (v: unknown) => (typeof v === 'string' && v ? v : null);
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.filter((x): x is Brut => !!x && typeof x === 'object') : []);
const minutes = (s: unknown) => { const n = nombre(s); return n == null ? null : Math.round(n / 60); };
/** Valeurs d'une table « décalage → valeur » de Garmin (les valeurs négatives signifient « pas de mesure »). */
const valeursTable = (v: unknown) => (v && typeof v === 'object' ? Object.values(v as Record<string, unknown>).map(nombre).filter((x): x is number => x != null && x > 0) : []);
const moy = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const arrondi = (x: number | null, d = 0) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

/** Transforme une table « décalage (s) → valeur » en série régulière. */
function serie(table: unknown, pas: number): { cles: number[]; valeurs: Map<number, number | null> } {
  const out = new Map<number, number | null>();
  if (table && typeof table === 'object') for (const [k, v] of Object.entries(table as Record<string, unknown>)) {
    const o = Number(k); const n = nombre(v);
    if (Number.isFinite(o)) out.set(Math.round(o / pas) * pas, n != null && n >= 0 ? n : null);
  }
  return { cles: [...out.keys()].sort((a, b) => a - b), valeurs: out };
}

const PAS_MAX_POINTS = 3600;

/** Compacte les échantillons d'une sortie (un point toutes les 1 à 5 s selon la durée). */
export function compacter(samples: Brut[], debut: number): Echantillons {
  const tri = samples.map((x) => ({ x, t: (nombre(x.startTimeInSeconds) ?? 0) - debut })).filter((p) => p.t >= 0).sort((a, b) => a.t - b.t);
  const pas = Math.max(1, Math.ceil((tri.at(-1)?.t ?? 0) / PAS_MAX_POINTS));
  const e: Echantillons = { t: [], fc: [], v: [], alt: [], cad: [], pw: [], d: [] };
  let dernier = -Infinity;
  for (const { x, t } of tri) {
    if (t - dernier < pas) continue;
    dernier = t;
    e.t.push(t);
    e.fc.push(nombre(x.heartRate));
    const v = nombre(x.speedMetersPerSecond); e.v.push(v == null ? null : Math.round(v * 100) / 100);
    const a = nombre(x.elevationInMeters); e.alt.push(a == null ? null : Math.round(a * 10) / 10);
    const c = nombre(x.stepsPerMinute) ?? nombre(x.runCadence); e.cad.push(c == null ? null : Math.round(c));
    e.pw.push(nombre(x.powerInWatts));
    const d = nombre(x.totalDistanceInMeters); e.d.push(d == null ? null : Math.round(d));
  }
  for (const k of ['fc', 'v', 'alt', 'cad', 'pw', 'd'] as const) if (e[k].every((x) => x == null)) e[k] = [];
  return e;
}

export interface MesureGarmin {
  garminId: string; date: string;
  sommeil_min?: number | null; sommeil_profond_min?: number | null; sommeil_paradoxal_min?: number | null; sommeil_eveil_min?: number | null;
  sommeil_score?: number | null; fc_repos?: number | null; vfc_ms?: number | null; stress_moyen?: number | null; body_battery_recharge?: number | null;
  respiration_nuit?: number | null; spo2_moyen?: number | null; spo2_min?: number | null; temp_peau_ecart?: number | null; poids_kg?: number | null;
  courbe_stress?: CourbeStress | null;
}

/** Courbe de stress et de Body Battery d'une journée (valeurs toutes les 3 min environ). */
export interface CourbeStress { debut: number; pas: number; stress: (number | null)[]; bb: (number | null)[] }

/** Échantillons d'une sortie, compactés : temps (s depuis le départ), FC, vitesse (m/s), altitude (m), cadence (pas/min), puissance (W), distance (m). */
export interface Echantillons { t: number[]; fc: (number | null)[]; v: (number | null)[]; alt: (number | null)[]; cad: (number | null)[]; pw: (number | null)[]; d: (number | null)[] }

export interface CourbeGarmin { garminId: string; sourceId: string; date: string; resume: Record<string, unknown>; echantillons: Echantillons }

export interface ActiviteGarmin {
  garminId: string; sourceId: string; date: string; nom: string | null; type: string;
  dureeMin: number; distanceKm: number | null; dplusM: number | null; fcMoyenne: number | null;
}

export interface PushGarmin { mesures: MesureGarmin[]; activites: ActiviteGarmin[]; courbes: CourbeGarmin[]; deconnexions: string[] }

/** Jeton qui protège l'adresse de réception (dérivé du secret serveur, à coller dans le portail Garmin). */
export const jetonPush = (secret: string) => createHash('sha256').update(`${secret}:garmin-push`).digest('hex').slice(0, 32);

const COURSE = /RUN|TRAIL|TREADMILL|TRACK/i;

export function lirePush(corps: unknown): PushGarmin {
  const b = (corps && typeof corps === 'object' ? corps : {}) as Brut;
  const parCle = new Map<string, MesureGarmin>();
  const mesure = (x: Brut) => {
    const garminId = texte(x.userId); const date = texte(x.calendarDate);
    if (!garminId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const cle = `${garminId}|${date}`;
    if (!parCle.has(cle)) parCle.set(cle, { garminId, date });
    return parCle.get(cle)!;
  };

  for (const d of liste(b.dailies)) {
    const m = mesure(d); if (!m) continue;
    m.fc_repos = nombre(d.restingHeartRateInBeatsPerMinute) ?? m.fc_repos;
    const stress = nombre(d.averageStressLevel);
    m.stress_moyen = stress != null && stress >= 0 ? stress : m.stress_moyen;
    m.body_battery_recharge = nombre(d.bodyBatteryChargedValue) ?? m.body_battery_recharge;
  }
  for (const s of liste(b.sleeps)) {
    const m = mesure(s); if (!m) continue;
    m.sommeil_min = minutes(s.durationInSeconds);
    m.sommeil_profond_min = minutes(s.deepSleepDurationInSeconds);
    m.sommeil_paradoxal_min = minutes(s.remSleepInSeconds ?? s.remSleepDurationInSeconds);
    m.sommeil_eveil_min = minutes(s.awakeDurationInSeconds);
    const score = s.overallSleepScore as Brut | number | undefined;
    m.sommeil_score = typeof score === 'number' ? score : nombre((score as Brut | undefined)?.value);
    const resp = valeursTable(s.timeOffsetSleepRespiration);
    if (resp.length) m.respiration_nuit = arrondi(moy(resp), 1);
    const spo2 = valeursTable(s.timeOffsetSleepSpo2);
    if (spo2.length) { m.spo2_moyen = arrondi(moy(spo2)); m.spo2_min = Math.min(...spo2); }
  }
  for (const o of liste(b.pulseox)) {
    const m = mesure(o); if (!m || m.spo2_moyen != null) continue;
    const spo2 = valeursTable(o.timeOffsetSpo2Values);
    if (spo2.length) { m.spo2_moyen = arrondi(moy(spo2)); m.spo2_min = Math.min(...spo2); }
  }
  for (const t of [...liste(b.skinTemp), ...liste(b.skinTemperature)]) {
    const m = mesure(t); if (!m) continue;
    const e = nombre(t.avgDeviationCelsius) ?? nombre(t.averageDeviationCelsius);
    if (e != null) m.temp_peau_ecart = arrondi(e, 2);
  }
  for (const c of liste(b.bodyComps)) {
    const quand = nombre(c.measurementTimeInSeconds); const poids = nombre(c.weightInGrams);
    if (quand == null || poids == null || !texte(c.userId)) continue;
    const m = mesure({ ...c, calendarDate: new Date((quand + (nombre(c.measurementTimeOffsetInSeconds) ?? 0)) * 1000).toISOString().slice(0, 10) });
    if (m) m.poids_kg = arrondi(poids / 1000, 1);
  }
  for (const d of liste(b.stressDetails)) {
    const m = mesure(d); if (!m) continue;
    const debut = nombre(d.startTimeInSeconds) ?? 0;
    const st = serie(d.timeOffsetStressLevelValues, 180); const bb = serie(d.timeOffsetBodyBatteryValues, 180);
    const cles = [...new Set([...st.cles, ...bb.cles])].sort((x, y) => x - y);
    if (cles.length) {
      const pas = 180; const fin = cles.at(-1)!;
      const n = Math.floor(fin / pas) + 1;
      m.courbe_stress = {
        debut, pas,
        stress: Array.from({ length: n }, (_, k) => st.valeurs.get(k * pas) ?? null),
        bb: Array.from({ length: n }, (_, k) => bb.valeurs.get(k * pas) ?? null),
      };
    }
  }
  for (const h of liste(b.hrv)) {
    const m = mesure(h); if (!m) continue;
    m.vfc_ms = nombre(h.lastNightAvg);
  }

  const activites: ActiviteGarmin[] = [];
  const courbes: CourbeGarmin[] = [];
  const details = liste(b.activityDetails);
  const resumesDetails: Brut[] = details.map((x) => ({ ...((x.summary as Brut) ?? {}), userId: x.userId, summaryId: x.summaryId ?? (x.summary as Brut | undefined)?.summaryId, activityId: x.activityId }));
  for (const x of details) {
    const r = (x.summary as Brut) ?? {};
    const garminId = texte(x.userId); const debut = nombre(r.startTimeInSeconds); const id = x.summaryId ?? r.summaryId ?? x.activityId;
    const samples = liste(x.samples);
    if (!garminId || debut == null || id == null || !samples.length || !COURSE.test(texte(r.activityType) ?? '')) continue;
    const decalage = nombre(r.startTimeOffsetInSeconds) ?? 0;
    courbes.push({
      garminId, sourceId: String(id).replace(/-detail$/, ''),
      date: new Date((debut + decalage) * 1000).toISOString().slice(0, 10),
      resume: { type: r.activityType, nom: r.activityName ?? null, duree_s: r.durationInSeconds ?? null, distance_m: r.distanceInMeters ?? null,
        dplus_m: r.totalElevationGainInMeters ?? null, dmoins_m: r.totalElevationLossInMeters ?? null, fc_moy: r.averageHeartRateInBeatsPerMinute ?? null,
        fc_max: r.maxHeartRateInBeatsPerMinute ?? null, cadence_moy: r.averageRunCadenceInStepsPerMinute ?? null,
        tours: liste(x.laps).map((l) => (nombre(l.startTimeInSeconds) ?? debut) - debut) },
      echantillons: compacter(samples, debut),
    });
  }
  const vus = new Set<string>();
  for (const a of [...liste(b.activities), ...liste(b.manuallyUpdatedActivities), ...resumesDetails]) {
    const garminId = texte(a.userId); const debut = nombre(a.startTimeInSeconds); const duree = nombre(a.durationInSeconds);
    const type = texte(a.activityType) ?? '';
    const id = a.summaryId ?? a.activityId;
    if (!garminId || debut == null || !duree || !COURSE.test(type) || id == null) continue;
    const decalage = nombre(a.startTimeOffsetInSeconds) ?? 0;
    const distance = nombre(a.distanceInMeters);
    const sourceId = String(id).replace(/-detail$/, '');
    if (vus.has(`${garminId}|${sourceId}`)) continue;
    vus.add(`${garminId}|${sourceId}`);
    activites.push({
      garminId, sourceId, type,
      date: new Date((debut + decalage) * 1000).toISOString().slice(0, 10),
      nom: texte(a.activityName), dureeMin: Math.round(duree / 60),
      distanceKm: distance != null ? Math.round(distance / 10) / 100 : null,
      dplusM: (() => { const d = nombre(a.totalElevationGainInMeters); return d != null ? Math.round(d) : null; })(),
      fcMoyenne: nombre(a.averageHeartRateInBeatsPerMinute),
    });
  }

  const deconnexions = liste(b.deregistrations).map((d) => texte(d.userId)).filter((x): x is string => !!x);
  for (const p of liste(b.userPermissionsChange)) {
    const perms = Array.isArray(p.permissions) ? p.permissions : null;
    const id = texte(p.userId);
    if (id && perms && perms.length === 0) deconnexions.push(id);
  }

  return { mesures: [...parCle.values()], activites, courbes, deconnexions };
}

export interface CompteGarmin { garmin_id: string; user_id: string; plan_id: string | null; plan: Plan | null; faites: string[] }

/** Prépare les lignes à écrire : mesures et sorties rattachées au bon membre (et à la séance prévue ce jour-là). */
export function lignesAEcrire(push: PushGarmin, comptes: CompteGarmin[]) {
  const parId = new Map(comptes.map((c) => [c.garmin_id, c]));
  const mesures = push.mesures.flatMap(({ garminId, ...m }) => {
    const c = parId.get(garminId);
    return c ? [{ ...m, user_id: c.user_id }] : [];
  });
  const prises = new Set<string>();
  const seances = push.activites.flatMap((a) => {
    const c = parId.get(a.garminId);
    if (!c || a.dureeMin < 5) return [];
    const faites = new Set([...(c.faites ?? []), ...prises]);
    const prevue = c.plan?.semaines.flatMap((s) => s.seances).find((s) => s.date === a.date && s.type !== 'course' && !faites.has(s.id)) ?? null;
    if (prevue) prises.add(prevue.id);
    return [{
      user_id: c.user_id, plan_id: c.plan_id ?? '', seance_id: prevue?.id ?? '', type_prevu: prevue?.type ?? '',
      date: a.date, duree_min: Math.min(1440, a.dureeMin), distance_km: a.distanceKm, dplus_m: a.dplusM,
      rpe: prevue?.rpePrevu ?? 4, source_id: a.sourceId,
      commentaire: `Reçue de Garmin${a.nom ? ` · ${a.nom}` : ''}${a.fcMoyenne ? ` · FC moyenne ${a.fcMoyenne} bpm` : ''}. Pense à ajuster ton ressenti.`,
    }];
  });
  const courbes = push.courbes.flatMap(({ garminId, sourceId, date, resume, echantillons }) => {
    const c = parId.get(garminId);
    return c ? [{ user_id: c.user_id, source_id: sourceId, date, resume, echantillons }] : [];
  });
  return { mesures, seances, courbes, deconnexions: push.deconnexions };
}
