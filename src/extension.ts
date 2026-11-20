import * as vscode from 'vscode';
import { formaterContexte } from './contexte';
import { collecterContexte } from './contexte-vscode';
import { FiltreMarqueurs } from './marqueurs';
import { choisirModele, MESSAGE_SANS_MODELE } from './modele';
import { ajouterAide, BaseNotions, chargerBase, enregistrerRevision, Notion, sauverBase } from './notions';
import { calculerPalier, determinerMode, promptSysteme } from './prompts';
import { formaterListeNotions, ligneRappel, notionsRappelRestantes, selectionRappel } from './rappels';

/** Date locale au format YYYY-MM-DD. */
function aujourdhui(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Texte Markdown d'une réponse précédente du tuteur. */
function texteReponse(tour: vscode.ChatResponseTurn): string {
  return tour.response
    .map((partie) => (partie instanceof vscode.ChatResponseMarkdownPart ? partie.value.value : ''))
    .join('');
}

/** Notions figées au dernier `/rappel` de la conversation (stockées dans le résultat de la réponse). */
function idsRappelDeLaSession(historique: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): string[] {
  for (let i = historique.length - 1; i >= 0; i--) {
    const tour = historique[i];
    if (tour instanceof vscode.ChatResponseTurn) {
      const ids = tour.result.metadata?.idsRappel;
      if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === 'string');
    }
  }
  return [];
}

export function activate(context: vscode.ExtensionContext): void {
  const cheminBase = vscode.Uri.joinPath(context.globalStorageUri, 'notions.json').fsPath;

  const handler: vscode.ChatRequestHandler = async (request, chatContext, stream, token) => {
    const jour = aujourdhui();
    let base: BaseNotions = await chargerBase(cheminBase);

    if (request.command === 'notions') {
      stream.markdown(formaterListeNotions(base, jour));
      return {};
    }

    const commandesPrecedentes = chatContext.history
      .filter((t): t is vscode.ChatRequestTurn => t instanceof vscode.ChatRequestTurn)
      .map((t) => t.command);
    let mode = determinerMode(request.command, commandesPrecedentes);
    let notionsARevoir: Notion[] = [];
    let idsRappel: string[] | undefined;
    if (request.command === 'rappel') {
      notionsARevoir = selectionRappel(base, jour);
      if (notionsARevoir.length === 0) {
        stream.markdown("Rien à revoir aujourd'hui. 👍");
        return {};
      }
      idsRappel = notionsARevoir.map((n) => n.id);
    } else if (mode === 'rappel') {
      // Réponse pendant une révision : on reprend les notions figées au début de la session.
      idsRappel = idsRappelDeLaSession(chatContext.history);
      notionsARevoir = notionsRappelRestantes(base, idsRappel, jour);
      if (notionsARevoir.length === 0) mode = 'auto';
    }

    const modele = await choisirModele(request.model);
    if (!modele) {
      stream.markdown(MESSAGE_SANS_MODELE);
      return {};
    }

    const systeme = promptSysteme(mode, { palier: calculerPalier(commandesPrecedentes), notionsARevoir });
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

    const filtre = new FiltreMarqueurs();
    try {
      const reponse = await modele.sendRequest(messages, {}, token);
      for await (const fragment of reponse.text) {
        const visible = filtre.pousser(fragment);
        if (visible) stream.markdown(visible);
      }
      const reste = filtre.terminer();
      if (reste) stream.markdown(reste);
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
    if (token.isCancellationRequested) return {};

    for (const ev of filtre.evenements) {
      base = 'notion' in ev
        ? ajouterAide(base, ev.notion, jour)
        : enregistrerRevision(base, ev.revision.id, ev.revision.reussie, jour);
    }
    if (mode !== 'rappel') {
      const rappel = ligneRappel(base, jour);
      if (rappel) {
        stream.markdown(rappel.texte);
        base = rappel.base;
      }
    }
    await sauverBase(cheminBase, base);
    return idsRappel ? { metadata: { idsRappel } } : {};
  };

  const participant = vscode.chat.createChatParticipant('tuteur.tuteur', handler);
  participant.iconPath = new vscode.ThemeIcon('mortar-board');
  context.subscriptions.push(participant);
}

export function deactivate(): void {}
