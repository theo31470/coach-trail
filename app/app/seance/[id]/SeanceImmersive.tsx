'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import ProfilSeance from '@/components/ProfilSeance';
import { IcCoche, IcFermer, IcLecture, IcPause, IcPrecedent, IcSuivant } from '@/components/Icones';
import { chrono, dateLongue, duree, isoAujourdhui, majuscule } from '@/lib/format';
import type { Seance, Zone } from '@/lib/moteur-entrainement';
import { COULEUR_ZONE } from '@/lib/plan-utils';
import { cibleBloc, type DetailSeance } from '@/lib/seance-detail';
import type { Preferences, SeanceRealiseeDb } from '@/lib/types';
import { enregistrerSeance, supprimerSeanceRealisee } from '../../actions';

interface Props {
  planId: string;
  seance: Seance;
  detail: DetailSeance;
  zones: Zone[];
  realisee: SeanceRealiseeDb | null;
  preferences: Preferences;
  ouvrirLecteur: boolean;
  adaptation: { titre: string; raisons: string[] } | null;
  analyse: ReactNode;
  envoi: ReactNode;
}

export default function SeanceImmersive({ planId, seance, detail, zones, realisee, preferences, ouvrirLecteur, adaptation, analyse, envoi }: Props) {
  const [lecteur, setLecteur] = useState(ouvrirLecteur);
  const [dureeFaite, setDureeFaite] = useState<number | null>(null);
  const totalSec = detail.blocs.reduce((t, b) => t + b.dureeSec, 0);
  const course = seance.type === 'course';

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="immersion">
        <div className="row" style={{ gap: 8 }}>
          <span className="pastille-verre">{majuscule(dateLongue(seance.date))}</span>
          {adaptation && <span className="pastille-verre">Adaptée ce matin</span>}
        </div>
        <h1>{detail.titre}</h1>
        <p className="resume">{detail.resume}</p>
        <div className="stats-seance">
          {!course && <div><b>{duree(seance.dureeMin)}</b><span>durée</span></div>}
          {seance.dplusM ? <div><b>{seance.dplusM} m</b><span>dénivelé positif</span></div> : null}
          <div><b>Z{seance.zonePrincipale}</b><span>zone principale</span></div>
          <div><b>{seance.rpePrevu}/10</b><span>ressenti visé</span></div>
        </div>
        <ProfilSeance blocs={detail.blocs} clair />
        <div className="row mt-24">
          {!course && !realisee && <button className="btn btn-primary btn-l" onClick={() => setLecteur(true)}><IcLecture /> Lancer la séance guidée</button>}
          {realisee && <span className="pastille-verre"><IcCoche /> Séance faite</span>}
        </div>
        {envoi}
        {adaptation && <p className="adaptation-note"><b>{adaptation.titre}.</b> {adaptation.raisons.join(' ')}</p>}
      </section>

      <div className="deux-col">
        <div className="stack">
          {detail.blocs.length > 0 && (
            <div className="carte">
              <div className="carte-titre"><h3>Déroulé</h3><span className="tiny">{chrono(totalSec)} au total</span></div>
              <div className="blocs">
                {regrouper(detail.blocs).map((g, i) => (
                  <div key={i} className="bloc">
                    <div className="trait" style={{ background: COULEUR_ZONE[g.bloc.zone] }} />
                    <div>
                      <h4 className="bloc-titre">{g.n > 1 ? `${g.n} × ${chrono(g.bloc.dureeSec)} ${g.bloc.type === 'effort' ? 'effort' : ''}` : g.bloc.titre}{g.recup ? ` · récup ${chrono(g.recup.dureeSec)}` : ''}</h4>
                      <p className="small mt-8">{g.bloc.consigne}</p>
                      <p className="cible">{cibleBloc(g.bloc.zone, zones)}</p>
                      {g.bloc.exercices && <ol className="exercices">{g.bloc.exercices.map((x) => <li key={x}>{x}</li>)}</ol>}
                    </div>
                    <div className="duree">{chrono(g.n * g.bloc.dureeSec + (g.recup ? (g.n - 1) * g.recup.dureeSec : 0))}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="carte objectif-seance">
            <h3>Ce que cette séance développe</h3>
            <p className="mt-8">{detail.objectif}</p>
            <p className="mt-8 small muted">{seance.pourquoi}</p>
          </div>
          {(detail.technique.length > 0 || detail.materiel.length > 0) && (
            <div className="grille-2">
              {detail.technique.length > 0 && <div className="carte"><h3>Technique</h3><ul className="liste-puces mt-8">{detail.technique.map((t) => <li key={t}>{t}</li>)}</ul></div>}
              {detail.materiel.length > 0 && <div className="carte"><h3>À emporter</h3><ul className="liste-puces mt-8">{detail.materiel.map((t) => <li key={t}>{t}</li>)}</ul></div>}
            </div>
          )}
          <div className="carte">
            <h3>Conseils du coach</h3>
            <ul className="mt-8 muted" style={{ paddingLeft: 18, margin: 0 }}>{detail.conseils.map((c) => <li key={c} style={{ marginBottom: 6 }}>{c}</li>)}</ul>
          </div>
          {seance.ppg && (
            <div className="carte">
              <div className="carte-titre"><h3>PPG après la séance</h3><span className="badge">{seance.ppg.dureeMin} min</span></div>
              <ul style={{ paddingLeft: 18, margin: 0 }}>{seance.ppg.contenu.map((c) => <li key={c} style={{ marginBottom: 6 }}>{c}</li>)}</ul>
              <p className="tiny mt-16">Récupère 30 s entre chaque série. Mouvements lents et contrôlés, sans douleur.</p>
            </div>
          )}
        </div>

        <div className="stack">
          {analyse}
          {!course && (realisee
            ? <RessentiEnregistre realisee={realisee} />
            : <FormRessenti planId={planId} seance={seance} dureeInitiale={dureeFaite ?? seance.dureeMin} />)}
          <div className="carte small">
            <h3>Repères d’intensité</h3>
            <div className="stack-s mt-16">
              {zones.map((z) => (
                <div key={z.zone} className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <span className="zone-tag" style={{ background: COULEUR_ZONE[z.zone] }}>Z{z.zone}</span>
                  <span className="muted">{z.nom} · {z.rpe[0]}-{z.rpe[1]}/10{z.fc ? ` · ${z.fc[0]}-${z.fc[1]} bpm` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {lecteur && detail.blocs.length > 0 && (
        <Lecteur detail={detail} zones={zones} preferences={preferences}
          onFermer={() => setLecteur(false)}
          onTerminer={(sec) => {
            setDureeFaite(Math.max(1, Math.round(sec / 60)));
            setLecteur(false);
            requestAnimationFrame(() => document.getElementById('ressenti')?.scrollIntoView({ behavior: 'smooth' }));
          }} />
      )}
    </div>
  );
}

function regrouper(blocs: DetailSeance['blocs']) {
  const groupes: { bloc: DetailSeance['blocs'][number]; n: number; recup?: DetailSeance['blocs'][number] }[] = [];
  for (let i = 0; i < blocs.length; i++) {
    const b = blocs[i];
    if (b.type === 'recup') continue;
    if (b.type === 'effort') {
      const precedent = groupes.at(-1);
      if (precedent && precedent.bloc.type === 'effort' && precedent.bloc.dureeSec === b.dureeSec) { precedent.n += 1; continue; }
      const recup = blocs[i + 1]?.type === 'recup' ? blocs[i + 1] : undefined;
      groupes.push({ bloc: b, n: 1, recup });
    } else groupes.push({ bloc: b, n: 1 });
  }
  return groupes;
}

// ───────────── Lecteur guidé ─────────────

function Lecteur({ detail, zones, preferences, onFermer, onTerminer }: {
  detail: DetailSeance; zones: Zone[]; preferences: Preferences; onFermer: () => void; onTerminer: (sec: number) => void;
}) {
  const blocs = detail.blocs;
  const [i, setI] = useState(0);
  const [reste, setReste] = useState(blocs[0].dureeSec);
  const [actif, setActif] = useState(false);
  const [ecoule, setEcoule] = useState(0);
  const dernier = useRef<number | null>(null);
  const total = blocs.reduce((t, b) => t + b.dureeSec, 0);
  const avantBloc = blocs.slice(0, i).reduce((t, b) => t + b.dureeSec, 0);
  const son = preferences.son_lecteur !== false;
  const vibre = preferences.vibration_lecteur !== false;

  const signal = useCallback((fort: boolean) => {
    if (vibre && 'vibrate' in navigator) navigator.vibrate(fort ? [200, 100, 200] : 120);
    if (!son) return;
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = fort ? 880 : 660;
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } catch { /* audio indisponible */ }
  }, [son, vibre]);

  // Garde l'écran allumé pendant la séance
  useEffect(() => {
    let verrou: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (actif && nav.wakeLock) nav.wakeLock.request('screen').then((v) => { verrou = v; }).catch(() => {});
    return () => { verrou?.release().catch(() => {}); };
  }, [actif]);

  useEffect(() => {
    if (!actif) { dernier.current = null; return; }
    const t = setInterval(() => {
      const maintenant = Date.now();
      const delta = dernier.current ? (maintenant - dernier.current) / 1000 : 0;
      dernier.current = maintenant;
      setEcoule((e) => e + delta);
      setReste((r) => r - delta);
    }, 250);
    return () => clearInterval(t);
  }, [actif]);

  useEffect(() => {
    if (reste > 0) return;
    if (i >= blocs.length - 1) { setActif(false); signal(true); onTerminer(ecoule); return; }
    signal(blocs[i + 1].type === 'effort');
    setI(i + 1);
    setReste(blocs[i + 1].dureeSec + reste);
  }, [reste, i, blocs, signal, onTerminer, ecoule]);

  const aller = (j: number) => { if (j < 0 || j >= blocs.length) return; setI(j); setReste(blocs[j].dureeSec); };
  const b = blocs[i];
  const suivant = blocs[i + 1];
  const pct = ((avantBloc + (b.dureeSec - Math.max(0, reste))) / total) * 100;

  return (
    <div className="lecteur" role="dialog" aria-modal="true" aria-label="Séance guidée">
      <div className="progression"><span style={{ width: `${pct}%` }} /></div>
      <div className="haut">
        <div>
          <div style={{ fontWeight: 800 }}>{detail.titre}</div>
          <div style={{ color: '#9FA5B3', fontSize: 14 }}>Bloc {i + 1} sur {blocs.length} · {chrono(ecoule)} écoulées</div>
        </div>
        <button className="rond" style={{ width: 44, height: 44 }} onClick={onFermer} aria-label="Fermer le lecteur"><IcFermer /></button>
      </div>
      <div className="centre">
        <div className="bloc-nom">{b.titre}</div>
        {b.repetition && <div className="rep">Répétition {b.repetition}</div>}
        <div className="temps" aria-live="polite">{chrono(Math.max(0, reste))}</div>
        <p className="consigne">{b.consigne}</p>
        <span className="cible" style={{ background: COULEUR_ZONE[b.zone] }}>{cibleBloc(b.zone, zones)}</span>
        {suivant && <p className="suivant">Ensuite : {suivant.titre} · {chrono(suivant.dureeSec)}</p>}
      </div>
      <div className="commandes">
        <button className="rond" onClick={() => aller(i - 1)} aria-label="Bloc précédent" disabled={i === 0}><IcPrecedent /></button>
        <button className="rond principal" onClick={() => setActif((a) => !a)} aria-label={actif ? 'Pause' : 'Démarrer'}>{actif ? <IcPause /> : <IcLecture />}</button>
        <button className="rond" onClick={() => (i === blocs.length - 1 ? onTerminer(ecoule) : aller(i + 1))} aria-label="Bloc suivant"><IcSuivant /></button>
      </div>
    </div>
  );
}

// ───────────── Ressenti ─────────────

const SOMMEIL = ['', 'Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Excellent'];
const RPE_TEXTE = ['', 'Très très facile', 'Très facile', 'Facile', 'Confortable', 'Un peu soutenu', 'Soutenu', 'Difficile', 'Très difficile', 'Extrêmement dur', 'Maximal'];

function FormRessenti({ planId, seance, dureeInitiale }: { planId: string; seance: Seance; dureeInitiale: number }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState('');
  const [f, setF] = useState({ date: seance.date <= isoAujourdhui() ? seance.date : isoAujourdhui(), duree: String(dureeInitiale), distance: '', dplus: seance.dplusM ? String(seance.dplusM) : '', rpe: seance.rpePrevu, douleur: 0, zone: '', sommeil: 4, commentaire: '' });
  useEffect(() => setF((x) => ({ ...x, duree: String(dureeInitiale) })), [dureeInitiale]);
  const maj = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <form id="ressenti" className="carte stack" onSubmit={(e) => {
      e.preventDefault();
      setErreur('');
      demarrer(async () => {
        const r = await enregistrerSeance({
          planId, seanceId: seance.id, typePrevu: seance.type, date: f.date, duree_min: Number(f.duree),
          distance_km: f.distance ? Number(f.distance.replace(',', '.')) : null, dplus_m: f.dplus ? Number(f.dplus) : null,
          rpe: f.rpe, douleur: f.douleur, zone_douleur: f.zone.trim() || null, sommeil: f.sommeil, commentaire: f.commentaire.trim() || null,
        });
        if (r.erreur) setErreur(r.erreur); else router.refresh();
      });
    }}>
      <div>
        <h3>Comment ça s’est passé ?</h3>
        <p className="tiny" style={{ marginTop: 4 }}>Ton ressenti sert au bilan de la semaine.</p>
      </div>
      <div className="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        <label className="champ">Date<input type="date" max={isoAujourdhui()} value={f.date} onChange={(e) => maj('date', e.target.value)} /></label>
        <label className="champ">Durée (min)<input inputMode="numeric" required value={f.duree} onChange={(e) => maj('duree', e.target.value)} /></label>
        <label className="champ">Distance (km)<input inputMode="decimal" placeholder="facultatif" value={f.distance} onChange={(e) => maj('distance', e.target.value)} /></label>
        <label className="champ">D+ (m)<input inputMode="numeric" placeholder="facultatif" value={f.dplus} onChange={(e) => maj('dplus', e.target.value)} /></label>
      </div>
      <label className="champ curseur-note">Effort ressenti
        <span className="row" style={{ gap: 10 }}><span className="valeur">{f.rpe}/10</span><span className="small muted">{RPE_TEXTE[f.rpe]} · visé : {seance.rpePrevu}/10</span></span>
        <input type="range" min={1} max={10} value={f.rpe} onChange={(e) => maj('rpe', Number(e.target.value))} />
        <span className="echelle"><span>Très facile</span><span>Maximal</span></span>
      </label>
      <label className="champ curseur-note">Douleur
        <span className="row" style={{ gap: 10 }}><span className="valeur" style={{ color: f.douleur >= 5 ? 'var(--danger)' : f.douleur >= 3 ? 'var(--warn)' : undefined }}>{f.douleur}/10</span><span className="small muted">{f.douleur === 0 ? 'Aucune' : f.douleur < 3 ? 'Gêne légère' : f.douleur < 5 ? 'Douleur modérée' : 'Douleur forte'}</span></span>
        <input type="range" min={0} max={10} value={f.douleur} onChange={(e) => maj('douleur', Number(e.target.value))} />
      </label>
      {f.douleur > 0 && <label className="champ">Où ?<input placeholder="genou droit, tendon d’Achille…" value={f.zone} onChange={(e) => maj('zone', e.target.value)} /></label>}
      {f.douleur >= 5 && <p className="alerte alerte-danger small">Douleur forte : arrête les séances intenses et consulte un médecin ou un kiné si elle persiste. Ton plan sera allégé au bilan.</p>}
      <div className="champ">Sommeil de la nuit dernière
        <div className="pastilles">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className="pastille" aria-pressed={f.sommeil === n} onClick={() => maj('sommeil', n)} title={SOMMEIL[n]}>{SOMMEIL[n]}</button>)}</div>
      </div>
      <label className="champ">Commentaire<textarea placeholder="Sensations, météo, parcours…" value={f.commentaire} onChange={(e) => maj('commentaire', e.target.value)} /></label>
      {erreur && <p className="alerte alerte-danger small">{erreur}</p>}
      <button className="btn btn-primary btn-block" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer ma séance'}</button>
    </form>
  );
}

function RessentiEnregistre({ realisee }: { realisee: SeanceRealiseeDb }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <div id="ressenti" className="carte stack">
      <div className="carte-titre" style={{ marginBottom: 0 }}><h3>Ton ressenti</h3><span className="badge badge-ok">Enregistré</span></div>
      <div className="grille-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="kpi"><div className="valeur">{duree(realisee.duree_min)}</div><div className="libelle">durée</div></div>
        <div className="kpi"><div className="valeur">{realisee.rpe}/10</div><div className="libelle">effort ressenti</div></div>
        {realisee.distance_km ? <div className="kpi"><div className="valeur">{Number(realisee.distance_km).toLocaleString('fr-FR')} km</div><div className="libelle">distance</div></div> : null}
        {realisee.dplus_m ? <div className="kpi"><div className="valeur">{realisee.dplus_m} m</div><div className="libelle">D+</div></div> : null}
      </div>
      {realisee.douleur > 0 && <p className={`alerte ${realisee.douleur >= 3 ? 'alerte-warn' : 'alerte-info'} small`}>Douleur {realisee.douleur}/10{realisee.zone_douleur ? ` · ${realisee.zone_douleur}` : ''}</p>}
      {realisee.sommeil && <p className="small muted">Sommeil : {SOMMEIL[realisee.sommeil]}</p>}
      {realisee.commentaire && <p className="small" style={{ fontStyle: 'italic' }}>« {realisee.commentaire} »</p>}
      <button className="btn btn-ghost btn-s" disabled={enCours} onClick={() => {
        if (!confirm('Supprimer ce ressenti pour le saisir à nouveau ?')) return;
        demarrer(async () => { await supprimerSeanceRealisee(realisee.id); router.refresh(); });
      }}>Modifier mon ressenti</button>
    </div>
  );
}
