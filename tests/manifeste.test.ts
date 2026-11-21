import { expect, test } from 'vitest';
import pkg from '../package.json';

test('déclare le participant tuteur et ses commandes', () => {
  const p = (pkg as any).contributes.chatParticipants[0];
  expect(p.id).toBe('tuteur.tuteur');
  expect(p.name).toBe('tuteur');
  expect(p.commands.map((c: { name: string }) => c.name))
    .toEqual(['demarrer', 'explique', 'indice', 'verifie']);
  expect((pkg as any).engines.vscode).toBe('^1.95.0');
});

test('ne dépend pas d’une extension Copilot à installer', () => {
  expect((pkg as any).extensionDependencies).toBeUndefined();
});

test('le paquet .vsix est toujours recompilé avant d’être créé', () => {
  expect((pkg as any).scripts['vscode:prepublish']).toBe('npm run compile');
});
