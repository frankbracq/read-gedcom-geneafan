/**
 * Phase 6 Cloud - Compression événements ultra-optimisée
 * Transforme les événements en format compact pour GeneaFan
 * Économie : ~20% de la taille du cache
 */

/**
 * Dictionnaire de compression des types d'événements
 * Couvre 50+ types d'événements GEDCOM
 */
export const EVENT_TYPE_COMPRESSION = {
    // === ÉVÉNEMENTS FAMILIAUX ===
    'birth': 'fb',
    'death': 'fd',
    'marriage': 'fm',
    'divorce': 'fv',
    'engagement': 'fe',
    'adoption': 'fa',
    'child-birth': 'fc',  // Naissance d'un enfant
    
    // === ÉVÉNEMENTS RELIGIEUX ===
    'baptism': 'rb',
    'christening': 'rc',
    'confirmation': 'rf',
    'first-communion': 'rp',
    'adult-christening': 'ra',
    'bar-mitzvah': 'rm',
    'bat-mitzvah': 'rw',
    'blessing': 'rl',
    'ordination': 'ro',
    
    // === ÉVÉNEMENTS CIVILS/GOUVERNEMENTAUX ===
    'census': 'gc',
    'naturalization': 'gn',
    'immigration': 'gi',
    'emigration': 'ge',
    'military-service': 'gm',
    'military-discharge': 'gd',
    'pension': 'gp',
    
    // === ÉVÉNEMENTS ÉDUCATIFS ===
    'education': 'ee',
    'graduation': 'eg',
    'diploma': 'ed',
    'certification': 'ec',
    'apprenticeship': 'ea',
    
    // === ÉVÉNEMENTS PROFESSIONNELS ===
    'occupation': 'po',
    'promotion': 'pp',
    'retirement': 'pr',
    'business-creation': 'pb',
    'business-closure': 'pc',
    'contract': 'pt',
    
    // === ÉVÉNEMENTS PATRIMONIAUX ===
    'property-acquisition': 'ap',
    'property-sale': 'as',
    'inheritance': 'ai',
    'will': 'aw',
    'probate': 'ab',
    'debt': 'ad',
    
    // === ÉVÉNEMENTS MÉDICAUX ===
    'illness': 'mi',
    'recovery': 'mr',
    'medical-treatment': 'mt',
    'disability': 'md',
    'epidemic': 'me',
    
    // === ÉVÉNEMENTS GÉOGRAPHIQUES ===
    'residence': 'gr',
    'move': 'gv',  // move/relocation
    'travel': 'gt',
    'pilgrimage': 'gl',
    
    // === ÉVÉNEMENTS LÉGAUX ===
    'trial': 'lp',  // procès
    'conviction': 'lc',
    'acquittal': 'la',
    'imprisonment': 'li',
    'fine': 'lf',
    
    // === ÉVÉNEMENTS SOCIAUX ===
    'social-event': 'ss',
    'celebration': 'sc',
    'honor': 'sh',
    'membership': 'sm',
    
    // === ÉVÉNEMENTS MULTIMEDIA ===
    'photo': 'mp',
    'document': 'md',
    'recording': 'mr',
    'video': 'mv',
    
    // === ÉVÉNEMENTS PERSONNALISÉS ===
    'custom': 'cx',
    'fact': 'fx',
    'note': 'nx'
};

/**
 * Dictionnaire inverse pour décompression
 */
export const EVENT_TYPE_DECOMPRESSION = Object.fromEntries(
    Object.entries(EVENT_TYPE_COMPRESSION).map(([key, value]) => [value, key])
);

/**
 * Compresse une date DD/MM/YYYY vers format numérique YYYYMMDD
 * @param {string|null} dateStr - Date format "20/07/1929" ou "1929" ou "Juillet 1929"
 * @returns {number|null} Date format 19290720 ou null
 */
export function compressDate(dateStr) {
    if (!dateStr || dateStr === "date inconnue" || dateStr === "unknown") {
        return null;
    }
    
    try {
        // Nettoyer la chaîne
        const clean = dateStr.trim().toLowerCase();
        
        // Format 1: Année seule (ex: "1929")
        if (/^\d{4}$/.test(clean)) {
            return parseInt(`${clean}0101`); // 1er janvier par défaut
        }
        
        // Format 2: DD/MM/YYYY (standard GeneaFan)
        const ddmmyyyyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
            const [, day, month, year] = ddmmyyyyMatch;
            return parseInt(`${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`);
        }
        
        // Format 3: MM/YYYY
        const mmyyyyMatch = clean.match(/^(\d{1,2})\/(\d{4})$/);
        if (mmyyyyMatch) {
            const [, month, year] = mmyyyyMatch;
            return parseInt(`${year}${month.padStart(2, '0')}01`); // 1er du mois
        }
        
        // Format 4: Mois textuel YYYY (ex: "Juillet 1929")
        const monthNames = {
            'janvier': '01', 'january': '01', 'jan': '01',
            'février': '02', 'february': '02', 'feb': '02', 'fév': '02',
            'mars': '03', 'march': '03', 'mar': '03',
            'avril': '04', 'april': '04', 'apr': '04', 'avr': '04',
            'mai': '05', 'may': '05',
            'juin': '06', 'june': '06', 'jun': '06',
            'juillet': '07', 'july': '07', 'jul': '07',
            'août': '08', 'august': '08', 'aug': '08', 'aou': '08',
            'septembre': '09', 'september': '09', 'sep': '09',
            'octobre': '10', 'october': '10', 'oct': '10',
            'novembre': '11', 'november': '11', 'nov': '11',
            'décembre': '12', 'december': '12', 'dec': '12', 'déc': '12'
        };
        
        for (const [monthName, monthNum] of Object.entries(monthNames)) {
            const monthYearMatch = clean.match(new RegExp(`${monthName}\\s+(\\d{4})`));
            if (monthYearMatch) {
                const year = monthYearMatch[1];
                return parseInt(`${year}${monthNum}01`);
            }
        }
        
        // Format 5: YYYY-MM-DD (ISO)
        const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            const [, year, month, day] = isoMatch;
            return parseInt(`${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`);
        }
        
        // Fallback: Extraire l'année si possible
        const yearMatch = clean.match(/\b(\d{4})\b/);
        if (yearMatch) {
            return parseInt(`${yearMatch[1]}0101`);
        }
        
        return null;
        
    } catch (error) {
        console.warn(`Erreur compression date: "${dateStr}"`, error);
        return null;
    }
}

