import { describe, expect, test } from 'vitest';
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
    expect(calculerPalier(['indice', 'demarrer', undefined])).toBe(1);
  });
  test('une réponse libre ne remet pas le palier à zéro', () => {
    expect(calculerPalier(['indice', undefined])).toBe(2);
    expect(calculerPalier(['indice', undefined, 'indice', undefined])).toBe(3);
  });
});

describe('promptSysteme', () => {
  const modes: Mode[] = ['auto', 'demarrer', 'explique', 'indice'];

  test.each(modes)('le mode %s rappelle les garde-fous', (mode) => {
    const p = promptSysteme(mode, { palier: 1 });
    expect(p).toContain('jamais la solution complète');
    expect(p).toContain('français');
    expect(p).toContain('donne-moi la solution');
  });

  test.each(modes)('le mode %s ramène toujours à la prochaine étape de l’exercice en cours', (mode) => {
    expect(promptSysteme(mode, { palier: 1 })).toContain('prochaine étape');
  });

  test.each(modes)('le mode %s s’appuie sur ce qui a déjà été vu dans la conversation', (mode) => {
    expect(promptSysteme(mode, { palier: 1 })).toContain('déjà expliqué dans cette conversation');
  });

  test.each(modes)('le mode %s ne parle plus de suivi ni de révision', (mode) => {
    const p = promptSysteme(mode, { palier: 1 });
    expect(p).not.toContain('@@TUTEUR');
    expect(p).not.toContain('/rappel');
  });

  test('palier 4 : seule la partie bloquante, squelette si c’est tout l’exercice', () => {
    expect(promptSysteme('indice', { palier: 4 })).toContain('seule partie bloquante');
    expect(promptSysteme('indice', { palier: 4 })).toContain('essentiellement tout l');
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
});

describe('determinerMode', () => {
  test('commande explicite', () => {
    expect(determinerMode('indice')).toBe('indice');
  });
  test('sans commande : auto', () => {
    expect(determinerMode(undefined)).toBe('auto');
  });
  test('commande inconnue ou retirée : auto', () => {
    expect(determinerMode('bidon')).toBe('auto');
    expect(determinerMode('rappel')).toBe('auto');
  });
});
