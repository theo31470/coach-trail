'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalyseCourbes } from '@/lib/analyse-courbes';
import type { Echantillons } from '@/lib/garmin';

/** Zones cardiaques : une seule teinte, du clair (Z1) au foncé (Z5). */
const TEINTES_ZONES = ['#C9D9FF', '#8FB0FF', '#5585FF', '#1D5BFF', '#0A1A3F'];

const duree = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)} min`);
const allure = (v: number | null) => (v && v > 0.5 ? (() => { const s = 1000 / v; return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} /km`; })() : '–');

interface Point { x: number; t: number; alt: number | null; fc: number | null; v: number | null }

/** Réduit la série à ~500 points (moyenne par paquet) pour un tracé net et léger. */
function points(e: Echantillons): { pts: Point[]; enKm: boolean } {
  const enKm = e.d.length > 0 && e.d.some((x) => x != null && x > 0);
  const n = e.t.length; const paquet = Math.max(1, Math.ceil(n / 500));
  const pts: Point[] = [];
  const moy = (l: (number | null)[]) => { const ok = l.filter((x): x is number => x != null); return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null; };
  for (let i = 0; i < n; i += paquet) {
    const j = Math.min(n, i + paquet);
    pts.push({
      x: enKm ? (e.d[j - 1] ?? e.d[i] ?? 0) / 1000 : e.t[j - 1] / 60, t: e.t[j - 1],
      alt: e.alt.length ? moy(e.alt.slice(i, j)) : null, fc: e.fc.length ? moy(e.fc.slice(i, j)) : null,
      v: e.v.length ? moy(e.v.slice(Math.max(0, i - paquet * 3), j)) : null, // allure lissée sur ~4 paquets
    });
  }
  return { pts, enKm };
}

const G = 46; const D = 12; // marges gauche / droite (la largeur suit celle de l'écran)

