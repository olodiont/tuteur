export interface Tour {
  role: 'user' | 'assistant';
  texte: string;
}

/**
 * Caractères disponibles pour l'historique : environ 3 caractères par jeton,
 * 80 % de la fenêtre du modèle, moins ce que prennent déjà les consignes et le contexte.
 */
export function budgetHistorique(maxJetons: number, caracteresDejaUtilises: number): number {
  return Math.max(0, Math.floor(maxJetons * 3 * 0.8) - caracteresDejaUtilises);
}

/**
 * Garde l'historique dans le budget : le premier message (souvent l'énoncé) s'il tient,
 * puis les messages les plus récents, sans trou entre eux.
 */
export function selectionnerHistorique(tours: Tour[], budget: number): Tour[] {
  const total = tours.reduce((s, x) => s + x.texte.length, 0);
  if (total <= budget) return tours;

  const [premier, ...suite] = tours;
  let reste = budget;
  const garderPremier = premier !== undefined && premier.texte.length <= budget;
  if (garderPremier) reste -= premier.texte.length;

  const recents: Tour[] = [];
  for (let i = suite.length - 1; i >= 0; i--) {
    if (suite[i].texte.length > reste) break;
    reste -= suite[i].texte.length;
    recents.unshift(suite[i]);
  }
  return garderPremier ? [premier, ...recents] : recents;
}
