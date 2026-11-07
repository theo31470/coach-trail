/**
 * Connexions aux montres et applis (OAuth 2).
 * Chaque fournisseur s'active dès que ses identifiants sont posés dans les variables d'environnement :
 *  - Strava, Polar : inscription développeur libre et gratuite ;
 *  - Garmin, Coros : programmes partenaires, gratuits après agrément de l'entreprise.
 * Apple Santé n'a pas d'accès web : il passe par Strava ou par la future app iPhone.
 */
import type { Seance, Zone } from './moteur-entrainement';
import type { DetailSeance } from './seance-detail';
import type { Fournisseur } from './types';

export interface Activite {
  sourceId: string;
  date: string;          // AAAA-MM-JJ (heure locale)
  dureeMin: number;
  distanceKm: number | null;
  dplusM: number | null;
  fcMoyenne: number | null;
  nom: string | null;
}

interface Jetons { access_token: string; refresh_token?: string | null; expire_le?: string | null; compte_externe?: string | null }

export interface ConfigFournisseur {
  id: Fournisseur;
  nom: string;
  couleur: string;
  description: string;
  capacites: { importer: boolean; envoyer: boolean };
  agrement: boolean;     // nécessite un programme partenaire
  pkce?: boolean;
  scope?: string;
  urlAutorisation?: string;
  clientId?: string;
  clientSecret?: string;
}

const env = (k: string) => process.env[k] || undefined;

export const FOURNISSEURS: Record<Exclude<Fournisseur, 'suunto'>, ConfigFournisseur> = {
  garmin: {
    id: 'garmin', nom: 'Garmin Connect', couleur: '#007CC3',
    description: 'Tes séances arrivent dans le calendrier Garmin Connect puis sur ta montre, avec chaque bloc et sa cible.',
    capacites: { importer: false, envoyer: true }, agrement: true, pkce: true,
    urlAutorisation: 'https://connect.garmin.com/oauth2Confirm',
    clientId: env('GARMIN_CLIENT_ID'), clientSecret: env('GARMIN_CLIENT_SECRET'),
  },
  coros: {
    id: 'coros', nom: 'COROS', couleur: '#111111',
    description: 'Séances structurées envoyées vers l’app COROS et ta montre, activités récupérées après chaque sortie.',
    capacites: { importer: true, envoyer: true }, agrement: true,
    urlAutorisation: env('COROS_AUTH_URL'),
    clientId: env('COROS_CLIENT_ID'), clientSecret: env('COROS_CLIENT_SECRET'),
  },
  polar: {
    id: 'polar', nom: 'Polar Flow', couleur: '#D10027',
    description: 'Tes sorties enregistrées avec ta Polar remontent automatiquement dans Monotrace.',
    capacites: { importer: true, envoyer: false }, agrement: false, scope: 'accesslink.read_all',
    urlAutorisation: 'https://flow.polar.com/oauth2/authorization',
    clientId: env('POLAR_CLIENT_ID'), clientSecret: env('POLAR_CLIENT_SECRET'),
  },
  strava: {
    id: 'strava', nom: 'Strava', couleur: '#FC4C02',
    description: 'Récupère toutes tes sorties, y compris celles d’une Apple Watch, Suunto ou d’un téléphone.',
    capacites: { importer: true, envoyer: false }, agrement: false, scope: 'activity:read_all',
    urlAutorisation: 'https://www.strava.com/oauth/authorize',
    clientId: env('STRAVA_CLIENT_ID'), clientSecret: env('STRAVA_CLIENT_SECRET'),
  },
};

export const estActif = (f: ConfigFournisseur) => Boolean(f.clientId && f.clientSecret && f.urlAutorisation);

export function urlAutorisation(f: ConfigFournisseur, redirection: string, etat: string, defi?: string) {
  const u = new URL(f.urlAutorisation!);
  u.searchParams.set('client_id', f.clientId!);
  u.searchParams.set('redirect_uri', redirection);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', etat);
  if (f.scope) u.searchParams.set('scope', f.scope);
  if (f.id === 'strava') u.searchParams.set('approval_prompt', 'auto');
  if (defi) { u.searchParams.set('code_challenge', defi); u.searchParams.set('code_challenge_method', 'S256'); }
  return u.toString();
}

