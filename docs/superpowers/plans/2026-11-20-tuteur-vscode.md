# @tuteur — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extension VS Code qui ajoute un participant de chat `@tuteur` pour débloquer un étudiant sur ses exercices (coaching, rappel, mini-cours, indices par paliers) et mémoriser les notions travaillées.

**Architecture:** La logique est en modules TypeScript purs, testés avec Vitest : notions et révisions, filtre des marqueurs, contexte, prompts, rappels. `extension.ts` est une fine couche qui relie ces modules aux API VS Code Chat Participant et Language Model (`vscode.lm`, modèle Copilot). Le modèle signale les notions et les résultats de révision par une ligne-marqueur `@@TUTEUR {json}`, retirée du flux avant affichage.

**Tech Stack:** TypeScript 5, `@types/vscode` ^1.95, Vitest, `@vscode/vsce` pour le `.vsix`.

**Spec:** `docs/superpowers/specs/2026-11-20-tuteur-vscode-design.md`

## Global Constraints

- Participant : id `tuteur.tuteur`, nom `tuteur`. Commandes : `demarrer`, `explique`, `indice`, `rappel`, `notions`.
- Modèle via `vscode.lm.selectChatModels({ vendor: 'copilot' })`. Aucune clé d'API.
- Réponses en français. Code et noms techniques tels quels.
- Jamais la solution complète de l'exercice. Le palier 4 = code de la seule partie bloquante, expliqué.
- Paliers d'indice : 1 question qui oriente, 2 indice concret, 3 pseudo-code/squelette à trous, 4 code de la partie bloquante. Maximum 4.
- Coaching : au plus 2 questions avant le découpage, découpage en 3 à 6 étapes sans code.
- Rappel : 3 à 5 lignes + exemple de 1 à 5 lignes de code. Mini-cours : un écran maximum, un exemple qui n'est pas l'exercice, une seule question de vérification.
- Révision espacée : intervalles `[1, 3, 7, 14, 30]` jours. Réussite : intervalle suivant (plafond 30). Échec ou nouvelle aide : retour à 1.
- Ligne de rappel au plus une fois par jour, en fin de réponse : `N notions à revoir — @tuteur /rappel (1 min)`. `/rappel` : au plus 3 notions.
- Stockage : `notions.json` dans `context.globalStorageUri`. Aucune notification, aucun pop-up.
- Pas de lecture de PDF, pas de publication Marketplace, pas de panneau sur mesure.

## Review Focus

1. `notions.json` absent ou corrompu : base vide, pas de crash, fichier réécrit proprement à la sauvegarde suivante (Task 2).
2. Marqueur `@@TUTEUR` coupé entre deux fragments du streaming : jamais affiché, toujours extrait (Task 3).
3. Même notion nommée différemment (`HashMap`, `hashmap`, ` HashMap `) : une seule entrée (Task 2).
4. `/indice` demandé plus de 4 fois : reste au palier 4 (Task 5).
5. Aucun fichier ouvert, ou fichier très long : contexte sans fichier, ou tronqué autour du curseur (Task 4).

---

### Task 1: Squelette de l'extension

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.vscodeignore`, `.gitignore`, `.vscode/launch.json`, `src/extension.ts` (stub `activate`/`deactivate`)
- Test: `tests/manifeste.test.ts`

**Interfaces:**
- Produces: scripts npm `compile` (`tsc -p .`), `test` (`vitest run`), `package` (`vsce package`). Sortie `out/`, entrée `main: ./out/extension.js`.

- [ ] **Step 1: `git init` et `.gitignore`** (`node_modules/`, `out/`, `*.vsix`).
- [ ] **Step 2: Écrire le test du manifeste**

```ts
import pkg from '../package.json';
test('déclare le participant tuteur et ses commandes', () => {
  const p = pkg.contributes.chatParticipants[0];
  expect(p.id).toBe('tuteur.tuteur');
  expect(p.name).toBe('tuteur');
  expect(p.commands.map((c: { name: string }) => c.name))
    .toEqual(['demarrer', 'explique', 'indice', 'rappel', 'notions']);
  expect(pkg.engines.vscode).toBe('^1.95.0');
});
```

- [ ] **Step 3: Écrire `package.json`** avec `contributes.chatParticipants` (description de chaque commande en français, `isSticky: true`), `extensionDependencies: ["github.copilot-chat"]`, `activationEvents: []`. Puis `npm install -D typescript @types/vscode@1.95.0 @types/node vitest @vscode/vsce`.
- [ ] **Step 4: `npm test`** → PASS. **`npm run compile`** → aucune erreur.
- [ ] **Step 5: Commit** `chore: squelette de l'extension @tuteur`

