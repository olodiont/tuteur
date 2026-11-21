import * as vscode from 'vscode';
import { formaterContexte } from './contexte';
import { collecterContexte } from './contexte-vscode';
import { choisirModele, MESSAGE_SANS_MODELE } from './modele';
import { calculerPalier, determinerMode, promptSysteme } from './prompts';

/** Texte Markdown d'une réponse précédente du tuteur. */
function texteReponse(tour: vscode.ChatResponseTurn): string {
  return tour.response
    .map((partie) => (partie instanceof vscode.ChatResponseMarkdownPart ? partie.value.value : ''))
    .join('');
}

export function activate(context: vscode.ExtensionContext): void {
  const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
    const commandesPrecedentes = chatContext.history
      .filter((t): t is vscode.ChatRequestTurn => t instanceof vscode.ChatRequestTurn)
      .map((t) => t.command);
    const mode = determinerMode(request.command);

    const modele = await choisirModele(request.model);
    if (!modele) {
      stream.markdown(MESSAGE_SANS_MODELE);
      return {};
    }

    const systeme = promptSysteme(mode, { palier: calculerPalier(commandesPrecedentes) });
    const contexte = formaterContexte(await collecterContexte(request, chatContext.history));
    const messages = [vscode.LanguageModelChatMessage.User(systeme)];
    for (const tour of chatContext.history) {
      if (tour instanceof vscode.ChatRequestTurn) {
        const prefixe = tour.command ? `/${tour.command} ` : '';
        messages.push(vscode.LanguageModelChatMessage.User(prefixe + tour.prompt));
      } else if (tour instanceof vscode.ChatResponseTurn) {
        const texte = texteReponse(tour);
        if (texte) messages.push(vscode.LanguageModelChatMessage.Assistant(texte));
      }
    }
    const demande = request.prompt.trim() || '(pas de message : aide-moi à partir de mon code)';
    messages.push(vscode.LanguageModelChatMessage.User(`${contexte}\n\n## Mon message\n${demande}`));

    try {
      const reponse = await modele.sendRequest(messages, {}, token);
      for await (const fragment of reponse.text) {
        stream.markdown(fragment);
      }
    } catch (err) {
      if (err instanceof vscode.LanguageModelError) {
        const sansAcces = err.code === vscode.LanguageModelError.NoPermissions.name
          || err.code === vscode.LanguageModelError.NotFound.name;
        stream.markdown(sansAcces ? MESSAGE_SANS_MODELE : `Le modèle a renvoyé une erreur : ${err.message}`);
        return {};
      }
      if (token.isCancellationRequested) return {};
      throw err;
    }
    return {};
  };

  const participant = vscode.chat.createChatParticipant('tuteur.tuteur', handler);
  participant.iconPath = new vscode.ThemeIcon('mortar-board');
  context.subscriptions.push(participant);
}

export function deactivate(): void {}
