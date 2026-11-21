import { describe, expect, test } from 'vitest';
import { Memoire, Reglage, couperAutocompletion, estCoupee, remettreAutocompletion } from '../src/autocompletion';

function faire(valeurGlobale: boolean | undefined) {
  const r = { valeur: valeurGlobale, ecritures: 0 };
  const reglage: Reglage = {
    lireGlobal: () => r.valeur,
    ecrireGlobal: async (v) => {
      r.valeur = v;
      r.ecritures++;
    },
  };
  const stock = new Map<string, unknown>();
  const memoire: Memoire = {
    get: (cle) => stock.get(cle) as never,
    update: async (cle, v) => {
      if (v === undefined) stock.delete(cle);
      else stock.set(cle, v);
    },
  };
  return { r, reglage, memoire };
}

describe('couperAutocompletion', () => {
  test('coupe le code gris et dit que c’est nouveau', async () => {
    const { r, reglage, memoire } = faire(true);
    expect(await couperAutocompletion(reglage, memoire)).toBe(true);
    expect(r.valeur).toBe(false);
    expect(estCoupee(memoire)).toBe(true);
  });

  test('déjà coupée : ne fait rien', async () => {
    const { r, reglage, memoire } = faire(true);
    await couperAutocompletion(reglage, memoire);
    expect(await couperAutocompletion(reglage, memoire)).toBe(false);
    expect(r.ecritures).toBe(1);
  });
});

describe('remettreAutocompletion', () => {
  test('remet la valeur d’avant (true)', async () => {
    const { r, reglage, memoire } = faire(true);
    await couperAutocompletion(reglage, memoire);
    expect(await remettreAutocompletion(reglage, memoire)).toBe(true);
    expect(r.valeur).toBe(true);
    expect(estCoupee(memoire)).toBe(false);
  });

  test('réglage absent avant : il est retiré (pas forcé à true)', async () => {
    const { r, reglage, memoire } = faire(undefined);
    await couperAutocompletion(reglage, memoire);
    await remettreAutocompletion(reglage, memoire);
    expect(r.valeur).toBeUndefined();
  });

  test('l’utilisateur l’avait déjà coupée lui-même : elle reste coupée après /stop', async () => {
    const { r, reglage, memoire } = faire(false);
    await couperAutocompletion(reglage, memoire);
    await remettreAutocompletion(reglage, memoire);
    expect(r.valeur).toBe(false);
  });

  test('pas coupée par le tuteur : /stop ne touche à rien', async () => {
    const { r, reglage, memoire } = faire(false);
    expect(await remettreAutocompletion(reglage, memoire)).toBe(false);
    expect(r.ecritures).toBe(0);
  });

  test('cycle complet deux fois', async () => {
    const { r, reglage, memoire } = faire(true);
    await couperAutocompletion(reglage, memoire);
    await remettreAutocompletion(reglage, memoire);
    await couperAutocompletion(reglage, memoire);
    expect(r.valeur).toBe(false);
    await remettreAutocompletion(reglage, memoire);
    expect(r.valeur).toBe(true);
  });
});
