# @tuteur — extension VS Code qui apprend à coder pendant qu'on code

Date : 2026-11-20
Statut : brouillon, en attente de validation

## 1. Intention

L'utilisateur est étudiant. Il apprend Java en ce moment et touche à d'autres langages. Ses travaux sont surtout des exercices venant de ses cours (documents, PDF) ou de sites spécialisés. Il code dans VS Code.

Il bloque dans trois situations différentes :

1. **Page blanche** : il connaît les notions mais ne sait pas par où attaquer l'exercice.
2. **Oubli** : il a déjà vu la notion mais elle ne lui revient pas.
3. **Notion jamais apprise** : l'exercice demande quelque chose qu'il n'a pas encore vu. Il veut qu'on la lui apprenne sur le moment.

Les outils d'IA actuels (Copilot, etc.) écrivent le code à sa place : il avance mais n'apprend pas. `@tuteur` fait l'inverse. Il l'aide à débloquer **lui-même**, en restant efficace.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**
- Débloquer l'utilisateur sur ses exercices, dans VS Code, sans changer d'outil.
- Adapter l'aide à la cause du blocage : coaching, rappel ou mini-cours.
- Garder une trace des notions travaillées et les faire réviser brièvement.
- Rester rapide : une aide doit coûter quelques minutes, pas une demi-heure.

**Non-objectifs (v1)**
- Publication sur le Marketplace VS Code (installation locale en `.vsix`).
- Lecture directe des PDF : l'utilisateur colle le texte de l'énoncé.
- Notation ou correction complète d'un exercice.
- Support d'autres éditeurs que VS Code.
- Panneau d'interface sur mesure (on utilise le chat de VS Code).

**Anti-objectifs (échec même si « ça marche »)**
- Donner la solution complète de l'exercice d'entrée de jeu.
- Faire prendre beaucoup plus de temps que prévu. Contrainte de l'utilisateur : apprendre, mais pas « 4x plus de temps ». Cible : un blocage se résout en moins de 5 minutes d'échange.
- Être bavard : longs cours, rappels qui interrompent, questions en rafale.

## 3. Contraintes

- Extension VS Code en TypeScript.
- Utilise l'API **Chat Participant** de VS Code (participant `@tuteur` dans le chat) et l'API **Language Model** (`vscode.lm`) pour appeler le modèle fourni par GitHub Copilot. Pas de clé d'API payante.
- Prérequis : extension GitHub Copilot Chat installée et compte Copilot actif (gratuit pour les étudiants via GitHub Education).
- Réponses en français. Code et noms techniques laissés tels quels.
- Java en priorité, mais rien de spécifique à Java dans l'architecture.

## 4. Approches envisagées

| Approche | Avantages | Inconvénients |
|---|---|---|
| **A. Participant de chat `@tuteur` + modèle Copilot** (retenue) | Intégré au chat de VS Code, gratuit pour un étudiant, interface de chat déjà fournie | Dépend d'un compte Copilot et de son API |
| B. Panneau sur mesure + API Claude directe | Contrôle total, interface plus pédagogique | Clé d'API payante, beaucoup plus de code |
| C. Skill « mode tuteur » dans Claude Code | Prêt en quelques minutes | Hors de VS Code, hors du flux de travail |

L'utilisateur a choisi **A**. Il a demandé que l'extension soit construite pour lui (il ne la code pas lui-même).

## 5. Comportement

### 5.1 Commandes

Dans le chat de VS Code :

| Commande | Usage |
|---|---|
| `@tuteur <message>` | Mode automatique : le tuteur devine la cause du blocage et choisit l'aide |
| `@tuteur /demarrer <énoncé>` | Page blanche : découpe l'exercice en étapes |
| `@tuteur /explique <notion>` | Mini-cours sur une notion |
| `@tuteur /indice` | Indice suivant, plus précis, sur le blocage en cours |
| `@tuteur /rappel` | Révision rapide des notions dues |
| `@tuteur /notions` | Liste des notions enregistrées et leur état |

### 5.2 Contexte envoyé au modèle

