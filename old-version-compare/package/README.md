# @fbracq/read-gedcom-geneafan

Parser GEDCOM optimisé pour GeneaFan avec compression avancée et extraction de relations directes.

## Installation

```bash
npm install @fbracq/read-gedcom-geneafan
```

## Usage

```javascript
import { GeneaFanParser } from '@fbracq/read-gedcom-geneafan';

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

## Format de Sortie

```javascript
{
  individualsCache: Map<string, {
    fn: "DUPONT|Jean",          // Nom compressé
    g: "M",                     // Genre compressé
    f: "@I2@",                  // Père (relation directe)
    m: "@I3@",                  // Mère (relation directe)
    e: [                        // Événements compressés
      {t:"fb",d:19290720,l:"paris"},
      {t:"fm",d:19521201,m:{s:"@I4@"}}
    ],
    q: 85                       // Score qualité
  }>,
  familiesCache: Map<string, Family>,
  readGedcomData: RootSelection, // 🚀 NOUVEAU: Objets read-gedcom avec APIs natives
  metadata: {
    compressionRatio: "56.2%",
    buildTime: 105
  }
}
```

## License

MIT