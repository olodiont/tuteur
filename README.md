# @tuteur

Un tuteur dans le chat de VS Code. Il t'aide à comprendre ce qu'il faut faire pour avancer sur ton exercice en cours, **sans te donner la solution**, et sans te faire perdre de temps.

## Prérequis

- VS Code 1.95 ou plus récent.
- GitHub Copilot, connecté à ton compte GitHub (intégré aux versions récentes de VS Code). L'offre **Copilot Free** suffit. Avec **GitHub Education**, tu as plus de requêtes.

## Installation

```powershell
code --install-extension tuteur-0.1.0.vsix
```

Puis ouvre le chat de VS Code (`Ctrl+Alt+I`) et tape `@tuteur`.

## Utilisation

| Commande | Quand l'utiliser |
|---|---|
| `@tuteur <ta question>` | Tu bloques : il devine pourquoi et choisit l'aide adaptée. |
| `@tuteur /demarrer <énoncé>` | Tu ne sais pas par où commencer. Colle l'énoncé, ou joins le fichier avec `#file`. |
| `@tuteur /explique <notion>` | Une notion te manque : mini-cours d'un écran, relié à ton exercice. Ex. `/explique Iterator`. |
| `@tuteur /indice` | Tu veux un indice plus précis. Chaque `/indice` monte d'un palier (4 au maximum). |

Le tuteur voit ton fichier ouvert, ta sélection, les erreurs de compilation et les fichiers joints. Il n'a donc pas besoin que tu recopies ton code. Chaque réponse se termine par la prochaine étape à faire dans ton code.

L'apprentissage reste propre à la conversation : le tuteur se souvient de ce qu'il t'a déjà expliqué dans le chat en cours, et rien n'est gardé ensuite. Pour un nouvel exercice, ouvre un nouveau chat.

### Les paliers d'indice

1. Une question qui t'oriente.
2. Un indice concret : quelle notion, quelle méthode.
3. Un squelette avec des trous à compléter.
4. Le code de la seule partie bloquante, expliqué ligne par ligne.

## Développement

```powershell
npm install
npm test
npm run compile
npm run package
```

`F5` dans VS Code lance une fenêtre de test avec l'extension.
