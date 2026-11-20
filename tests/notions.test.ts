import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  ajouterAide,
  BaseNotions,
  chargerBase,
  enregistrerRevision,
  notionsDues,
  sauverBase,
} from '../src/notions';

const AUJ = '2026-11-20';
const vide = (): BaseNotions => ({ notions: [] });

describe('ajouterAide', () => {
  test('crée une notion à réviser le lendemain', () => {
    const base = ajouterAide(vide(), { nom: 'HashMap', langage: 'java', type: 'mini-cours' }, AUJ);
    expect(base.notions).toHaveLength(1);
    const n = base.notions[0];
    expect(n.id).toBe('java-hashmap');
    expect(n.nbAides).toBe(1);
    expect(n.vueLe).toBe(AUJ);
    expect(n.prochaineRevision).toBe('2026-11-21');
  });

  test('regroupe les variantes de nom en une seule notion', () => {
    let base = ajouterAide(vide(), { nom: 'HashMap', langage: 'java', type: 'mini-cours' }, AUJ);
    base = ajouterAide(base, { nom: ' hashmap ', langage: 'Java', type: 'rappel' }, AUJ);
    expect(base.notions).toHaveLength(1);
    expect(base.notions[0].nbAides).toBe(2);
  });

  test('ne modifie pas la base reçue', () => {
    const base = vide();
    ajouterAide(base, { nom: 'for', langage: 'java', type: 'rappel' }, AUJ);
    expect(base.notions).toHaveLength(0);
  });
});

describe('enregistrerRevision', () => {
  test('chaque réussite passe à l’intervalle suivant, plafonné à 30 jours', () => {
    let base = ajouterAide(vide(), { nom: 'for', langage: 'java', type: 'rappel' }, AUJ);
    const attendus = ['2026-11-23', '2026-11-27', '2026-12-04', '2026-12-20', '2026-12-20'];
    for (const attendu of attendus) {
      base = enregistrerRevision(base, 'java-for', true, AUJ);
      expect(base.notions[0].prochaineRevision).toBe(attendu);
    }
  });

  test('un échec revient à 1 jour', () => {
    let base = ajouterAide(vide(), { nom: 'for', langage: 'java', type: 'rappel' }, AUJ);
    for (let i = 0; i < 3; i++) base = enregistrerRevision(base, 'java-for', true, AUJ);
    base = enregistrerRevision(base, 'java-for', false, AUJ);
    expect(base.notions[0].palier).toBe(0);
    expect(base.notions[0].prochaineRevision).toBe('2026-11-21');
  });

  test('une nouvelle aide sur une notion avancée revient à 1 jour', () => {
    let base = ajouterAide(vide(), { nom: 'for', langage: 'java', type: 'rappel' }, AUJ);
    for (let i = 0; i < 3; i++) base = enregistrerRevision(base, 'java-for', true, AUJ);
    base = ajouterAide(base, { nom: 'for', langage: 'java', type: 'indice' }, AUJ);
    expect(base.notions[0].palier).toBe(0);
    expect(base.notions[0].prochaineRevision).toBe('2026-11-21');
  });

  test('un id inconnu ne change rien', () => {
    const base = ajouterAide(vide(), { nom: 'for', langage: 'java', type: 'rappel' }, AUJ);
    expect(enregistrerRevision(base, 'java-inconnu', true, AUJ)).toEqual(base);
  });
});

describe('notionsDues', () => {
  test('ignore une notion dont la révision est demain', () => {
    const base = ajouterAide(vide(), { nom: 'for', langage: 'java', type: 'rappel' }, AUJ);
    expect(notionsDues(base, AUJ)).toHaveLength(0);
    expect(notionsDues(base, '2026-11-21')).toHaveLength(1);
  });

  test('les plus anciennes d’abord', () => {
    let base = ajouterAide(vide(), { nom: 'b', langage: 'java', type: 'rappel' }, '2026-11-18');
    base = ajouterAide(base, { nom: 'a', langage: 'java', type: 'rappel' }, '2026-11-10');
    expect(notionsDues(base, AUJ).map((n) => n.nom)).toEqual(['a', 'b']);
  });
});

describe('stockage', () => {
  test('fichier absent : base vide', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuteur-'));
    expect(await chargerBase(join(dir, 'notions.json'))).toEqual({ notions: [] });
  });

  test('fichier corrompu : base vide, sans exception', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuteur-'));
    const chemin = join(dir, 'notions.json');
    await writeFile(chemin, '{pas du json');
    expect(await chargerBase(chemin)).toEqual({ notions: [] });
  });

  test('JSON valide mais sans tableau notions : base vide', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuteur-'));
    const chemin = join(dir, 'notions.json');
    await writeFile(chemin, '{"autre": 1}');
    expect(await chargerBase(chemin)).toEqual({ notions: [] });
  });

  test('sauver puis charger dans un dossier inexistant', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tuteur-'));
    const chemin = join(dir, 'sous', 'dossier', 'notions.json');
    const base = ajouterAide(vide(), { nom: 'HashMap', langage: 'java', type: 'mini-cours' }, AUJ);
    await sauverBase(chemin, base);
    expect(await chargerBase(chemin)).toEqual(base);
  });
});
