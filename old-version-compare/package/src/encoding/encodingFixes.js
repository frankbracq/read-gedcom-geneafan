/**
 * Correction automatique des problèmes d'encodage ANSI/UTF-8
 * Basé sur le module de read-gedcom-enhanced mais optimisé
 */

/**
 * Table de correction des encodages les plus courants
 * Couvre ~95% des cas d'encodage corrompu en généalogie française
 */
export const ENCODING_FIXES = {
    // === CORRUPTION TRIPLE (read-gedcom spécifique) ===
    'RenÃƒÂ©e': 'Renée',
    'FranÃƒÂ§ois': 'François', 
    'ThÃƒÂ©rÃƒÂ¨se': 'Thérèse',
    'JosÃƒÂ©phine': 'Joséphine',
    'AndrÃƒÂ©': 'André',
    
    // === DOUBLE ENCODAGE (CP1252 → UTF-8) ===
    'Ã©': 'é',    // 195,169 → 233 (e acute)
    'Ã¨': 'è',    // 195,168 → 232 (e grave)
    'Ã ': 'à',    // 195,160 → 224 (a grave)
    'Ã¢': 'â',    // 195,162 → 226 (a circumflex)
    'Ã´': 'ô',    // 195,180 → 244 (o circumflex)
    'Ã®': 'î',    // 195,174 → 238 (i circumflex)
    'Ã¹': 'ù',    // 195,185 → 249 (u grave)
    'Ã»': 'û',    // 195,187 → 251 (u circumflex)
    'Ã§': 'ç',    // 195,167 → 231 (c cedilla)
    
    // === MAJUSCULES ===
    'Ã‰': 'É',    // E acute
    'Ãˆ': 'È',    // E grave
    'Ã€': 'À',    // A grave
    'Ã‚': 'Â',    // A circumflex
    'Ã"': 'Ô',    // O circumflex
    'ÃŽ': 'Î',    // I circumflex
    'Ã™': 'Ù',    // U grave
    'Ã›': 'Û',    // U circumflex
    'Ã‡': 'Ç',    // C cedilla
    
    // === TRIPLE ENCODAGE (patterns communs) ===
    'ÃƒÂ©': 'é',
    'ÃƒÂ¨': 'è',
    'ÃƒÂ ': 'à',
    'ÃƒÂ¢': 'â',
    'ÃƒÂ´': 'ô',
    'ÃƒÂ®': 'î',
    'ÃƒÂ¹': 'ù',
    'ÃƒÂ»': 'û',
    'ÃƒÂ§': 'ç',
    
    // === PONCTUATION (exports Word/Office) ===
    'â€™': "'",   // right single quotation
    'â€œ': '"',   // left double quotation
    'â€': '"',    // right double quotation
    'â€"': '–',   // en dash
    'â€"': '—',   // em dash
    'â€¦': '…',   // horizontal ellipsis
    
    // === DEVISES & SYMBOLES ===
    'â‚¬': '€',   // Euro
    'Â£': '£',    // Pound
    'Â©': '©',    // Copyright
    'Â®': '®',    // Registered
    'Â°': '°',    // Degree
    
    // === CARACTÈRES EUROPÉENS COURANTS ===
    
    // Allemand
    'Ã¤': 'ä',    // a umlaut
    'Ã¶': 'ö',    // o umlaut
    'Ã¼': 'ü',    // u umlaut
    'ÃŸ': 'ß',    // sharp s
    'Ã„': 'Ä',    // A umlaut
    'Ã–': 'Ö',    // O umlaut
    'Ãœ': 'Ü',    // U umlaut
    
    // Espagnol
    'Ã±': 'ñ',    // n tilde
    'Ã\u0091': 'Ñ',    // N tilde
    
    // Italien
    'Ã¬': 'ì',    // i grave
    'Ã²': 'ò',    // o grave
    'ÃŒ': 'Ì',    // I grave
    'Ã\u0092': 'Ò',   // O grave
    
    // Nordique
    'Ã¥': 'å',    // a ring
    'Ã…': 'Å',    // A ring
    'Ã¦': 'æ',    // ae ligature
    'Ã†': 'Æ',    // AE ligature
    'Ã¸': 'ø',    // o slash
    'Ã˜': 'Ø'     // O slash
};

