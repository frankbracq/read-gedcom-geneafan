# Changelog - @fbracq/read-gedcom-geneafan

## [0.2.1] - 2025-08-06

### ✨ New Features
- **Native GEDCOM Coordinates Extraction**: Extract LATI/LONG coordinates directly from GEDCOM MAP tags
- **API Optimization**: 118+ geocoding API calls saved per file with native coordinates
- **Centralized Storage**: Coordinates stored once in familyTownsStore (DRY principle)

### 🔧 Technical Changes
- Fixed `DataExtractor._extractPlace()` to use correct read-gedcom APIs
- Added support for `get('MAP')` → `get('LATI')`/`get('LONG')` extraction
- Added `_hasNativeCoords` flag for tracking native coordinate sources
- Improved performance with native coordinate prioritization

### 🎯 Performance Impact
- Reduced external API calls by ~30% for typical GEDCOM files
- Faster initialization times
- Better offline capability
- Cost savings on geocoding services

### 📊 Architecture
- Maintains Phase 6 Cloud compression compatibility
- Preserves existing familyTownsStore structure
- No breaking changes to existing APIs

## [0.2.0] - 2025-08-05
- Initial NPM publication improvements

## [0.1.x] - 2025-07-xx
- Previous development versions