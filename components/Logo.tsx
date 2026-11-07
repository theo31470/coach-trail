import Link from 'next/link';

/**
 * Identité Monotrace : une seule trace en M, du point de départ (anneau) au sommet (point + halo),
 * avec les crêtes en filigrane derrière. Trois tons :
 *  - clair : trace bleu nuit sur fond blanc ;
 *  - nuit  : trace blanche, départ et sommet glacier, sur bleu nuit ;
 *  - bleu  : trace blanche sur le bleu de marque (icône d'app, dossard).
 */
export type TonMarque = 'clair' | 'nuit' | 'bleu';

/** Le symbole seul (viewBox 120 × 120, coordonnées de la planche). Couleurs dans alpin.css (.symbole.ton-*). */
export function Symbole({ taille = 36, ton = 'clair', fantomes = true, halo = true, className }: {
  taille?: number; ton?: TonMarque; fantomes?: boolean; halo?: boolean; className?: string;
}) {
  return (
    <svg className={`symbole ton-${ton}${className ? ` ${className}` : ''}`} width={taille} height={taille} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {fantomes && (
        <g className="s-fantome" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 104 40 78 52 104" />
          <path d="M57 104 79.5 56 101 104" />
          <path d="M69 104 79.5 80 90 104" />
        </g>
      )}
      <path className="s-trace" d="M10 104 40 36 60 66 80 22 110 104" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {halo && <circle className="s-halo" cx="80" cy="22" r="11" strokeWidth="2.6" />}
      <circle className="s-sommet" cx="80" cy="22" r="6" />
      <circle className="s-depart" cx="10" cy="104" r="5.5" strokeWidth="3.2" />
    </svg>
  );
}

/** Pastille d'app : la trace blanche sur le bleu de marque. */
export function Marque({ taille = 32 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="marque-fond" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3D7BFF" />
          <stop offset=".5" stopColor="#1D5BFF" />
          <stop offset="1" stopColor="#0F3BD1" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="30" fill="url(#marque-fond)" />
      <g transform="translate(18 16) scale(.7)">
        <g stroke="#6C98FF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M57 104 79.5 56 101 104" />
        </g>
        <path d="M10 104 40 36 60 66 80 22 110 104" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="80" cy="22" r="13" fill="none" stroke="#BFE9FF" strokeOpacity=".55" strokeWidth="3" />
        <circle cx="80" cy="22" r="7.5" fill="#7DD3FC" />
        <circle cx="10" cy="104" r="7" fill="#1D5BFF" stroke="#fff" strokeWidth="4" />
      </g>
    </svg>
  );
}

/** Le mot-marque : « mono » appuyé, « trace » léger et bleu. */
export function MotMarque({ className }: { className?: string }) {
  return (
    <span className={`mot-marque${className ? ` ${className}` : ''}`}>
      <b>mono</b><span>trace</span>
    </span>
  );
}

export default function Logo({ href = '/', ton = 'clair', suffixe }: { href?: string; ton?: TonMarque; suffixe?: string }) {
  return (
    <Link href={href} className={`logo logo-${ton}`} aria-label={`Monotrace${suffixe ? ` ${suffixe}` : ''}, accueil`}>
      <Symbole taille={34} ton={ton} />
      <MotMarque />
      {suffixe && <em className="logo-suffixe">{suffixe}</em>}
    </Link>
  );
}
