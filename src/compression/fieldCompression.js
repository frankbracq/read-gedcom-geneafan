/**
 * Phase 10 - Compression des noms de champs
 * Réduit la taille des objets individuels en raccourcissant les noms de propriétés
 * Économie : ~15% supplémentaire sur la taille du cache
 */

/**
 * Dictionnaire de compression des champs
 * Mapping champ long → champ court (1-2 caractères)
 */
export const FIELD_COMPRESSION = {
    // === IDENTITÉ ===
    'fullName': 'fn',           // Phase 12/13: "surname|name"
    'gender': 'g',              // Phase 14: M/F/U
    'nickname': 'nn',
    'title': 'tt',
    
    // === RELATIONS FAMILIALES ===
    'fatherId': 'f',
    'motherId': 'm',
    'spouseIds': 's',           // Array des conjoints
    'childIds': 'c',            // Array des enfants
    'siblingIds': 'b',          // brothers/sisters
    'parentIds': 'p',           // Array [père, mère]
    
    // === LIEUX ===
    'individualTowns': 't',     // towns
    'birthPlace': 'bl',         // birth location
    'deathPlace': 'dl',         // death location
    'residences': 'r',          // Array des résidences
    
    // === ÉVÉNEMENTS ===
    'individualEvents': 'e',    // events
    'birthDate': 'bd',
    'deathDate': 'dd',
    'marriageDate': 'md',
    
    // === DONNÉES ENRICHIES ===
    'multimedia': 'mm',         // Array des médias
    'notes': 'nt',             // Array des notes
    'sources': 'sr',           // Array des sources
    'occupations': 'oc',       // Array des professions
    'education': 'ed',         // Array formation
    'identifiers': 'id',       // Object des identifiants
    'addresses': 'ad',         // Array des adresses
    
    // === MÉTADONNÉES ===
    'bgColor': 'bg',           // Couleur de fond
    'quality': 'q',            // Score qualité
    'changeDate': 'ch',        // Date de modification
    'timeline': 'tl',          // Boolean timeline
    'statistics': 'st',        // Stats calculées
    
    // === ATTRIBUTS PHYSIQUES ===
    'height': 'h',
    'weight': 'w',
    'eyeColor': 'ey',
    'hairColor': 'hr',
    
    // === RELIGION & CULTURE ===
    'religion': 'rl',
    'nationality': 'na',
    'language': 'lg',
    
    // === CONTACT ===
    'email': 'em',
    'website': 'wb',
    'phone': 'ph',
    'social': 'so',            // Réseaux sociaux
    
    // === DONNÉES AVANCÉES ===
    'dnaMarkers': 'dn',        // Marqueurs ADN
    'medicalInfo': 'mi',       // Informations médicales
    'preferences': 'pr',       // Préférences utilisateur
    'customFields': 'cf'       // Champs personnalisés
};

/**
 * Dictionnaire inverse pour décompression
 */
export const FIELD_DECOMPRESSION = Object.fromEntries(
    Object.entries(FIELD_COMPRESSION).map(([key, value]) => [value, key])
);

/**
 * Compresse les noms de champs d'un objet
 * @param {Object} obj - Objet avec noms de champs longs
 * @param {Object} options - Options de compression
 * @returns {Object} Objet avec noms de champs courts
 */
export function compressFields(obj, options = {}) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }
    
    const compressed = {};
    const { 
        deep = true,           // Compression récursive
        skipEmpty = true,      // Ignorer les valeurs vides
        keepOriginal = false   // Garder les champs originaux
    } = options;
    
    for (const [key, value] of Object.entries(obj)) {
        // Ignorer les valeurs vides si demandé
        if (skipEmpty && isEmpty(value)) {
            continue;
        }
        
        // Trouver le nom compressé
        const compressedKey = FIELD_COMPRESSION[key] || key;
        
        // Compression récursive pour objets imbriqués
        let processedValue = value;
        if (deep && value && typeof value === 'object') {
            if (Array.isArray(value)) {
                // Compression des éléments du tableau
                processedValue = value.map(item => 
                    typeof item === 'object' ? compressFields(item, options) : item
                );
            } else {
                // Compression de l'objet imbriqué
                processedValue = compressFields(value, options);
            }
        }
        
        // Ajouter au résultat
        compressed[compressedKey] = processedValue;
        
        // Garder l'original si demandé (pour debug)
        if (keepOriginal && compressedKey !== key) {
            compressed[key] = value;
        }
    }
    
    return compressed;
}

/**
 * Décompresse les noms de champs d'un objet
 * @param {Object} obj - Objet avec noms de champs courts
 * @param {Object} options - Options de décompression
 * @returns {Object} Objet avec noms de champs longs
 */
