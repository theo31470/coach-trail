'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface Lien { href: string; libelle: string; icone: ReactNode; exact?: boolean }

const actif = (chemin: string, l: Lien) => (l.exact ? chemin === l.href : chemin === l.href || chemin.startsWith(`${l.href}/`));

export function NavLaterale({ liens, sections }: { liens: Lien[]; sections?: { titre: string; liens: Lien[] }[] }) {
  const chemin = usePathname();
  return (
    <nav className="nav-app" aria-label="Navigation">
      {liens.map((l) => (
        <Link key={l.href} href={l.href} aria-current={actif(chemin, l) ? 'page' : undefined}>{l.icone}{l.libelle}</Link>
      ))}
      {sections?.map((s) => (
        <div key={s.titre}>
          <div className="sep">{s.titre}</div>
          {s.liens.map((l) => (
            <Link key={l.href} href={l.href} aria-current={actif(chemin, l) ? 'page' : undefined}>{l.icone}{l.libelle}</Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function OngletsBas({ liens }: { liens: Lien[] }) {
  const chemin = usePathname();
  return (
    <nav className="onglets-bas" aria-label="Navigation">
      {liens.map((l) => (
        <Link key={l.href} href={l.href} aria-current={actif(chemin, l) ? 'page' : undefined}>{l.icone}{l.libelle}</Link>
      ))}
    </nav>
  );
}
