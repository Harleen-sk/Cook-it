# Cook-it : Générateur de recettes par IA

Vous ouvrez le frigo, vous avez des ingrédients... mais aucune idée de quoi en faire ?
Cook-it génère des recettes personnalisées à partir de ce que vous avez réellement chez vous.

## Pourquoi ce projet ?

L'idée est née d'une frustration très concrète : je passe souvent du temps à chercher une recette,puis je me rend compte qu'il manque toujours un ingrédient ce qui casse la motivation de cuisiner ou je reviens systématiquement vers les mêmes plats, faute de trouver une alternative avec
ce que j'ai réellement sous la main
Et en faisant les courses, j'oublie souvent ce qu'il manquait réellement.

Étant végétarienne (sans œufs, poisson, ni fruits de mer), j'ai aussi remarqué que la plupart des applications de recettes traitent le filtre végétarien de façon très superficielle proposent encore du poisson ou d'autres produits non compatibles, sans réelle alternative adaptée.

Le déclic final est venu d'une amie qui voulait réduire sa consommation de viande, mais ne savait pas par où commencer ni comment rendre ses repas végétariens réellement satisfaisants. Vivant ce problème au quotidien moi-même, j'ai voulu construire un outil qui puisse nous aider toutes les deux et plus largement, toute personne dans la même situation.

## Ce que fait l'application

À partir de ce que l'utilisateur renseigne, l'application génère des recettes adaptées et concrètement réalisables.

**Entrées utilisateur :**
- Ingrédients disponibles
- Équipements de cuisine
- Préférences alimentaires
- Contraintes de temps et de budget

**Ce que l'app produit :**
- Des recettes contextualisées à ce que l'utilisateur a réellement sous la main
- Des suggestions de substitution intelligentes (pas juste "retirez l'ingrédient", mais une vraie alternative)
- Une liste de courses générée automatiquement et organisée par catégorie

## Stack technique

- Génération de recettes : API Gemini
- Interface mobile : React Native, typescript
- Environnement de dev : Docker

## Fonctionnalités prévues

- [ ] Formulaire de saisie des ingrédients/équipements simple, rapide, pensé mobile-first
- [ ] Génération de recettes via l'API Gemini contextuelle
- [ ] Suggestions de substitution d'ingrédients pratiques
- [ ] Liste de courses auto-générée, exportable et triée par catégorie
- [ ] Interface mobile fluide développée en React Native
- [ ] Setup Docker pour un développement et déploiement local facilités

## Statut du projet

Projet personnel en cours de développement.