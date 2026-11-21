/**
 * Coupe le code gris de Copilot (suggestions en ligne) pendant que l'étudiant travaille
 * avec @tuteur, et le remet exactement comme avant avec /stop.
 * La liste des noms de méthodes de VS Code (IntelliSense) n'est pas touchée.
 */

/** Le réglage VS Code qui active le code gris : `editor.inlineSuggest.enabled`. */
export const SECTION = 'editor';
export const CLE_REGLAGE = 'inlineSuggest.enabled';

/** Accès au réglage, au niveau utilisateur (global). */
export interface Reglage {
  lireGlobal(): boolean | undefined;
  ecrireGlobal(valeur: boolean | undefined): Promise<void>;
}

/** Mémoire persistante de l'extension (vscode.Memento). */
export interface Memoire {
  get<T>(cle: string): T | undefined;
  update(cle: string, valeur: unknown): PromiseLike<void>;
}

const CLE_ETAT = 'tuteur.autocompletion';

/** `avant` vaut null quand le réglage n'existait pas dans les réglages utilisateur. */
interface Etat {
  avant: boolean | null;
}

export function estCoupee(memoire: Memoire): boolean {
  return memoire.get<Etat>(CLE_ETAT) !== undefined;
}

/** Coupe le code gris. Retourne vrai si elle vient d'être coupée (faux si elle l'était déjà). */
export async function couperAutocompletion(reglage: Reglage, memoire: Memoire): Promise<boolean> {
  if (estCoupee(memoire)) return false;
  const etat: Etat = { avant: reglage.lireGlobal() ?? null };
  await memoire.update(CLE_ETAT, etat);
  await reglage.ecrireGlobal(false);
  return true;
}

/** Remet le réglage d'avant. Retourne vrai si quelque chose a été remis. */
export async function remettreAutocompletion(reglage: Reglage, memoire: Memoire): Promise<boolean> {
  const etat = memoire.get<Etat>(CLE_ETAT);
  if (etat === undefined) return false;
  await reglage.ecrireGlobal(etat.avant ?? undefined);
  await memoire.update(CLE_ETAT, undefined);
  return true;
}
