# @tuteur

Un tuteur dans le chat de VS Code. Il t'aide à comprendre ce qu'il faut faire pour avancer sur ton exercice en cours, **sans te donner la solution**, et sans te faire perdre de temps.

## Prérequis

- VS Code 1.95 ou plus récent.
- GitHub Copilot, connecté à ton compte GitHub (intégré aux versions récentes de VS Code). L'offre **Copilot Free** suffit. Avec **GitHub Education**, tu as plus de requêtes.

## Installation

```powershell
code --install-extension tuteur-0.1.0.vsix
```

Recharge VS Code (`Ctrl+Shift+P` → « Developer: Reload Window »), ouvre le chat (`Ctrl+Alt+I`) et tape `@tuteur`.

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
