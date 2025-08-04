/**
 * Parser principal GEDCOM → GeneaFan
 * Utilise read-gedcom comme base et produit directement le format optimisé
 */

import { readGedcom } from 'read-gedcom';
import { DataExtractor } from './DataExtractor.js';
import { CacheBuilder } from './CacheBuilder.js';
import { fixEncoding } from '../encoding/encodingFixes.js';

export class GeneaFanParser {
    constructor(options = {}) {
        this.options = {
            fixEncoding: true,
            extractMedia: true,
            extractNotes: true,
            extractSources: true,
            calculateQuality: true,
            verbose: false,
            ...options
        };
        
        this.dataExtractor = new DataExtractor(this.options);
        this.cacheBuilder = new CacheBuilder(this.options);
    }
    
    /**
     * Parse asynchrone du fichier GEDCOM
     * @param {string|ArrayBuffer} data - Données GEDCOM
     * @returns {Promise<Object>} Toutes les caches générées
     */
    async parse(data) {
        const startTime = Date.now();
        
        try {
            // Phase 1: Préparation des données
            this._log('Phase 1: Préparation des données...');
            const buffer = await this._prepareData(data);
            
            // Phase 2: Parsing GEDCOM avec read-gedcom
            this._log('Phase 2: Parsing GEDCOM avec read-gedcom...');
            const rootSelection = readGedcom(buffer);
            this._reportProgress('gedcom-parsing', 1.0);
            
            // Phase 3: Extraction enrichie des données
            this._log('Phase 3: Extraction enrichie des données...');
            const enrichedData = await this.dataExtractor.extract(rootSelection);
            this._reportProgress('data-extraction', 1.0);
            
            // Phase 4: Construction des caches optimisées
            this._log('Phase 4: Construction des caches optimisées...');
            const result = await this.cacheBuilder.build(enrichedData);
            this._reportProgress('cache-building', 1.0);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            this._log(`✅ Parsing terminé en ${duration}ms`);
            this._log(`📊 ${result.individualsCache.size} individus, ${result.familiesCache.size} familles`);
            
            return result;
            
        } catch (error) {
            this._log(`❌ Erreur: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Parse synchrone du fichier GEDCOM
     * @param {string|ArrayBuffer} data - Données GEDCOM
     * @returns {Object} Toutes les caches générées
     */
    parseSync(data) {
        const startTime = Date.now();
        
        try {
            // Phase 1: Préparation
            const text = this._prepareDataSync(data);
            
            // Phase 2: Tokenisation
            const tokens = this.tokenizer.tokenizeSync(text);
            
            // Phase 3: Arbre
            const tree = this.treeBuilder.buildSync(tokens);
            
            // Phase 4: Extraction
            const rawData = this.dataExtractor.extractSync(tree);
            
            // Phase 5: Caches
            const result = this.cacheBuilder.buildSync(rawData);
            
            const duration = Date.now() - startTime;
            this._log(`✅ Parsing synchrone terminé en ${duration}ms`);
            
            return result;
            
        } catch (error) {
            this._log(`❌ Erreur: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Prépare les données pour le parsing (async)
     * @private
     */
    async _prepareData(data) {
        if (Buffer.isBuffer(data)) {
            // Buffer Node.js - perfect pour read-gedcom
            return data;
        }
        
        if (data instanceof ArrayBuffer) {
            // Convertir ArrayBuffer vers Buffer
            return Buffer.from(data);
        }
        
        if (typeof data === 'string') {
            // Convertir string vers Buffer
            let text = data;
            
            // Fix encoding si nécessaire
            if (this.options.fixEncoding) {
                text = await fixEncoding(text);
            }
            
            // Convertir en Buffer
            return Buffer.from(text, 'utf8');
        }
        
        throw new Error('Format de données non supporté. Utilisez string, Buffer ou ArrayBuffer.');
    }
    
    /**
     * Prépare les données pour le parsing (sync)
     * @private
     */
    _prepareDataSync(data) {
        if (data instanceof ArrayBuffer) {
            return data;
        }
        
        if (typeof data === 'string') {
            let text = data;
            if (this.options.fixEncoding) {
                text = fixEncoding(text);
            }
            
            // Convertir en ArrayBuffer
            const encoder = new TextEncoder();
            return encoder.encode(text).buffer;
        }
        
        throw new Error('Format de données non supporté');
    }
    
    /**
     * Détecte l'encodage du fichier
     * @private
     */
    _detectEncoding(buffer) {
        const bytes = new Uint8Array(buffer);
        
        // BOM UTF-8
        if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
            return 'utf-8';
        }
        
        // BOM UTF-16 LE
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
            return 'utf-16le';
        }
        
        // BOM UTF-16 BE
        if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
            return 'utf-16be';
        }
        
        // Recherche de CHAR dans l'en-tête
        const headerText = new TextDecoder('ascii', { fatal: false })
            .decode(buffer.slice(0, 1000));
        
        const charMatch = headerText.match(/1 CHAR ([^\r\n]+)/);
        if (charMatch) {
            const charset = charMatch[1].toUpperCase();
            switch (charset) {
                case 'UTF-8': return 'utf-8';
                case 'UTF-16': return 'utf-16le';
                case 'ANSEL': return 'windows-1252'; // Approximation
                case 'ASCII': return 'ascii';
                case 'ANSI': return 'windows-1252';
            }
        }
        
        // Par défaut UTF-8
        return 'utf-8';
    }
    
    /**
     * Rapporte la progression
     * @private
     */
    _reportProgress(phase, progress) {
        if (this.options.onProgress) {
            this.options.onProgress(phase, progress);
        }
    }
    
    /**
     * Log si mode verbose
     * @private
     */
    _log(message) {
        if (this.options.verbose) {
            console.log(`[GeneaFanParser] ${message}`);
        }
    }
}