'use client';

import { useEffect, useRef, useState } from 'react';
import type { Jour } from '@/lib/tendances';

type Cle = 'forme' | 'sommeilH' | 'fcRepos' | 'vfc' | 'respiration' | 'charge';
interface Def { cle: Cle; titre: string; unite: string; forme: 'ligne' | 'barres'; reference?: number | null; refLibelle?: string; min?: number; max?: number; decimales?: number }

const G = 40; const D = 10; const H = 92;
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmt = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d });

function Panneau({ def, jours, L, survol }: { def: Def; jours: Jour[]; L: number; survol: number | null }) {
  const vals = jours.map((j) => j[def.cle]);
  const ok = vals.filter((v): v is number => v != null && (def.cle !== 'charge' || v > 0));
  if (ok.length < 2) return null;
  let min = def.min ?? Math.min(...ok, def.reference ?? Infinity);
  let max = def.max ?? Math.max(...ok, def.reference ?? -Infinity);
  if (def.forme === 'barres') min = 0;
  if (def.min == null && def.forme === 'ligne') { const m = (max - min) * 0.15 || 1; min -= m; max += m; }
  const n = jours.length; const pasX = (L - G - D) / n;
  const X = (i: number) => G + pasX * (i + 0.5);
  const Y = (v: number) => 6 + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min || 1)) * (H - 14);
  let d = ''; let debut = true;
  vals.forEach((v, i) => { if (v == null) { debut = true; return; } d += `${debut ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; debut = false; });
  const larg = Math.max(2, Math.min(14, pasX - 2));
  const dernier = def.cle === 'charge'
    ? vals.slice(-7).reduce<number>((t, v) => t + (v ?? 0), 0)
    : [...vals].reverse().find((v) => v != null);
  return (
    <div className="tf-panneau">
      <div className="tf-entete">
        <span className="tf-titre">{def.titre}</span>
        {dernier != null && <span className="tf-dernier">{def.cle === 'charge' ? `7 derniers jours : ${fmt(dernier)} pts` : `${fmt(dernier, def.decimales)} ${def.unite}`}</span>}
      </div>
      <svg width={L} height={H} viewBox={`0 0 ${L} ${H}`} role="img" aria-label={`${def.titre} sur ${n} jours`}>
        <line x1={G} x2={L - D} y1={H - 8} y2={H - 8} className="tf-base" />
        {[min, max].map((g) => <text key={g} x={G - 6} y={Y(g) + 4} textAnchor="end" className="tf-axe">{fmt(g, def.decimales && max - min < 5 ? 1 : 0)}</text>)}
        {def.reference != null && (
          <>
            <line x1={G} x2={L - D} y1={Y(def.reference)} y2={Y(def.reference)} className="tf-ref" />
            <text x={L - D} y={Y(def.reference) - 4} textAnchor="end" className="tf-ref-txt">{def.refLibelle} {fmt(def.reference, def.decimales)}</text>
          </>
        )}
        {def.forme === 'barres'
          ? vals.map((v, i) => v != null && v > 0 && (
            <rect key={i} x={X(i) - larg / 2} y={Y(v)} width={larg} height={Math.max(1, H - 8 - Y(v))} rx={Math.min(3, larg / 2)}
              className={survol === i ? 'tf-barre actif' : 'tf-barre'} />
          ))
          : <>
            <path d={d} className="tf-ligne" />
            {vals.map((v, i) => v != null && <circle key={i} cx={X(i)} cy={Y(v)} r={survol === i ? 4.5 : 2.2} className="tf-point" />)}
          </>}
        {survol != null && <line x1={X(survol)} x2={X(survol)} y1={0} y2={H - 8} className="tf-curseur" />}
      </svg>
    </div>
  );
}

export default function TendancesForme({ jours, refs }: { jours: Jour[]; refs: { fcRepos: number | null; vfc: number | null; respiration: number | null } }) {
  const zone = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(640);
  const [survol, setSurvol] = useState<number | null>(null);
  useEffect(() => {
    const el = zone.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setL(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const defs: Def[] = [
    { cle: 'forme', titre: 'Forme du matin', unite: '/100', forme: 'ligne', min: 0, max: 100 },
    { cle: 'sommeilH', titre: 'Sommeil', unite: 'h', forme: 'barres', reference: 7.5, refLibelle: 'objectif', decimales: 1 },
    { cle: 'fcRepos', titre: 'FC au repos', unite: 'bpm', forme: 'ligne', reference: refs.fcRepos, refLibelle: 'ta normale' },
    { cle: 'vfc', titre: 'VFC nocturne', unite: 'ms', forme: 'ligne', reference: refs.vfc, refLibelle: 'ta normale' },
    { cle: 'respiration', titre: 'Respiration nocturne', unite: '/min', forme: 'ligne', reference: refs.respiration, refLibelle: 'ta normale', decimales: 1 },
    { cle: 'charge', titre: 'Charge d’entraînement', unite: 'pts', forme: 'barres' },
  ];

  const bouger = (clientX: number) => {
    const r = zone.current?.getBoundingClientRect(); if (!r) return;
    const i = Math.floor(((clientX - r.left - G) / (L - G - D)) * jours.length);
    setSurvol(i >= 0 && i < jours.length ? i : null);
  };
  const j = survol != null ? jours[survol] : null;

  return (
    <div className="tf" ref={zone} onPointerMove={(e) => bouger(e.clientX)} onPointerLeave={() => setSurvol(null)}>
      <div className="tf-infobulle" data-visible={j ? 'oui' : 'non'} aria-live="polite">
        {j && <>
          <b>{fmtDate(j.date)}</b>
          {j.forme != null && <span>forme {j.forme}</span>}
          {j.sommeilH != null && <span>{fmt(j.sommeilH, 1)} h</span>}
          {j.fcRepos != null && <span>FC {j.fcRepos}</span>}
          {j.vfc != null && <span>VFC {j.vfc}</span>}
          {j.charge > 0 && <span>charge {j.charge}</span>}
        </>}
      </div>
      {defs.map((d) => <Panneau key={d.cle} def={d} jours={jours} L={L} survol={survol} />)}
      <div className="tf-dates" style={{ paddingLeft: G, paddingRight: D }}>
        <span>{fmtDate(jours[0].date)}</span><span>aujourd’hui</span>
      </div>
    </div>
  );
}