### Task 2: Notions et révision espacée

**Files:**
- Create: `src/notions.ts`
- Test: `tests/notions.test.ts`

**Interfaces:**
- Produces:
  - `type TypeAide = 'rappel' | 'mini-cours' | 'indice'`
  - `interface Notion { id: string; nom: string; langage: string; type: TypeAide; vueLe: string; nbAides: number; prochaineRevision: string; palier: number }` (dates `YYYY-MM-DD` ; `palier` = index dans `INTERVALLES`)
  - `interface BaseNotions { notions: Notion[]; dernierRappelAffiche?: string }`
  - `const INTERVALLES = [1, 3, 7, 14, 30]`
  - `idNotion(langage: string, nom: string): string` — minuscules, trim, espaces → `-`, préfixe langage (`java-hashmap`)
  - `ajouterAide(base, { nom, langage, type }, aujourdhui: string): BaseNotions` — crée la notion, ou met `nbAides += 1`, `palier = 0`, `prochaineRevision = aujourdhui + 1`
  - `enregistrerRevision(base, id, reussie: boolean, aujourdhui): BaseNotions`
  - `notionsDues(base, aujourdhui): Notion[]` — `prochaineRevision <= aujourdhui`, les plus anciennes d'abord
  - `chargerBase(chemin: string): Promise<BaseNotions>` / `sauverBase(chemin, base): Promise<void>` (crée le dossier parent)
- Fonctions pures, sans muter l'entrée.

