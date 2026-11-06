/**
 * Export d'une séance au format FIT « workout » : le format natif des montres Garmin
 * (et lu par de nombreuses applis). Les répétitions sont encodées en boucles,
 * chaque bloc porte sa cible : fréquence cardiaque, allure, ou rien (au ressenti).
 */
import { Encoder, Profile } from '@garmin/fitsdk';
import type { Seance, Zone } from './moteur-entrainement';
import type { Bloc, DetailSeance } from './seance-detail';

type Pilotage = 'fc' | 'allure' | 'rpe';

const INTENSITE: Record<Bloc['type'], string> = {
  echauffement: 'warmup', calme: 'cooldown', recup: 'recovery', effort: 'active', continu: 'active',
};

/** « 5:30 » → mètres par seconde. */
const allureVersVitesse = (mmss: string) => {
  const [m, s] = mmss.split(':').map(Number);
  return 1000 / (m * 60 + (s || 0));
};

function cible(bloc: Bloc, zones: Zone[], pilotage: Pilotage) {
  const z = zones.find((x) => x.zone === bloc.zone);
  if (pilotage === 'fc' && z?.fc) {
    return { targetType: 'heartRate', targetValue: 0, customTargetValueLow: z.fc[0] + 100, customTargetValueHigh: z.fc[1] + 100 };
  }
  if (pilotage === 'allure' && z?.allureMinKm) {
    // allureMinKm = [plus rapide, plus lente] → vitesse basse = allure lente
    return {
      targetType: 'speed', targetValue: 0,
      customTargetValueLow: Math.round(allureVersVitesse(z.allureMinKm[1]) * 1000),
      customTargetValueHigh: Math.round(allureVersVitesse(z.allureMinKm[0]) * 1000),
    };
  }
  return { targetType: 'open', targetValue: 0 };
}

interface Etape { bloc?: Bloc; boucle?: { depuis: number; fois: number } }

/** Regroupe les séries effort / récup identiques en boucles « répéter N fois ». */
function etapes(blocs: Bloc[]): Etape[] {
  const out: Etape[] = [];
  let i = 0;
  while (i < blocs.length) {
    const b = blocs[i];
    if (b.type === 'effort') {
      const recup = blocs[i + 1]?.type === 'recup' ? blocs[i + 1] : undefined;
      let n = 1;
      let j = i + (recup ? 2 : 1);
      while (blocs[j]?.type === 'effort' && blocs[j].dureeSec === b.dureeSec) {
        n++;
        j += blocs[j + 1]?.type === 'recup' && blocs[j + 1].dureeSec === recup?.dureeSec ? 2 : 1;
      }
      const depuis = out.length;
      out.push({ bloc: b });
      if (recup) out.push({ bloc: recup });
      if (n > 1) out.push({ boucle: { depuis, fois: n } });
      i = j;
    } else {
      out.push({ bloc: b });
      i++;
    }
  }
  return out;
}

export function seanceVersFit(seance: Seance, detail: DetailSeance, zones: Zone[], pilotage: Pilotage = 'rpe'): Uint8Array {
  const liste = etapes(detail.blocs);
  const enc = new Encoder();
  const M = Profile.MesgNum;
  // Les types du SDK sont très stricts sur les énumérations : on passe par un écrivain générique
  const ecrire = (num: number, mesg: Record<string, unknown>) => enc.onMesg(num, mesg as never);
  ecrire(M.FILE_ID, {
    type: 'workout', manufacturer: 'development', product: 1, serialNumber: 12345, timeCreated: new Date(),
  });
  ecrire(M.WORKOUT, {
    wktName: detail.titre.slice(0, 40), sport: 'running', subSport: seance.dplusM ? 'trail' : 'generic',
    numValidSteps: liste.length,
  });
  liste.forEach((e, k) => {
    if (e.boucle) {
      ecrire(M.WORKOUT_STEP, {
        messageIndex: k, durationType: 'repeatUntilStepsCmplt', durationValue: e.boucle.depuis,
        targetType: 'open', targetValue: e.boucle.fois,
      });
      return;
    }
    const b = e.bloc!;
    ecrire(M.WORKOUT_STEP, {
      messageIndex: k,
      wktStepName: (b.type === 'effort' ? 'Effort' : b.type === 'recup' ? 'Récup' : b.titre).slice(0, 15),
      durationType: 'time',
      durationValue: Math.round(b.dureeSec * 1000),
      intensity: INTENSITE[b.type],
      notes: b.consigne.slice(0, 50),
      ...cible(b, zones, pilotage),
    });
  });
  return enc.close();
}

/** Nom de fichier lisible : « 2026-11-07-fractionne-vma.fit ». */
export const nomFichierFit = (seance: Seance, titre: string) =>
  `${seance.date}-${titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.fit`;