/**
 * Décompresse une date numérique vers format DD/MM/YYYY
 * @param {number|null} dateNum - Date format 19290720
 * @returns {string|null} Date format "20/07/1929"
 */
export function decompressDate(dateNum) {
    if (!dateNum || typeof dateNum !== 'number') {
        return null;
    }
    
    try {
        const dateStr = dateNum.toString();
        if (dateStr.length !== 8) {
            return null;
        }
        
        const year = dateStr.slice(0, 4);
        const month = dateStr.slice(4, 6);
        const day = dateStr.slice(6, 8);
        
        // Validation basique
        if (parseInt(month) < 1 || parseInt(month) > 12) return null;
        if (parseInt(day) < 1 || parseInt(day) > 31) return null;
        
        return `${parseInt(day)}/${parseInt(month)}/${year}`;
        
    } catch (error) {
        console.warn(`Erreur décompression date: ${dateNum}`, error);
        return null;
    }
}

/**
 * Compresse un événement complet
 * @param {Object} event - Événement riche du DataExtractor
 * @returns {Object} Événement compressé
 */
export function compressEvent(event) {
    if (!event || !event.type) {
        return null;
    }
    
    const compressed = {
        t: EVENT_TYPE_COMPRESSION[event.type] || event.type // Type compressé
    };
    
    // Date compressée
    if (event.date) {
        const compressedDate = compressDate(event.date);
        if (compressedDate) {
            compressed.d = compressedDate;
        }
    }
    
    // Lieu (clé normalisée)
    if (event.place && event.place.normalized) {
        compressed.l = event.place.normalized;
    }
    
    // Métadonnées (seulement si non-vides)
    const metadata = {};
    
    if (event.spouseId) metadata.s = event.spouseId;
    if (event.childId) metadata.c = event.childId;
    if (event.occupation) metadata.o = event.occupation;
    if (event.age) metadata.a = event.age;
    if (event.cause) metadata.x = event.cause; // cause
    if (event.customType) metadata.y = event.customType; // custom type
    
    // Références (si disponibles)
    if (event.sources && event.sources.length > 0) {
        metadata.r = event.sources; // references
    }
    
    if (event.multimedia && event.multimedia.length > 0) {
        metadata.q = event.multimedia; // multimedia
    }
    
    // Ajouter métadonnées seulement si non-vide
    if (Object.keys(metadata).length > 0) {
        compressed.m = metadata;
    }
    
    return compressed;
}

/**
 * Décompresse un événement
 * @param {Object} compressedEvent - Événement compressé
 * @returns {Object} Événement décompressé
 */
export function decompressEvent(compressedEvent) {
    if (!compressedEvent || !compressedEvent.t) {
        return null;
    }
    
    const event = {
        type: EVENT_TYPE_DECOMPRESSION[compressedEvent.t] || compressedEvent.t,
        date: decompressDate(compressedEvent.d),
        place: compressedEvent.l || null,
        metadata: compressedEvent.m || {}
    };
    
    // Métadonnées spécifiques
    if (event.metadata.s) event.spouseId = event.metadata.s;
    if (event.metadata.c) event.childId = event.metadata.c;
    if (event.metadata.o) event.occupation = event.metadata.o;
    if (event.metadata.a) event.age = event.metadata.a;
    if (event.metadata.x) event.cause = event.metadata.x;
    if (event.metadata.y) event.customType = event.metadata.y;
    if (event.metadata.r) event.sources = event.metadata.r;
    if (event.metadata.q) event.multimedia = event.metadata.q;
    
    return event;
}

/**
 * Compresse un array d'événements
 * @param {Array} events - Array d'événements riches
 * @returns {Array} Array d'événements compressés
 */
export function compressEventArray(events) {
    if (!Array.isArray(events)) {
        return [];
    }
    
    return events
        .map(compressEvent)
        .filter(event => event !== null);
}

/**
 * Décompresse un array d'événements
 * @param {Array} compressedEvents - Array d'événements compressés
 * @returns {Array} Array d'événements décompressés
 */
export function decompressEventArray(compressedEvents) {
    if (!Array.isArray(compressedEvents)) {
        return [];
    }
    
    return compressedEvents
        .map(decompressEvent)
        .filter(event => event !== null);
}

/**
 * Calcule les statistiques de compression
 * @param {Array} originalEvents - Événements originaux
 * @param {Array} compressedEvents - Événements compressés
 * @returns {Object} Statistiques
 */
export function getCompressionStats(originalEvents, compressedEvents) {
    const originalSize = JSON.stringify(originalEvents).length;
    const compressedSize = JSON.stringify(compressedEvents).length;
    
    return {
        originalCount: originalEvents.length,
        compressedCount: compressedEvents.length,
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        savings: originalSize - compressedSize,
        savingsPercent: Math.round((1 - compressedSize / originalSize) * 100)
    };
}