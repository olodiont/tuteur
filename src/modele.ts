import * as vscode from 'vscode';

export const MESSAGE_SANS_MODELE = `**@tuteur n'a pas accès à un modèle d'IA.**

Il utilise le modèle de GitHub Copilot. Pour l'activer :
1. Installe l'extension **GitHub Copilot Chat** dans VS Code.
2. Connecte-toi à ton compte GitHub (icône du compte, en bas à gauche).
3. Active Copilot : l'offre **Copilot Free** suffit pour commencer. Avec **GitHub Education** (étudiant), tu as plus de requêtes.

Puis réessaie \`@tuteur\`.`;

/** Modèle choisi dans le chat ; à défaut, le premier modèle Copilot disponible. */
export async function choisirModele(
  modeleDeLaRequete: vscode.LanguageModelChat | undefined,
): Promise<vscode.LanguageModelChat | undefined> {
  if (modeleDeLaRequete) return modeleDeLaRequete;
  const modeles = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  return modeles[0];
}
