'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { IcSync } from '@/components/Icones';
import type { Fournisseur } from '@/lib/types';
import { deconnecter, synchroniser } from './actions';

export function BoutonSynchro() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [msg, setMsg] = useState('');
  return (
    <div className="row" style={{ gap: 12 }}>
      <button className="btn btn-primary" disabled={enCours} onClick={() => demarrer(async () => {
        const r = await synchroniser();
        setMsg(r.erreur ?? (r.importees ? `${r.importees} sortie${r.importees > 1 ? 's' : ''} importée${r.importees > 1 ? 's' : ''} et rattachée${r.importees > 1 ? 's' : ''} à ton plan.` : 'Tout est déjà à jour.'));
        router.refresh();
      })}><span className={enCours ? 'tourne' : ''}><IcSync /></span> {enCours ? 'Synchronisation…' : 'Synchroniser maintenant'}</button>
      {msg && <span className="small muted" role="status">{msg}</span>}
    </div>
  );
}

export function BoutonDeconnecter({ fournisseur }: { fournisseur: Fournisseur }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => {
      if (!confirm('Déconnecter ce compte ? Monotrace n’y aura plus accès.')) return;
      const effacer = confirm('Supprimer aussi les sorties importées depuis ce service ?\n\nOK : elles sont effacées de ton journal.\nAnnuler : elles restent dans ton journal.');
      demarrer(async () => { await deconnecter(fournisseur, effacer); router.refresh(); });
    }}>Déconnecter</button>
  );
}

export function CopierLien({ url }: { url: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="copier">
      <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Adresse du calendrier" />
      <button className="btn btn-ghost btn-s" onClick={() => { navigator.clipboard?.writeText(url.replace('webcal://', 'https://')); setCopie(true); setTimeout(() => setCopie(false), 2000); }}>{copie ? 'Copié ✓' : 'Copier'}</button>
    </div>
  );
}
