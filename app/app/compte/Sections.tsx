'use client';

import { InstallerApp, Notifications } from '@/components/AppMobile';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { JOURS, ABONNEMENTS, ajouterJoursIso, dateCourte, isoAujourdhui } from '@/lib/format';
import type { Jour, Niveau } from '@/lib/moteur-entrainement';
import { supabaseNavigateur } from '@/lib/supabase/client';
import type { ObjectifDb, Preferences, Profil } from '@/lib/types';
import { changerObjectif, deconnexion, exporterDonnees, majPreferences, majProfil, regenererPlan, supprimerCompte } from '../actions';
import type { Onglet } from './page';

interface Props { onglet: Onglet; profil: Profil; email: string; objectif: ObjectifDb | null; semainesPlan: number; nbSeances: number }

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const txt = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

function Bloc({ titre, description, children }: { titre: string; description?: string; children: ReactNode }) {
  return (
    <section className="carte stack">
      <div><h3>{titre}</h3>{description && <p className="small muted mt-8">{description}</p>}</div>
      {children}
    </section>
  );
}

function useEnregistrement() {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const lancer = (fn: () => Promise<{ erreur?: string } | void>, ok = 'Modifications enregistrées.') => {
    setMessage(null);
    demarrer(async () => {
      const r = await fn();
      if (r && r.erreur) setMessage({ ok: false, texte: r.erreur });
      else { setMessage({ ok: true, texte: ok }); router.refresh(); }
    });
  };
  const retour = message && <p className={`alerte ${message.ok ? 'alerte-ok' : 'alerte-danger'} small`} role="status">{message.texte}</p>;
  return { enCours, lancer, retour };
}

function Interrupteur({ titre, texte, coche, onChange }: { titre: string; texte?: string; coche: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="reglage">
      <div><b>{titre}</b>{texte && <p>{texte}</p>}</div>
      <label className="interrupteur"><input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} /><span /><b className="sr">{titre}</b></label>
    </div>
  );
}

export default function Sections(props: Props) {
  switch (props.onglet) {
    case 'profil': return <SectionProfil {...props} />;
    case 'physiologie': return <SectionPhysio {...props} />;
    case 'objectif': return <SectionObjectif {...props} />;
    case 'disponibilites': return <SectionDispos {...props} />;
    case 'preferences': return <SectionPreferences {...props} />;
    case 'appareils': return <SectionAppareils />;
    case 'abonnement': return <SectionAbonnement {...props} />;
    case 'confidentialite': return <SectionConfidentialite {...props} />;
    case 'securite': return <SectionSecurite {...props} />;
  }
}

function SectionProfil({ profil }: Props) {
  const { enCours, lancer, retour } = useEnregistrement();
  const [f, setF] = useState({ prenom: txt(profil.prenom), nom: txt(profil.nom), date_naissance: txt(profil.date_naissance), sexe: profil.sexe ?? '', ville: txt(profil.ville), niveau: profil.niveau });
  const maj = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Bloc titre="Profil" description="Ces informations restent privées.">
      <div className="grille">
        <label className="champ">Prénom<input value={f.prenom} onChange={(e) => maj('prenom', e.target.value)} /></label>
        <label className="champ">Nom<input value={f.nom} onChange={(e) => maj('nom', e.target.value)} /></label>
        <label className="champ">Date de naissance<input type="date" value={f.date_naissance} onChange={(e) => maj('date_naissance', e.target.value)} /></label>
        <label className="champ">Sexe
          <select value={f.sexe} onChange={(e) => maj('sexe', e.target.value)}>
            <option value="">Non précisé</option><option value="femme">Femme</option><option value="homme">Homme</option><option value="autre">Autre</option>
          </select>
        </label>
        <label className="champ">Ville<input value={f.ville} onChange={(e) => maj('ville', e.target.value)} /></label>
        <label className="champ">Niveau
          <select value={f.niveau} onChange={(e) => maj('niveau', e.target.value)}>
            <option value="debutant">Débutant</option><option value="intermediaire">Intermédiaire</option><option value="confirme">Confirmé</option>
          </select>
        </label>
      </div>
      {retour}
      <div><button className="btn btn-primary" disabled={enCours} onClick={() => lancer(() => majProfil({
        prenom: f.prenom.trim() || null, nom: f.nom.trim() || null, date_naissance: f.date_naissance || null,
        sexe: (f.sexe || null) as Profil['sexe'], ville: f.ville.trim() || null, niveau: f.niveau as Niveau,
      }))}>Enregistrer</button></div>
      <p className="tiny">Le niveau s’applique à ton prochain plan. Pour l’appliquer tout de suite, régénère ton plan depuis « Course objectif ».</p>
    </Bloc>
  );
}

