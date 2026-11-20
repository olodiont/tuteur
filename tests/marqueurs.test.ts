import { expect, test } from 'vitest';
import { FiltreMarqueurs } from '../src/marqueurs';

function filtrer(fragments: string[]) {
  const f = new FiltreMarqueurs();
  let sortie = '';
  for (const fr of fragments) sortie += f.pousser(fr);
  sortie += f.terminer();
  return { sortie, evenements: f.evenements };
}

test('retire une ligne-marqueur de notion et la convertit en événement', () => {
  const { sortie, evenements } = filtrer([
    'Bonjour\n@@TUTEUR {"notion":{"nom":"HashMap","langage":"java","type":"mini-cours"}}\n',
  ]);
  expect(sortie).toBe('Bonjour\n');
  expect(evenements).toEqual([{ notion: { nom: 'HashMap', langage: 'java', type: 'mini-cours' } }]);
});

test('extrait un marqueur coupé en plusieurs fragments, sans retour à la ligne final', () => {
  const { sortie, evenements } = filtrer([
    '@@TU',
    'TEUR {"revi',
    'sion":{"id":"java-for","reussie":true}}',
  ]);
  expect(sortie).toBe('');
  expect(evenements).toEqual([{ revision: { id: 'java-for', reussie: true } }]);
});

test('retire un marqueur au JSON cassé sans créer d’événement', () => {
  const { sortie, evenements } = filtrer(['@@TUTEUR {cassé\n']);
  expect(sortie).toBe('');
  expect(evenements).toEqual([]);
});

test('ignore un JSON valide qui n’est ni notion ni revision', () => {
  const { evenements } = filtrer(['@@TUTEUR {"autre":1}\n']);
  expect(evenements).toEqual([]);
});

test('rend le texte sans marqueur à l’identique, même coupé au milieu d’une ligne', () => {
  const texte = 'Voici une boucle :\n```java\nfor (int i = 0; i < n; i++) {}\n```\nÀ toi !';
  const { sortie } = filtrer([texte.slice(0, 7), texte.slice(7, 30), texte.slice(30)]);
  expect(sortie).toBe(texte);
});

test('laisse passer une ligne qui contient @@TUTEUR ailleurs qu’au début', () => {
  const { sortie, evenements } = filtrer(['le format est @@TUTEUR {…}\n']);
  expect(sortie).toBe('le format est @@TUTEUR {…}\n');
  expect(evenements).toEqual([]);
});
