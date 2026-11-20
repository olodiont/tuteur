import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type TypeAide = 'rappel' | 'mini-cours' | 'indice';

export interface Notion {
  id: string;
  nom: string;
  langage: string;
  type: TypeAide;
  /** Date de la première aide, au format YYYY-MM-DD. */
  vueLe: string;
  nbAides: number;
  /** Date de la prochaine révision, au format YYYY-MM-DD. */
  prochaineRevision: string;
  /** Index dans INTERVALLES. */
  palier: number;
}

export interface BaseNotions {
  notions: Notion[];
  dernierRappelAffiche?: string;
}

export interface AideRecue {
  nom: string;
  langage: string;
  type: TypeAide;
}

/** Intervalles de révision, en jours. */
export const INTERVALLES = [1, 3, 7, 14, 30];

function normaliser(texte: string): string {
  return texte.trim().toLowerCase().replace(/\s+/g, '-');
}

export function idNotion(langage: string, nom: string): string {
  return `${normaliser(langage)}-${normaliser(nom)}`;
}

/** Ajoute `jours` à une date YYYY-MM-DD, en UTC pour éviter les décalages de fuseau. */
export function ajouterJours(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

export function ajouterAide(base: BaseNotions, aide: AideRecue, aujourdhui: string): BaseNotions {
  const id = idNotion(aide.langage, aide.nom);
  const demain = ajouterJours(aujourdhui, INTERVALLES[0]);
  const existante = base.notions.find((n) => n.id === id);
  if (existante) {
    return {
      ...base,
      notions: base.notions.map((n) =>
        n.id === id
          ? { ...n, type: aide.type, nbAides: n.nbAides + 1, palier: 0, prochaineRevision: demain }
          : n,
      ),
    };
  }
  const nouvelle: Notion = {
    id,
    nom: aide.nom.trim(),
    langage: normaliser(aide.langage),
    type: aide.type,
    vueLe: aujourdhui,
    nbAides: 1,
    prochaineRevision: demain,
    palier: 0,
  };
  return { ...base, notions: [...base.notions, nouvelle] };
}

export function enregistrerRevision(
  base: BaseNotions,
  id: string,
  reussie: boolean,
  aujourdhui: string,
): BaseNotions {
  if (!base.notions.some((n) => n.id === id)) return base;
  return {
    ...base,
    notions: base.notions.map((n) => {
      if (n.id !== id) return n;
      const palier = reussie ? Math.min(n.palier + 1, INTERVALLES.length - 1) : 0;
      return { ...n, palier, prochaineRevision: ajouterJours(aujourdhui, INTERVALLES[palier]) };
    }),
  };
}

export function notionsDues(base: BaseNotions, aujourdhui: string): Notion[] {
  return base.notions
    .filter((n) => n.prochaineRevision <= aujourdhui)
    .sort((a, b) => a.prochaineRevision.localeCompare(b.prochaineRevision));
}

export async function chargerBase(chemin: string): Promise<BaseNotions> {
  try {
    const donnees = JSON.parse(await readFile(chemin, 'utf8'));
    if (donnees && Array.isArray(donnees.notions)) return donnees as BaseNotions;
  } catch {
    // Fichier absent ou illisible : on repart d'une base vide.
  }
  return { notions: [] };
}

export async function sauverBase(chemin: string, base: BaseNotions): Promise<void> {
  await mkdir(dirname(chemin), { recursive: true });
  await writeFile(chemin, JSON.stringify(base, null, 2), 'utf8');
}
