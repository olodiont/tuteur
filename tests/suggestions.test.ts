import { expect, test } from 'vitest';
import { suggestions } from '../src/suggestions';

test('après une réponse : indice plus précis et étape suivante', () => {
  const s = suggestions({ mode: 'auto', palier: 1 });
  expect(s.map((x) => x.label)).toEqual(['Indice plus précis', "C'est fait, étape suivante"]);
  expect(s[0].command).toBe('indice');
  expect(s[1].command).toBeUndefined();
});

test('au dernier palier : plus de bouton indice', () => {
  const s = suggestions({ mode: 'indice', palier: 4 });
  expect(s.map((x) => x.label)).toEqual(["C'est fait, étape suivante"]);
});

test('palier 3 en mode indice : le bouton indice reste', () => {
  expect(suggestions({ mode: 'indice', palier: 3 }).map((x) => x.command)).toContain('indice');
});

test('métadonnées absentes ou invalides : boutons par défaut', () => {
  expect(suggestions(undefined)).toHaveLength(2);
  expect(suggestions({ palier: 'x' })).toHaveLength(2);
});