function Panneau({ titre, pts, cle, hauteur, couleur, aire, inverse, format, survol, xMax, L }: {
  titre: string; pts: Point[]; cle: 'alt' | 'fc' | 'v'; hauteur: number; couleur: string; aire?: boolean; inverse?: boolean;
  format: (n: number) => string; survol: number | null; xMax: number; L: number;
}) {
  const vals = pts.map((p) => p[cle]).filter((x): x is number => x != null);
  if (vals.length < 5) return null;
  let min = Math.min(...vals); let max = Math.max(...vals);
  if (cle === 'v') { const tri = [...vals].sort((a, b) => a - b); min = tri[Math.floor(tri.length * 0.03)]; max = tri[Math.ceil(tri.length * 0.97) - 1]; }
  const marge = (max - min) * 0.08 || 1; min -= marge; max += marge;
  const X = (x: number) => G + (x / xMax) * (L - G - D);
  const Y = (v: number) => { const r = (Math.min(max, Math.max(min, v)) - min) / (max - min); return 8 + (inverse ? r : 1 - r) * (hauteur - 16); };
  let d = ''; let debut = true;
  for (const p of pts) { const v = p[cle]; if (v == null) { debut = true; continue; } d += `${debut ? 'M' : 'L'}${X(p.x).toFixed(1)} ${Y(v).toFixed(1)} `; debut = false; }
  const graduations = [min + marge, (min + max) / 2, max - marge];
  return (
    <div className="panneau">
      <p className="panneau-titre">{titre}</p>
      <svg viewBox={`0 0 ${L} ${hauteur}`} width={L} height={hauteur} role="img" aria-label={titre}>
        {graduations.map((g) => (
          <g key={g}>
            <line x1={G} x2={L - D} y1={Y(g)} y2={Y(g)} className="grille" />
            <text x={G - 6} y={Y(g) + 4} textAnchor="end" className="axe">{format(g)}</text>
          </g>
        ))}
        {aire && <path d={`${d} L${X(pts.at(-1)!.x)} ${hauteur - 8} L${X(pts[0].x)} ${hauteur - 8} Z`} fill={couleur} opacity=".14" />}
        <path d={d} fill="none" stroke={couleur} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {survol != null && pts[survol][cle] != null && (
          <>
            <line x1={X(pts[survol].x)} x2={X(pts[survol].x)} y1={0} y2={hauteur} className="curseur" />
            <circle cx={X(pts[survol].x)} cy={Y(pts[survol][cle]!)} r="4.5" fill={couleur} stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </div>
  );
}

/** Courbes et analyse détaillée d'une sortie reçue de la montre. */
export default function CourbesSeance({ echantillons, analyse }: { echantillons: Echantillons; analyse: AnalyseCourbes }) {
  const { pts, enKm } = useMemo(() => points(echantillons), [echantillons]);
  const [survol, setSurvol] = useState<number | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(640);
  useEffect(() => {
    const el = zone.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setL(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const xMax = pts.at(-1)?.x || 1;

  const bouger = (clientX: number) => {
    const r = zone.current?.getBoundingClientRect(); if (!r) return;
    const x = ((clientX - r.left) / r.width) * L;
    const cible = ((x - G) / (L - G - D)) * xMax;
    let best = 0; let ecart = Infinity;
    pts.forEach((p, i) => { const e = Math.abs(p.x - cible); if (e < ecart) { ecart = e; best = i; } });
    setSurvol(best);
  };
  const p = survol != null ? pts[survol] : null;

  return (
    <section className="courbes" aria-label="Analyse détaillée de ta sortie">
      <div className="courbes-tete">
        <h3>Analyse détaillée</h3>
        <p className="small muted">D’après les courbes de ta montre Garmin.</p>
      </div>

      <dl className="courbes-chiffres">
        {analyse.distanceKm != null && <div><dt>Distance</dt><dd>{analyse.distanceKm.toLocaleString('fr-FR')} km</dd></div>}
        <div><dt>Durée</dt><dd>{duree(analyse.dureeSec)}</dd></div>
        <div><dt>Dénivelé</dt><dd>+{analyse.dplus} / −{analyse.dmoins} m</dd></div>
        {analyse.fcMoy != null && <div><dt>FC moyenne</dt><dd>{analyse.fcMoy} bpm</dd></div>}
        {analyse.fcMax != null && <div><dt>FC max</dt><dd>{analyse.fcMax} bpm</dd></div>}
        {analyse.cadenceMoy != null && <div><dt>Cadence</dt><dd>{analyse.cadenceMoy} pas/min</dd></div>}
      </dl>

      {analyse.constats.length > 0 && (
        <ul className="courbes-constats">{analyse.constats.map((c) => <li key={c}>{c}</li>)}</ul>
      )}

      <div className="courbes-graphes" ref={zone}
        onPointerMove={(e) => bouger(e.clientX)} onPointerLeave={() => setSurvol(null)}>
        <div className="courbes-infobulle" aria-live="polite" data-visible={p ? 'oui' : 'non'}>
          {p && <>
            <b>{enKm ? `km ${p.x.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}` : duree(p.t)}</b>
            {p.alt != null && <span>{Math.round(p.alt)} m</span>}
            {p.fc != null && <span>{Math.round(p.fc)} bpm</span>}
            {p.v != null && <span>{allure(p.v)}</span>}
          </>}
        </div>
        <Panneau titre="Altitude" pts={pts} cle="alt" hauteur={110} couleur="#5585FF" aire format={(n) => `${Math.round(n)} m`} survol={survol} xMax={xMax} L={L} />
        <Panneau titre="Fréquence cardiaque" pts={pts} cle="fc" hauteur={110} couleur="#0A1A3F" format={(n) => `${Math.round(n)}`} survol={survol} xMax={xMax} L={L} />
        <Panneau titre="Allure" pts={pts} cle="v" hauteur={96} couleur="#1D5BFF" format={(n) => allure(n).replace(' /km', '')} survol={survol} xMax={xMax} L={L} />
        <p className="tiny muted courbes-axe">{enKm ? `0 → ${xMax.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `0 → ${Math.round(xMax)} min`}</p>
      </div>

      {analyse.zones.some((z) => z.sec > 0) && (
        <div className="courbes-bloc">
          <h4>Temps par zone cardiaque{analyse.cible ? ` · zone ${analyse.cible.zone} visée` : ''}</h4>
          <div className="zones-barre" role="img" aria-label={analyse.zones.map((z) => `Zone ${z.zone} ${z.pct} %`).join(', ')}>
            {analyse.zones.filter((z) => z.pct > 0).map((z) => (
              <span key={z.zone} style={{ flexGrow: z.pct, background: TEINTES_ZONES[z.zone - 1] }} title={`Zone ${z.zone} · ${duree(z.sec)}`} />
            ))}
          </div>
          <ul className="zones-legende">
            {analyse.zones.map((z) => (
              <li key={z.zone} className={analyse.cible?.zone === z.zone ? 'visee' : undefined}>
                <i style={{ background: TEINTES_ZONES[z.zone - 1] }} aria-hidden="true" />
                <span>Z{z.zone} · {z.nom}</span><b>{duree(z.sec)}</b><em>{z.pct} %</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analyse.montees.length > 0 && (
        <div className="courbes-bloc">
          <h4>Montées</h4>
          <div className="table-defile">
            <table className="table-courbes">
              <thead><tr><th>Où</th><th>D+</th><th>Pente</th><th>Durée</th><th title="Vitesse ascensionnelle">VAM</th><th>FC moy.</th></tr></thead>
              <tbody>
                {analyse.montees.map((m) => (
                  <tr key={m.debutKm}>
                    <td>km {m.debutKm.toLocaleString('fr-FR')} → {m.finKm.toLocaleString('fr-FR')}</td><td>{m.dplus} m</td><td>{m.pente} %</td>
                    <td>{duree(m.sec)}</td><td>{m.vam} m/h</td><td>{m.fc ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analyse.km.length > 0 && (
        <div className="courbes-bloc">
          <h4>Kilomètre par kilomètre</h4>
          <div className="table-defile">
            <table className="table-courbes">
              <thead><tr><th>Km</th><th>Allure</th><th>FC moy.</th><th>D+</th><th>D−</th></tr></thead>
              <tbody>
                {analyse.km.map((k) => (
                  <tr key={k.km}><td>{k.km}</td><td>{k.allure} /km</td><td>{k.fc ?? '–'}</td><td>{k.dplus} m</td><td>{k.dmoins} m</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
