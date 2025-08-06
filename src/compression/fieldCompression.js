/**
 * Phase 10: Field Key Compression - Compresse les noms des champs JSON
 * Économie estimée: ~5% supplémentaire (110KB sur 2.24MB)
 * 
 * Stratégie: Utiliser des clés ultra-courtes pour réduire la taille JSON
 * Compatible avec la compression Phase 6 Cloud des événements
 */

// Dictionnaire de compression des champs (bidirectionnel)
const FIELD_COMPRESSION_MAP = {
    // Champs principaux
    'id': 'i',
    'name': 'p',           // p = person name
    'surname': 'n',        // n = name (family)
    'gender': 'g',
    
    // Relations familiales  
    'fatherId': 'f',
    'motherId': 'm',
    'spouseIds': 's',
    'siblingIds': 'b',     // b = brothers/sisters
    
    // Données géographiques et événements
    'individualTowns': 't',
    'individualEvents': 'e',
    
    // Champs calculés (si présents)
    'childrenIds': 'c',
    'generation': 'gen'
};

// Dictionnaire inverse pour décompression
const FIELD_DECOMPRESSION_MAP = Object.fromEntries(
    Object.entries(FIELD_COMPRESSION_MAP).map(([key, value]) => [value, key])
);

/**
 * Compresse les noms des champs d'un individu
 * @param {Object} individual - Individu à compresser
 * @returns {Object} - Individu avec champs compressés
 */
export function compressIndividualFields(individual) {
    if (!individual || typeof individual !== 'object') return individual;
    
    const compressed = {};
    
    for (const [key, value] of Object.entries(individual)) {
        const compressedKey = FIELD_COMPRESSION_MAP[key] || key;
        compressed[compressedKey] = value;
    }
    
    return compressed;
}

/**
 * Décompresse les noms des champs d'un individu
 * @param {Object} compressedIndividual - Individu avec champs compressés
 * @returns {Object} - Individu avec champs décompressés
 */
export function decompressIndividualFields(compressedIndividual) {
    if (!compressedIndividual || typeof compressedIndividual !== 'object') {
        return compressedIndividual;
    }
    
    const decompressed = {};
    
    for (const [key, value] of Object.entries(compressedIndividual)) {
        const decompressedKey = FIELD_DECOMPRESSION_MAP[key] || key;
        decompressed[decompressedKey] = value;
    }
    
    return decompressed;
}

/**
 * Compresse tout le cache des individus
 * @param {Map} individualsCache - Cache à compresser
 * @returns {Map} - Cache avec champs compressés
 */
export function compressIndividualsCache(individualsCache) {
    const compressedCache = new Map();
    
    for (const [id, individual] of individualsCache.entries()) {
        compressedCache.set(id, compressIndividualFields(individual));
    }
    
    return compressedCache;
}

/**
 * Décompresse tout le cache des individus
 * @param {Map} compressedCache - Cache compressé
 * @returns {Map} - Cache avec champs décompressés
 */
export function decompressIndividualsCache(compressedCache) {
    const decompressedCache = new Map();
    
    for (const [id, compressedIndividual] of compressedCache.entries()) {
        decompressedCache.set(id, decompressIndividualFields(compressedIndividual));
    }
    
    return decompressedCache;
}

/**
 * Calcule les statistiques de compression des champs
 * @param {Map} originalCache - Cache original
 * @param {Map} compressedCache - Cache compressé
 * @returns {Object} - Statistiques de compression
 */
export function calculateFieldCompressionStats(originalCache, compressedCache) {
    const originalJSON = JSON.stringify(Array.from(originalCache.entries()));
    const compressedJSON = JSON.stringify(Array.from(compressedCache.entries()));
    
    const originalSize = new Blob([originalJSON]).size;
    const compressedSize = new Blob([compressedJSON]).size;
    const savings = originalSize - compressedSize;
    const percentage = ((savings / originalSize) * 100).toFixed(1);
    
    return {
        originalSize,
        compressedSize,
        savings,
        percentage: parseFloat(percentage),
        originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
        compressedSizeMB: (compressedSize / 1024 / 1024).toFixed(2),
        savingsKB: (savings / 1024).toFixed(0)
    };
}

/**
 * Active/désactive la compression des champs
 * Flag de contrôle pour tests et déploiement progressif
 */
export const ENABLE_FIELD_COMPRESSION = false; // ⚠️ DÉSACTIVÉ - trop d'accès directs aux propriétés

/**
 * Wrapper conditionnel pour la compression des champs
 * @param {Object} individual - Individu à traiter
 * @returns {Object} - Individu compressé si activé, sinon original
 */
export function conditionalCompressFields(individual) {
    return ENABLE_FIELD_COMPRESSION ? compressIndividualFields(individual) : individual;
}

/**
 * Wrapper conditionnel pour la décompression des champs
 * @param {Object} individual - Individu à traiter
 * @returns {Object} - Individu décompressé si activé, sinon original
 */
export function conditionalDecompressFields(individual) {
    return ENABLE_FIELD_COMPRESSION ? decompressIndividualFields(individual) : individual;
}