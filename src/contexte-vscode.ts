import * as path from 'node:path';
import * as vscode from 'vscode';
import { dansDossier, DonneesContexte, FichierOuvert, LIMITES, racineExercice } from './contexte';

type TourChat = vscode.ChatRequestTurn | vscode.ChatResponseTurn;

/** Taille maximale d'une pièce jointe lue depuis le disque. */
const TAILLE_MAX_PIECE = 2 * 1024 * 1024;

/**
 * Rassemble ce que l'utilisateur a sous les yeux : fichier actif, sélection, erreurs,
 * autres fichiers ouverts de l'exercice et pièces jointes.
 */
export async function collecterContexte(
  request: vscode.ChatRequest,
  historique: ReadonlyArray<TourChat> = [],
): Promise<DonneesContexte> {
  const donnees: DonneesContexte = { diagnostics: [], references: [], piecesIgnorees: [] };

  const editeur = vscode.window.activeTextEditor;
  const docActif = editeur?.document;
  let racine: string | undefined;
  if (editeur && docActif) {
    donnees.fichier = {
      nom: path.basename(docActif.fileName),
      langage: docActif.languageId,
      contenu: docActif.getText(),
      ligneCurseur: editeur.selection.active.line,
    };
    if (!editeur.selection.isEmpty) donnees.selection = docActif.getText(editeur.selection);
    donnees.diagnostics = vscode.languages
      .getDiagnostics(docActif.uri)
      .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
      .map((d) => `Ligne ${d.range.start.line + 1} : ${d.message}`);
    if (docActif.uri.scheme === 'file') racine = racineExercice(docActif.uri.fsPath, docActif.getText());
  }
  const uriActif = docActif?.uri.toString();

  // Pièces jointes du message actuel, puis celles des messages précédents (l'énoncé joint
  // à /demarrer reste ainsi visible pour les /indice suivants). Les pièces implicites des
  // anciens messages (fichier alors actif, zone visible) et le fichier actif sont ignorés.
  const anciennes = historique
    .filter((t): t is vscode.ChatRequestTurn => t instanceof vscode.ChatRequestTurn)
    .flatMap((t) => t.references.filter((r) => !r.id.startsWith('vscode.implicit')));
  const vus = new Set<string>();
  for (const ref of [...request.references, ...anciennes]) {
    const uri = uriDe(ref);
    if (uri && uri.toString() === uriActif) continue;
    const cle = uri?.toString() ?? ref.id;
    if (vus.has(cle)) continue;
    vus.add(cle);
    const lue = await lireReference(ref);
    if (lue) donnees.references.push(lue);
    else donnees.piecesIgnorees!.push(uri ? path.basename(uri.fsPath) : ref.id);
  }

  const onglets = await lireAutresOnglets(uriActif, vus, racine);
  donnees.autresFichiers = onglets.fichiers;
  donnees.autresFichiersNonJoints = onglets.nonLus;
  donnees.erreursProjet = erreursAutresFichiers(uriActif, racine);
  return donnees;
}

function uriDe(ref: vscode.ChatPromptReference): vscode.Uri | undefined {
  if (ref.value instanceof vscode.Uri) return ref.value;
  if (ref.value instanceof vscode.Location) return ref.value.uri;
  return undefined;
}

async function lireReference(
  ref: vscode.ChatPromptReference,
): Promise<{ nom: string; contenu: string } | undefined> {
  try {
    const valeur = ref.value;
    if (typeof valeur === 'string') return { nom: ref.id, contenu: valeur };
    if (valeur instanceof vscode.Uri) {
      const infos = await vscode.workspace.fs.stat(valeur);
      if (infos.type !== vscode.FileType.File || infos.size > TAILLE_MAX_PIECE) return undefined;
      // openTextDocument donne aussi les modifications non enregistrées.
      const doc = await vscode.workspace.openTextDocument(valeur);
      return { nom: path.basename(valeur.fsPath), contenu: doc.getText() };
    }
    if (valeur instanceof vscode.Location) {
      const doc = await vscode.workspace.openTextDocument(valeur.uri);
      return { nom: path.basename(valeur.uri.fsPath), contenu: doc.getText(valeur.range) };
    }
  } catch {
    // Pièce jointe illisible (binaire, supprimée…) : signalée par l'appelant.
  }
  return undefined;
}

/**
 * Fichiers ouverts dans d'autres onglets (ex. Student.java pendant qu'on écrit CourseRoster.java),
 * limités au dossier de l'exercice, sauf le fichier actif et les pièces jointes déjà lues.
 */
async function lireAutresOnglets(
  uriActif: string | undefined,
  dejaJoints: Set<string>,
  racine: string | undefined,
): Promise<{ fichiers: FichierOuvert[]; nonLus: number }> {
  const uris = new Map<string, vscode.Uri>();
  for (const groupe of vscode.window.tabGroups.all) {
    for (const onglet of groupe.tabs) {
      const entree = onglet.input;
      if (!(entree instanceof vscode.TabInputText)) continue;
      const cle = entree.uri.toString();
      if (cle === uriActif || uris.has(cle) || dejaJoints.has(cle)) continue;
      if (entree.uri.scheme !== 'file') continue;
      if (racine && !dansDossier(entree.uri.fsPath, racine)) continue;
      uris.set(cle, entree.uri);
    }
  }
  const candidats = [...uris.values()];
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

/** Erreurs (pas les avertissements) des autres fichiers de l'exercice. */
function erreursAutresFichiers(uriActif: string | undefined, racine: string | undefined): string[] {
  const erreurs: string[] = [];
  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    if (uri.toString() === uriActif) continue;
    if (racine && !dansDossier(uri.fsPath, racine)) continue;
    for (const d of diagnostics) {
      if (d.severity !== vscode.DiagnosticSeverity.Error) continue;
      erreurs.push(`${path.basename(uri.fsPath)} ligne ${d.range.start.line + 1} : ${d.message}`);
    }
  }
  return erreurs;
}
