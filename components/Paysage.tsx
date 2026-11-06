/**
 * Paysage alpin calculé (aucune image) : crêtes bleutées, sommets enneigés,
 * et au premier plan le profil d'altitude d'un trail de 30 km avec ses repères.
 */

const L = 1440;
const H = 620;

function hasard(graine: number) {
  let a = graine;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ligne de crête : somme d'ondes « en arête » pour des sommets pointus. */
function crete(graine: number, base: number, amplitude: number, frequence: number) {
  const r = hasard(graine);
  const ondes = [1, 2.3, 5.1, 11.3].map((f, i) => ({ f: f * frequence, p: r() * Math.PI * 2, a: [1, 0.42, 0.14, 0.05][i] }));
  const pts: string[] = [];
  for (let i = 0; i <= 144; i++) {
    const x = (i / 144) * L;
    const t = x / L;
    const h = ondes.reduce((s, o) => s + o.a * Math.pow(1 - Math.abs(Math.sin(t * Math.PI * o.f + o.p)), 2.4), 0) / 1.61;
    pts.push(`${x.toFixed(0)} ${(base - h * amplitude).toFixed(1)}`);
  }
  return `M0 ${H}L${pts.join('L')}L${L} ${H}Z`;
}

const COUCHES = [
  { d: crete(11, 360, 260, 1.1), fill: '#D3E2FF', neige: 200 },
  { d: crete(23, 400, 230, 1.5), fill: '#AFC8FF', neige: 245 },
  { d: crete(37, 445, 200, 1.9), fill: '#7FA2F5', neige: 300 },
  { d: crete(53, 492, 170, 2.4), fill: '#4E78E6', neige: 0 },
  { d: crete(71, 540, 140, 3.0), fill: '#2649BE', neige: 0 },
];

const PROFIL: [number, number][] = [[0, 320], [2, 380], [4, 540], [6, 790], [8, 1040], [9, 1170], [10, 1240], [11, 1150], [13, 900], [15, 700], [16, 650], [18, 830], [20, 1080], [21, 1340], [22, 1290], [24, 1010], [26, 760], [28, 520], [30, 340]];
const x = (km: number) => (km / 30) * L;
const y = (alt: number) => H - 28 - ((alt - 280) / 1100) * 150;
const LIGNE = PROFIL.map(([k, a], i) => `${i ? 'L' : 'M'}${x(k).toFixed(1)} ${y(a).toFixed(1)}`).join('');
const REPERES = [
  { km: 0, alt: 320, nom: 'Départ', ancre: 'start' as const, dx: 28 },
  { km: 10, alt: 1240, nom: 'Col · km 10', ancre: 'middle' as const, dx: 0 },
  { km: 16, alt: 650, nom: 'Ravito · km 16', ancre: 'middle' as const, dx: 0 },
  { km: 21, alt: 1340, nom: 'Sommet · km 21', ancre: 'middle' as const, dx: 0 },
  { km: 30, alt: 340, nom: 'Arrivée', ancre: 'end' as const, dx: -28 },
];

export default function Paysage() {
  return (
    <svg className="paysage" viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" />
          <stop offset=".4" stopColor="#E3EEFF" stopOpacity=".55" />
          <stop offset="1" stopColor="#CFE0FF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="neige" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {COUCHES.map((c, i) => <clipPath key={i} id={`crete-${i}`}><path d={c.d} /></clipPath>)}
      </defs>
      <g className="soleil">
        <circle cx="1040" cy="210" r="240" fill="url(#halo)" />
        <circle cx="1040" cy="210" r="46" fill="#FFFFFF" />
      </g>
      {COUCHES.map((c, i) => (
        <g key={i} className="couche" style={{ '--i': i } as React.CSSProperties}>
          <path d={c.d} fill={c.fill} />
          {c.neige > 0 && <rect x="0" y="0" width={L} height={c.neige} fill="url(#neige)" clipPath={`url(#crete-${i})`} opacity={0.95 - i * 0.12} />}
        </g>
      ))}
      <g className="couche" style={{ '--i': 5 } as React.CSSProperties}>
        <path d={`${LIGNE}L${L} ${H}L0 ${H}Z`} fill="#0A1A3F" />
        <path className="trace-course" d={LIGNE} fill="none" stroke="#7DD3FC" strokeWidth="2.5" strokeDasharray="10 7" strokeLinejoin="round" />
        {REPERES.map((r, k) => (
          <g key={r.nom} className="repere" style={{ '--i': k } as React.CSSProperties}>
            <circle cx={x(r.km) + r.dx} cy={y(r.alt)} r="6" fill="#0A1A3F" stroke="#7DD3FC" strokeWidth="3" />
            <text x={x(r.km) + r.dx} y={y(r.alt) - 32} textAnchor={r.ancre}>{r.nom}</text>
            <text className="alt" x={x(r.km) + r.dx} y={y(r.alt) - 15} textAnchor={r.ancre}>{r.alt.toLocaleString('fr-FR')} m</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
