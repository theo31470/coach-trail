/**
 * Analyse détaillée d'une sortie à partir des courbes de la montre (règles fixes, pas d'IA) :
 *  - temps passé dans chaque zone cardiaque du coureur ;
 *  - découpage kilomètre par kilomètre (temps, allure, FC, dénivelé) ;
 *  - montées détectées (≥ 40 m de dénivelé continu) avec vitesse ascensionnelle (VAM) et FC ;
 *  - dérive cardiaque (découplage allure / FC entre la 1re et la 2e moitié, sur le plat) ;
 *  - respect de l'intensité prévue : temps passé dans la zone visée.
 */
import type { Echantillons } from './garmin';
import type { Seance, Zone } from './moteur-entrainement';

export interface Kilometre { km: number; sec: number; allure: string; fc: number | null; dplus: number; dmoins: number }
export interface Montee { debutKm: number; finKm: number; dplus: number; sec: number; vam: number; pente: number; fc: number | null }
export interface AnalyseCourbes {
  dureeSec: number; distanceKm: number | null; dplus: number; dmoins: number;
  fcMoy: number | null; fcMax: number | null; cadenceMoy: number | null;
  zones: { zone: number; nom: string; sec: number; pct: number }[];
  km: Kilometre[];
  montees: Montee[];
  derive: { pct: number; verdict: 'stable' | 'legere' | 'marquee' } | null;
  cible: { zone: number; sec: number; pct: number } | null;
  constats: string[];
}

const allureTxt = (secParKm: number) => `${Math.floor(secParKm / 60)}:${String(Math.round(secParKm % 60)).padStart(2, '0')}`;

/** Altitude lissée (moyenne glissante) pour ne pas compter le bruit du capteur comme du dénivelé. */
function lisser(v: (number | null)[], fenetre: number): (number | null)[] {
  return v.map((_, i) => {
    let s = 0; let n = 0;
    for (let k = Math.max(0, i - fenetre); k <= Math.min(v.length - 1, i + fenetre); k++) { const x = v[k]; if (x != null) { s += x; n++; } }
    return n ? s / n : null;
  });
}

function denivele(alt: (number | null)[], seuil = 2) {
  let plus = 0; let moins = 0; let ref: number | null = null;
  for (const a of alt) {
    if (a == null) continue;
    if (ref == null) { ref = a; continue; }
    const d = a - ref;
    if (d >= seuil) { plus += d; ref = a; } else if (d <= -seuil) { moins -= d; ref = a; }
  }
  return { plus: Math.round(plus), moins: Math.round(moins) };
}

/** Distance cumulée : celle de la montre si elle existe, sinon intégrée depuis la vitesse. */
function distances(e: Echantillons): (number | null)[] {
  if (e.d.length && e.d.some((x) => x != null)) return e.d;
  if (!e.v.length) return [];
  let cumul = 0;
  return e.t.map((t, i) => { if (i > 0) cumul += (e.v[i] ?? 0) * (t - e.t[i - 1]); return Math.round(cumul); });
}

