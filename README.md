# 📘 xcraft-core-wizard

## Aperçu

Le module `xcraft-core-wizard` est une librairie utilitaire du framework Xcraft qui fournit des outils pour transformer et manipuler des définitions de wizards (assistants). Il permet de convertir des modules de wizard utilisant le format d'[Inquirer.js] en commandes exécutables sur le bus Xcraft et de sérialiser des wizards pour une utilisation côté client dans un environnement distribué.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module expose deux fonctions principales :

- **`stringify`** : Transforme un wizard en chaîne JSON avec des fonctions remplacées par des appels de commandes
- **`commandify`** : Convertit un module wizard en handlers de commandes pour le bus Xcraft

## Fonctionnement global

Le module `xcraft-core-wizard` agit comme un pont entre les définitions de wizards côté serveur et leur utilisation côté client. Il utilise deux approches complémentaires :

1. **Sérialisation avec `stringify`** : Transforme les fonctions d'un wizard en appels de commandes asynchrones, permettant l'exécution distante via le bus Xcraft
2. **Génération de commandes avec `commandify`** : Crée automatiquement les handlers de commandes nécessaires pour exposer les fonctions du wizard sur le bus

Le processus fonctionne en analysant récursivement la structure d'un module wizard et en identifiant les fonctions spécifiques (`validate`, `choices`, `filter`, `when`) qui sont typiques des systèmes d'assistants interactifs compatibles avec le format Inquirer.js.

### Architecture de communication

Le système utilise un modèle de communication asynchrone où :

- Les fonctions côté client deviennent des proxies qui envoient des commandes
- Les fonctions côté serveur sont exposées comme handlers de commandes
- La communication se fait via des événements nommés avec un pattern spécifique
- Chaque appel de fonction est identifié par un ID unique pour gérer les réponses

## Exemples d'utilisation

### Sérialisation d'un wizard

```javascript
const xWizard = require('xcraft-core-wizard');

// Transformer un wizard en version sérialisée
const wizardPath = './my-wizard-module';
const serializedWizard = xWizard.stringify(wizardPath);

// Le résultat peut être envoyé au client
console.log(serializedWizard);
```

### Génération de commandes pour un wizard

```javascript
const xWizard = require('xcraft-core-wizard');

// Module wizard exemple (format Inquirer.js)
const myWizardModule = {
  questions: [
    {
      name: 'username',
      type: 'input',
      message: 'Enter username:',
      validate: (input) => input.length > 0 || 'Username is required',
      filter: (input) => input.trim(),
    },
    {
      name: 'email',
      type: 'input',
      message: 'Enter email:',
      validate: (input) => /\S+@\S+\.\S+/.test(input) || 'Invalid email format',
      when: (answers) => answers.username !== 'admin',
    },
    {
      name: 'role',
      type: 'list',
      message: 'Select role:',
      choices: (answers) => {
        const baseRoles = ['user', 'moderator'];
        return answers.username === 'admin'
          ? [...baseRoles, 'admin']
          : baseRoles;
      },
    },
  ],
};

// Générer les commandes
const {handlers, rc} = xWizard.commandify(myWizardModule);

// Les handlers contiennent maintenant :
// - 'questions.username.validate'
// - 'questions.username.filter'
// - 'questions.email.validate'
// - 'questions.email.when'
// - 'questions.role.choices'
```

### Utilisation avec un wizard complexe

```javascript
// Wizard avec plusieurs catégories
const complexWizard = {
  userInfo: [
    {
      name: 'profile',
      validate: (data) => data.name && data.age > 0,
      choices: () => ['basic', 'advanced', 'expert'],
    },
  ],
  settings: [
    {
      name: 'theme',
      when: (answers) => answers.profile === 'advanced',
      filter: (value) => value.toLowerCase(),
    },
  ],
};

const {handlers, rc} = xWizard.commandify(complexWizard);
// Génère des commandes pour chaque catégorie :
// - 'userInfo.profile.validate'
// - 'userInfo.profile.choices'
// - 'settings.theme.when'
// - 'settings.theme.filter'
```

## Interactions avec d'autres modules

Le module `xcraft-core-wizard` interagit avec plusieurs composants de l'écosystème Xcraft :

- **[xcraft-traverse]** : Utilisé pour parcourir récursivement les structures d'objets et identifier les fonctions à transformer
- **[xcraft-core-bus]** : Les commandes générées sont destinées à être exécutées sur le bus Xcraft
- **[xcraft-core-server]** : Le serveur utilise ce module pour exposer automatiquement les wizards comme commandes
- **clone** : Utilisé pour créer une copie profonde du wizard avant transformation

## Détails des sources

### `index.js`

Le fichier principal expose deux fonctions utilitaires pour la manipulation des wizards compatibles avec le format Inquirer.js.

#### Méthodes publiques

- **`stringify(wizardPath)`** — Transforme un module wizard en chaîne JSON où toutes les fonctions sont remplacées par des appels de commandes asynchrones. Prend le chemin vers le module wizard et retourne une chaîne JSON sérialisée prête pour l'envoi côté client.

- **`commandify(module)`** — Analyse un module wizard et génère automatiquement les handlers de commandes et leur configuration. Retourne un objet avec `handlers` (les fonctions de commande) et `rc` (la configuration des commandes avec `parallel: true`).

#### Fonctions supportées dans les wizards

Le module reconnaît et traite automatiquement ces fonctions spécifiques dans les définitions de champs, conformément au format Inquirer.js :

- **`validate`** : Fonction de validation des entrées utilisateur, doit retourner `true` ou un message d'erreur
- **`choices`** : Fonction pour générer des choix dynamiques, peut dépendre des réponses précédentes
- **`filter`** : Fonction pour filtrer/transformer les entrées avant stockage
- **`when`** : Fonction conditionnelle pour déterminer si un champ doit être affiché

#### Mécanisme de transformation

La fonction `stringify` utilise `xcraft-traverse` pour parcourir récursivement l'objet wizard et remplace chaque fonction par un template qui :

1. Utilise `this.async()` pour créer un callback asynchrone
2. Génère un nom de commande basé sur le chemin dans l'objet : `wizard.${category}.${fieldName}.${functionName}`
3. Envoie la commande via `busClient.command.send`
4. Appelle le callback avec le résultat reçu

La fonction `commandify` crée des handlers qui :

1. Exécutent la fonction originale avec les données reçues (`msg.data`)
2. Émettent un événement avec le résultat via `resp.events.send`
3. Utilisent un nom d'événement structuré : `wizard.${category}.${fieldName}.${functionName}.${msg.id}.finished`
4. Configurent toutes les commandes avec `parallel: true` pour permettre l'exécution concurrente

#### Gestion des catégories

Le module supporte l'organisation des wizards en catégories multiples. Chaque propriété du module (sauf `xcraftCommands`) est traitée comme une catégorie contenant un tableau de définitions de champs. Cette structure permet d'organiser logiquement les questions d'un wizard complexe.

---

_Documentation mise à jour_

[inquirer.js]: https://github.com/SBoudrias/Inquirer.js
[xcraft-traverse]: https://github.com/Xcraft-Inc/xcraft-traverse
[xcraft-core-bus]: https://github.com/Xcraft-Inc/xcraft-core-bus
[xcraft-core-server]: https://github.com/Xcraft-Inc/xcraft-core-server