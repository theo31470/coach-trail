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

export interface MesureGarmin {
  garminId: string; date: string;
  sommeil_min?: number | null; sommeil_profond_min?: number | null; sommeil_paradoxal_min?: number | null; sommeil_eveil_min?: number | null;
  sommeil_score?: number | null; fc_repos?: number | null; vfc_ms?: number | null; stress_moyen?: number | null; body_battery_recharge?: number | null;
}

export interface ActiviteGarmin {
  garminId: string; sourceId: string; date: string; nom: string | null; type: string;
  dureeMin: number; distanceKm: number | null; dplusM: number | null; fcMoyenne: number | null;
}

export interface PushGarmin { mesures: MesureGarmin[]; activites: ActiviteGarmin[]; deconnexions: string[] }

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
  }
  for (const h of liste(b.hrv)) {
    const m = mesure(h); if (!m) continue;
    m.vfc_ms = nombre(h.lastNightAvg);
  }

  const activites: ActiviteGarmin[] = [];
  for (const a of [...liste(b.activities), ...liste(b.manuallyUpdatedActivities)]) {
    const garminId = texte(a.userId); const debut = nombre(a.startTimeInSeconds); const duree = nombre(a.durationInSeconds);
    const type = texte(a.activityType) ?? '';
    const id = a.summaryId ?? a.activityId;
    if (!garminId || debut == null || !duree || !COURSE.test(type) || id == null) continue;
    const decalage = nombre(a.startTimeOffsetInSeconds) ?? 0;
    const distance = nombre(a.distanceInMeters);
    activites.push({
      garminId, sourceId: String(id).replace(/-detail$/, ''), type,
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

  return { mesures: [...parCle.values()], activites, deconnexions };
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
  return { mesures, seances, deconnexions: push.deconnexions };
}