/**
 * Correction synchrone des encodages
 * @param {string} text - Texte à corriger
 * @param {Object} options - Options de correction
 * @returns {string} Texte corrigé
 */
export function fixEncoding(text, options = {}) {
    if (!text || typeof text !== 'string') {
        return text || '';
    }
    
    const {
        aggressive = true,      // Mode agressif pour patterns non-listés
        preserveNonStandard = false, // Préserver caractères non-standards
        logFixes = false        // Logger les corrections
    } = options;
    
    let fixed = text;
    let fixCount = 0;
    
    // 1. Corrections par table
    for (const [corrupted, correct] of Object.entries(ENCODING_FIXES)) {
        if (fixed.includes(corrupted)) {
            const before = fixed;
            fixed = fixed.replaceAll(corrupted, correct);
            if (fixed !== before) {
                fixCount++;
                if (logFixes) {
                    console.log(`Encoding fix: "${corrupted}" → "${correct}"`);
                }
            }
        }
    }
    
    // 2. Mode agressif : patterns automatiques
    if (aggressive) {
        // Pattern Ã + caractère étendu
        fixed = fixed.replace(/Ã([\u0080-\u00FF])/g, (match, char) => {
            const code = char.charCodeAt(0);
            // Conversion CP1252 → UTF-8
            if (code >= 128 && code <= 255) {
                fixCount++;
                return String.fromCharCode(code);
            }
            return match;
        });
        
        // Séquences ÃƒÂ communes
        const triplePatterns = {
            'ÃƒÂ': '',  // Préfixe triple commun
        };
        
        for (const [pattern, replacement] of Object.entries(triplePatterns)) {
            if (fixed.includes(pattern)) {
                // Traitement plus sophistiqué des triples
                fixed = fixTripleEncoding(fixed);
                fixCount++;
            }
        }
    }
    
    // 3. Nettoyage final
    if (!preserveNonStandard) {
        // Supprimer caractères de contrôle invisibles
        fixed = fixed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
        
        // Normaliser espaces multiples
        fixed = fixed.replace(/\s+/g, ' ').trim();
    }
    
    return fixed;
}

/**
 * Version asynchrone (pour compatibilité)
 * @param {string} text - Texte à corriger
 * @param {Object} options - Options
 * @returns {Promise<string>} Texte corrigé
 */
export async function fixEncodingAsync(text, options = {}) {
    return fixEncoding(text, options);
}

/**
 * Pour compatibilité avec ancien code
 */
fixEncoding.sync = fixEncoding;

/**
 * Traitement spécialisé des triples encodages
 * @private
 */
function fixTripleEncoding(text) {
    // Patterns spécifiques français
    const triplePatterns = [
        [/ÃƒÂ©/g, 'é'],
        [/ÃƒÂ¨/g, 'è'],
        [/ÃƒÂ /g, 'à'],
        [/ÃƒÂ¢/g, 'â'],
        [/ÃƒÂ´/g, 'ô'],
        [/ÃƒÂ®/g, 'î'],
        [/ÃƒÂ¹/g, 'ù'],
        [/ÃƒÂ»/g, 'û'],
        [/ÃƒÂ§/g, 'ç'],
        [/ÃƒÂ‰/g, 'É'],
        [/ÃƒÂˆ/g, 'È']
    ];
    
    let result = text;
    for (const [pattern, replacement] of triplePatterns) {
        result = result.replace(pattern, replacement);
    }
    
    return result;
}

/**
 * Détecte si un texte a probablement des problèmes d'encodage
 * @param {string} text - Texte à analyser
 * @returns {Object} Résultat de détection
 */
