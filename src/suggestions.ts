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
  /** Le fichier actif avait des erreurs de compilation. */
  aDesErreurs?: boolean;
}

/** Boutons pour enchaîner vite : expliquer l'erreur, indice suivant (tant qu'il en reste), étape suivante. */
export function suggestions(metadata: unknown): Suggestion[] {
  const m = (typeof metadata === 'object' && metadata !== null ? metadata : {}) as Metadonnees;
  const dernierPalier = m.mode === 'indice' && typeof m.palier === 'number' && m.palier >= PALIER_MAX;
  const liste: Suggestion[] = [];
  if (m.aDesErreurs === true) {
    liste.push({
      label: 'Explique cette erreur',
      prompt: "Explique-moi l'erreur de compilation de mon fichier, sans la corriger à ma place.",
    });
  }
  if (!dernierPalier) {
    liste.push({ label: 'Indice plus précis', prompt: 'Un indice plus précis, stp.', command: 'indice' });
  }
  liste.push({ label: "C'est fait, vérifie", prompt: "C'est fait. Vérifie et donne-moi l'étape suivante.", command: 'verifie' });
  return liste;
}
