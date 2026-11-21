import * as vscode from 'vscode';
import { formaterContexte } from './contexte';
import { collecterContexte } from './contexte-vscode';
import { budgetHistorique, selectionnerHistorique, Tour } from './historique';
import { choisirModele, MESSAGE_SANS_MODELE } from './modele';
import { calculerPalier, determinerMode, promptSysteme } from './prompts';
import { Metadonnees, suggestions } from './suggestions';

type TourChat = vscode.ChatRequestTurn | vscode.ChatResponseTurn;

/** Texte Markdown d'une réponse précédente du tuteur. */
function texteReponse(tour: vscode.ChatResponseTurn): string {
  return tour.response
    .map((partie) => (partie instanceof vscode.ChatResponseMarkdownPart ? partie.value.value : ''))
    .join('');
}

/** Conversation précédente, sous forme de tours texte. */
function toursPrecedents(historique: ReadonlyArray<TourChat>): Tour[] {
  const tours: Tour[] = [];
  for (const tour of historique) {
    if (tour instanceof vscode.ChatRequestTurn) {
      const prefixe = tour.command ? `/${tour.command} ` : '';
      tours.push({ role: 'user', texte: prefixe + tour.prompt });
    } else if (tour instanceof vscode.ChatResponseTurn) {
      const texte = texteReponse(tour);
      if (texte) tours.push({ role: 'assistant', texte });
    }
  }
  return tours;
}

const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
  const commandesPrecedentes = chatContext.history
    .filter((t): t is vscode.ChatRequestTurn => t instanceof vscode.ChatRequestTurn)
    .map((t) => t.command);
  const mode = determinerMode(request.command);
  const palier = calculerPalier(commandesPrecedentes);
  const metadata: Metadonnees = { mode, palier };

  const modele = await choisirModele(request.model);
  if (!modele) {
    stream.markdown(MESSAGE_SANS_MODELE);
    return {};
  }

  stream.progress('Je regarde ton code…');
  const systeme = promptSysteme(mode, { palier });
  const contexte = formaterContexte(await collecterContexte(request, chatContext.history));
  const demande = request.prompt.trim() || '(pas de message : aide-moi à partir de mon code)';
  const dernier = `${contexte}\n\n## Mon message\n${demande}`;

  const budget = budgetHistorique(modele.maxInputTokens || 8_000, systeme.length + dernier.length);
  const historique = selectionnerHistorique(toursPrecedents(chatContext.history), budget);

  const messages = [
    vscode.LanguageModelChatMessage.User(systeme),
    ...historique.map((t) =>
      t.role === 'user'
        ? vscode.LanguageModelChatMessage.User(t.texte)
        : vscode.LanguageModelChatMessage.Assistant(t.texte),
    ),
    vscode.LanguageModelChatMessage.User(dernier),
  ];

  try {
    const reponse = await modele.sendRequest(messages, {}, token);
    for await (const fragment of reponse.text) {
      stream.markdown(fragment);
    }
  } catch (err) {
    if (err instanceof vscode.LanguageModelError) {
      const sansAcces =
        err.code === vscode.LanguageModelError.NoPermissions.name ||
        err.code === vscode.LanguageModelError.NotFound.name;
      stream.markdown(sansAcces ? MESSAGE_SANS_MODELE : `Le modèle a renvoyé une erreur : ${err.message}`);
      return {};
    }
    if (token.isCancellationRequested) return {};
    throw err;
  }
  return { metadata };
};

export function activate(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant('tuteur.tuteur', handler);
  participant.iconPath = new vscode.ThemeIcon('mortar-board');
  participant.followupProvider = {
    provideFollowups: (result) => (result.metadata ? suggestions(result.metadata) : []),
  };
  context.subscriptions.push(participant);
}

export function deactivate(): void {}