export function detectEncodingIssues(text) {
    if (!text || typeof text !== 'string') {
        return { hasIssues: false, confidence: 0, issues: [] };
    }
    
    const issues = [];
    let score = 0;
    
    // 1. Recherche patterns connus
    let patternMatches = 0;
    for (const corrupted of Object.keys(ENCODING_FIXES)) {
        if (text.includes(corrupted)) {
            issues.push(`Found corrupted pattern: "${corrupted}"`);
            patternMatches++;
            score += 15;
        }
    }
    
    // 2. Patterns suspects
    const suspiciousPatterns = [
        { pattern: /Ã[\u0080-\u00FF]/g, name: 'Ã + extended ASCII' },
        { pattern: /â€/g, name: 'Smart quotes corruption' },
        { pattern: /Â[£©®°]/g, name: 'Symbol corruption' },
        { pattern: /ÃƒÂ/g, name: 'Triple encoding prefix' }
    ];
    
    for (const { pattern, name } of suspiciousPatterns) {
        const matches = text.match(pattern);
        if (matches) {
            issues.push(`Found ${matches.length} instances of ${name}`);
            score += matches.length * 5;
        }
    }
    
    // 3. Ratio de caractères suspects
    const suspiciousChars = text.match(/[ÃÂ\u0080-\u00FF]/g) || [];
    const suspiciousRatio = suspiciousChars.length / text.length;
    
    if (suspiciousRatio > 0.02) { // Plus de 2% de caractères suspects
        issues.push(`High suspicious character ratio: ${(suspiciousRatio * 100).toFixed(1)}%`);
        score += suspiciousRatio * 100;
    }
    
    const confidence = Math.min(score, 100);
    
    return {
        hasIssues: issues.length > 0,
        confidence,
        issues,
        patternMatches,
        suspiciousRatio,
        recommendation: confidence > 70 ? 'fix' : confidence > 30 ? 'review' : 'none'
    };
}

/**
 * Corrige l'encodage de manière récursive dans un objet
 * @param {any} obj - Objet à corriger
 * @param {Object} options - Options
 * @returns {any} Objet avec encodage corrigé
 */
export function fixObjectEncoding(obj, options = {}) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'string') {
        return fixEncoding(obj, options);
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => fixObjectEncoding(item, options));
    }
    
    if (typeof obj === 'object') {
        const fixed = {};
        for (const [key, value] of Object.entries(obj)) {
            const fixedKey = fixEncoding(key, options);
            fixed[fixedKey] = fixObjectEncoding(value, options);
        }
        return fixed;
    }
    
    return obj;
}

/**
 * Statistiques des corrections appliquées
 * @param {string} original - Texte original
 * @param {string} fixed - Texte corrigé
 * @returns {Object} Statistiques
 */
export function getFixStatistics(original, fixed) {
    if (!original || !fixed) {
        return { totalFixes: 0, details: [] };
    }
    
    const details = [];
    let totalFixes = 0;
    
    // Compter les corrections par pattern
    for (const [corrupted, correct] of Object.entries(ENCODING_FIXES)) {
        const originalCount = (original.match(new RegExp(escapeRegex(corrupted), 'g')) || []).length;
        const fixedCount = (fixed.match(new RegExp(escapeRegex(corrupted), 'g')) || []).length;
        const appliedFixes = originalCount - fixedCount;
        
        if (appliedFixes > 0) {
            details.push({
                pattern: corrupted,
                replacement: correct,
                count: appliedFixes
            });
            totalFixes += appliedFixes;
        }
    }
    
    return {
        totalFixes,
        details,
        originalLength: original.length,
        fixedLength: fixed.length,
        changeRatio: totalFixes / original.length,
        efficiency: details.length > 0 ? totalFixes / details.length : 0
    };
}

/**
 * Échappe les caractères spéciaux pour regex
 * @private
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}