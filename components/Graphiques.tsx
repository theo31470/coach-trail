/** Graphiques SVG légers, sans dépendance, lisibles en clair comme en sombre. */

export interface Barre { libelle: string; valeur: number; valeur2?: number; couleur?: string; titre?: string }

/** Barres verticales, avec une seconde série optionnelle (ex. prévu / réalisé). */
export function Barres({
  donnees, hauteur = 200, unite = '', legende, couleur = 'var(--forest-2)', couleur2 = 'var(--aube)', marque, largeur = 720,
}: {
  donnees: Barre[]; hauteur?: number; unite?: string; legende?: [string, string]; couleur?: string; couleur2?: string; marque?: number; largeur?: number;
}) {
  const gauche = 40;
  const bas = 26;
  const max = Math.max(1, ...donnees.map((d) => Math.max(d.valeur, d.valeur2 ?? 0)));
  const entiers = donnees.every((d) => Number.isInteger(d.valeur) && Number.isInteger(d.valeur2 ?? 0));
  const pas = entiers ? Math.max(1, niceStep(max)) : niceStep(max);
  const haut = Math.ceil(max / pas) * pas;
  const graduations = Array.from({ length: Math.round(haut / pas) + 1 }, (_, i) => i * pas);
  const zone = largeur - gauche - 8;
  const bande = zone / Math.max(1, donnees.length);
  const double = donnees.some((d) => d.valeur2 !== undefined);
  const lb = Math.min(28, bande * (double ? 0.36 : 0.62));
  const y = (v: number) => 8 + (hauteur - bas - 8) * (1 - v / haut);
  const pasLibelle = Math.ceil(donnees.length / (largeur < 600 ? 7 : 14));
  return (
    <div>
      {legende && (
        <div className="row tiny" style={{ marginBottom: 8, gap: 16 }}>
          <span className="row" style={{ gap: 6 }}><i className="point" style={{ background: couleur, borderRadius: 3 }} />{legende[0]}</span>
          <span className="row" style={{ gap: 6 }}><i className="point" style={{ background: couleur2, borderRadius: 3 }} />{legende[1]}</span>
        </div>
      )}
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} width="100%" role="img" aria-label={legende ? legende.join(' et ') : 'Graphique en barres'}>
        {graduations.map((g) => (
          <g key={g}>
            <line x1={gauche} x2={largeur - 8} y1={y(g)} y2={y(g)} stroke="var(--line)" />
            <text x={gauche - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{g.toLocaleString('fr-FR')}{unite}</text>
          </g>
        ))}
        {donnees.map((d, i) => {
          const cx = gauche + i * bande + bande / 2;
          const actuel = marque === i;
          return (
            <g key={i} className="gr-barre" style={{ '--i': i } as React.CSSProperties}>
              <rect x={double ? cx - lb - 1 : cx - lb / 2} y={y(d.valeur)} width={lb} height={Math.max(0, y(0) - y(d.valeur))} rx="3"
                fill={d.couleur ?? couleur} opacity={marque !== undefined && !actuel ? 0.75 : 1}>
                <title>{d.titre ?? `${d.libelle} : ${d.valeur}${unite}`}</title>
              </rect>
              {double && (
                <rect x={cx + 1} y={y(d.valeur2 ?? 0)} width={lb} height={Math.max(0, y(0) - y(d.valeur2 ?? 0))} rx="3" fill={couleur2}>
                  <title>{`${d.libelle} : ${d.valeur2 ?? 0}${unite}`}</title>
                </rect>
              )}
              {i % pasLibelle === 0 && (
                <text x={cx} y={hauteur - 8} textAnchor="middle" fontSize="11" fontWeight={actuel ? 700 : 400} fill={actuel ? 'var(--ink)' : 'var(--ink-3)'}>{d.libelle}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Courbe simple avec zone de référence optionnelle (ex. ACWR entre 0,8 et 1,3). */
export function Courbe({
  points, hauteur = 180, bande, min = 0, max: maxForce, format = (v: number) => String(v), largeur = 720,
}: {
  points: { libelle: string; valeur: number | null }[]; hauteur?: number; bande?: [number, number]; min?: number; max?: number; format?: (v: number) => string; largeur?: number;
}) {
  const gauche = 40;
  const bas = 26;
  const valeurs = points.map((p) => p.valeur).filter((v): v is number => v !== null);
  const max = maxForce ?? Math.max(1, ...valeurs, bande?.[1] ?? 0) * 1.1;
  const x = (i: number) => gauche + (i + 0.5) * ((largeur - gauche - 8) / Math.max(1, points.length));
  const y = (v: number) => 8 + (hauteur - bas - 8) * (1 - (v - min) / (max - min));
  let d = '';
  points.forEach((p, i) => { if (p.valeur !== null) d += `${d && points[i - 1]?.valeur !== null ? 'L' : 'M'}${x(i)} ${y(p.valeur)}`; });
  const pasLibelle = Math.ceil(points.length / (largeur < 600 ? 7 : 14));
  const ticks = [min, (min + max) / 2, max];
  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} width="100%" role="img" aria-label="Courbe">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={gauche} x2={largeur - 8} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={gauche - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{format(Math.round(t * 10) / 10)}</text>
        </g>
      ))}
      {bande && <rect x={gauche} width={largeur - gauche - 8} y={y(bande[1])} height={y(bande[0]) - y(bande[1])} fill="var(--ok-soft)" />}
      <path className="gr-courbe" pathLength={1} d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => p.valeur !== null && (
        <circle key={i} className="gr-point" style={{ '--i': i } as React.CSSProperties} cx={x(i)} cy={y(p.valeur)} r="3.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2">
          <title>{`${p.libelle} : ${format(p.valeur)}`}</title>
        </circle>
      ))}
      {points.map((p, i) => i % pasLibelle === 0 && (
        <text key={`l${i}`} x={x(i)} y={hauteur - 8} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{p.libelle}</text>
      ))}
    </svg>
  );
}

/** Répartition en barres horizontales avec pourcentage. */
export function Repartition({ elements, couleur = 'var(--forest-2)' }: { elements: { libelle: string; valeur: number; couleur?: string }[]; couleur?: string }) {
  const total = elements.reduce((t, e) => t + e.valeur, 0);
  if (!total) return <p className="tiny">Pas encore de données.</p>;
  return (
    <div className="stack-s">
      {elements.map((e) => (
        <div key={e.libelle}>
          <div className="row between small"><span>{e.libelle}</span><span className="muted">{e.valeur} · {Math.round((e.valeur / total) * 100)} %</span></div>
          <div className="barre-prog mt-8"><span className="remplit" style={{ width: `${(e.valeur / total) * 100}%`, background: e.couleur ?? couleur }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Anneau de progression. */
export function Anneau({ pct, taille = 120, libelle, sous }: { pct: number; taille?: number; libelle: string; sous?: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" role="img" aria-label={`${libelle} ${sous ?? ''}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="12" />
      <circle className="gr-anneau" style={{ '--c': c } as React.CSSProperties} cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y={sous ? 60 : 66} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink)">{libelle}</text>
      {sous && <text x="60" y="80" textAnchor="middle" fontSize="11" fill="var(--ink-3)">{sous}</text>}
    </svg>
  );
}

function niceStep(max: number) {
  const brut = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(brut)));
  const n = brut / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
