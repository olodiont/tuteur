import { expect, test } from 'vitest';
import { suggestions } from '../src/suggestions';

test('après une réponse : indice plus précis et étape suivante', () => {
  const s = suggestions({ mode: 'auto', palier: 1 });
  expect(s.map((x) => x.label)).toEqual(['Indice plus précis', "C'est fait, vérifie"]);
  expect(s[0].command).toBe('indice');
  expect(s[1].command).toBe('verifie');
});

test('au dernier palier : plus de bouton indice', () => {
  const s = suggestions({ mode: 'indice', palier: 4 });
  expect(s.map((x) => x.label)).toEqual(["C'est fait, vérifie"]);
});

test('palier 3 en mode indice : le bouton indice reste', () => {
  expect(suggestions({ mode: 'indice', palier: 3 }).map((x) => x.command)).toContain('indice');
});

test('métadonnées absentes ou invalides : boutons par défaut', () => {
  expect(suggestions(undefined)).toHaveLength(2);
  expect(suggestions({ palier: 'x' })).toHaveLength(2);
});

test('erreurs de compilation dans le fichier : bouton « Explique cette erreur » en premier', () => {
  const s = suggestions({ mode: 'auto', palier: 1, aDesErreurs: true });
  expect(s[0].label).toBe('Explique cette erreur');
  expect(s[0].prompt).toContain('sans la corriger');
  expect(s).toHaveLength(3);
});