function SectionPhysio({ profil }: Props) {
  const { enCours, lancer, retour } = useEnregistrement();
  const [f, setF] = useState({
    fc_max: txt(profil.fc_max), fc_repos: txt(profil.fc_repos), poids_kg: txt(profil.poids_kg), taille_cm: txt(profil.taille_cm),
    ref_distance_km: txt(profil.ref_distance_km), ref_temps_min: profil.ref_temps_min ? minutesVersTexte(Number(profil.ref_temps_min)) : '',
    volume_h: String(Math.round((profil.volume_actuel_min / 60) * 10) / 10), dplus: txt(profil.dplus_actuel_m), blessure: profil.blessure_recente,
  });
  const maj = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="stack">
      <Bloc titre="Fréquence cardiaque" description="Pour calculer tes zones cardiaques (méthode de Karvonen).">
        <div className="grille">
          <label className="champ">FC max (bpm)<input inputMode="numeric" value={f.fc_max} onChange={(e) => maj('fc_max', e.target.value)} /></label>
          <label className="champ">FC au repos (bpm) <span className="aide">mesurée au réveil</span><input inputMode="numeric" value={f.fc_repos} onChange={(e) => maj('fc_repos', e.target.value)} /></label>
        </div>
      </Bloc>
      <Bloc titre="Course de référence" description="Un chrono récent sur route, pour estimer ta VMA et tes allures.">
        <div className="grille">
          <label className="champ">Distance (km)<input inputMode="decimal" value={f.ref_distance_km} onChange={(e) => maj('ref_distance_km', e.target.value)} /></label>
          <label className="champ">Temps <span className="aide">ex. 48:30</span><input value={f.ref_temps_min} onChange={(e) => maj('ref_temps_min', e.target.value)} /></label>
        </div>
      </Bloc>
      <Bloc titre="Volume et morphologie">
        <div className="grille">
          <label className="champ">Heures de course par semaine<input inputMode="decimal" value={f.volume_h} onChange={(e) => maj('volume_h', e.target.value)} /></label>
          <label className="champ">D+ par semaine (m)<input inputMode="numeric" value={f.dplus} onChange={(e) => maj('dplus', e.target.value)} /></label>
          <label className="champ">Poids (kg) <span className="aide">facultatif</span><input inputMode="decimal" value={f.poids_kg} onChange={(e) => maj('poids_kg', e.target.value)} /></label>
          <label className="champ">Taille (cm) <span className="aide">facultatif</span><input inputMode="numeric" value={f.taille_cm} onChange={(e) => maj('taille_cm', e.target.value)} /></label>
        </div>
        <label className="case"><input type="checkbox" checked={f.blessure} onChange={(e) => maj('blessure', e.target.checked)} /><span>Blessure dans les 6 derniers mois (progression plus douce)</span></label>
      </Bloc>
      {retour}
      <div className="row">
        <button className="btn btn-primary" disabled={enCours} onClick={() => lancer(() => majProfil({
          fc_max: num(f.fc_max), fc_repos: num(f.fc_repos), poids_kg: num(f.poids_kg), taille_cm: num(f.taille_cm),
          ref_distance_km: f.ref_temps_min ? num(f.ref_distance_km) : null, ref_temps_min: texteVersMinutes(f.ref_temps_min),
          volume_actuel_min: Math.round((num(f.volume_h) ?? 0) * 60), dplus_actuel_m: num(f.dplus) ?? 0, blessure_recente: f.blessure,
        }))}>Enregistrer</button>
        <button className="btn btn-ghost" disabled={enCours} onClick={() => {
          if (confirm('Recalculer ton plan avec ces données ? Les séances déjà notées sont conservées.')) lancer(regenererPlan, 'Plan recalculé avec tes nouvelles données.');
        }}>Recalculer mon plan</button>
      </div>
    </div>
  );
}

