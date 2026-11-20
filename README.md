# @tuteur

Un tuteur dans le chat de VS Code. Il t'aide à débloquer tes exercices **sans te donner la solution**, et sans te faire perdre de temps.

## Prérequis

- VS Code 1.95 ou plus récent.
- L'extension **GitHub Copilot Chat**, connectée à ton compte GitHub. L'offre **Copilot Free** suffit. Avec **GitHub Education**, tu as plus de requêtes.

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
| `@tuteur /explique <notion>` | Tu n'as jamais vu une notion : mini-cours d'un écran. Ex. `/explique HashMap`. |
| `@tuteur /indice` | Tu veux un indice plus précis. Chaque `/indice` monte d'un palier (4 au maximum). |
| `@tuteur /rappel` | Révision rapide (1 min) des notions déjà travaillées. |
| `@tuteur /notions` | Liste de tes notions et de leur prochaine révision. |

Le tuteur voit ton fichier ouvert, ta sélection et les erreurs de compilation. Il n'a donc pas besoin que tu recopies ton code.

### Les paliers d'indice

1. Une question qui t'oriente.
2. Un indice concret : quelle notion, quelle méthode.
3. Un squelette avec des trous à compléter.
4. Le code de la seule partie bloquante, expliqué ligne par ligne.

### La mémoire des notions

Chaque notion sur laquelle tu as eu besoin d'aide est notée. Elle revient en révision après 1, 3, 7, 14 puis 30 jours. Au plus une fois par jour, une ligne discrète en fin de réponse te le rappelle.

Les notions sont stockées uniquement sur ton ordinateur, dans le stockage de l'extension.

## Développement

```powershell
npm install
npm test
npm run compile
npm run package
```

`F5` dans VS Code lance une fenêtre de test avec l'extension.
