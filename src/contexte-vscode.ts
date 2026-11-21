import * as path from 'node:path';
import * as vscode from 'vscode';
import { DonneesContexte, FichierOuvert, LIMITES } from './contexte';

/** Rassemble ce que l'utilisateur a sous les yeux : fichier actif, sélection, erreurs, pièces jointes. */
export async function collecterContexte(
  request: vscode.ChatRequest,
  historique: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn> = [],
): Promise<DonneesContexte> {
  const donnees: DonneesContexte = { diagnostics: [], references: [] };

  const editeur = vscode.window.activeTextEditor;
  if (editeur) {
    const doc = editeur.document;
    donnees.fichier = {
      nom: path.basename(doc.fileName),
      langage: doc.languageId,
      contenu: doc.getText(),
      ligneCurseur: editeur.selection.active.line,
    };
    if (!editeur.selection.isEmpty) donnees.selection = doc.getText(editeur.selection);
    donnees.diagnostics = vscode.languages
      .getDiagnostics(doc.uri)
      .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
      .map((d) => `Ligne ${d.range.start.line + 1} : ${d.message}`);
  }

  // Pièces jointes du message actuel, puis celles des messages précédents (l'énoncé joint
  // à /demarrer reste ainsi visible pour les /indice suivants). Doublons ignorés par nom.
  const anciennes = historique
    .filter((t): t is vscode.ChatRequestTurn => t instanceof vscode.ChatRequestTurn)
    .flatMap((t) => [...t.references]);
  const vus = new Set<string>();
  for (const ref of [...request.references, ...anciennes]) {
    const lue = await lireReference(ref);
    if (lue && !vus.has(lue.nom)) {
      vus.add(lue.nom);
      donnees.references.push(lue);
    }
  }

  const uriActif = editeur?.document.uri.toString();
  const onglets = await lireAutresOnglets(uriActif, vus);
  donnees.autresFichiers = onglets.fichiers;
  donnees.autresFichiersNonJoints = onglets.nonLus;
  donnees.erreursProjet = erreursAutresFichiers(uriActif);
  return donnees;
}

/**
 * Fichiers ouverts dans d'autres onglets (ex. Student.java pendant qu'on écrit CourseRoster.java),
 * sauf le fichier actif et les pièces jointes déjà lues.
 */
async function lireAutresOnglets(
  uriActif: string | undefined,
  dejaJoints: Set<string>,
): Promise<{ fichiers: FichierOuvert[]; nonLus: number }> {
  const uris = new Map<string, vscode.Uri>();
  for (const groupe of vscode.window.tabGroups.all) {
    for (const onglet of groupe.tabs) {
      const entree = onglet.input;
      if (!(entree instanceof vscode.TabInputText)) continue;
      const cle = entree.uri.toString();
      if (cle === uriActif || uris.has(cle)) continue;
      if (entree.uri.scheme !== 'file' && entree.uri.scheme !== 'untitled') continue;
      uris.set(cle, entree.uri);
    }
  }
  const candidats = [...uris.values()].filter((uri) => !dejaJoints.has(path.basename(uri.fsPath)));
  const fichiers: FichierOuvert[] = [];
  for (const uri of candidats.slice(0, LIMITES.autresFichiersMax)) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      fichiers.push({ nom: path.basename(uri.fsPath), langage: doc.languageId, contenu: doc.getText() });
    } catch {
      // Onglet illisible (binaire, supprimé…) : ignoré.
    }
  }
  return { fichiers, nonLus: Math.max(0, candidats.length - LIMITES.autresFichiersMax) };
}

/** Erreurs (pas les avertissements) des autres fichiers du projet. */
function erreursAutresFichiers(uriActif: string | undefined): string[] {
  const erreurs: string[] = [];
  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    if (uri.toString() === uriActif) continue;
    for (const d of diagnostics) {
      if (d.severity !== vscode.DiagnosticSeverity.Error) continue;
      erreurs.push(`${path.basename(uri.fsPath)} ligne ${d.range.start.line + 1} : ${d.message}`);
    }
  }
  return erreurs;
}

async function lireReference(
  ref: vscode.ChatPromptReference,
): Promise<{ nom: string; contenu: string } | undefined> {
  try {
    const valeur = ref.value;
    if (typeof valeur === 'string') return { nom: ref.id, contenu: valeur };
    if (valeur instanceof vscode.Uri) {
      const octets = await vscode.workspace.fs.readFile(valeur);
      return { nom: path.basename(valeur.fsPath), contenu: new TextDecoder().decode(octets) };
    }
    if (valeur instanceof vscode.Location) {
      const doc = await vscode.workspace.openTextDocument(valeur.uri);
      return { nom: path.basename(valeur.uri.fsPath), contenu: doc.getText(valeur.range) };
    }
  } catch {
    // Pièce jointe illisible (fichier binaire, supprimé…) : on l'ignore.
  }
  return undefined;
}
