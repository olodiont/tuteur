import { describe, expect, test } from 'vitest';
import type { Notion } from '../src/notions';
import { calculerPalier, determinerMode, Mode, promptSysteme } from '../src/prompts';

describe('calculerPalier', () => {
  test('premier indice : palier 1', () => {
    expect(calculerPalier([])).toBe(1);
  });
  test('un indice déjà donné : palier 2', () => {
    expect(calculerPalier(['indice'])).toBe(2);
  });
  test('plafonné à 4', () => {
    expect(calculerPalier(['indice', 'indice', 'indice', 'indice', 'indice'])).toBe(4);
  });
  test('une autre commande remet à zéro', () => {
    expect(calculerPalier(['indice', 'explique'])).toBe(1);

  });
});

describe('promptSysteme', () => {
  const modes: Mode[] = ['auto', 'demarrer', 'explique', 'indice', 'rappel'];

  test.each(modes)('le mode %s rappelle les garde-fous et le format du marqueur', (mode) => {
    const p = promptSysteme(mode, { palier: 1, notionsARevoir: [] });
    expect(p).toContain('jamais la solution complète');
    expect(p).toContain('@@TUTEUR');
    expect(p).toContain('français');
  });

  test('palier 4 : seule la partie bloquante', () => {
    expect(promptSysteme('indice', { palier: 4 })).toContain('seule partie bloquante');
    expect(promptSysteme('indice', { palier: 1 })).not.toContain('seule partie bloquante');
  });

  test('palier 3 : squelette à trous', () => {
    expect(promptSysteme('indice', { palier: 3 })).toContain('squelette');
  });

  test('démarrer : découpage en 3 à 6 étapes', () => {
    expect(promptSysteme('demarrer', {})).toContain('3 à 6 étapes');
  });

  test('auto : une seule question de diagnostic si la cause est ambiguë', () => {
    expect(promptSysteme('auto', {})).toContain('une seule question de diagnostic');
  });

  test('rappel : liste les notions et demande le marqueur revision', () => {
    const n: Notion = {
      id: 'java-hashmap', nom: 'HashMap', langage: 'java', type: 'mini-cours',
      vueLe: '2026-11-20', nbAides: 1, prochaineRevision: '2026-11-21', palier: 0,
    };
    const p = promptSysteme('rappel', { notionsARevoir: [n] });
    expect(p).toContain('java-hashmap');
    expect(p).toContain('"revision"');
  });
});

describe('determinerMode', () => {
  test('commande explicite', () => {
    expect(determinerMode('indice', [])).toBe('indice');
  });
  test('sans commande : auto', () => {
    expect(determinerMode(undefined, ['explique'])).toBe('auto');
  });
  test('réponse pendant une révision : reste en rappel', () => {
    expect(determinerMode(undefined, ['rappel'])).toBe('rappel');
    expect(determinerMode(undefined, ['rappel', undefined])).toBe('rappel');
  });
  test('commande inconnue : auto', () => {
    expect(determinerMode('bidon', [])).toBe('auto');
  });
});

describe('corrections relecture', () => {
  test('I2 : une réponse libre ne remet pas le palier à zéro', () => {
    expect(calculerPalier(['indice', undefined])).toBe(2);
    expect(calculerPalier(['indice', undefined, 'indice', undefined])).toBe(3);
    expect(calculerPalier(['indice', 'demarrer', undefined])).toBe(1);
  });

  test('M3 : palier 4 reste un squelette si la partie bloquante est tout l’exercice', () => {
    expect(promptSysteme('indice', { palier: 4 })).toContain('essentiellement tout l');
  });

  test('M3 : refus explicite de donner la solution', () => {
    expect(promptSysteme('auto', {})).toContain('donne-moi la solution');
  });

  test('I1 : le prompt de révision sort du mode si le message n’est pas une réponse', () => {
    expect(promptSysteme('rappel', { notionsARevoir: [] })).toContain('pas une réponse');
  });
});
