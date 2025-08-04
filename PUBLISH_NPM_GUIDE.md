# 📦 Guide Publication NPM - read-gedcom-geneafan

## 🚀 Étapes de Publication

### 1️⃣ **Créer un compte NPM (si nécessaire)**
Allez sur https://www.npmjs.com/signup

### 2️⃣ **Se connecter dans le terminal**
```bash
npm login
# ou
npm adduser
```
Il vous demandera :
- Username
- Password  
- Email
- OTP (si 2FA activé)

### 3️⃣ **Vérifier la connexion**
```bash
npm whoami
```

### 4️⃣ **Préparer le package**

#### Mettre à jour package.json avec un nom scopé
```json
{
  "name": "@frankbracq/read-gedcom-geneafan",
  "version": "0.1.0",
  "description": "Parser GEDCOM optimisé pour GeneaFan avec compression avancée",
  "main": "src/index.js",
  "type": "module",
  "keywords": ["gedcom", "genealogy", "parser", "geneafan", "compression"],
  "author": "Frank Bracq",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/frankbracq/read-gedcom-geneafan.git"
  },
  "files": [
    "src/**/*",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=16.0.0"
  }
}
```

#### Créer un fichier .npmignore
```
# Development
dev/
tests/
scripts/
*.test.js

# Logs
*.log
npm-debug.log*

# Dependencies
node_modules/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Documentation locale
docs/
*.md
!README.md
```

#### Créer un README.md minimal
```markdown
# @frankbracq/read-gedcom-geneafan

Parser GEDCOM optimisé pour GeneaFan avec compression avancée et extraction de relations directes.

## Installation

```bash
npm install @frankbracq/read-gedcom-geneafan
```

## Usage

```javascript
import { GeneaFanParser } from '@frankbracq/read-gedcom-geneafan';

const parser = new GeneaFanParser({
  verbose: true,
  calculateQuality: true,
  compressEvents: true
});

const result = await parser.parse(gedcomData);
console.log(result.individualsCache); // Map des individus au format GeneaFan
```

## Features

- ✅ Parser TypeScript moderne basé sur read-gedcom
- ✅ Compression événements 56.2% (Phase 6 Cloud)
- ✅ Relations directes (f, m, s) - FamilyIndices obsolètes
- ✅ Format optimisé GeneaFan avec scores qualité
- ✅ Support complet GEDCOM 5.5.1

## License

MIT
```

### 5️⃣ **Tester le package localement**
```bash
# Voir ce qui sera publié
npm pack --dry-run

# Créer un tarball pour test
npm pack

# Résultat: frankbracq-read-gedcom-geneafan-0.1.0.tgz
```

### 6️⃣ **Publier !**
```bash
# Publication publique avec scope
npm publish --access public
```

### 7️⃣ **Vérifier la publication**
```
https://www.npmjs.com/package/@frankbracq/read-gedcom-geneafan
```

### 8️⃣ **Mettre à jour GeneaFan**
```bash
cd ../geneafan

# Désinstaller version locale
npm uninstall read-gedcom-geneafan

# Installer depuis NPM
npm install @frankbracq/read-gedcom-geneafan

# Mettre à jour l'import dans parse.js
# import { GeneaFanParser } from '@frankbracq/read-gedcom-geneafan';
```

## 📝 Notes Importantes

- Le nom scopé `@frankbracq/` évite les conflits
- Version 0.1.0 indique que c'est expérimental
- Publication instantanée, visible en ~30 secondes
- Gratuit pour packages publics
- Peut être mis à jour avec `npm version patch && npm publish`

## 🚨 Avant de Publier

Assurez-vous que :
- ✅ Pas de secrets/tokens dans le code
- ✅ Dépendances correctes dans package.json
- ✅ Code fonctionne (`node test.js`)
- ✅ Pas de chemins absolus locaux