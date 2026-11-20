import { BaseNotions, Notion, notionsDues } from './notions';

export const MAX_RAPPEL = 3;

/** Ligne discrète en fin de réponse, au plus une fois par jour. */
export function ligneRappel(
  base: BaseNotions,
  aujourdhui: string,
): { texte: string; base: BaseNotions } | null {
  if (base.dernierRappelAffiche === aujourdhui) return null;
  const n = notionsDues(base, aujourdhui).length;
  if (n === 0) return null;
  const libelle = n === 1 ? '1 notion à revoir' : `${n} notions à revoir`;
  return {
    texte: `\n\n---\n${libelle} — \`@tuteur /rappel\` (1 min)`,
    base: { ...base, dernierRappelAffiche: aujourdhui },
  };
}

export function selectionRappel(base: BaseNotions, aujourdhui: string): Notion[] {
  return notionsDues(base, aujourdhui).slice(0, MAX_RAPPEL);
}

/** Notions choisies au début de la session `/rappel` et pas encore révisées (toujours dues). */
export function notionsRappelRestantes(base: BaseNotions, idsGeles: string[], aujourdhui: string): Notion[] {
  const dues = notionsDues(base, aujourdhui);
  return idsGeles
    .map((id) => dues.find((n) => n.id === id))
    .filter((n): n is Notion => n !== undefined);
}

export function formaterListeNotions(base: BaseNotions, aujourdhui: string): string {
  if (base.notions.length === 0) return "Aucune notion enregistrée pour l'instant.";
  const dues = new Set(notionsDues(base, aujourdhui).map((n) => n.id));
  const triees = [...base.notions].sort((a, b) => {
    if (dues.has(a.id) !== dues.has(b.id)) return dues.has(a.id) ? -1 : 1;
    return a.prochaineRevision.localeCompare(b.prochaineRevision);
  });
  const lignes = triees.map((n) => {
    const quand = dues.has(n.id) ? `**à revoir** (${n.prochaineRevision})` : n.prochaineRevision;
    return `| ${n.nom} | ${n.langage} | ${n.nbAides} | ${quand} |`;
  });
  return ['| Notion | Langage | Aides | Prochaine révision |', '|---|---|---|---|', ...lignes].join('\n');
}
