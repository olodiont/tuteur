import * as path from 'node:path';
import * as vscode from 'vscode';
import type { DonneesContexte } from './contexte';

/** Rassemble ce que l'utilisateur a sous les yeux : fichier actif, sélection, erreurs, pièces jointes. */
export async function collecterContexte(request: vscode.ChatRequest): Promise<DonneesContexte> {
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

  for (const ref of request.references) {
    const lue = await lireReference(ref);
    if (lue) donnees.references.push(lue);
  }
  return donnees;
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