function SectionObjectif({ objectif, semainesPlan }: Props) {
  const { enCours, lancer, retour } = useEnregistrement();
  const [f, setF] = useState({
    nom: objectif?.nom ?? '', type: objectif?.type ?? 'trail', distance: txt(objectif?.distance_km ?? 30), dplus: txt(objectif?.dplus_m ?? 1500),
    date: objectif?.date ?? ajouterJoursIso(isoAujourdhui(), 112),
  });
  const maj = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="stack">
      {objectif && (
        <Bloc titre="Course actuelle">
          <div className="row between">
            <div>
              <b style={{ fontSize: 18 }}>{objectif.nom || (objectif.type === 'trail' ? 'Trail' : 'Course sur route')}</b>
              <p className="small muted">{Number(objectif.distance_km)} km{objectif.dplus_m ? ` · ${objectif.dplus_m} m D+` : ''} · {dateCourte(objectif.date)} · plan de {semainesPlan} semaines</p>
            </div>
            <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => {
              if (confirm('Recalculer le plan à partir de lundi prochain ?')) lancer(regenererPlan, 'Plan recalculé.');
            }}>Recalculer le plan</button>
          </div>
        </Bloc>
      )}
      <Bloc titre="Nouvelle course objectif" description="Un nouveau plan sera généré à partir de lundi prochain. Ton historique de séances est conservé.">
        <div className="pastilles">
          {(['trail', 'route'] as const).map((t) => <button key={t} type="button" className="pastille" aria-pressed={f.type === t} onClick={() => maj('type', t)}>{t === 'trail' ? 'Trail' : 'Route'}</button>)}
        </div>
        <div className="grille">
          <label className="champ">Nom<input value={f.nom} onChange={(e) => maj('nom', e.target.value)} /></label>
          <label className="champ">Distance (km)<input inputMode="decimal" value={f.distance} onChange={(e) => maj('distance', e.target.value)} /></label>
          {f.type === 'trail' && <label className="champ">D+ (m)<input inputMode="numeric" value={f.dplus} onChange={(e) => maj('dplus', e.target.value)} /></label>}
          <label className="champ">Date<input type="date" value={f.date} onChange={(e) => maj('date', e.target.value)} /></label>
        </div>
        {retour}
        <div><button className="btn btn-primary" disabled={enCours} onClick={() => {
          if (f.date <= ajouterJoursIso(isoAujourdhui(), 13)) return alert('La course doit être dans au moins deux semaines.');
          if (!confirm('Remplacer ton plan actuel par un nouveau plan ?')) return;
          lancer(() => changerObjectif({ nom: f.nom.trim(), type: f.type as 'trail' | 'route', distance_km: num(f.distance) ?? 0, dplus_m: num(f.dplus) ?? 0, date: f.date }), 'Nouveau plan généré.');
        }}>Générer le nouveau plan</button></div>
      </Bloc>
    </div>
  );
}

function SectionDispos({ profil }: Props) {
  const { enCours, lancer, retour } = useEnregistrement();
  const [jours, setJours] = useState<Jour[]>(profil.jours_dispo);
  const [longue, setLongue] = useState<Jour>(profil.jour_longue);
  return (
    <Bloc titre="Jours d’entraînement" description="Le plan place tes séances sur ces jours, sans jamais enchaîner deux séances dures.">
      <div className="pastilles">
        {JOURS.map((j) => (
          <button key={j.id} type="button" className="pastille" aria-pressed={jours.includes(j.id)} onClick={() => {
            const n = jours.includes(j.id) ? jours.filter((x) => x !== j.id) : [...jours, j.id];
            setJours(n);
            if (!n.includes(longue) && n.length) setLongue(n.at(-1)!);
          }}>{j.long}</button>
        ))}
      </div>
      <label className="champ" style={{ maxWidth: 300 }}>Jour de sortie longue
        <select value={longue} onChange={(e) => setLongue(e.target.value as Jour)}>
          {JOURS.filter((j) => jours.includes(j.id)).map((j) => <option key={j.id} value={j.id}>{j.long}</option>)}
        </select>
      </label>
      {retour}
      <div className="row">
        <button className="btn btn-primary" disabled={enCours || jours.length < 2} onClick={() => lancer(async () => {
          const r = await majProfil({ jours_dispo: jours, jour_longue: longue });
          if (r.erreur) return r;
          return regenererPlan();
        }, 'Disponibilités enregistrées, plan recalculé à partir de lundi.')}>Enregistrer et recalculer</button>
      </div>
    </Bloc>
  );
}

