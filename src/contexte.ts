export interface DonneesContexte {
  fichier?: { nom: string; langage: string; contenu: string; ligneCurseur: number };
  selection?: string;
  diagnostics: string[];
  references: { nom: string; contenu: string }[];
}

const omission = (n: number) => `// … (${n} lignes omises)`;

/** Garde `maxLignes` lignes centrées sur le curseur (numéro de ligne à partir de 0). */
export function tronquerAutourDuCurseur(contenu: string, ligneCurseur: number, maxLignes = 200): string {
  const lignes = contenu.split('\n');
  if (lignes.length <= maxLignes) return contenu;
  const fin = Math.min(lignes.length, Math.max(0, ligneCurseur - Math.floor(maxLignes / 2)) + maxLignes);
  const debut = fin - maxLignes;
  const sortie = lignes.slice(debut, fin);
  if (debut > 0) sortie.unshift(omission(debut));
  if (fin < lignes.length) sortie.push(omission(lignes.length - fin));
  return sortie.join('\n');
}

export function formaterContexte(d: DonneesContexte): string {
  const sections: string[] = [];
  if (d.fichier) {
    const contenu = tronquerAutourDuCurseur(d.fichier.contenu, d.fichier.ligneCurseur);
    sections.push(
      `## Fichier actif : ${d.fichier.nom} (curseur ligne ${d.fichier.ligneCurseur + 1})\n` +
        `\`\`\`${d.fichier.langage}\n${contenu}\n\`\`\``,
    );
  } else {
    sections.push('## Fichier actif\nAucun fichier ouvert.');
  }
  if (d.selection?.trim()) {
    sections.push(`## Sélection\n\`\`\`\n${d.selection}\n\`\`\``);
  }
  if (d.diagnostics.length > 0) {
    sections.push(`## Erreurs\n${d.diagnostics.map((e) => `- ${e}`).join('\n')}`);
  }
  if (d.references.length > 0) {
    const pieces = d.references.map((r) => `### ${r.nom}\n\`\`\`\n${r.contenu}\n\`\`\``);
    sections.push(`## Pièces jointes\n${pieces.join('\n\n')}`);
  }
  return sections.join('\n\n');
}
