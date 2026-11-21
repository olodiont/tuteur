import { beforeEach, describe, expect, test } from 'vitest';
import * as vscode from './fake-vscode';
import { activate } from '../src/extension';

type Message = { role: string; content: string };

function faireModele(options: { reponse?: string[]; erreur?: Error } = {}) {
  const recu: Message[][] = [];
  return {
    recu,
    modele: {
      maxInputTokens: 100_000,
      sendRequest: async (messages: Message[]) => {
        recu.push(messages);
        if (options.erreur) throw options.erreur;
        return {
          text: (async function* () {
            for (const f of options.reponse ?? ['Réponse.']) yield f;
          })(),
        };
      },
    },
  };
}

function faireStream() {
  const sortie: string[] = [];
  return { sortie, stream: { markdown: (t: string) => sortie.push(t), progress: () => undefined } };
}

const reussi = (mode: string, palier = 1) =>
  new vscode.ChatResponseTurn([new vscode.ChatResponseMarkdownPart('ok')], { metadata: { mode, palier } });
const echoue = () => new vscode.ChatResponseTurn([], {});
const demande = (prompt: string, command?: string) => new vscode.ChatRequestTurn(prompt, command);

async function appeler(opts: {
  prompt?: string;
  command?: string;
  history?: unknown[];
  model?: unknown;
}) {
  activate({ subscriptions: [] } as never);
  const { stream, sortie } = faireStream();
  const resultat = await vscode.participantCree!.handler(
    { prompt: opts.prompt ?? '', command: opts.command, references: [], model: opts.model },
    { history: opts.history ?? [] },
    stream,
    { isCancellationRequested: false },
  );
  return { resultat, sortie: sortie.join('') };
}

beforeEach(() => {
  vscode.etat.diagnostics = [];
  vscode.etat.modelesCopilot = [];
  vscode.window.activeTextEditor = undefined;
});

describe('handler @tuteur', () => {
  test('envoie consignes, contexte et message, puis renvoie mode et palier', async () => {
    const { modele, recu } = faireModele({ reponse: ['Bon', 'jour'] });
    const { resultat, sortie } = await appeler({ prompt: 'Je bloque', model: modele });
    expect(sortie).toBe('Bonjour');
    const messages = recu[0];
    expect(messages[0].content).toContain('Tu es @tuteur');
    expect(messages.at(-1)!.content).toContain('## Mon message\nJe bloque');
    expect(messages.at(-1)!.content).toContain('Aucun fichier ouvert.');
    expect(resultat).toEqual({ metadata: { mode: 'auto', palier: 1, aDesErreurs: false } });
  });

  test('message vide : demande d’aide à partir du code', async () => {
    const { modele, recu } = faireModele();
    await appeler({ prompt: '  ', model: modele });
    expect(recu[0].at(-1)!.content).toContain('aide-moi à partir de mon code');
  });

  test('historique rejoué dans l’ordre, entre consignes et message actuel', async () => {
    const { modele, recu } = faireModele();
    await appeler({
      prompt: 'et après ?',
      model: modele,
      history: [demande('énoncé', 'demarrer'), reussi('demarrer')],
    });
    const roles = recu[0].map((m) => m.role);
    expect(roles).toEqual(['user', 'user', 'assistant', 'user']);
    expect(recu[0][1].content).toBe('/demarrer énoncé');
  });

  test('palier affiché et transmis : deux /indice réussis → palier 3', async () => {
    const { modele, recu } = faireModele();
    const { sortie, resultat } = await appeler({
      command: 'indice',
      model: modele,
      history: [demande('', 'indice'), reussi('indice', 1), demande('', 'indice'), reussi('indice', 2)],
    });
    expect(sortie.startsWith('*Indice 3/4*')).toBe(true);
    expect(recu[0][0].content).toContain('Palier 3 sur 4');
    expect(resultat.metadata.palier).toBe(3);
  });

  test('un /indice qui a échoué ne fait pas monter le palier', async () => {
    const { modele } = faireModele();
    const { resultat } = await appeler({
      command: 'indice',
      model: modele,
      history: [demande('', 'indice'), reussi('indice', 1), demande('', 'indice'), echoue()],
    });
    expect(resultat.metadata.palier).toBe(2);
  });

  test('/verifie remet le palier à zéro', async () => {
    const { modele } = faireModele();
    const { resultat } = await appeler({
      command: 'indice',
      model: modele,
      history: [reussi('indice', 1), reussi('indice', 2), reussi('indice', 3), reussi('verifie')],
    });
    expect(resultat.metadata.palier).toBe(1);
  });

  test('pas de modèle : message d’installation, sans métadonnées', async () => {
    const { resultat, sortie } = await appeler({ prompt: 'aide', model: undefined });
    expect(sortie).toContain("n'a pas accès à un modèle");
    expect(resultat).toEqual({});
  });

  test('quota épuisé : message clair', async () => {
    const { modele } = faireModele({ erreur: vscode.LanguageModelError.Blocked('quota') });
    const { sortie, resultat } = await appeler({ prompt: 'aide', model: modele });
    expect(sortie).toContain('limite de requêtes');
    expect(resultat).toEqual({});
  });

  test('accès refusé : message d’installation', async () => {
    const { modele } = faireModele({ erreur: vscode.LanguageModelError.NoPermissions('non') });
    const { sortie } = await appeler({ prompt: 'aide', model: modele });
    expect(sortie).toContain("n'a pas accès à un modèle");
  });

  test('erreurs de compilation dans le fichier actif : signalées et bouton proposé', async () => {
    const uri = new vscode.Uri('/cours/exo1/Main.java');
    vscode.window.activeTextEditor = {
      document: {
        uri,
        fileName: uri.fsPath,
        languageId: 'java',
        getText: () => 'class Main {',
      },
      selection: { isEmpty: true, active: { line: 0 } },
    };
    vscode.etat.diagnostics = [[uri, [{ severity: 0, message: "'}' expected", range: { start: { line: 0 } } }]]];
    const { modele, recu } = faireModele();
    const { resultat } = await appeler({ prompt: 'ça compile pas', model: modele });
    expect(resultat.metadata.aDesErreurs).toBe(true);
    expect(recu[0].at(-1)!.content).toContain("'}' expected");
    const boutons = vscode.participantCree!.followupProvider!.provideFollowups(resultat);
    expect(boutons[0].label).toBe('Explique cette erreur');
  });

  test('les erreurs d’un autre exercice ne sont pas envoyées', async () => {
    const uri = new vscode.Uri('/cours/exo1/Main.java');
    vscode.window.activeTextEditor = {
      document: { uri, fileName: uri.fsPath, languageId: 'java', getText: () => 'class Main {}' },
      selection: { isEmpty: true, active: { line: 0 } },
    };
    vscode.etat.diagnostics = [
      [new vscode.Uri('/cours/exo1/Student.java'), [{ severity: 0, message: 'erreur exo1', range: { start: { line: 2 } } }]],
      [new vscode.Uri('/cours/exo2/Bank.java'), [{ severity: 0, message: 'erreur exo2', range: { start: { line: 5 } } }]],
    ];
    const { modele, recu } = faireModele();
    await appeler({ prompt: '?', model: modele });
    const contexte = recu[0].at(-1)!.content;
    expect(contexte).toContain('Student.java ligne 3 : erreur exo1');
    expect(contexte).not.toContain('erreur exo2');
  });
});
