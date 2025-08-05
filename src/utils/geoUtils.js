/**
 * geoUtils.js - Utilitaires géographiques pour read-gedcom-geneafan
 * 
 * Intègre l'API parsePlaceParts de read-gedcom avec la logique sophistiquée
 * de normalisation des lieux de GeneaFan
 */

import { parsePlaceParts } from 'read-gedcom';

// 🚀 OPTIMISATION: Cache de normalisation pour éviter les recalculs
const normalizationCache = new Map();

// 🌐 Cache pour les données géographiques depuis l'API
let geoDataCache = null;
let geoDataLoadPromise = null;

/**
 * Charge les données géographiques depuis l'API Cloudflare KV
 * @returns {Promise<{countries: Object, departments: Object}>}
 */
async function loadGeoData() {
    // Si déjà en cache, retourner directement
    if (geoDataCache) return geoDataCache;
    
    // Si chargement en cours, attendre la promesse existante
    if (geoDataLoadPromise) return geoDataLoadPromise;
    
    // Lancer le chargement
    geoDataLoadPromise = (async () => {
        try {
            console.log('🌐 [geoUtils] Tentative chargement API geo-data...');
            const response = await fetch('https://geocode.genealogie.app/api/geo-data');
            console.log('📡 [geoUtils] Réponse API reçue:', response.status, response.ok);
            
            if (!response.ok) {
                throw new Error(`Failed to load geo data: ${response.status}`);
            }
            
            const data = await response.json();
            geoDataCache = data;
            console.log('✅ [geoUtils] Données géographiques chargées depuis API');
            console.log('📊 [geoUtils] Continents chargés:', data.countries?.continents?.length);
            console.log('📊 [geoUtils] Départements chargés:', Object.keys(data.departments || {}).length);
            return data;
        } catch (error) {
            console.warn('⚠️ [geoUtils] Échec chargement API, utilisation données locales:', error.message);
            console.warn('🔧 [geoUtils] Stack trace:', error.stack);
            // Fallback sur les données locales minimales
            const localCountries = getLocalCountriesData();
            const localDepartments = getLocalDepartmentsData();
            console.log('🏠 [geoUtils] Fallback - Pays locaux:', localCountries.continents?.length);
            console.log('🏠 [geoUtils] Fallback - Départements locaux:', Object.keys(localDepartments || {}).length);
            
            geoDataCache = {
                countries: localCountries,
                departments: localDepartments
            };
            return geoDataCache;
        } finally {
            geoDataLoadPromise = null;
        }
    })();
    
    return geoDataLoadPromise;
}

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
 * 🚀 LOGIQUE SOPHISTIQUÉE : Porte depuis placeProcessor de GeneaFan
 * 
 * @param {string} placeString - Chaîne de lieu brute du GEDCOM
 * @returns {Promise<Object>} - Composants du lieu
 */
