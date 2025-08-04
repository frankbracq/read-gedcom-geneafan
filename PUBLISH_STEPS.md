# 🚀 Étapes pour Publier @fbracq/read-gedcom-geneafan

## 1. Connectez-vous à NPM

```bash
npm login
```

Il vous demandera :
- **Username**: fbracq (ou votre username)
- **Password**: votre mot de passe NPM
- **Email**: votre email
- **OTP**: code 2FA si activé

## 2. Vérifiez la connexion

```bash
npm whoami
# Devrait afficher: fbracq
```

## 3. Publiez le package

```bash
npm publish --access public
```

## 4. Succès !

Votre package sera disponible sur :
https://www.npmjs.com/package/@fbracq/read-gedcom-geneafan

## 5. Mettre à jour GeneaFan

```bash
cd ../geneafan

# Désinstaller la version locale
npm uninstall read-gedcom-geneafan

# Installer depuis NPM
npm install @fbracq/read-gedcom-geneafan
```

## 6. Modifier l'import dans parse.js

```javascript
// Remplacer
import { GeneaFanParser as ReadGedcomGeneaFanParser } from 'read-gedcom-geneafan';

// Par
import { GeneaFanParser as ReadGedcomGeneaFanParser } from '@fbracq/read-gedcom-geneafan';
```

## Notes

- La publication est instantanée (30 secondes)
- Le package est public et gratuit
- Pour mettre à jour : `npm version patch && npm publish`