function SectionPreferences({ profil }: Props) {
  const { lancer, retour } = useEnregistrement();
  const [p, setP] = useState<Preferences>({
    theme: 'systeme', unites: 'km', pilotage: 'rpe', son_lecteur: true, vibration_lecteur: true,
    notif_seance: true, notif_bilan: true, notif_conseils: false, rappel_heure: '07:30', ...profil.preferences,
  });
  const maj = <K extends keyof Preferences>(k: K, v: Preferences[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    lancer(() => majPreferences({ [k]: v }), 'Préférence enregistrée.');
  };
  return (
    <div className="stack">
      <Bloc titre="Affichage">
        <div className="reglage"><div><b>Thème</b><p>Clair, sombre ou selon ton appareil.</p></div>
          <select style={{ width: 'auto' }} value={p.theme} onChange={(e) => maj('theme', e.target.value as Preferences['theme'])}>
            <option value="systeme">Système</option><option value="clair">Clair</option><option value="sombre">Sombre</option>
          </select>
        </div>
        <div className="reglage"><div><b>Unités</b><p>Distances et allures.</p></div>
          <select style={{ width: 'auto' }} value={p.unites} onChange={(e) => maj('unites', e.target.value as Preferences['unites'])}>
            <option value="km">Kilomètres</option><option value="mi">Miles</option>
          </select>
        </div>
        <div className="reglage"><div><b>Je pilote mes séances</b><p>Repère mis en avant dans les consignes.</p></div>
          <select style={{ width: 'auto' }} value={p.pilotage} onChange={(e) => maj('pilotage', e.target.value as Preferences['pilotage'])}>
            <option value="rpe">Au ressenti</option><option value="fc">À la fréquence cardiaque</option><option value="allure">À l’allure</option>
          </select>
        </div>
      </Bloc>
      <Bloc titre="Séance guidée">
        <Interrupteur titre="Signal sonore" texte="Un bip à chaque changement de bloc." coche={p.son_lecteur !== false} onChange={(v) => maj('son_lecteur', v)} />
        <Interrupteur titre="Vibration" texte="Sur téléphone, à chaque changement de bloc." coche={p.vibration_lecteur !== false} onChange={(v) => maj('vibration_lecteur', v)} />
      </Bloc>
      <Bloc titre="Accompagnement quotidien" description="Chaque matin, ta séance du jour et le rappel de ton bilan de forme.">
        <Notifications />
        <Interrupteur titre="Notification du matin" texte="Séance du jour et rappel du bilan (si les notifications sont activées sur ton téléphone)." coche={p.notif_seance !== false} onChange={(v) => maj('notif_seance', v)} />
        <Interrupteur titre="E-mail du matin" texte="Le programme du jour, son déroulé et le lien vers ton bilan." coche={p.email_quotidien !== false} onChange={(v) => maj('email_quotidien', v)} />
        <Interrupteur titre="Rappel de bilan hebdomadaire" texte="Le lundi, si le bilan de la semaine n’est pas fait." coche={!!p.notif_bilan} onChange={(v) => maj('notif_bilan', v)} />
        <Interrupteur titre="Conseils et nouveautés" coche={!!p.notif_conseils} onChange={(v) => maj('notif_conseils', v)} />
      </Bloc>
      {retour}
    </div>
  );
}

function SectionAppareils() {
  return (
    <Bloc titre="Montres et applis" description="Garmin, COROS, Polar, Strava, Apple Watch : connexions, fichier .FIT et abonnement agenda.">
      <div className="reglage"><div><b>Gérer mes connexions</b><p>Envoyer mes séances à ma montre et récupérer mes sorties.</p></div><a className="btn btn-primary btn-s" href="/app/connexions">Ouvrir</a></div>
      <InstallerApp />
    </Bloc>
  );
}

function SectionAbonnement({ profil }: Props) {
  const fin = profil.abonnement_fin;
  return (
    <div className="stack">
      <Bloc titre="Ton offre">
        <div className="row between">
          <div>
            <span className="badge badge-accent">{ABONNEMENTS[profil.abonnement]}</span>
            <p className="mt-8"><b style={{ fontSize: 20 }}>{profil.abonnement === 'premium' ? 'Premium' : profil.abonnement === 'offert' ? 'Accès offert' : 'Bêta gratuite'}</b></p>
            <p className="small muted">{fin ? `Valable jusqu’au ${dateCourte(fin)}.` : ''} Toutes les fonctionnalités sont ouvertes pendant la bêta.</p>
          </div>
        </div>
      </Bloc>
      <Bloc titre="Premium · bientôt" description="Le paiement en ligne n’est pas encore ouvert. Tu seras prévenu avant toute facturation, rien ne sera prélevé sans ton accord.">
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Plusieurs objectifs dans la saison</li><li>Analyses avancées : allure, cardio, dénivelé</li><li>App iPhone avec Apple Santé</li>
        </ul>
      </Bloc>
    </div>
  );
}

function SectionConfidentialite({ profil, nbSeances }: Props) {
  const { enCours, lancer, retour } = useEnregistrement();
  const [sante, setSante] = useState(profil.consentement_sante);
  const [confirmation, setConfirmation] = useState('');
  return (
    <div className="stack">
      <Bloc titre="Consentements">
        <Interrupteur titre="Données de santé" texte="Ressenti, douleurs, sommeil et fréquence cardiaque servent à adapter ton plan. Sans ce consentement, le bilan hebdomadaire ne peut pas t’ajuster."
          coche={sante} onChange={(v) => { setSante(v); lancer(() => majProfil({ consentement_sante: v })); }} />
        {retour}
      </Bloc>
      <Bloc titre="Exporter mes données" description={`Profil, objectifs, plans et ${nbSeances} séances, au format JSON.`}>
        <div><button className="btn btn-ghost" disabled={enCours} onClick={async () => {
          const donnees = await exporterDonnees();
          const url = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
          const a = document.createElement('a');
          a.href = url; a.download = `coach-trail-mes-donnees-${isoAujourdhui()}.json`; a.click();
          URL.revokeObjectURL(url);
        }}>Télécharger mes données</button></div>
      </Bloc>
      <Bloc titre="Supprimer mon compte" description="Ton compte, ton profil, tes plans et toutes tes séances sont effacés définitivement. Cette action est irréversible.">
        <label className="champ">Tape SUPPRIMER pour confirmer<input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
        <div><button className="btn btn-danger" disabled={confirmation !== 'SUPPRIMER' || enCours} onClick={() => lancer(supprimerCompte)}>Supprimer définitivement mon compte</button></div>
      </Bloc>
    </div>
  );
}

function SectionSecurite({ email }: Props) {
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const supabase = supabaseNavigateur();
  return (
    <div className="stack">
      <Bloc titre="Adresse e-mail" description={`Adresse actuelle : ${email}`}>
        <label className="champ">Nouvelle adresse<input type="email" value={nouvelEmail} onChange={(e) => setNouvelEmail(e.target.value)} /></label>
        <div><button className="btn btn-ghost" disabled={!nouvelEmail} onClick={async () => {
          const { error } = await supabase.auth.updateUser({ email: nouvelEmail }, { emailRedirectTo: `${location.origin}/auth/callback?suite=/app/compte?onglet=securite` });
          setMessage(error ? { ok: false, texte: 'Changement impossible. Vérifie l’adresse.' } : { ok: true, texte: 'Un lien de confirmation a été envoyé aux deux adresses.' });
        }}>Changer d’adresse</button></div>
      </Bloc>
      <Bloc titre="Mot de passe">
        <label className="champ">Nouveau mot de passe <span className="aide">8 caractères minimum</span><input type="password" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} /></label>
        <div><button className="btn btn-ghost" disabled={mdp.length < 8} onClick={async () => {
          const { error } = await supabase.auth.updateUser({ password: mdp });
          setMdp('');
          setMessage(error ? { ok: false, texte: 'Changement impossible : reconnecte-toi puis réessaie.' } : { ok: true, texte: 'Mot de passe modifié.' });
        }}>Changer le mot de passe</button></div>
      </Bloc>
      {message && <p className={`alerte ${message.ok ? 'alerte-ok' : 'alerte-danger'} small`}>{message.texte}</p>}
      <Bloc titre="Sessions">
        <div className="row">
          <form action={deconnexion}><button className="btn btn-ghost">Se déconnecter</button></form>
          <button className="btn btn-ghost" onClick={async () => { await supabase.auth.signOut({ scope: 'global' }); location.href = '/'; }}>Se déconnecter de tous les appareils</button>
        </div>
      </Bloc>
    </div>
  );
}

function minutesVersTexte(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  const s = Math.round((min - Math.floor(min)) * 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function texteVersMinutes(t: string) {
  if (!t.trim()) return null;
  const p = t.split(':').map(Number);
  if (p.some(Number.isNaN)) return null;
  return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p.length === 2 ? p[0] + p[1] / 60 : p[0];
}
