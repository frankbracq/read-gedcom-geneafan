/**
 * Phase 6 - Compression cloud-native pour événements
 * Structure ultra-compacte pour optimiser le stockage Cloudflare R2
 * 
 * Objectif: 20% d'économie supplémentaire sur le cache
 * Format: { "t": "fb", "d": 19290720, "l": "fourmies" }
 */

/**
 * Dictionnaire des types d'événements compressés
 * Économise ~50% sur les types d'événements fréquents
 */
const EVENT_TYPE_COMPRESSION = {
    // Événements familiaux (family)
    'birth': 'fb',
    'death': 'fd', 
    'marriage': 'fm',
    'divorce': 'fv',
    'baptism': 'ft',
    'christening': 'ft',  // Même code que baptism
    'adoption': 'fa',
    'child-birth': 'fc',
    'today': 'fy',
    
    // Événements professionnels (professional)
    'occupation': 'po',
    'promotion': 'pn',       // Changé pp→pn pour éviter conflit avec property
    'retirement': 'pt',      // Changé pr→pt pour éviter conflit avec residence
    'business-creation': 'pc',
    
    // Événements éducatifs (education)
    'education': 'pe',       // Changé ee→pe pour cohérence
    'diploma': 'ed',
    'graduation': 'eg',
    'certification': 'ec',
    
    // Distinctions (distinction)
    'decoration': 'dd',
    'award': 'da',
    'recognition': 'dr',
    'title': 'dt',
    
    // Événements médiatiques (media)
    'media-mention': 'mm',
    'publication': 'mp',
    'interview': 'mi',
    'public-speech': 'ms',
    
    // Événements géographiques (geographic)
    'migration': 'gm',
    'residence': 'pr',      // Changé gr→pr pour cohérence avec extraction
    'travel': 'gt',
    
    // Événements personnels (personal)
    'illness': 'pi',
    'recovery': 'py',       // Changé pr→py (recovery)
    'military-service': 'pm',
    
    // Événements administratifs (administrative) 
    'immigration': 'ai',
    'naturalization': 'an',
    'census': 'ac',
    
    // Événements religieux étendus (religious)
    'confirmation': 'rc',
    'first-communion': 'rf',
    'bar-mitzvah': 'rb',
    'bat-mitzvah': 'ra',
    'adult-christening': 'rh',
    
    // Événements supplémentaires read-gedcom
    'burial': 'bu',
    'cremation': 'cr',
    'emigration': 'em',
    'census': 'ac',     // Utilisé notre mapping administratif
    'probate': 'pb',    // Utilise pb maintenant que business-creation est changé
    'will': 'pw',
    
    // Attributs (traités comme événements)
    'caste': 'ca',
    'physical-description': 'pd',
    'id-number': 'in',
    'nationality': 'na',
    'children-count': 'cc',
    'marriage-count': 'mc',
    'property': 'pp',   // Garde pp pour property
    'religion': 'rl',
    'title': 'ti',
    
    // Événements personnalisés
    'custom': 'cx'      // Pour les événements EVEN génériques
};

/**
 * Dictionnaire inverse pour décompression
 */
const EVENT_TYPE_DECOMPRESSION = Object.fromEntries(
    Object.entries(EVENT_TYPE_COMPRESSION).map(([key, value]) => [value, key])
);

/**
 * Convertit une date DD/MM/YYYY vers format compact YYYYMMDD
 * @param {string} dateStr - Date format "20/07/1929"
 * @returns {number|null} - Date format 19290720 ou null
 */
function compressDate(dateStr) {
    if (!dateStr || dateStr === "date inconnue") return null;
    
    try {
        // Gérer les années seules (ex: "1939")
        if (/^\d{4}$/.test(dateStr)) {
            return parseInt(`${dateStr}0101`); // 1er janvier par défaut
        }
        
        // Gérer les dates complètes DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        
        const [day, month, year] = parts;
        const paddedDay = day.padStart(2, '0');
        const paddedMonth = month.padStart(2, '0');
        
        return parseInt(`${year}${paddedMonth}${paddedDay}`);
    } catch (error) {
        console.warn('Erreur compression date:', dateStr, error);
        return null;
    }
}

/**
 * Convertit une date compacte YYYYMMDD vers format DD/MM/YYYY
 * @param {number} compactDate - Date format 19290720
 * @returns {string|null} - Date format "20/07/1929" ou null
 */
function decompressDate(compactDate) {
    if (!compactDate) return null;
    
    try {
        const dateStr = compactDate.toString();
        if (dateStr.length !== 8) return null;
        
        const year = dateStr.slice(0, 4);
        const month = dateStr.slice(4, 6);
        const day = dateStr.slice(6, 8);
        
        // Si c'est une année seule (01/01), retourner juste l'année
        if (month === '01' && day === '01') {
            return year;
        }
        
        return `${parseInt(day)}/${parseInt(month)}/${year}`;
    } catch (error) {
        console.warn('Erreur décompression date:', compactDate, error);
        return null;
    }
}

