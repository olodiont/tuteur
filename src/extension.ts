import * as vscode from 'vscode';
import {
  CLE_REGLAGE,
  couperAutocompletion,
  estCoupee,
  Reglage,
  remettreAutocompletion,
  SECTION,
} from './autocompletion';
import { formaterContexte } from './contexte';
import { collecterContexte } from './contexte-vscode';
import { budgetHistorique, selectionnerHistorique, Tour } from './historique';
import { choisirModele, MESSAGE_SANS_MODELE } from './modele';
import { calculerPalier, determinerMode, PALIER_MAX, promptSysteme } from './prompts';
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

/**
 * Commandes des réponses réussies (celles qui ont des métadonnées) : un `/indice`
 * qui a échoué (pas de modèle, erreur) ne fait pas monter le palier.
 */
function commandesReussies(historique: ReadonlyArray<TourChat>): (string | undefined)[] {
  return historique
    .filter((t): t is vscode.ChatResponseTurn => t instanceof vscode.ChatResponseTurn)
    .map((t) => (t.result.metadata as Metadonnees | undefined)?.mode)
    .filter((mode): mode is string => typeof mode === 'string')
    .map((mode) => (mode === 'auto' ? undefined : mode));
}

const MESSAGE_QUOTA = `**Ta limite de requêtes Copilot est atteinte pour l'instant.**

Réessaie plus tard, ou choisis un autre modèle dans le sélecteur du chat. Avec **GitHub Education** (étudiant), la limite est plus haute.`;

const MESSAGE_COUPEE = `*Autocomplétion de Copilot coupée pendant que tu apprends (le code gris). La liste des noms de méthodes reste là. \`@tuteur /stop\` pour la remettre.*\n\n`;
const MESSAGE_REMISE = `Autocomplétion de Copilot remise, comme avant. Ta prochaine demande à \`@tuteur\` la coupera de nouveau.`;
const MESSAGE_PAS_COUPEE = `L'autocomplétion de Copilot n'était pas coupée par le tuteur : rien à remettre.`;

/** Couper / remettre le code gris de Copilot, branché sur les réglages de VS Code. */
interface Interrupteur {
  couper(): Promise<boolean>;
  remettre(): Promise<boolean>;
}

const creerHandler = (interrupteur: Interrupteur): vscode.ChatRequestHandler => async (request, chatContext, stream, token) => {
  if (request.command === 'stop') {
    stream.markdown((await interrupteur.remettre()) ? MESSAGE_REMISE : MESSAGE_PAS_COUPEE);
    return {};
  }
  if (await interrupteur.couper()) stream.markdown(MESSAGE_COUPEE);

  const mode = determinerMode(request.command);
  const palier = calculerPalier(commandesReussies(chatContext.history));
  const docActif = vscode.window.activeTextEditor?.document;
  const aDesErreurs = docActif
    ? vscode.languages.getDiagnostics(docActif.uri).some((d) => d.severity === vscode.DiagnosticSeverity.Error)
    : false;
  const metadata: Metadonnees = { mode, palier, aDesErreurs };

  const modele = await choisirModele(request.model);
  if (!modele) {
    stream.markdown(MESSAGE_SANS_MODELE);
    return {};
  }

  if (mode === 'indice') stream.markdown(`*Indice ${palier}/${PALIER_MAX}*\n\n`);
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
      const quota = err.code === vscode.LanguageModelError.Blocked.name;
      stream.markdown(
        sansAcces ? MESSAGE_SANS_MODELE
          : quota ? MESSAGE_QUOTA
          : `Le modèle a renvoyé une erreur : ${err.message}`,
      );
      return {};
    }
    if (token.isCancellationRequested) return {};
    throw err;
  }
  return { metadata };
};

export function activate(context: vscode.ExtensionContext): void {
  const reglage: Reglage = {
    lireGlobal: () =>
      vscode.workspace.getConfiguration(SECTION).inspect<boolean>(CLE_REGLAGE)?.globalValue,
    ecrireGlobal: async (valeur) => {
      await vscode.workspace.getConfiguration(SECTION).update(CLE_REGLAGE, valeur, vscode.ConfigurationTarget.Global);
    },
  };
  const memoire = context.globalState;

  const barre = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  barre.text = '$(mortar-board) Tuteur : sans code gris';
  barre.tooltip = "Le tuteur a coupé l'autocomplétion de Copilot. Clique pour la remettre.";
  barre.command = 'tuteur.remettreAutocompletion';
  const majBarre = () => (estCoupee(memoire) ? barre.show() : barre.hide());
  majBarre();

  // Un réglage illisible ou non modifiable ne doit jamais empêcher le tuteur de répondre.
  const sansErreur = async (action: () => Promise<boolean>) => {
    try {
      return await action();
    } catch {
      return false;
    } finally {
      majBarre();
    }
  };
  const interrupteur: Interrupteur = {
    couper: () => sansErreur(() => couperAutocompletion(reglage, memoire)),
    remettre: () => sansErreur(() => remettreAutocompletion(reglage, memoire)),
  };

  const commande = vscode.commands.registerCommand('tuteur.remettreAutocompletion', async () => {
    if (await interrupteur.remettre()) vscode.window.showInformationMessage(MESSAGE_REMISE);
  });

  const participant = vscode.chat.createChatParticipant('tuteur.tuteur', creerHandler(interrupteur));
  participant.iconPath = new vscode.ThemeIcon('mortar-board');
  participant.followupProvider = {
    provideFollowups: (result) => (result.metadata ? suggestions(result.metadata) : []),
  };
  context.subscriptions.push(participant, barre, commande);
}

export function deactivate(): void {}
