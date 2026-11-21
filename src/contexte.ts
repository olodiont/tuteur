export interface FichierOuvert {
  nom: string;
  langage: string;
  contenu: string;
}

export interface DonneesContexte {
  fichier?: FichierOuvert & { ligneCurseur: number };
  selection?: string;
  /** Erreurs et avertissements du fichier actif. */
  diagnostics: string[];
  references: { nom: string; contenu: string }[];
  /** Autres fichiers ouverts dans l'éditeur (onglets). */
  autresFichiers?: FichierOuvert[];
  /** Onglets ouverts en plus, non lus pour rester sous les limites. */
  autresFichiersNonJoints?: number;
  /** Erreurs des autres fichiers de l'exercice. */
  erreursProjet?: string[];
  /** Pièces jointes qui n'ont pas pu être lues. */
  piecesIgnorees?: string[];
}

/** Limites de taille, pour garder des réponses rapides et ne pas dépasser ce que le modèle accepte. */
export const LIMITES = {
  fichierActif: 15_000,
  selection: 6_000,
  autreFichier: 6_000,
  autresFichiersMax: 5,
  reference: 15_000,
  referencesTotal: 30_000,
  erreursMax: 15,
};

const omissionLignes = (n: number) => `// … (${n} lignes omises)`;

/** Garde `maxLignes` lignes centrées sur le curseur (numéro de ligne à partir de 0). */
export function tronquerAutourDuCurseur(contenu: string, ligneCurseur: number, maxLignes = 200): string {
  const lignes = contenu.split('\n');
  if (lignes.length <= maxLignes) return contenu;
  const fin = Math.min(lignes.length, Math.max(0, ligneCurseur - Math.floor(maxLignes / 2)) + maxLignes);
  const debut = fin - maxLignes;
  const sortie = lignes.slice(debut, fin);
  if (debut > 0) sortie.unshift(omissionLignes(debut));
  if (fin < lignes.length) sortie.push(omissionLignes(lignes.length - fin));
  return sortie.join('\n');
}

/** Coupe un texte trop long et le signale. */
export function tronquerCaracteres(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  return `${texte.slice(0, max)}\n// … (${texte.length - max} caractères omis)`;
}

/** Clôture de bloc de code plus longue que toute suite d'accents graves du contenu. */
export function cloture(contenu: string): string {
  const plusLongue = Math.max(0, ...(contenu.match(/`+/g) ?? []).map((s) => s.length));
  return '`'.repeat(Math.max(3, plusLongue + 1));
}

function blocCode(contenu: string, langage = ''): string {
  const c = cloture(contenu);
  return `${c}${langage}\n${contenu}\n${c}`;
}

export function formaterContexte(d: DonneesContexte): string {
  const sections: string[] = [];

  if (d.fichier) {
    const contenu = tronquerCaracteres(
      tronquerAutourDuCurseur(d.fichier.contenu, d.fichier.ligneCurseur),
      LIMITES.fichierActif,
    );
    sections.push(
      `## Fichier actif : ${d.fichier.nom} (curseur ligne ${d.fichier.ligneCurseur + 1})\n` +
        blocCode(contenu, d.fichier.langage),
    );
  } else {
    sections.push('## Fichier actif\nAucun fichier ouvert.');
  }

  if (d.selection?.trim()) {
    sections.push(`## Sélection\n${blocCode(tronquerCaracteres(d.selection, LIMITES.selection))}`);
  }

  if (d.diagnostics.length > 0) {
    const liste = d.diagnostics.slice(0, LIMITES.erreursMax).map((e) => `- ${e}`);
    sections.push(`## Erreurs\n${liste.join('\n')}`);
  }

  const autres = d.autresFichiers ?? [];
  if (autres.length > 0) {
    const joints = autres.slice(0, LIMITES.autresFichiersMax).map(
      (f) => `### ${f.nom}\n${blocCode(tronquerCaracteres(f.contenu, LIMITES.autreFichier), f.langage)}`,
    );
    const reste =
      Math.max(0, autres.length - LIMITES.autresFichiersMax) + (d.autresFichiersNonJoints ?? 0);
    if (reste > 0) joints.push(`(${reste} autres fichiers ouverts non joints)`);
    sections.push(`## Autres fichiers ouverts\n${joints.join('\n\n')}`);
  }

  const erreursProjet = d.erreursProjet ?? [];
  if (erreursProjet.length > 0) {
    const liste = erreursProjet.slice(0, LIMITES.erreursMax).map((e) => `- ${e}`);
    sections.push(`## Erreurs dans les autres fichiers\n${liste.join('\n')}`);
  }

  if (d.references.length > 0) {
    let utilise = 0;
    const pieces = d.references.map((r) => {
      const contenu = tronquerCaracteres(r.contenu, LIMITES.reference);
      if (utilise > 0 && utilise + contenu.length > LIMITES.referencesTotal) {
        return `### ${r.nom} (non incluse : limite de taille atteinte)`;
      }
      utilise += contenu.length;
      return `### ${r.nom}\n${blocCode(contenu)}`;
    });
    sections.push(`## Pièces jointes\n${pieces.join('\n\n')}`);
  }

  if (d.piecesIgnorees && d.piecesIgnorees.length > 0) {
    sections.push(`Pièces jointes ignorées : ${d.piecesIgnorees.join(', ')} (illisibles ou trop grosses).`);
  }

  return sections.join('\n\n');
}

const versSlash = (chemin: string) => chemin.replace(/\\/g, '/');

/**
 * Dossier de l'exercice d'un fichier : son dossier, en remontant le paquet Java
 * (`package a.b;`) puis un `src` ou `src/main/java` final.
 */
export function racineExercice(cheminFichier: string, contenu: string): string {
  let dossier = versSlash(cheminFichier).split('/').slice(0, -1);
  const paquet = contenu.match(/^\s*package\s+([\w.]+)\s*;/m);
  if (paquet) {
    const parties = paquet[1].split('.');
    const fin = dossier.slice(-parties.length);
    if (fin.length !== parties.length || fin.some((p, i) => p !== parties[i])) return dossier.join('/');
    dossier = dossier.slice(0, -parties.length);
  }
  if (dossier.slice(-3).join('/') === 'src/main/java') dossier = dossier.slice(0, -3);
  else if (dossier.at(-1) === 'src') dossier = dossier.slice(0, -1);
  return dossier.join('/');
}

/** Vrai si le fichier est dans le dossier (séparateurs et casse ignorés). */
export function dansDossier(cheminFichier: string, dossier: string): boolean {
  const n = (s: string) => versSlash(s).toLowerCase().replace(/\/+$/, '');
  return n(cheminFichier).startsWith(`${n(dossier)}/`);
}