// ───────────── Échange du code contre des jetons ─────────────

export async function echangerCode(f: ConfigFournisseur, code: string, redirection: string, verificateur?: string): Promise<Jetons> {
  if (f.id === 'strava') {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: f.clientId, client_secret: f.clientSecret, code, grant_type: 'authorization_code' }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message ?? 'Strava a refusé la connexion');
    return { access_token: j.access_token, refresh_token: j.refresh_token, expire_le: new Date(j.expires_at * 1000).toISOString(), compte_externe: String(j.athlete?.id ?? '') };
  }
  if (f.id === 'polar') {
    const r = await fetch('https://polarremote.com/v2/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json;charset=UTF-8', Authorization: `Basic ${Buffer.from(`${f.clientId}:${f.clientSecret}`).toString('base64')}` },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirection }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Polar a refusé la connexion');
    return { access_token: j.access_token, compte_externe: String(j.x_user_id ?? ''), expire_le: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null };
  }
  if (f.id === 'garmin') {
    const r = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: f.clientId!, client_secret: f.clientSecret!, code, code_verifier: verificateur ?? '', redirect_uri: redirection }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Garmin a refusé la connexion');
    return { access_token: j.access_token, refresh_token: j.refresh_token, expire_le: new Date(Date.now() + (j.expires_in ?? 86400) * 1000).toISOString() };
  }
  // COROS : point d'échange fourni avec la documentation partenaire
  const url = env('COROS_TOKEN_URL');
  if (!url) throw new Error('COROS n’est pas encore activé');
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: f.clientId!, client_secret: f.clientSecret!, code, redirect_uri: redirection }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('COROS a refusé la connexion');
  return { access_token: j.access_token, refresh_token: j.refresh_token, expire_le: j.expires_in ? new Date(Date.now() + j.expires_in * 1000).toISOString() : null, compte_externe: j.openId ?? null };
}

