import { describe, expect, test } from 'vitest';
import { budgetHistorique, selectionnerHistorique, Tour } from '../src/historique';

const t = (role: Tour['role'], n: number, lettre = 'x'): Tour => ({ role, texte: lettre.repeat(n) });

describe('selectionnerHistorique', () => {
  test('tout tient : historique inchangé', () => {
    const tours = [t('user', 10), t('assistant', 10)];
    expect(selectionnerHistorique(tours, 100)).toEqual(tours);
  });

  test('garde le premier message (souvent l’énoncé) et les plus récents', () => {
    const tours = [t('user', 30, 'e'), t('assistant', 30, 'a'), t('user', 30, 'b'), t('assistant', 30, 'c')];
    const garde = selectionnerHistorique(tours, 100);
    expect(garde.map((x) => x.texte[0])).toEqual(['e', 'b', 'c']);
  });

  test('budget trop petit même pour le premier message : seulement les plus récents qui tiennent', () => {
    const tours = [t('user', 500, 'e'), t('assistant', 20, 'a'), t('user', 20, 'b')];
    expect(selectionnerHistorique(tours, 50).map((x) => x.texte[0])).toEqual(['a', 'b']);
  });

  test('budget nul : rien', () => {
    expect(selectionnerHistorique([t('user', 10)], 0)).toEqual([]);
  });
});

describe('budgetHistorique', () => {
  test('3 caractères par jeton, 80 % de marge, moins ce qui est déjà utilisé', () => {
    expect(budgetHistorique(10_000, 4_000)).toBe(20_000);
  });

  test('jamais négatif', () => {
    expect(budgetHistorique(1_000, 50_000)).toBe(0);
  });
});