- [ ] **Step 1: Écrire les tests**
  - `ajouterAide` sur base vide → 1 notion, `id 'java-hashmap'`, `nbAides 1`, `prochaineRevision '2026-11-21'` (aujourd'hui `2026-11-20`).
  - `ajouterAide` avec `'HashMap'`, puis `' hashmap '` → une seule notion, `nbAides 2`.
  - `enregistrerRevision(..., true, ...)` répété depuis le palier 0 → `prochaineRevision` à +3, +7, +14, +30, puis reste à +30.
  - `enregistrerRevision(..., false, ...)` depuis le palier 3 → `palier 0`, +1 jour.
  - `notionsDues` ignore une notion dont la révision est demain.
  - `chargerBase` sur un chemin absent → `{ notions: [] }`. Sur un fichier contenant `{pas du json` → `{ notions: [] }`, sans exception.
  - `sauverBase` puis `chargerBase` dans un dossier temporaire inexistant → même contenu.
- [ ] **Step 2: `npx vitest run tests/notions.test.ts`** → FAIL (module absent).
- [ ] **Step 3: Implémenter `src/notions.ts`.** Les dates sont additionnées en UTC sur des chaînes `YYYY-MM-DD`, pour éviter les décalages de fuseau horaire.
- [ ] **Step 4: Relancer** → PASS.
- [ ] **Step 5: Commit** `feat: mémoire des notions et révision espacée`

### Task 3: Filtre des marqueurs `@@TUTEUR`

**Files:**
- Create: `src/marqueurs.ts`
- Test: `tests/marqueurs.test.ts`

**Interfaces:**
- Produces:
  - `type Evenement = { notion: { nom: string; langage: string; type: TypeAide } } | { revision: { id: string; reussie: boolean } }`
  - `class FiltreMarqueurs { pousser(fragment: string): string; terminer(): string; get evenements(): Evenement[] }`
  - `const PREFIXE = '@@TUTEUR '`
- Règle : le texte est mis en tampon par ligne. Une ligne complète qui commence par `@@TUTEUR ` (après trim) est parsée en JSON et retirée. Les autres lignes sont rendues. `terminer()` traite la dernière ligne sans `\n`. Un JSON invalide est ignoré silencieusement : la ligne est quand même retirée.

- [ ] **Step 1: Écrire les tests**
  - `pousser('Bonjour\n@@TUTEUR {"notion":{"nom":"HashMap","langage":"java","type":"mini-cours"}}\n')` → sortie totale `'Bonjour\n'`, 1 événement notion.
  - Même marqueur découpé en fragments `'@@TU'`, `'TEUR {"revi'`, `'sion":{"id":"java-for","reussie":true}}'`, sans `\n` final, puis `terminer()` → sortie totale `''`, 1 événement revision.
  - `'@@TUTEUR {cassé\n'` → sortie `''`, 0 événement.
  - Texte sans marqueur découpé au milieu d'une ligne → sortie identique à l'entrée une fois `terminer()` appelé.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter `src/marqueurs.ts`.**
- [ ] **Step 4: Lancer** → PASS.
- [ ] **Step 5: Commit** `feat: extraction des marqueurs du flux du modèle`

### Task 4: Contexte envoyé au modèle

**Files:**
- Create: `src/contexte.ts`
- Test: `tests/contexte.test.ts`

**Interfaces:**
- Produces:
  - `interface DonneesContexte { fichier?: { nom: string; langage: string; contenu: string; ligneCurseur: number }; selection?: string; diagnostics: string[]; references: { nom: string; contenu: string }[] }`
  - `tronquerAutourDuCurseur(contenu: string, ligneCurseur: number, maxLignes = 200): string` — garde `maxLignes` lignes centrées sur le curseur, marque `// … (N lignes omises)` en haut et/ou en bas
  - `formaterContexte(d: DonneesContexte): string` — sections Markdown `## Fichier actif`, `## Sélection`, `## Erreurs`, `## Pièces jointes`. Une section vide est omise. Sans fichier : `Aucun fichier ouvert.`
  - `collecterContexte(request: vscode.ChatRequest): Promise<DonneesContexte>` — dans `src/contexte-vscode.ts` (non testé unitairement) : éditeur actif, sélection, `vscode.languages.getDiagnostics(uri)` (erreurs et avertissements), `request.references` de type `Uri` ou `Location` lus via `workspace.fs`.

- [ ] **Step 1: Écrire les tests**
  - Fichier de 500 lignes, curseur ligne 250 → 200 lignes gardées + 2 marques d'omission. La ligne 250 est présente.
  - Fichier de 50 lignes → inchangé.
  - `formaterContexte({ diagnostics: [], references: [] })` contient `Aucun fichier ouvert.` et pas `## Erreurs`.
  - Avec un fichier `Main.java` et une erreur `';' expected` → contient `## Fichier actif`, ` ```java`, `';' expected`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter `src/contexte.ts` puis `src/contexte-vscode.ts`.**
- [ ] **Step 4: Lancer** → PASS. `npm run compile` → OK.
- [ ] **Step 5: Commit** `feat: collecte et mise en forme du contexte`

### Task 5: Prompts et paliers

**Files:**
- Create: `src/prompts.ts`
- Test: `tests/prompts.test.ts`

**Interfaces:**
- Consumes: `Notion` (Task 2), `PREFIXE` (Task 3).
- Produces:
  - `type Mode = 'auto' | 'demarrer' | 'explique' | 'indice' | 'rappel'`
  - `calculerPalier(commandesPrecedentes: (string | undefined)[]): number` — commandes des tours précédents de la conversation, du plus ancien au plus récent. Retourne `1 + nombre de 'indice' consécutifs en fin de liste`, plafonné à 4.
  - `promptSysteme(mode: Mode, options: { palier?: number; notionsARevoir?: Notion[] }): string`
- Contenu obligatoire de chaque prompt :
  - règles communes : français, réponses courtes, une seule question à la fois, jamais la solution complète, exemples différents de l'exercice, format du marqueur (`@@TUTEUR {"notion":{...}}` sur sa propre ligne en fin de réponse, quand un rappel, un mini-cours ou un palier 3-4 porte sur une notion) ;
  - par mode, les règles chiffrées des Global Constraints. `auto` : diagnostiquer la cause (page blanche, oubli, jamais vu) et poser une seule question de diagnostic si c'est ambigu. `indice` : le texte exact du palier demandé. `rappel` : la liste des notions, une question à la fois, `@@TUTEUR {"revision":{...}}` après chaque réponse.

- [ ] **Step 1: Écrire les tests**
  - `calculerPalier([])` → 1. `calculerPalier(['indice'])` → 2. `calculerPalier(['indice','indice','indice','indice','indice'])` → 4. `calculerPalier(['indice', 'explique'])` → 1.
  - Tous les modes contiennent `jamais la solution complète` et `@@TUTEUR`.
  - `promptSysteme('indice', { palier: 4 })` contient `seule partie bloquante`. `palier: 1` ne la contient pas.
  - `promptSysteme('demarrer', {})` contient `3 à 6 étapes`.
  - `promptSysteme('rappel', { notionsARevoir: [n] })` contient `n.id` et `"revision"`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter `src/prompts.ts`.**
- [ ] **Step 4: Lancer** → PASS.
- [ ] **Step 5: Commit** `feat: prompts par mode et paliers d'indice`

### Task 6: Ligne de rappel et `/notions`

**Files:**
- Create: `src/rappels.ts`
- Test: `tests/rappels.test.ts`

**Interfaces:**
- Consumes: `BaseNotions`, `notionsDues` (Task 2).
- Produces:
  - `ligneRappel(base: BaseNotions, aujourdhui: string): { texte: string; base: BaseNotions } | null` — `null` si aucune notion due, ou si `dernierRappelAffiche === aujourdhui`. Sinon le texte `\n\n---\nN notions à revoir — \`@tuteur /rappel\` (1 min)` (singulier `1 notion à revoir`), et la base avec `dernierRappelAffiche = aujourdhui`.
  - `formaterListeNotions(base, aujourdhui): string` — tableau Markdown `Notion | Langage | Aides | Prochaine révision`, dues en premier. Base vide : `Aucune notion enregistrée pour l'instant.`
  - `selectionRappel(base, aujourdhui): Notion[]` — au plus 3 notions dues.

- [ ] **Step 1: Écrire les tests** : 2 notions dues → texte avec `2 notions à revoir`. Second appel le même jour sur la base retournée → `null`. Le lendemain → de nouveau un texte. 5 notions dues → `selectionRappel` en retourne 3. Base vide → message `Aucune notion…`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter `src/rappels.ts`.**
- [ ] **Step 4: Lancer** → PASS.
- [ ] **Step 5: Commit** `feat: ligne de rappel quotidienne et liste des notions`

### Task 7: Brancher le participant et empaqueter

**Files:**
- Modify: `src/extension.ts`
- Create: `src/modele.ts`, `README.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces:
  - `src/modele.ts` : `choisirModele(): Promise<vscode.LanguageModelChat | undefined>` (premier résultat de `selectChatModels({ vendor: 'copilot' })`) ; `const MESSAGE_SANS_MODELE` = explication en français : installer GitHub Copilot Chat, se connecter, offre gratuite ou GitHub Education.
  - `extension.ts` `activate` : crée le participant `tuteur.tuteur` (icône facultative) et un handler qui :
    1. lit `request.command` (`undefined` → `auto`) ;
    2. `/notions` : affiche `formaterListeNotions`, sans appel au modèle ;
    3. charge la base (`globalStorageUri/notions.json`), calcule le palier à partir de `chatContext.history` (`ChatRequestTurn.command`), construit `promptSysteme` + `formaterContexte(await collecterContexte(request))` + historique de la conversation (tours précédents en messages User/Assistant) + `request.prompt` ;
    4. `/rappel` sans notion due : répond `Rien à revoir aujourd'hui.` sans appel au modèle ;
    5. envoie au modèle (`request.model` s'il vient de Copilot, sinon `choisirModele()`), passe chaque fragment dans `FiltreMarqueurs` puis `stream.markdown` ;
    6. applique les événements (`ajouterAide` / `enregistrerRevision`). Sauf pour `/rappel`, ajoute `ligneRappel`. Sauvegarde la base ;
    7. erreurs `vscode.LanguageModelError` ou absence de modèle → `stream.markdown(MESSAGE_SANS_MODELE)` ou le message d'erreur, sans exception non gérée.
  - `README.md` : installation (`code --install-extension tuteur-0.1.0.vsix`), prérequis Copilot, exemples d'usage des 6 commandes.

- [ ] **Step 1: Implémenter `src/modele.ts` et le handler.**
- [ ] **Step 2: `npm run compile` et `npm test`** → aucune erreur, tous les tests PASS.
- [ ] **Step 3: Vérification manuelle (F5, Extension Development Host)** avec un `Main.java` contenant une erreur :
  - `@tuteur /demarrer` + énoncé collé → découpage en 3 à 6 étapes, pas de code.
  - `@tuteur /indice` ×5 → paliers 1, 2, 3, 4, 4. Le palier 4 ne donne que la partie bloquante.
  - `@tuteur /explique HashMap` → mini-cours. Aucune ligne `@@TUTEUR` visible. `/notions` liste `HashMap`.
  - Copilot désactivé → message `MESSAGE_SANS_MODELE`.
- [ ] **Step 4: `npm run package`** → `tuteur-0.1.0.vsix` créé. Installer avec `code --install-extension tuteur-0.1.0.vsix` et refaire un essai rapide.
- [ ] **Step 5: Commit** `feat: participant @tuteur branché au modèle Copilot`
