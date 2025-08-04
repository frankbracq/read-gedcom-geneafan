/**
 * read-gedcom-geneafan
 * Parser GEDCOM spécialisé pour GeneaFan
 * Produit directement le format optimisé avec 100% des données GEDCOM
 */

import { GeneaFanParser } from './parser/GeneaFanParser.js';

/**
 * Parse un fichier GEDCOM vers le format GeneaFan optimisé
 * @param {string|ArrayBuffer} data - Données GEDCOM (string ou buffer)
 * @param {Object} options - Options de parsing
 * @param {boolean} options.fixEncoding - Corriger l'encodage ANSI/UTF-8 (défaut: true)
 * @param {boolean} options.extractMedia - Extraire les références multimedia (défaut: true)
 * @param {boolean} options.extractNotes - Extraire les notes (défaut: true)
 * @param {boolean} options.extractSources - Extraire les sources (défaut: true)
 * @param {boolean} options.calculateQuality - Calculer le score de qualité (défaut: true)
 * @param {Function} options.onProgress - Callback de progression (phase, progress)
 * @returns {Promise<Object>} Résultat avec toutes les caches
 */
export async function parseGedcomToGeneaFan(data, options = {}) {
    const parser = new GeneaFanParser(options);
    return parser.parse(data);
}

/**
 * Version synchrone du parser
 * @param {string|ArrayBuffer} data - Données GEDCOM
 * @param {Object} options - Options de parsing
 * @returns {Object} Résultat avec toutes les caches
 */
export function parseGedcomToGeneaFanSync(data, options = {}) {
    const parser = new GeneaFanParser(options);
    return parser.parseSync(data);
}

/**
 * Structure du résultat retourné :
 * {
 *   individualsCache: Map<string, Individual>,  // Cache principal des individus
 *   familiesCache: Map<string, Family>,        // Familles
 *   mediaCache: Map<string, Media>,            // Multimedia (photos, docs)
 *   notesCache: Map<string, Note>,             // Notes textuelles
 *   sourcesCache: Map<string, Source>,         // Sources documentaires
 *   repositoriesCache: Map<string, Repository>, // Dépôts d'archives
 *   statistics: {                              // Statistiques globales
 *     individuals: number,
 *     families: number,
 *     media: number,
 *     sources: number,
 *     events: number,
 *     places: Set<string>,
 *     timespan: { min: number, max: number },
 *     quality: { min: number, max: number, avg: number }
 *   },
 *   metadata: {                                // Métadonnées du fichier
 *     encoding: string,
 *     software: string,
 *     version: string,
 *     date: string
 *   }
 * }
 */

// Exports utilitaires
export { EVENT_TYPE_COMPRESSION } from './compression/eventCompression.js';
export { FIELD_COMPRESSION } from './compression/fieldCompression.js';
export { fixEncoding } from './encoding/encodingFixes.js';
export { calculateQualityScore } from './utils/qualityScoring.js';

// Constantes
export const VERSION = '1.0.0';
export const CACHE_VERSION = '2025.1';
export const SUPPORTED_ENCODINGS = ['UTF-8', 'UTF-16', 'ANSEL', 'ASCII', 'CP1252'];

// Tags GEDCOM supportés (pour référence)
export { GEDCOM_TAGS } from './parser/gedcomTags.js';