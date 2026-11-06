/** Courbes de niveau topographiques, calculées (aucune image). Couleur héritée (currentColor). */

interface Sommet { x: number; y: number; niveaux: number; pas: number; graine: number }

const SOMMETS: Sommet[] = [
  { x: 1120, y: 260, niveaux: 16, pas: 34, graine: 1.3 },
  { x: 260, y: 760, niveaux: 12, pas: 38, graine: 4.1 },
  { x: 720, y: 40, niveaux: 7, pas: 40, graine: 2.6 },
];

function anneau(s: Sommet, k: number) {
  const n = 48;
  const r0 = 18 + k * s.pas;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = r0 * (1 + 0.16 * Math.sin(3 * t + s.graine + k * 0.22) + 0.08 * Math.sin(5 * t - s.graine * 1.7 + k * 0.35) + 0.05 * Math.cos(2 * t + k * 0.5));
    pts.push([s.x + r * Math.cos(t) * 1.25, s.y + r * Math.sin(t) * 0.82]);
  }
  // Catmull-Rom fermée → courbes de Bézier
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

const CHEMINS = SOMMETS.flatMap((s) => Array.from({ length: s.niveaux }, (_, k) => ({ d: anneau(s, k), maitresse: k % 5 === 4 })));

export default function Topo({ className = 'topo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {CHEMINS.map((c, i) => (
        <path key={i} d={c.d} fill="none" stroke="currentColor" strokeWidth={c.maitresse ? 1.6 : 0.9} />
      ))}
    </svg>
  );
}