/** Polar exige d'enregistrer l'utilisateur une fois après l'autorisation. */
export async function apresConnexion(f: ConfigFournisseur, jetons: Jetons, userId: string) {
  if (f.id !== 'polar') return;
  const r = await fetch('https://www.polaraccesslink.com/v3/users', {
    method: 'POST', headers: { Authorization: `Bearer ${jetons.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ 'member-id': userId }),
  });
  if (!r.ok && r.status !== 409) throw new Error('Enregistrement Polar impossible');
}

/** Renouvelle un jeton Strava expiré. Renvoie les nouveaux jetons, ou null s'il est encore valide. */
export async function rafraichir(f: ConfigFournisseur, j: Jetons): Promise<Jetons | null> {
  if (!j.expire_le || new Date(j.expire_le).getTime() > Date.now() + 120_000 || !j.refresh_token) return null;
  if (f.id === 'strava') {
    const r = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: f.clientId, client_secret: f.clientSecret, refresh_token: j.refresh_token, grant_type: 'refresh_token' }),
    });
    const n = await r.json();
    if (!r.ok) throw new Error('Reconnecte Strava');
    return { access_token: n.access_token, refresh_token: n.refresh_token, expire_le: new Date(n.expires_at * 1000).toISOString() };
  }
  if (f.id === 'garmin') {
    const r = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: f.clientId!, client_secret: f.clientSecret!, refresh_token: j.refresh_token }),
    });
    const n = await r.json();
    if (!r.ok) throw new Error('Reconnecte Garmin');
    return { access_token: n.access_token, refresh_token: n.refresh_token, expire_le: new Date(Date.now() + (n.expires_in ?? 86400) * 1000).toISOString() };
  }
  return null;
}

// ───────────── Import des activités ─────────────

const COURSE_STRAVA = ['Run', 'TrailRun', 'VirtualRun'];
const COURSE_POLAR = ['RUNNING', 'TRAIL_RUNNING', 'ROAD_RUNNING', 'TREADMILL_RUNNING', 'MOUNTAIN_RUNNING'];

/** « PT1H02M03S » → minutes. */
const dureeIso = (d: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(d ?? '');
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60 : 0;
};

export async function activitesRecentes(f: ConfigFournisseur, accessToken: string, depuis: Date): Promise<Activite[]> {
  if (f.id === 'strava') {
    const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=60&after=${Math.floor(depuis.getTime() / 1000)}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
    });
    if (!r.ok) throw new Error('Lecture Strava impossible');
    const liste = (await r.json()) as Array<Record<string, unknown>>;
    return liste.filter((a) => COURSE_STRAVA.includes(String(a.sport_type ?? a.type))).map((a) => ({
      sourceId: String(a.id), date: String(a.start_date_local).slice(0, 10),
      dureeMin: Math.round(Number(a.moving_time) / 60), distanceKm: a.distance ? Math.round(Number(a.distance) / 10) / 100 : null,
      dplusM: a.total_elevation_gain != null ? Math.round(Number(a.total_elevation_gain)) : null,
      fcMoyenne: a.average_heartrate ? Math.round(Number(a.average_heartrate)) : null, nom: (a.name as string) ?? null,
    }));
  }
  if (f.id === 'polar') {
    const r = await fetch('https://www.polaraccesslink.com/v3/exercises', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, cache: 'no-store',
    });
    if (!r.ok) throw new Error('Lecture Polar impossible');
    const liste = (await r.json()) as Array<Record<string, any>>;
    return liste.filter((a) => COURSE_POLAR.includes(String(a.sport)) && String(a.start_time) >= depuis.toISOString().slice(0, 10)).map((a) => ({
      sourceId: String(a.id), date: String(a.start_time).slice(0, 10), dureeMin: Math.round(dureeIso(a.duration)),
      distanceKm: a.distance ? Math.round(Number(a.distance) / 10) / 100 : null, dplusM: a.ascent != null ? Math.round(Number(a.ascent)) : null,
      fcMoyenne: a.heart_rate?.average ?? null, nom: null,
    }));
  }
  return []; // Garmin et COROS envoient leurs activités par notification (activé avec l'agrément)
}

// ───────────── Envoi d'une séance structurée (Garmin Training API) ─────────────


/**
 * Format « workout » de la Training API Garmin.
 * Les adresses et le schéma sont ceux de la documentation partenaire : à vérifier lors de l'agrément.
 */
export async function envoyerVersGarmin(accessToken: string, seance: Seance, detail: DetailSeance, zones: Zone[], pilotage: 'fc' | 'allure' | 'rpe') {
  let ordre = 0;
  const cible = (zone: number) => {
    const z = zones.find((x) => x.zone === zone);
    if (pilotage === 'fc' && z?.fc) return { targetType: 'HEART_RATE', targetValueLow: z.fc[0], targetValueHigh: z.fc[1] };
    if (pilotage === 'allure' && z?.allureMinKm) {
      const v = (t: string) => { const [m, s] = t.split(':').map(Number); return 1000 / (m * 60 + (s || 0)); };
      return { targetType: 'PACE', targetValueLow: v(z.allureMinKm[1]), targetValueHigh: v(z.allureMinKm[0]) };
    }
    return { targetType: 'OPEN' };
  };
  const INT: Record<string, string> = { echauffement: 'WARMUP', calme: 'COOLDOWN', recup: 'RECOVERY', effort: 'INTERVAL', continu: 'ACTIVE' };
  const steps = detail.blocs.map((b) => ({
    type: 'WorkoutStep', stepOrder: ++ordre, intensity: INT[b.type], description: b.consigne.slice(0, 500),
    durationType: 'TIME', durationValue: b.dureeSec, ...cible(b.zone),
  }));
  const corps = { workoutName: detail.titre.slice(0, 80), description: detail.resume, sport: 'RUNNING', workoutProvider: 'Monotrace', segments: [{ segmentOrder: 1, sport: 'RUNNING', steps }] };
  const r = await fetch('https://apis.garmin.com/workoutportal/workout/v2', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error('Garmin a refusé la séance');
  const { workoutId } = await r.json();
  const p = await fetch('https://apis.garmin.com/training-api/schedule/', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workoutId, date: seance.date }),
  });
  if (!p.ok) throw new Error('Séance créée mais non planifiée dans Garmin Connect');
}
