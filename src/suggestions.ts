import { PALIER_MAX } from './prompts';

/** Bouton proposé sous une réponse du tuteur (même forme que vscode.ChatFollowup). */
export interface Suggestion {
  label: string;
  prompt: string;
  command?: string;
}

/** Ce que le tuteur garde de sa réponse (ChatResult.metadata). */
export interface Metadonnees {
  mode?: string;
  palier?: number;
}

/** Boutons pour enchaîner vite : indice suivant (tant qu'il en reste), étape suivante. */
export function suggestions(metadata: unknown): Suggestion[] {
  const m = (typeof metadata === 'object' && metadata !== null ? metadata : {}) as Metadonnees;
  const dernierPalier = m.mode === 'indice' && typeof m.palier === 'number' && m.palier >= PALIER_MAX;
  const liste: Suggestion[] = [];
  if (!dernierPalier) {
    liste.push({ label: 'Indice plus précis', prompt: 'Un indice plus précis, stp.', command: 'indice' });
  }
  liste.push({ label: "C'est fait, étape suivante", prompt: "C'est fait. Quelle est la prochaine étape ?" });
  return liste;
}