export async function extractPlaceComponents(placeString) {
    console.log('🔍 [geoUtils] extractPlaceComponents appelée avec:', placeString);
    
    if (!placeString || typeof placeString !== 'string') {
        console.log('⚠️ [geoUtils] PlaceString invalide, retour null');
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
        // 1. Utiliser parsePlaceParts pour décomposer
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
        
        // 2. Initialisation avec première partie comme ville
        const result = {
            town: parts[0] ? formatTownName(parts[0]) : null,
            postalCode: null,
            department: null,
            region: null,
            country: null,
            normalizedKey: normalizePlace(placeString)
        };
        
        // 3. 🔍 DÉTECTION INTELLIGENTE DU PAYS (logique placeProcessor._findCountry)
        const normalizedSegments = parts.map(part => normalizeGeoString(part));
        const countryMatch = await _findCountryInSegments(normalizedSegments);
        if (countryMatch) {
            result.country = countryMatch.name.FR;
        }
        
        // 4. 🇫🇷 TRAITEMENT SPÉCIAL FRANÇAIS (logique placeProcessor._processFrenchDepartement)
        if (!result.country || result.country === "France") {
            const departmentInfo = await _extractFrenchDepartment(placeString);
            if (departmentInfo) {
                result.department = departmentInfo.name;
                result.postalCode = departmentInfo.postalCode;
                result.departmentColor = departmentInfo.color;
            }
        }
        
        // 5. 🔍 DÉTECTION CODE POSTAL STANDARD (5 chiffres)
        if (!result.postalCode) {
            for (const part of parts) {
                if (/^\d{5}$/.test(part.trim())) {
                    result.postalCode = part.trim();
                    break;
                }
            }
        }
        
        // 6. 📍 FALLBACK DÉPARTEMENT/RÉGION (logique placeProcessor._processSubdivisionAndDepartement)
        if (!result.department && parts.length >= 2) {
            // Filtrer les segments vides et les doublons/répétitions
            const cleanParts = parts.filter(p => p && p.trim() !== '');
            const uniqueParts = [...new Set(cleanParts.map(p => normalizeGeoString(p)))];
            
            // Ne pas utiliser le pays détecté comme département
            const countriesList = await _getCountriesList();
            const nonCountryParts = cleanParts.filter(part => {
                const normalized = normalizeGeoString(part);
                
                // Vérifier si c'est un pays ou une variante de pays
                for (const country of countriesList) {
                    if (country.variants?.includes(normalized) || 
                        country.territories?.includes(normalized)) {
                        return false;
                    }
                }
                return true;
            });
            
            if (nonCountryParts.length >= 2) {
                // Exclure la ville (première partie)
                const potentialDepartments = nonCountryParts.slice(1);
                
                if (potentialDepartments.length >= 2) {
                    // Format: Ville, Département, Région, [Pays]
                    result.department = potentialDepartments[0] || null;
                    result.region = potentialDepartments[1] || null;
                } else if (potentialDepartments.length === 1) {
                    // Format: Ville, Département, [Pays]
                    result.department = potentialDepartments[0] || null;
                }
            }
        }
        
        return result;
        
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

/**
 * 🔍 FONCTION INTERNE: Trouve un pays dans les segments normalisés
 * 🚀 AMÉLIORÉE: Gère variantes, abréviations, territoires
 */
async function _findCountryInSegments(normalizedSegments) {
    // Filtrer les segments vides
    const cleanSegments = normalizedSegments.filter(s => s && s.trim() !== '');
    
    // Utiliser la liste partagée des pays
    const countries = await _getCountriesList();
    
    // Recherche directe dans les variantes
    for (const country of countries) {
        for (const segment of cleanSegments) {
            // Vérifier les variantes principales
            if (country.variants.includes(segment)) {
                return country;
            }
            
            // Vérifier les territoires (donnent le pays parent)
            if (country.territories && country.territories.includes(segment)) {
                return country;
            }
        }
    }
    
    return null;
}

/**
 * 🔍 FONCTION HELPER: Retourne la liste des pays pour réutilisation
 * Utilise l'API si disponible, sinon fallback local
 */
async function _getCountriesList() {
    try {
        const geoData = await loadGeoData();
        if (geoData?.countries?.continents) {
            // Extraire tous les pays de la structure continents
            const countries = [];
            for (const continent of geoData.countries.continents) {
                for (const country of continent.countries) {
                    // Adapter la structure pour correspondre au format attendu
                    countries.push({
                        name: country.name,
                        code: country.code,
                        variants: [
                            country.key.FR,
                            country.key.EN?.toLowerCase(),
                            country.code?.toLowerCase()
                        ].filter(Boolean),
                        territories: country.territories || []
                    });
                }
            }
            return countries;
        }
    } catch (error) {
        console.warn('⚠️ [geoUtils] Utilisation données pays locales:', error.message);
    }
    
    // Fallback sur données locales
    return getLocalCountriesData();
}

/**
 * Données locales de fallback pour les pays
 */
function getLocalCountriesData() {
    return [
        // France
        { 
            name: { FR: "France" }, 
            variants: ["france", "fr", "french", "francais"] 
        },
        
        // États-Unis avec variantes et territoires
        { 
            name: { FR: "États-Unis" }, 
            variants: ["usa", "us", "etats-unis", "united-states", "america", "amerique"],
            territories: ["puerto-rico", "porto-rico", "hawaii", "alaska", "guam", "virgin-islands"]
        },
        
        // Canada
        { 
            name: { FR: "Canada" }, 
            variants: ["canada", "ca", "canadien"] 
        },
        
        // Royaume-Uni avec territoires
        { 
            name: { FR: "Royaume-Uni" }, 
            variants: ["royaume-uni", "uk", "united-kingdom", "great-britain", "england", "scotland", "wales", "northern-ireland", "angleterre", "ecosse", "galles"],
            territories: ["gibraltar", "jersey", "guernsey", "isle-of-man"]
        },
        
        // Autres pays européens
        { 
            name: { FR: "Allemagne" }, 
            variants: ["allemagne", "germany", "deutschland", "de"] 
        },
        { 
            name: { FR: "Belgique" }, 
            variants: ["belgique", "belgium", "be"] 
        },
        { 
            name: { FR: "Suisse" }, 
            variants: ["suisse", "switzerland", "swiss", "schweiz", "ch"] 
        },
        { 
            name: { FR: "Italie" }, 
            variants: ["italie", "italy", "italia", "it"] 
        },
        { 
            name: { FR: "Espagne" }, 
            variants: ["espagne", "spain", "espana", "es"] 
        },
        { 
            name: { FR: "Pays-Bas" }, 
            variants: ["pays-bas", "netherlands", "holland", "nl"] 
        },
        
        // Autres continents
        { 
            name: { FR: "Maroc" }, 
            variants: ["maroc", "morocco", "ma"] 
        },
        { 
            name: { FR: "Algérie" }, 
            variants: ["algerie", "algeria", "dz"] 
        },
        { 
            name: { FR: "Tunisie" }, 
            variants: ["tunisie", "tunisia", "tn"] 
        }
    ];
}

/**
 * 🇫🇷 FONCTION INTERNE: Extrait département français
 * Porte depuis placeProcessor._processFrenchDepartement() + _extractAndSetDepartement()
 */
async function _extractFrenchDepartment(original) {
    // Regex placeProcessor: \b\d{5}\b|\(\d{2}\)
    // - \b\d{5}\b : code postal (5 chiffres)  
    // - \(\d{2}\) : code département entre parenthèses comme "(59)"
    const codeRegex = /\b\d{5}\b|\(\d{2}\)/;
    const codeMatch = original.match(codeRegex);
    
    if (!codeMatch) return null;
    
    let departmentCode = codeMatch[0];
    let postalCode = null;
    
    if (departmentCode.startsWith('(')) {
        // Format "(59)" → département 59
        departmentCode = departmentCode.replace(/[()]/g, "");
    } else if (departmentCode.length === 5) {
        // Format "59310" → département 59, code postal 59310
        postalCode = departmentCode;
        departmentCode = departmentCode.substring(0, 2);
    }
    
    // Charger les données depuis l'API si possible
    try {
        const geoData = await loadGeoData();
        if (geoData?.departments) {
            // Rechercher par code dans les données de l'API
            for (const [key, dept] of Object.entries(geoData.departments)) {
                if (dept.code === departmentCode) {
                    return {
                        name: dept.name,
                        code: departmentCode,
                        postalCode: postalCode,
                        color: dept.departementColor,
                        region: dept.region
                    };
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ [geoUtils] Utilisation mapping départements local');
    }
    
    // Fallback: Mapping code → nom (simplifié des principaux départements)
    const deptMapping = getLocalDepartmentsData();
    
    const departmentName = deptMapping[departmentCode];
    if (departmentName) {
        return {
            name: departmentName,
            code: departmentCode,
            postalCode: postalCode
        };
    }
    
    return null;
}

/**
 * Données locales de fallback pour les départements
 */
function getLocalDepartmentsData() {
    return {
        "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
        "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
        "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
        "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
        "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "21": "Côte-d'Or",
        "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne", "25": "Doubs",
        "26": "Drôme", "27": "Eure", "28": "Eure-et-Loir", "29": "Finistère",
        "30": "Gard", "31": "Haute-Garonne", "32": "Gers", "33": "Gironde",
        "34": "Hérault", "35": "Ille-et-Vilaine", "36": "Indre", "37": "Indre-et-Loire",
        "38": "Isère", "39": "Jura", "40": "Landes", "41": "Loir-et-Cher",
        "42": "Loire", "43": "Haute-Loire", "44": "Loire-Atlantique", "45": "Loiret",
        "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozère", "49": "Maine-et-Loire",
        "50": "Manche", "51": "Marne", "52": "Haute-Marne", "53": "Mayenne",
        "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan", "57": "Moselle",
        "58": "Nièvre", "59": "Nord", "60": "Oise", "61": "Orne",
        "62": "Pas-de-Calais", "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques",
        "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales", "67": "Bas-Rhin",
        "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône", "71": "Saône-et-Loire",
        "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie", "75": "Paris",
        "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
        "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
        "83": "Var", "84": "Vaucluse", "85": "Vendée", "86": "Vienne",
        "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
        "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis",
        "94": "Val-de-Marne", "95": "Val-d'Oise"
    };
}

/**
 * Ajoute les fonctionnalités manquantes de placeProcessor
 */

/**
 * Extrait les coordonnées géographiques depuis l'arbre GEDCOM
 * @param {Array} tree - Arbre GEDCOM du lieu (PLAC)
 * @returns {{latitude: number|null, longitude: number|null}}
 */
export function extractGeolocation(tree) {
    if (!Array.isArray(tree)) {
        return { latitude: null, longitude: null };
    }
    
    try {
        // Chercher le nœud MAP
        const mapNode = tree.find(node => node.tag === 'MAP');
        if (!mapNode || !Array.isArray(mapNode.tree)) {
            return { latitude: null, longitude: null };
        }
        
        // Chercher LATI et LONG dans MAP
        const latiNode = mapNode.tree.find(node => node.tag === 'LATI');
        const longNode = mapNode.tree.find(node => node.tag === 'LONG');
        
        if (latiNode && longNode) {
            const latitude = parseFloat(latiNode.data?.trim());
            const longitude = parseFloat(longNode.data?.trim());
            
            if (!isNaN(latitude) && !isNaN(longitude)) {
                return { latitude, longitude };
            }
        }
    } catch (error) {
        console.warn('[geoUtils] Erreur extraction géolocalisation:', error.message);
    }
    
    return { latitude: null, longitude: null };
}

/**
 * Formate une chaîne d'affichage pour un lieu
 * @param {Object} placeComponents - Composants du lieu
 * @returns {string} - Chaîne formatée
 */
export function formatDisplayString(placeComponents) {
    const parts = [
        placeComponents.town,
        placeComponents.postalCode,
        placeComponents.department,
        placeComponents.region,
        placeComponents.country
    ].filter(Boolean);
    
    return parts.join(', ');
}