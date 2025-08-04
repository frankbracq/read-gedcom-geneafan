/**
 * geoUtils.js - Utilitaires géographiques pour read-gedcom-geneafan
 * 
 * Intègre l'API parsePlaceParts de read-gedcom avec la logique sophistiquée
 * de normalisation des lieux de GeneaFan
 */

import { parsePlaceParts } from 'read-gedcom';

// 🚀 OPTIMISATION: Cache de normalisation pour éviter les recalculs
const normalizationCache = new Map();

/**
 * Nettoie un nom de ville en extrayant la partie principale
 * Porte depuis GeneaFan/assets/scripts/utils/geo.js
 */
export function cleanTownName(str) {
    const cleanPlace = (place) =>
        (place.split(/,|\(.*|\s\d+\s*$/)[0].replace(/\d+$/, "") || "").trim();
    return cleanPlace(str);
}

/**
 * Formate un nom de ville selon les règles françaises sophistiquées
 * Porte depuis GeneaFan/assets/scripts/utils/geo.js
 */
export function formatTownName(str) {
    if (typeof str !== "string") {
        str = String(str);
    }
    str = cleanTownName(str);

    str = str.toLowerCase().replace(/(^|[-\s])([a-zà-ÿ])/g, function (match) {
        return match.toUpperCase();
    });

    str = str.replace(/(-D'|-d'| D'| d')(\w)/g, function(match, p1, p2) {
        return "-d'" + p2.toUpperCase();
    });

    const replacements = [
        { pattern: /-Sur-| Sur | s\/ /g, replacement: "-s/-" },
        { pattern: /-Sous-| Sous /g, replacement: "-/s-" },
        { pattern: /-La-| La | la /g, replacement: "-la-" },
        { pattern: /-Le-| Le | le /g, replacement: "-le-" },
        { pattern: /-Les-| Les | les /g, replacement: "-les-" },
        { pattern: /-Lès-| Lès | lès /g, replacement: "-lès-" },
        { pattern: /-Au-| Au | au /g, replacement: "-au-" },
        { pattern: /-Du-| Du | du /g, replacement: "-du-" },
        { pattern: /-De-| De | de /g, replacement: "-de-" },
        { pattern: /-Des-| Des | des /g, replacement: "-des-" },
        { pattern: /-Devant-| Devant | devant /g, replacement: "-devant-" },
        { pattern: /-En-| En | en /g, replacement: "-en-" },
        { pattern: /-Et-| Et | et /g, replacement: "-et-" },
        {
            pattern: /(Saint|Sainte)-|(Saint|Sainte) /g,
            replacement: function (match) {
                return match[0] === "S" ? "St-" : "Ste-";
            },
        },
        {
            pattern: /(Mont-|Mont |^-Mont$)/g,
            replacement: function (match) {
                return match === "-Mont" ? "-Mt" : "Mt-";
            },
        },
        { pattern: /-Madame$/g, replacement: "-Mme" },
        { pattern: /-Vieux$/g, replacement: "-Vx" },
        { pattern: /-Grand$/g, replacement: "-Gd" },
        { pattern: /-Petit$/g, replacement: "-Pt" },
        { pattern: /-Moulineaux$/g, replacement: "-Mlx" },
        {
            pattern: /(Paris|Marseille|Lyon)(-|\s)\b(X{0,3}(I{1,3}|IV|VI{0,3}|IX|X{0,3}V?I{0,3})\b)(ème)?/gi,
            replacement: "$1",
        },
        {
            pattern: /(Paris|Marseille|Lyon)(-|\s)\d{5}/gi,
            replacement: "$1",
        },
        {
            pattern: /(Paris|Marseille|Lyon)(-|\s)?(\d{1,2}(er|e|ème)?)/gi,
            replacement: "$1",
        },
    ];

    replacements.forEach(({ pattern, replacement }) => {
        str = str.replace(pattern, replacement);
    });

    return str;
}

/**
 * Normalise une chaîne géographique (supprime accents, espaces → underscores, minuscules)
 * Porte depuis GeneaFan/assets/scripts/utils/geo.js
 */
export function normalizeGeoString(inputString) {
    if (!inputString || typeof inputString !== 'string') return '';
    
    return inputString
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/\s/g, "_"); // Espaces → underscores
}

/**
 * Pipeline complet de normalisation des lieux AVEC CACHE
 * Utilise parsePlaceParts de read-gedcom + logique GeneaFan
 * 
 * @param {string} placeString - Chaîne de lieu brute du GEDCOM
 * @returns {string|null} - Clé normalisée pour la ville ou null
 * 
 * @example
 * normalizePlace("Huisseau-sur-Mauves, 45130, Loiret, Centre, France")
 * // → "huisseau_s_mauves"
 * 
 * normalizePlace("Paris XVème, 75015, Paris, Île-de-France, France") 
 * // → "paris"
 * 
 * normalizePlace("Saint-Denis, 93200, Seine-Saint-Denis, Île-de-France, France")
 * // → "st_denis"
 */