export function decompressFields(obj, options = {}) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }
    
    const decompressed = {};
    const { deep = true } = options;
    
    for (const [key, value] of Object.entries(obj)) {
        // Trouver le nom décompressé
        const decompressedKey = FIELD_DECOMPRESSION[key] || key;
        
        // Décompression récursive pour objets imbriqués
        let processedValue = value;
        if (deep && value && typeof value === 'object') {
            if (Array.isArray(value)) {
                processedValue = value.map(item => 
                    typeof item === 'object' ? decompressFields(item, options) : item
                );
            } else {
                processedValue = decompressFields(value, options);
            }
        }
        
        decompressed[decompressedKey] = processedValue;
    }
    
    return decompressed;
}

/**
 * Compression conditionnelle (Phase 10 GeneaFan)
 * Active la compression seulement si les gains sont significatifs
 * @param {Object} obj - Objet à compresser
 * @param {number} minSavingsPercent - Pourcentage minimum d'économie (défaut: 10%)
 * @returns {Object} Objet compressé ou original
 */
export function conditionalCompressFields(obj, minSavingsPercent = 10) {
    if (!obj) return obj;
    
    // Test de compression
    const compressed = compressFields(obj, { skipEmpty: true });
    
    // Calcul des tailles
    const originalSize = JSON.stringify(obj).length;
    const compressedSize = JSON.stringify(compressed).length;
    const savingsPercent = ((originalSize - compressedSize) / originalSize) * 100;
    
    // Retourner la version compressée seulement si les gains sont significatifs
    if (savingsPercent >= minSavingsPercent) {
        return {
            data: compressed,
            metadata: {
                compressed: true,
                originalSize,
                compressedSize,
                savingsPercent: Math.round(savingsPercent)
            }
        };
    }
    
    return {
        data: obj,
        metadata: {
            compressed: false,
            reason: `Gains insuffisants: ${Math.round(savingsPercent)}% < ${minSavingsPercent}%`
        }
    };
}

/**
 * Décompression conditionnelle
 * @param {Object} result - Résultat de conditionalCompressFields
 * @returns {Object} Objet décompressé
 */
export function conditionalDecompressFields(result) {
    if (!result || !result.data) {
        return result;
    }
    
    if (result.metadata && result.metadata.compressed) {
        return decompressFields(result.data);
    }
    
    return result.data;
}

/**
 * Compression spécialisée pour individuals GeneaFan
 * Applique toutes les phases de compression de champs
 * @param {Object} individual - Individu avec données complètes
 * @returns {Object} Individu avec champs compressés
 */
export function compressGeneaFanIndividual(individual) {
    if (!individual) return individual;
    
    const result = {};
    
    // Phase 12/13: Compression name/surname → fn
    if (individual.name && individual.name.surname && individual.name.given) {
        result.fn = `${individual.name.surname}|${individual.name.given}`;
    }
    
    // Phase 14: Compression gender → g
    if (individual.sex) {
        const genderMap = { 'M': 'M', 'F': 'F', 'male': 'M', 'female': 'F' };
        result.g = genderMap[individual.sex] || 'U';
    }
    
    // Phase 10: Compression champs standards
    const fieldMappings = {
        'fatherId': 'f',
        'motherId': 'm',
        'siblingIds': 'b',
        'individualTowns': 't',
        'individualEvents': 'e',
        'multimedia': 'mm',
        'notes': 'nt',
        'sources': 'sr',
        'bgColor': 'bg'
    };
    
    for (const [original, compressed] of Object.entries(fieldMappings)) {
        if (individual[original] !== undefined && !isEmpty(individual[original])) {
            result[compressed] = individual[original];
        }
    }
    
    // Autres champs non-vides
    for (const [key, value] of Object.entries(individual)) {
        if (!fieldMappings[key] && key !== 'name' && key !== 'sex' && !isEmpty(value)) {
            const compressedKey = FIELD_COMPRESSION[key] || key;
            result[compressedKey] = value;
        }
    }
    
    return result;
}

/**
 * Vérifie si une valeur est vide (pour skipEmpty)
 * @private
 */
function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}

/**
 * Active/désactive la compression de champs globalement
 * Flag utilisé dans GeneaFan pour activer Phase 10
 */
export const ENABLE_FIELD_COMPRESSION = true;

/**
 * Calcule les statistiques de compression de champs
 * @param {Object} original - Objet original
 * @param {Object} compressed - Objet compressé
 * @returns {Object} Statistiques
 */
export function getFieldCompressionStats(original, compressed) {
    const originalStr = JSON.stringify(original);
    const compressedStr = JSON.stringify(compressed);
    
    const originalFields = countFields(original);
    const compressedFields = countFields(compressed);
    
    return {
        fields: {
            original: originalFields,
            compressed: compressedFields,
            reduction: originalFields - compressedFields
        },
        size: {
            original: originalStr.length,
            compressed: compressedStr.length,
            savings: originalStr.length - compressedStr.length,
            savingsPercent: Math.round((1 - compressedStr.length / originalStr.length) * 100)
        }
    };
}

/**
 * Compte le nombre de champs dans un objet (récursif)
 * @private
 */
function countFields(obj, count = 0) {
    if (!obj || typeof obj !== 'object') return count;
    
    for (const value of Object.values(obj)) {
        count++;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            count = countFields(value, count);
        }
    }
    
    return count;
}