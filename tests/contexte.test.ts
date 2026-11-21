import { describe, expect, test } from 'vitest';
import { cloture, dansDossier, formaterContexte, racineExercice, tronquerAutourDuCurseur, tronquerCaracteres } from '../src/contexte';

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

describe('limites de taille', () => {
  test('tronquerCaracteres : texte court inchangé', () => {
    expect(tronquerCaracteres('abc', 10)).toBe('abc');
  });

  test('tronquerCaracteres : texte long coupé avec une marque', () => {
    const t = tronquerCaracteres('x'.repeat(100), 40);
    expect(t.startsWith('x'.repeat(40))).toBe(true);
    expect(t).toContain('(60 caractères omis)');
  });

  test('un fichier minifié d’une seule ligne énorme reste sous 20 000 caractères', () => {
    const t = formaterContexte({
      fichier: { nom: 'min.js', langage: 'javascript', contenu: 'a'.repeat(100_000), ligneCurseur: 0 },
      diagnostics: [],
      references: [],
    });
    expect(t.length).toBeLessThan(20_000);
  });

  test('une pièce jointe énorme est coupée', () => {
    const t = formaterContexte({ diagnostics: [], references: [{ nom: 'gros.txt', contenu: 'b'.repeat(100_000) }] });
    expect(t.length).toBeLessThan(20_000);
    expect(t).toContain('caractères omis');
  });
});

describe('blocs de code', () => {
  test('cloture : 3 accents graves par défaut', () => {
    expect(cloture('int x;')).toBe('```');
  });

  test('cloture : plus longue que les accents graves du contenu', () => {
    expect(cloture('voir ```java\ncode\n```')).toBe('````');
  });

  test('un fichier qui contient ``` ne casse pas le bloc', () => {
    const t = formaterContexte({
      fichier: { nom: 'README.md', langage: 'markdown', contenu: '```java\nx\n```', ligneCurseur: 0 },
      diagnostics: [],
      references: [],
    });
    expect(t).toContain('````markdown');
  });
});

describe('autres fichiers et erreurs du projet', () => {
  const autre = (nom: string) => ({ nom, langage: 'java', contenu: `class ${nom} {}` });

  test('les autres fichiers ouverts sont joints', () => {
    const t = formaterContexte({
      diagnostics: [],
      references: [],
      autresFichiers: [autre('Student.java'), autre('Main.java')],
    });
    expect(t).toContain('## Autres fichiers ouverts');
    expect(t).toContain('### Student.java');
    expect(t).toContain('class Main.java {}');
  });

  test('au plus 5 autres fichiers', () => {
    const fichiers = Array.from({ length: 8 }, (_, i) => autre(`F${i}.java`));
    const t = formaterContexte({ diagnostics: [], references: [], autresFichiers: fichiers });
    expect(t).toContain('### F4.java');
    expect(t).not.toContain('### F5.java');
    expect(t).toContain('3 autres fichiers ouverts non joints');
  });

  test('pas de section vide', () => {
    const t = formaterContexte({ diagnostics: [], references: [], autresFichiers: [], erreursProjet: [] });
    expect(t).not.toContain('## Autres fichiers ouverts');
    expect(t).not.toContain('## Erreurs dans les autres fichiers');
  });

  test('les erreurs des autres fichiers sont listées', () => {
    const t = formaterContexte({
      diagnostics: [],
      references: [],
      erreursProjet: ['Student.java ligne 4 : cannot find symbol'],
    });
    expect(t).toContain('## Erreurs dans les autres fichiers');
    expect(t).toContain('cannot find symbol');
  });
});

test('les onglets non lus sont comptés dans la mention', () => {
  const t = formaterContexte({
    diagnostics: [],
    references: [],
    autresFichiers: [{ nom: 'A.java', langage: 'java', contenu: 'class A {}' }],
    autresFichiersNonJoints: 2,
  });
  expect(t).toContain('2 autres fichiers ouverts non joints');
});

describe('relecture 2 : pièces jointes', () => {
  test('pièces jointes ignorées signalées', () => {
    const t = formaterContexte({ diagnostics: [], references: [], piecesIgnorees: ['image.png'] });
    expect(t).toContain('Pièces jointes ignorées : image.png');
  });

  test('plafond total sur les pièces jointes', () => {
    const refs = Array.from({ length: 5 }, (_, i) => ({ nom: `r${i}.txt`, contenu: 'z'.repeat(20_000) }));
    const t = formaterContexte({ diagnostics: [], references: refs });
    expect(t.length).toBeLessThan(40_000);
    expect(t).toContain('r4.txt (non incluse : limite de taille atteinte)');
  });
});

describe('racineExercice', () => {
  test('fichier dans un paquet Java sous src : racine = dossier de l’exercice', () => {
    expect(racineExercice(String.raw`C:\cours\exo1\src\university\model\Student.java`, 'package university.model;\n\nclass Student {}'))
      .toBe('C:/cours/exo1');
  });

  test('sans paquet, sous src', () => {
    expect(racineExercice('/cours/exo2/src/Main.java', 'public class Main {}')).toBe('/cours/exo2');
  });

  test('sans paquet ni src : dossier du fichier', () => {
    expect(racineExercice('/cours/exo3/Main.java', 'class Main {}')).toBe('/cours/exo3');
  });

  test('paquet qui ne correspond pas au chemin : dossier du fichier', () => {
    expect(racineExercice('/cours/exo4/Main.java', 'package autre.chose;')).toBe('/cours/exo4');
  });
});

describe('dansDossier', () => {
  test('séparateurs et casse ignorés', () => {
    expect(dansDossier(String.raw`C:\Cours\Exo1\src\Main.java`, 'c:/cours/exo1')).toBe(true);
  });
  test('un dossier voisin au nom proche n’est pas dedans', () => {
    expect(dansDossier('/cours/exo10/Main.java', '/cours/exo1')).toBe(false);
  });
});
