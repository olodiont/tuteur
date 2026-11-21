# @tuteur

Un tuteur dans le chat de VS Code. Il t'aide à comprendre ce qu'il faut faire pour avancer sur ton exercice en cours, **sans te donner la solution**, et sans te faire perdre de temps.

## Installation pas à pas

Compte 5 minutes. L'extension n'est pas sur le Marketplace : on la construit à partir de ce dépôt, puis on l'installe dans VS Code.

### 1. Ce qu'il te faut

| Outil | Pourquoi | Vérifier dans un terminal |
|---|---|---|
| [VS Code](https://code.visualstudio.com/) 1.95 ou plus récent | L'extension tourne dedans | `code --version` |
| [Git](https://git-scm.com/downloads) | Récupérer le code | `git --version` |
| [Node.js](https://nodejs.org/) 20 ou plus récent | Construire l'extension | `node --version` |
| Un compte GitHub avec Copilot | C'est le modèle d'IA qu'utilise le tuteur | voir l'étape 5 |

Pour Copilot, l'offre gratuite **Copilot Free** suffit. Si tu es étudiant, **GitHub Education** te donne plus de requêtes, gratuitement.

### 2. Récupérer le code

```powershell
git clone https://github.com/olodiont/tuteur.git
```

```powershell
cd tuteur
```

### 3. Construire l'extension

```powershell
npm install
```

```powershell
npm run package
```

À la fin, un fichier `tuteur-0.1.0.vsix` apparaît dans le dossier `tuteur`.

### 4. L'installer dans VS Code

```powershell
code --install-extension tuteur-0.1.0.vsix
```

Si la commande `code` n'est pas reconnue, passe par VS Code :
1. Ouvre la vue Extensions (`Ctrl+Shift+X`).
2. Clique sur les **…** en haut de la vue.
3. Choisis **Install from VSIX…** et sélectionne `tuteur-0.1.0.vsix`.

### 5. Activer Copilot

Dans VS Code, clique sur l'icône de compte en bas à gauche et connecte-toi à GitHub. Si Copilot te le propose, active **Copilot Free**.

### 6. Essayer

1. Recharge VS Code : `Ctrl+Shift+P`, puis « Developer: Reload Window ».
2. Ouvre le chat : `Ctrl+Alt+I`.
3. Tape `@tuteur bonjour`.

Le tuteur répond, et **Tuteur : sans code gris** apparaît dans la barre d'état en bas. C'est bon, tu peux t'en servir sur tes exercices.

### Mettre à jour

Dans le dossier `tuteur`, récupère la dernière version et reconstruis l'extension :

```powershell
git pull
```

```powershell
npm run package
```

Puis réinstalle-la par-dessus l'ancienne :

```powershell
code --install-extension tuteur-0.1.0.vsix --force
```

### Désinstaller

1. Tape d'abord `@tuteur /stop` dans le chat, pour remettre l'autocomplétion de Copilot.
2. Puis désinstalle l'extension :

```powershell
code --uninstall-extension local.tuteur
```

### En cas de problème

| Problème | Solution |
|---|---|
| `@tuteur` n'apparaît pas dans le chat | Recharge VS Code. Vérifie que l'extension est installée : `code --list-extensions` doit afficher `local.tuteur`. |
| « @tuteur n'a pas accès à un modèle d'IA » | Connecte-toi à GitHub dans VS Code et active Copilot (étape 5). |
| « Ta limite de requêtes Copilot est atteinte » | Attends un peu, ou choisis un autre modèle dans le sélecteur du chat. |
| `npm` ou `node` n'est pas reconnu | Installe Node.js, puis ouvre un **nouveau** terminal. |
| Le code gris de Copilot ne revient pas | Tape `@tuteur /stop`. Sinon, remets `editor.inlineSuggest.enabled` à `true` dans les paramètres de VS Code. |

## Utilisation

| Commande | Quand l'utiliser |
|---|---|
| `@tuteur <ta question>` | Tu bloques : il devine pourquoi et choisit l'aide adaptée. |
| `@tuteur /demarrer <énoncé>` | Tu ne sais pas par où commencer. Colle l'énoncé, ou joins le fichier avec `#file:exo1.md`. |
| `@tuteur /explique <notion>` | Une notion te manque : mini-cours d'un écran, relié à ton exercice. Ex. `/explique Iterator`. |
| `@tuteur /indice` | Tu veux un indice plus précis. Chaque `/indice` monte d'un palier (affiché : *Indice 2/4*). |
| `@tuteur /verifie` | Tu as fini une étape : il vérifie ton code et te donne la suivante. Remet les indices au palier 1. |
| `@tuteur /stop` | Remet l'autocomplétion de Copilot (voir plus bas). Ne consomme pas de requête. |

Sous chaque réponse, des boutons te font gagner du temps :
- **Indice plus précis** : comme `/indice`.
- **C'est fait, vérifie** : comme `/verifie`.
- **Explique cette erreur** : apparaît quand ton fichier ne compile pas.

### Autocomplétion coupée pendant que tu apprends

Ta première demande à `@tuteur` coupe le **code gris de Copilot**, ces suggestions qui écrivent des lignes entières à ta place. La petite liste des noms de méthodes de VS Code (après `liste.`) reste là.

- Pendant la coupure, la barre d'état en bas affiche **Tuteur : sans code gris**.
- `@tuteur /stop`, ou un clic sur cet indicateur, remet le réglage exactement comme avant.
- La coupure reste active même si tu fermes VS Code, jusqu'à `/stop`.

Techniquement, le tuteur passe le réglage utilisateur `editor.inlineSuggest.enabled` à `false`. Si tu désinstalles l'extension sans faire `/stop`, remets ce réglage à la main dans les paramètres de VS Code.

### Ce que voit le tuteur

- Ton fichier actif (200 lignes autour du curseur) et ta sélection.
- Tes autres fichiers ouverts **du même exercice** (ex. `Student.java` pendant que tu écris `CourseRoster.java`).
- Les erreurs de compilation de l'exercice.
- Les fichiers que tu joins avec `#file`. L'énoncé joint au début reste visible pour toute la conversation.

Il ne voit pas la sortie de ton programme ni le terminal : pour une erreur à l'exécution, colle le message dans le chat.

L'apprentissage reste propre à la conversation : le tuteur se souvient de ce qu'il t'a déjà expliqué dans le chat en cours, et rien n'est gardé ensuite. Pour un nouvel exercice, ouvre un nouveau chat.

### Les paliers d'indice

1. Une question qui t'oriente.
2. Un indice concret : quelle notion, quelle méthode.
3. Un squelette avec des trous à compléter.
4. Le code de la seule partie bloquante, expliqué ligne par ligne (un squelette détaillé si l'exercice est tout petit).

## Développement

```powershell
npm install
npm test
npm run package
```

`npm run package` recompile puis crée le `.vsix`. `F5` dans VS Code lance une fenêtre de test avec l'extension.
