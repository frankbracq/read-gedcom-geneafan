/**
 * read-gedcom-geneafan
 * Parser GEDCOM spécialisé pour GeneaFan
 * Extrait et normalise les données GEDCOM pour geneafan
 */

import { GeneaFanParser } from './parser/GeneaFanParser.js';

/**
 * Parse un fichier GEDCOM pour geneafan
 * @param {string|ArrayBuffer} data - Données GEDCOM
 * @param {Object} options - Options de parsing
 * @returns {Promise<Object>} Cache individus + familyTownsStore pour geneafan
 */
export async function parseGedcomToGeneaFan(data, options = {}) {
    const parser = new GeneaFanParser(options);
    return parser.parse(data);
}

// Retourne: { individualsCache, familyTownsStore, ... }

// Export principal pour geneafan
export const VERSION = '0.2.0';
export const CACHE_VERSION = '2025.1';