export function normalizePlace(placeString) {
    if (!placeString || typeof placeString !== 'string') return null;
    
    // 🚀 OPTIMISATION: Vérifier le cache d'abord
    if (normalizationCache.has(placeString)) {
        return normalizationCache.get(placeString);
    }
    
    try {
        // 1. Utiliser parsePlaceParts de read-gedcom pour décomposer
        const parts = parsePlaceParts(placeString);
        if (!parts || parts.length === 0) {
            normalizationCache.set(placeString, null);
            return null;
        }
        
        // 2. Extraire la première partie (ville)
        const townPart = parts[0];
        if (!townPart || !townPart.trim()) {
            normalizationCache.set(placeString, null);
            return null;
        }
        
        // 3. Pipeline de nettoyage GeneaFan
        const cleanTown = cleanTownName(townPart);
        if (!cleanTown) {
            normalizationCache.set(placeString, null);
            return null;
        }
        
        const formattedTown = formatTownName(cleanTown);
        if (!formattedTown) {
            normalizationCache.set(placeString, null);
            return null;
        }
        
        const normalizedKey = normalizeGeoString(formattedTown);
        
        // 4. Validation finale
        if (!normalizedKey || normalizedKey.length === 0) {
            normalizationCache.set(placeString, null);
            return null;
        }
        
        // 🚀 OPTIMISATION: Stocker dans le cache
        normalizationCache.set(placeString, normalizedKey);
        return normalizedKey;
        
    } catch (error) {
        console.warn(`[geoUtils] Erreur normalisation lieu "${placeString}":`, error.message);
        normalizationCache.set(placeString, null); // Cache même les erreurs
        return null;
    }
}

/**
 * 🚀 NOUVEAU: Traitement en lot pour optimiser les performances
 * Normalise plusieurs lieux d'un coup avec déduplication automatique
 * 
 * @param {string[]} places - Array de chaînes de lieux
 * @returns {Map<string, string|null>} - Map(placeString → normalizedKey)
 */
export function normalizePlacesBatch(places) {
    const results = new Map();
    const uniquePlaces = [...new Set(places)]; // Déduplication
    
    console.log(`🚀 [geoUtils] Normalisation batch: ${uniquePlaces.length} lieux uniques`);
    
    const startTime = Date.now();
    for (const place of uniquePlaces) {
        results.set(place, normalizePlace(place));
    }
    
    const duration = Date.now() - startTime;
    const cacheHits = places.length - uniquePlaces.length;
    
    console.log(`✅ [geoUtils] Batch terminé: ${duration}ms, ${cacheHits} hits cache, ${normalizationCache.size} entrées`);
    
    return results;
}

/**
 * 🚀 NOUVEAU: Réinitialise le cache de normalisation
 * Utile pour les tests ou la gestion mémoire
 */
export function clearNormalizationCache() {
    const size = normalizationCache.size;
    normalizationCache.clear();
    console.log(`🗑️ [geoUtils] Cache normalization vidé: ${size} entrées supprimées`);
}

/**
 * 📊 NOUVEAU: Statistiques du cache
 */
export function getCacheStats() {
    return {
        size: normalizationCache.size,
        entries: [...normalizationCache.entries()].slice(0, 5), // Premier 5 pour debug
        hitRate: normalizationCache.size > 0 ? 'Disponible après premier batch' : 'Pas encore utilisé'
    };
}

/**
 * Extrait les composants d'un lieu (ville, département, pays, etc.)
 * 
 * @param {string} placeString - Chaîne de lieu brute du GEDCOM
 * @returns {Object} - Composants du lieu
 */
export function extractPlaceComponents(placeString) {
    if (!placeString || typeof placeString !== 'string') {
        return {
            town: null,
            postalCode: null,
            department: null,
            region: null,
            country: null,
            normalizedKey: null
        };
    }
    
    try {
        const parts = parsePlaceParts(placeString);
        if (!parts || parts.length === 0) {
            return {
                town: null,
                postalCode: null,
                department: null,
                region: null,
                country: null,
                normalizedKey: null
            };
        }
        
        // Extraction intelligente basée sur la position et le contenu
        const town = parts[0] || null;
        let postalCode = null;
        let department = null;
        let region = null;
        let country = null;
        
        // Détecter code postal (5 chiffres)
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i].trim();
            if (/^\d{5}$/.test(part)) {
                postalCode = part;
                break;
            }
        }
        
        // Le dernier élément est souvent le pays
        if (parts.length > 1) {
            country = parts[parts.length - 1] || null;
        }
        
        // Les éléments du milieu sont département/région
        if (parts.length > 2) {
            department = parts[parts.length - 2] || null;
        }
        
        if (parts.length > 3) {
            region = parts[parts.length - 3] || null;
        }
        
        return {
            town: town ? formatTownName(town) : null,
            postalCode,
            department,
            region,
            country,
            normalizedKey: normalizePlace(placeString)
        };
        
    } catch (error) {
        console.warn(`[geoUtils] Erreur extraction composants "${placeString}":`, error.message);
        return {
            town: null,
            postalCode: null,
            department: null,
            region: null,
            country: null,
            normalizedKey: null
        };
    }
}