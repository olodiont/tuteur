import { describe, expect, test } from 'vitest';
import { formaterContexte, tronquerAutourDuCurseur } from '../src/contexte';

const lignes = (n: number) => Array.from({ length: n }, (_, i) => `ligne ${i}`).join('\n');

describe('tronquerAutourDuCurseur', () => {
  test('garde 200 lignes centrées sur le curseur et marque les omissions', () => {
    const sortie = tronquerAutourDuCurseur(lignes(500), 250).split('\n');
    const gardees = sortie.filter((l) => l.startsWith('ligne '));
    expect(gardees).toHaveLength(200);
    expect(gardees).toContain('ligne 250');
    expect(sortie[0]).toBe('// … (150 lignes omises)');
    expect(sortie.at(-1)).toBe('// … (150 lignes omises)');
  });

  test('curseur au début : une seule marque, en bas', () => {
    const sortie = tronquerAutourDuCurseur(lignes(500), 0).split('\n');
    expect(sortie[0]).toBe('ligne 0');
    expect(sortie.at(-1)).toBe('// … (300 lignes omises)');
  });

  test('fichier court : inchangé', () => {
    expect(tronquerAutourDuCurseur(lignes(50), 10)).toBe(lignes(50));
  });
});

describe('formaterContexte', () => {
  test('sans fichier ni erreur', () => {
    const t = formaterContexte({ diagnostics: [], references: [] });
    expect(t).toContain('Aucun fichier ouvert.');
    expect(t).not.toContain('## Erreurs');
    expect(t).not.toContain('## Sélection');
  });

  test('avec fichier Java, sélection, erreur et pièce jointe', () => {
    const t = formaterContexte({
      fichier: { nom: 'Main.java', langage: 'java', contenu: 'class Main {}', ligneCurseur: 0 },
      selection: 'int x = 1',
      diagnostics: ["Ligne 3 : ';' expected"],
      references: [{ nom: 'enonce.txt', contenu: 'Écrire une fonction qui…' }],
    });
    expect(t).toContain('## Fichier actif');
    expect(t).toContain('```java');
    expect(t).toContain('class Main {}');
    expect(t).toContain('## Sélection');
    expect(t).toContain("';' expected");
    expect(t).toContain('## Pièces jointes');
    expect(t).toContain('enonce.txt');
  });

  test('tronque un fichier long', () => {
    const t = formaterContexte({
      fichier: { nom: 'Gros.java', langage: 'java', contenu: lignes(500), ligneCurseur: 250 },
      diagnostics: [],
      references: [],
    });
    expect(t).toContain('lignes omises');
    expect(t).not.toContain('ligne 0\n');
  });
});