export function analyserCourbes(e: Echantillons, zones: Zone[], prevue?: Seance | null): AnalyseCourbes {
  const n = e.t.length;
  const dureeSec = n ? e.t[n - 1] : 0;
  const pas = n > 1 ? Math.max(1, Math.round(dureeSec / (n - 1))) : 1;
  const dist = distances(e);
  const distanceKm = dist.length ? (dist.filter((x) => x != null).at(-1) ?? 0) / 1000 : null;
  const alt = e.alt.length ? lisser(e.alt, Math.max(1, Math.round(15 / pas))) : [];
  const { plus: dplus, moins: dmoins } = alt.length ? denivele(alt) : { plus: 0, moins: 0 };
  const fcs = e.fc.filter((x): x is number => x != null && x > 30);
  const fcMoy = fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null;
  const fcMax = fcs.length ? Math.max(...fcs) : null;
  const cads = e.cad.filter((x): x is number => x != null && x > 60);
  const cadenceMoy = cads.length ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) * (cads[0] < 120 ? 2 : 1) : null;
  const constats: string[] = [];

  // Zones cardiaques
  const zonesFc = zones.filter((z) => z.fc);
  const tempsZone = new Map<number, number>();
  if (zonesFc.length && e.fc.length) {
    for (let i = 1; i < n; i++) {
      const fc = e.fc[i]; if (fc == null) continue;
      const z = zonesFc.find((x) => fc <= x.fc![1]) ?? zonesFc.at(-1)!;
      const zone = fc < zonesFc[0].fc![0] ? zonesFc[0] : z;
      tempsZone.set(zone.zone, (tempsZone.get(zone.zone) ?? 0) + (e.t[i] - e.t[i - 1]));
    }
  }
  const totalZones = [...tempsZone.values()].reduce((a, b) => a + b, 0) || 1;
  const zonesOut = zonesFc.map((z) => ({ zone: z.zone, nom: z.nom, sec: tempsZone.get(z.zone) ?? 0, pct: Math.round(((tempsZone.get(z.zone) ?? 0) / totalZones) * 100) }));

  // Kilomètres
  const km: Kilometre[] = [];
  if (dist.length) {
    let debut = 0; let prochain = 1000;
    for (let i = 1; i < n; i++) {
      const d = dist[i]; if (d == null || d < prochain) continue;
      const tranche = { from: debut, to: i };
      const fcT = e.fc.slice(tranche.from, tranche.to + 1).filter((x): x is number => x != null);
      const dn = alt.length ? denivele(alt.slice(tranche.from, tranche.to + 1)) : { plus: 0, moins: 0 };
      const sec = e.t[i] - e.t[debut];
      km.push({ km: km.length + 1, sec, allure: allureTxt(sec), fc: fcT.length ? Math.round(fcT.reduce((a, b) => a + b, 0) / fcT.length) : null, dplus: dn.plus, dmoins: dn.moins });
      debut = i; prochain += 1000;
    }
  }

  // Montées : portions où l'altitude lissée gagne ≥ 40 m sans redescendre de plus de 10 m
  const montees: Montee[] = [];
  if (alt.length && dist.length) {
    let i0 = 0; let bas = alt[0] ?? 0; let haut = bas; let iHaut = 0;
    for (let i = 1; i < n; i++) {
      const a = alt[i]; if (a == null) continue;
      if (a > haut) { haut = a; iHaut = i; }
      if (a < bas || haut - a > 10) {
        if (haut - bas >= 40) montees.push(monteeDe(i0, iHaut));
        i0 = i; bas = a; haut = a; iHaut = i;
      }
    }
    if (haut - bas >= 40) montees.push(monteeDe(i0, iHaut));
  }
  function monteeDe(a0: number, b: number): Montee {
    // le départ de la montée = dernier point encore à moins de 5 m de l'altitude de départ
    let a = a0;
    for (let k = a0; k < b; k++) if ((alt[k] ?? 0) <= (alt[a0] ?? 0) + 5) a = k;
    const dp = Math.round((alt[b] ?? 0) - (alt[a] ?? 0));
    const sec = e.t[b] - e.t[a];
    const longueur = Math.max(1, (dist[b] ?? 0) - (dist[a] ?? 0));
    const fcT = e.fc.slice(a, b + 1).filter((x): x is number => x != null);
    return {
      debutKm: Math.round((dist[a] ?? 0) / 100) / 10, finKm: Math.round((dist[b] ?? 0) / 100) / 10, dplus: dp, sec,
      vam: Math.round(dp / (sec / 3600)), pente: Math.round((dp / longueur) * 100),
      fc: fcT.length ? Math.round(fcT.reduce((x, y) => x + y, 0) / fcT.length) : null,
    };
  }

  // Dérive cardiaque : efficacité (vitesse / FC) sur les portions plates, 1re vs 2e moitié
  let derive: AnalyseCourbes['derive'] = null;
  if (dureeSec >= 40 * 60 && e.v.length && e.fc.length) {
    const ef = (from: number, to: number) => {
      let s = 0; let k = 0;
      for (let i = Math.max(1, from); i < to; i++) {
        const v = e.v[i]; const fc = e.fc[i];
        const pente = alt.length && dist.length && dist[i] != null && dist[i - 1] != null && (dist[i]! - dist[i - 1]!) > 0
          ? ((alt[i] ?? 0) - (alt[i - 1] ?? 0)) / (dist[i]! - dist[i - 1]!) : 0;
        if (v == null || fc == null || v < 1.2 || fc < 80 || Math.abs(pente) > 0.03) continue;
        s += v / fc; k++;
      }
      return k > 30 ? s / k : null;
    };
    const debutUtile = Math.round(n * 0.1); // on écarte l'échauffement
    const milieu = Math.round((debutUtile + n) / 2);
    const a = ef(debutUtile, milieu); const b = ef(milieu, n);
    if (a && b) {
      const pct = Math.round(((a - b) / a) * 1000) / 10;
      derive = { pct, verdict: pct < 5 ? 'stable' : pct < 10 ? 'legere' : 'marquee' };
      if (derive.verdict === 'stable') constats.push(`FC stable du début à la fin (dérive de ${pct.toLocaleString('fr-FR')} %) : ton endurance tient la durée.`);
      else if (derive.verdict === 'legere') constats.push(`Légère dérive cardiaque (${pct.toLocaleString('fr-FR')} %) : à allure égale, ton cœur a battu plus vite en 2e partie. Pense à boire et à partir un peu moins vite.`);
      else constats.push(`Dérive cardiaque marquée (${pct.toLocaleString('fr-FR')} %) : fatigue, chaleur ou manque d'hydratation. Ton endurance de base a encore de la marge de progression.`);
    }
  }

  // Intensité prévue
  let cible: AnalyseCourbes['cible'] = null;
  if (prevue && zonesFc.length) {
    const z = prevue.zonePrincipale;
    const sec = tempsZone.get(z) ?? 0;
    cible = { zone: z, sec, pct: Math.round((sec / totalZones) * 100) };
    const auDessus = zonesOut.filter((x) => x.zone > z).reduce((a, b) => a + b.sec, 0);
    if (z <= 2 && auDessus / totalZones > 0.25) constats.push(`Séance prévue en endurance, mais ${Math.round((auDessus / totalZones) * 100)} % du temps au-dessus de la zone ${z} : ralentis davantage, marche dans les côtes.`);
    else if (z >= 4 && sec < 4 * 60) constats.push(`Peu de temps dans la zone ${z} visée (${Math.round(sec / 60)} min) : les efforts étaient sans doute trop courts ou trop prudents.`);
    else if (z <= 2) constats.push(`Intensité bien maîtrisée : ${cible.pct} % du temps en zone ${z} ou en dessous, comme prévu.`);
  }

  if (montees.length) {
    const meilleure = [...montees].sort((a, b) => b.dplus - a.dplus)[0];
    constats.push(`${montees.length} montée${montees.length > 1 ? 's' : ''} ; la plus longue : ${meilleure.dplus} m à ${meilleure.pente} % en ${Math.round(meilleure.sec / 60)} min (${meilleure.vam} m/h).`);
  }
  if (km.length >= 3) {
    const plats = km.filter((k) => k.dplus < 15 && k.dmoins < 15);
    if (plats.length >= 3) {
      const t = plats.map((k) => k.sec); const ecart = Math.max(...t) - Math.min(...t);
      if (ecart <= 20) constats.push('Allure très régulière sur les kilomètres plats.');
    }
  }

  return { dureeSec, distanceKm: distanceKm != null ? Math.round(distanceKm * 100) / 100 : null, dplus, dmoins, fcMoy, fcMax, cadenceMoy, zones: zonesOut, km, montees, derive, cible, constats };
}
