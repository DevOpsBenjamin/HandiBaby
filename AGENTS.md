# Multi-Account GitHub CLI & Git Rules

## GitHub CLI Authentication & Multi-Account Management
* **Préfixe obligatoire** : Toute commande `gh` exécutée sur tout projet appartenant au compte ou à l'organisation `DevOpsBenjamin` doit impérativement être préfixée avec `GH_TOKEN=$(gh auth token --user DevOpsBenjamin)` afin d'utiliser le compte `DevOpsBenjamin` sans JAMAIS modifier le compte actif global du système (`bledrappier`).
  * Exemple : `GH_TOKEN=$(gh auth token --user DevOpsBenjamin) gh pr list`
  * Exemple : `GH_TOKEN=$(gh auth token --user DevOpsBenjamin) gh pr create ...`
  * Exemple : `GH_TOKEN=$(gh auth token --user DevOpsBenjamin) gh pr view ...`
* **Interdiction formelle de `gh auth switch`** : Il est strictement interdit d'exécuter `gh auth switch`. Le compte actif global de la machine doit toujours rester `bledrappier`.
* **Push Git** : Pour pousser des commits vers un dépôt `DevOpsBenjamin`, utiliser le token non persistant sans changer l'authentification globale :
  `git push https://DevOpsBenjamin:$(gh auth token --user DevOpsBenjamin)@github.com/<owner>/<repo>.git <branch>`
  puis s'assurer que l'URL distante enregistrée dans `.git/config` reste l'URL propre `https://github.com/<owner>/<repo>.git`.
