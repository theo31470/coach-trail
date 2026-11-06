'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { traiterAlerte } from '../actions';

export default function BoutonAlerte({ id, traitee }: { id: string; traitee: boolean }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <button className={`btn btn-s ${traitee ? 'btn-ghost' : 'btn-dark'}`} disabled={enCours}
      onClick={() => demarrer(async () => { await traiterAlerte(id, !traitee); router.refresh(); })}>
      {traitee ? 'Rouvrir' : 'Marquer traitée'}
    </button>
  );
}