À chaque requête, l'extension joint automatiquement :
- le fichier actif (nom, langage, contenu ; tronqué autour du curseur s'il est long) ;
- la sélection, si elle existe ;
- les erreurs de compilation/diagnostics du fichier actif ;
- les fichiers joints par l'utilisateur dans le chat (`#file`), par exemple l'énoncé copié dans un `.txt` ou `.md`.

### 5.3 Les trois modes

**Coaching (page blanche)**
- Reformule l'énoncé en une phrase.
- Pose 1 ou 2 questions courtes : entrées, sortie attendue, première étape à la main.
- Propose un découpage en 3 à 6 étapes, sans code.
- Pas plus de 2 questions avant de donner le découpage, pour rester rapide.

**Rappel (notion oubliée)**
- Rappel en 3 à 5 lignes + un exemple de 1 à 5 lignes de code, sans rapport direct avec l'exercice.
- Renvoie l'utilisateur à son code.

**Mini-cours (notion jamais vue)**
- Explication simple, environ un écran maximum.
- Un petit exemple qui n'est **pas** l'exercice.
- Une mini-question de vérification (une seule). L'utilisateur peut l'ignorer.
- Renvoie l'utilisateur à son code pour appliquer.

En mode automatique, si la cause n'est pas claire, le tuteur pose **une** question de diagnostic (« tu as déjà vu les `HashMap` ? ») plutôt que de deviner.

### 5.4 Échelle d'indices (efficacité)

Pour respecter la contrainte de temps, l'aide monte par paliers. `/indice` passe au palier suivant :

1. Question qui oriente.
2. Indice concret (quelle notion, quelle méthode).
3. Pseudo-code ou squelette avec des trous.
4. Code pour **la seule partie bloquante**, expliqué ligne par ligne.

Le palier 4 n'est jamais la solution complète de l'exercice. L'utilisateur peut monter de palier immédiatement, sans justification. Arriver au palier 4 n'est pas un échec : la notion est enregistrée pour être révisée.

Le palier en cours est mémorisé pour la conversation (historique du chat).

### 5.5 Mémoire des notions

Chaque fois qu'un rappel, un mini-cours ou un palier 3-4 porte sur une notion, elle est enregistrée. Le modèle renvoie le nom de la notion dans un format structuré que l'extension extrait.

Stockage : fichier JSON local dans le stockage global de l'extension (`context.globalStorageUri`), donc commun à tous les projets.

```json
{
  "notions": [
    {
      "id": "java-hashmap",
      "nom": "HashMap",
      "langage": "java",
      "type": "mini-cours",
      "vueLe": "2026-11-20",
      "nbAides": 2,
      "prochaineRevision": "2026-11-23",
      "palier": 1
    }
  ]
}
```

Révision espacée simple : intervalles de 1, 3, 7, 14, 30 jours. Réussir une révision fait monter d'un intervalle. La rater, ou avoir encore besoin d'aide sur la notion, fait revenir au premier.

### 5.6 Rappels non intrusifs

- Jamais de notification ni de pop-up.
- Au plus une fois par jour, une ligne en fin de réponse : « 2 notions à revoir — `@tuteur /rappel` (1 min) ».
- `/rappel` pose au plus 3 questions courtes, une à la fois.

### 5.7 Garde-fous du prompt

Le prompt système impose :
- ne jamais donner la solution complète de l'exercice ;
- réponses courtes, une seule question à la fois ;
- français, ton direct, adapté à un débutant ;
- exemples différents de l'exercice.

## 6. Architecture (proposition)

- `extension.ts` : enregistre le participant `@tuteur` et ses commandes.
- `contexte.ts` : rassemble fichier actif, sélection, diagnostics et références.
- `prompts.ts` : prompts système par mode et par palier.
- `modele.ts` : appel à `vscode.lm` (sélection du modèle Copilot, streaming de la réponse).
- `notions.ts` : lecture/écriture du JSON, calcul des révisions (logique pure, testable).
- `tests/` : tests unitaires de `notions.ts` et de l'extraction de la notion.

## 7. Ce qui est laissé au développeur

- Choix précis du modèle Copilot disponible (prendre le meilleur proposé par `vscode.lm`).
- Framework de test (tests unitaires sur la logique pure ; tests d'intégration VS Code facultatifs en v1).
- Format exact de la balise qui marque la notion dans la réponse du modèle.
- Seuil de troncature du fichier actif.
- Message affiché si Copilot n'est pas disponible (doit expliquer quoi installer).

## 8. Choix faits par Claude (à vérifier)

- Échelle à 4 paliers, palier 4 limité à la partie bloquante.
- Pas de lecture de PDF en v1 : on colle l'énoncé.
- Révision espacée 1/3/7/14/30 jours, rappel au plus une fois par jour en fin de réponse.
- Mémoire globale, partagée entre tous les projets.
- Installation locale en `.vsix`, pas de publication.

## 9. Révision du 2026-11-20 : apprentissage limité à la session

Après un premier essai, l'utilisateur abandonne la révision sur le long terme. L'apprentissage doit rester propre à la session : le tuteur l'aide à comprendre ce qu'il faut faire pour avancer sur l'exercice en cours.

Ce qui change, et remplace les sections 5.1, 5.5, 5.6 et 6 :
- Commandes : `@tuteur`, `/demarrer`, `/explique`, `/indice`. `/rappel` et `/notions` sont retirés.
- Plus de mémoire des notions, plus de fichier `notions.json`, plus de rappels, plus de marqueurs `@@TUTEUR`.
- La seule mémoire est la conversation du chat : le tuteur s'appuie sur ce qu'il a déjà expliqué dans cette conversation, sans le répéter.
- Chaque réponse se termine par la prochaine étape concrète à faire dans le code de l'exercice en cours.
- Un mini-cours (`/explique`) se termine en montrant où la notion sert dans l'exercice en cours.

Inchangé : les modes coaching / rappel / mini-cours, l'échelle d'indices à 4 paliers, les garde-fous (jamais la solution complète, réponses courtes), le contexte envoyé au modèle.

## 10. Améliorations du 2026-11-20 (revue complète)

Décidées par Claude pendant une revue autonome demandée par l'utilisateur :
- Commande `/verifie` (étape finie) : vérifie le code et donne l'étape suivante. Elle remet le palier d'indice à 1, pour qu'une nouvelle étape ne commence pas au palier 4.
- Un `/indice` qui a échoué (pas de modèle, erreur) ne compte pas dans le palier.
- Boutons sous chaque réponse : « Indice plus précis », « C'est fait, vérifie », et « Explique cette erreur » si le fichier actif ne compile pas.
- Palier affiché en tête des réponses `/indice` (*Indice 2/4*).
- Contexte élargi aux autres fichiers ouverts et aux erreurs, limité au dossier de l'exercice (dossier du fichier actif, en remontant le paquet Java et `src`).
- Limites de taille sur chaque élément du contexte ; historique gardé dans le budget du modèle (premier message et messages récents).
- Consignes : 8 lignes / ~120 mots, pas de « prochaine étape » après une question, indices sans répétition, l'exercice en cours défini, demande du message d'erreur pour les erreurs à l'exécution.
- Message clair quand le quota Copilot est atteint ; plus de dépendance déclarée à l'extension Copilot.
