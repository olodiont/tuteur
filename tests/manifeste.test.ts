import { expect, test } from 'vitest';
import pkg from '../package.json';

test('déclare le participant tuteur et ses commandes', () => {
  const p = (pkg as any).contributes.chatParticipants[0];
  expect(p.id).toBe('tuteur.tuteur');
  expect(p.name).toBe('tuteur');
  expect(p.commands.map((c: { name: string }) => c.name))
    .toEqual(['demarrer', 'explique', 'indice', 'rappel', 'notions']);
  expect((pkg as any).engines.vscode).toBe('^1.95.0');
});