/**
 * Compresse un événement en format cloud-optimisé
 * @param {Object} event - Événement standard
 * @returns {Object} - Événement compressé
 */
export function compressEvent(event) {
    if (!event || !event.type) return event;
    
    const compressed = {};
    
    // Type compressé (économie: ~50% sur les types)
    compressed.t = EVENT_TYPE_COMPRESSION[event.type] || event.type;
    
    // Date compressée (économie: ~10% sur les dates)
    if (event.date) {
        const compactDate = compressDate(event.date);
        if (compactDate) {
            compressed.d = compactDate;
        }
    }
    
    // Lieu par clé normalisée (économie: utilise familyTownsStore)
    if (event.townKey) {
        compressed.l = event.townKey;
    }
    
    // Métadonnées contextuelles si nécessaires
    const metadata = {};
    
    if (event.spouseId) metadata.s = event.spouseId;
    if (event.childId) metadata.c = event.childId;
    if (event.occupation) metadata.o = event.occupation;
    if (event.eventAttendees) metadata.a = event.eventAttendees;
    
    // Ajouter metadata seulement si non vide
    if (Object.keys(metadata).length > 0) {
        compressed.m = metadata;
    }
    
    return compressed;
}

/**
 * Décompresse un événement depuis le format cloud-optimisé
 * @param {Object} compressedEvent - Événement compressé
 * @returns {Object} - Événement standard
 */
export function decompressEvent(compressedEvent) {
    if (!compressedEvent || !compressedEvent.t) return compressedEvent;
    
    const event = {};
    
    // Type décompressé
    event.type = EVENT_TYPE_DECOMPRESSION[compressedEvent.t] || compressedEvent.t;
    
    // Date décompressée
    if (compressedEvent.d) {
        const standardDate = decompressDate(compressedEvent.d);
        if (standardDate) {
            event.date = standardDate;
        }
    }
    
    // Lieu par clé normalisée
    if (compressedEvent.l) {
        event.townKey = compressedEvent.l;
        // IMPORTANT: La timeline et d'autres composants s'attendent à 'town' pas 'townKey'
        // Pour l'instant on met la clé, l'enrichissement se fera plus tard
        event.town = compressedEvent.l;
    }
    
    // Métadonnées contextuelles
    if (compressedEvent.m) {
        const metadata = compressedEvent.m;
        
        if (metadata.s) event.spouseId = metadata.s;
        if (metadata.c) event.childId = metadata.c;
        if (metadata.o) event.occupation = metadata.o;
        if (metadata.a) event.eventAttendees = metadata.a;
    }
    
    return event;
}

/**
 * Compresse un array d'événements
 * @param {Array} events - Array d'événements standard
 * @returns {Array} - Array d'événements compressés
 */
export function compressEventArray(events) {
    if (!Array.isArray(events)) return events;
    return events.map(compressEvent);
}

/**
 * Décompresse un array d'événements
 * @param {Array} compressedEvents - Array d'événements compressés
 * @returns {Array} - Array d'événements standard
 */
export function decompressEventArray(compressedEvents) {
    if (!Array.isArray(compressedEvents)) return compressedEvents;
    return compressedEvents.map(decompressEvent);
}

/**
 * Compresse un individu complet (événements inclus)
 * @param {Object} individual - Individu standard
 * @returns {Object} - Individu avec événements compressés
 */
export function compressIndividual(individual) {
    if (!individual) return individual;
    
    const compressed = { ...individual };
    
    if (individual.individualEvents) {
        compressed.individualEvents = compressEventArray(individual.individualEvents);
    }
    
    return compressed;
}

/**
 * Décompresse un individu complet (événements inclus)
 * @param {Object} compressedIndividual - Individu avec événements compressés
 * @returns {Object} - Individu standard
 */
export function decompressIndividual(compressedIndividual) {
    if (!compressedIndividual) return compressedIndividual;
    
    const individual = { ...compressedIndividual };
    
    if (compressedIndividual.individualEvents) {
        individual.individualEvents = decompressEventArray(compressedIndividual.individualEvents);
    }
    
    return individual;
}

/**
 * Statistiques de compression d'un array d'événements
 * @param {Array} events - Array d'événements
 * @returns {Object} - Stats de compression
 */
export function getCompressionStats(events) {
    if (!Array.isArray(events)) return null;
    
    const originalSize = JSON.stringify(events).length;
    const compressedEvents = compressEventArray(events);
    const compressedSize = JSON.stringify(compressedEvents).length;
    
    return {
        originalSize,
        compressedSize,
        savings: originalSize - compressedSize,
        compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
    };
}

// Export des dictionnaires pour référence
export { EVENT_TYPE_COMPRESSION, EVENT_TYPE_DECOMPRESSION };