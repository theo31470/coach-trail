'use client';

import { useEffect, useState } from 'react';
import { abonnerNotifications, desabonnerNotifications } from '@/app/app/actions';
import { IcCloche, IcTelephone } from './Icones';

const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function versUint8(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

/** Enregistre le service worker (app installable, hors ligne, notifications). */
export function EnregistrerSW() {
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  return null;
}

/** Interrupteur des notifications push (rappel du matin). */
export function Notifications() {
  const [etat, setEtat] = useState<'chargement' | 'indisponible' | 'ios' | 'refuse' | 'actif' | 'inactif'>('chargement');
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad/i.test(navigator.userAgent);
      const installee = window.matchMedia('(display-mode: standalone)').matches;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !cle) { setEtat(ios && !installee ? 'ios' : 'indisponible'); return; }
      if (Notification.permission === 'denied') { setEtat('refuse'); return; }
      const reg = await navigator.serviceWorker.ready;
      setEtat((await reg.pushManager.getSubscription()) ? 'actif' : 'inactif');
    })().catch(() => setEtat('indisponible'));
  }, []);

  const basculer = async () => {
    setOccupe(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existant = await reg.pushManager.getSubscription();
      if (existant) { await desabonnerNotifications(existant.endpoint); await existant.unsubscribe(); setEtat('inactif'); return; }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setEtat('refuse'); return; }
      const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versUint8(cle!) });
      const j = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const r = await abonnerNotifications(j);
      setEtat(r.erreur ? 'inactif' : 'actif');
    } finally { setOccupe(false); }
  };

  return (
    <div className="reglage-ligne">
      <span className="reglage-icone"><IcCloche /></span>
      <div className="grow">
        <b>Notifications du matin</b>
        <p className="small muted">
          {etat === 'actif' && 'Activées sur cet appareil : séance du jour et rappel du bilan chaque matin.'}
          {etat === 'inactif' && 'Reçois chaque matin ta séance du jour et le rappel de ton bilan.'}
          {etat === 'refuse' && 'Les notifications sont bloquées dans les réglages de ton navigateur.'}
          {etat === 'ios' && 'Sur iPhone, installe d’abord l’app sur ton écran d’accueil, puis active les notifications depuis l’app.'}
          {etat === 'indisponible' && 'Non disponibles sur ce navigateur.'}
          {etat === 'chargement' && '…'}
        </p>
      </div>
      {(etat === 'actif' || etat === 'inactif') && (
        <button className={`interrupteur-btn${etat === 'actif' ? ' on' : ''}`} role="switch" aria-checked={etat === 'actif'} disabled={occupe} onClick={basculer} aria-label="Notifications du matin"><i /></button>
      )}
    </div>
  );
}

/** Invitation à installer l'app sur l'écran d'accueil. */
export function InstallerApp() {
  const [invite, setInvite] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const [mode, setMode] = useState<'installee' | 'android' | 'ios' | 'autre'>('autre');
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) { setMode('installee'); return; }
    if (/iphone|ipad/i.test(navigator.userAgent)) setMode('ios');
    const f = (e: Event) => { e.preventDefault(); setInvite(e as Event & { prompt: () => Promise<void> }); setMode('android'); };
    window.addEventListener('beforeinstallprompt', f);
    return () => window.removeEventListener('beforeinstallprompt', f);
  }, []);
  return (
    <div className="reglage-ligne">
      <span className="reglage-icone"><IcTelephone /></span>
      <div className="grow">
        <b>L’app sur ton téléphone</b>
        <p className="small muted">
          {mode === 'installee' && 'Installée : tu utilises Monotrace en plein écran.'}
          {mode === 'android' && 'Installe Monotrace sur ton écran d’accueil, en plein écran comme une app.'}
          {mode === 'ios' && 'Dans Safari : touche le bouton Partager, puis « Sur l’écran d’accueil ».'}
          {mode === 'autre' && 'Ouvre monotrace.fr sur ton téléphone puis ajoute-le à l’écran d’accueil depuis le menu du navigateur.'}
        </p>
      </div>
      {mode === 'android' && invite && <button className="btn btn-primary btn-s" onClick={() => invite.prompt()}>Installer</button>}
    </div>
  );
}
