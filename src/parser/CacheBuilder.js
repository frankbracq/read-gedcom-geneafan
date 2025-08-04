/**
 * CacheBuilder - Assemblage final du format GeneaFan optimisé
 * Transforme les données enrichies en caches compressées
 */

import { compressEventArray } from '../compression/eventCompression.js';
import { compressGeneaFanIndividual, compressFields } from '../compression/fieldCompression.js';
import { calculateQualityScore, calculateCacheQualityStats } from '../utils/qualityScoring.js';
import { normalizePlace } from '../utils/geoUtils.js';

export class CacheBuilder {
    constructor(options = {}) {
        this.options = {
            calculateQuality: true,
            compressEvents: true,
            compressFields: true,
            extractPlaces: true,
            generateStats: true,
            verbose: false,
            ...options
        };
        
        this.stats = {
            processed: 0,
            skipped: 0,
            errors: 0,
            compressionRatio: 0
        };
    }
    
    /**
     * Construit tous les caches OPTIMISÉS GeneaFan avec relations directes
     * Exploite les données extraites via read-gedcom APIs directes
     * @param {Object} enrichedData - Données du DataExtractor optimisé
     * @returns {Promise<Object>} Toutes les caches GeneaFan format compressé
     */
    async build(enrichedData) {
        const startTime = Date.now();
        
        try {
            // Réinitialiser stats
            this.stats = { processed: 0, skipped: 0, errors: 0, compressionRatio: 0 };
            
            // Construction DIRECTE du cache individus avec format GeneaFan compressé
            this._log('Construction du cache des individus optimisé...');
            const individualsCache = await this._buildOptimizedIndividualsCache(enrichedData.individuals);
            
            // Les familles ne sont plus nécessaires (relations intégrées dans individus)
            this._log('Construction du cache des familles...');
            const familiesCache = new Map(); // VIDE car relations dans individualsCache
            
            this._log('Construction du cache des sources...');
            const sourcesCache = await this._buildSourcesCache(enrichedData.sources);
            
            this._log('Construction du cache des médias...');
            const mediaCache = await this._buildMediaCache(enrichedData.media);
            
            this._log('Construction du cache des notes...');
            const notesCache = await this._buildNotesCache(enrichedData.notes);
            
            this._log('Construction du cache des dépôts...');
            const repositoriesCache = await this._buildRepositoriesCache(enrichedData.repositories);
            
            // Extraire les lieux uniques
            const places = this.options.extractPlaces ? 
                this._extractUniquePlaces(individualsCache, familiesCache) : new Set();
            
            // Calculer statistiques globales
            const statistics = this.options.generateStats ? 
                this._generateStatistics(individualsCache, familiesCache, sourcesCache, mediaCache, places) : {};
            
            // Calculer qualité globale
            const qualityStats = this.options.calculateQuality ? 
                calculateCacheQualityStats(individualsCache) : {};
            
            const buildTime = Date.now() - startTime;
            
            this._log(`✅ Caches construites en ${buildTime}ms`);
            this._log(`📊 ${individualsCache.size} individus, ${familiesCache.size} familles`);
            
            return {
                // Caches principales
                individualsCache,
                familiesCache,
                sourcesCache,
                mediaCache,
                notesCache,
                repositoriesCache,
                
                // Données dérivées
                places,
                statistics,
                qualityStats,
                
                // Métadonnées
                metadata: {
                    ...enrichedData.metadata,
                    buildTime,
                    compressionStats: this.stats,
                    cacheVersion: '2025.1',
                    buildDate: new Date().toISOString()
                }
            };
            
        } catch (error) {
            this._log(`❌ Erreur construction: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Version synchrone
     */
    buildSync(enrichedData) {
        // Pour l'instant, utiliser la version async
        // TODO: Implémenter version vraiment synchrone si nécessaire
        return this.build(enrichedData);
    }
    
    /**
     * Construit le cache des individus optimisé
     * @private
     */
    async _buildOptimizedIndividualsCache(individualsData) {
        const cache = new Map();
        
        if (!Array.isArray(individualsData)) {
            this._log('⚠️ Données individus vides ou invalides');
            return cache;
        }
        
        this._log(`🚀 Traitement optimisé de ${individualsData.length} individus...`);
        const uncompressedSize = JSON.stringify(individualsData).length;
        
        for (const individual of individualsData) {
            try {
                const geneafanOptimized = await this._createGeneaFanOptimizedIndividual(individual);
                if (geneafanOptimized && individual.pointer) {
                    cache.set(individual.pointer, geneafanOptimized);
                    this.stats.processed++;
                } else {
                    this.stats.skipped++;
                }
            } catch (error) {
                this._log(`❌ Erreur individu ${individual.pointer}: ${error.message}`);
                this.stats.errors++;
            }
        }
        
        // Calculer compression
        const compressedSize = JSON.stringify([...cache.entries()]).length;
        this.stats.compressionRatio = ((uncompressedSize - compressedSize) / uncompressedSize * 100).toFixed(1);
        
        this._log(`✅ Compression: ${this.stats.compressionRatio}% (${this.stats.processed} individus)`);
        
        return cache;
    }
    
    /**
     * 🚀 CŒUR DE L'OPTIMISATION: Transformation en format GeneaFan compressé
     * Exploite les relations directes extraites par read-gedcom APIs
     * @private
     */
    async _createGeneaFanOptimizedIndividual(individual) {
        if (!individual || !individual.pointer) return null;
        
        // === FORMAT GENEAFAN OPTIMISÉ FINAL ===
        const result = {};
        
        // Phase 12/13: Compression name/surname (fn = "surname|name")
        if (individual.name || individual.surname) {
            result.fn = `${individual.surname || ''}|${individual.name || ''}`;
        }
        
        // Phase 14: Compression gender (M/F/U)
        if (individual.sex) {
            result.g = individual.sex === 'male' ? 'M' : 
                      individual.sex === 'female' ? 'F' : 'U';
        }
        
        // === RELATIONS DIRECTES (pré-extraites par DataExtractor) ===
        // 🚀 ARCHITECTURE SOLIDE: Données extraites via 100% APIs read-gedcom natives
        
        // Père et mère (extraits par DataExtractor._extractDirectFamilyRelations)
        if (individual.fatherId) result.f = individual.fatherId;
        if (individual.motherId) result.m = individual.motherId;
        
        // Conjoints (extraits par DataExtractor._extractDirectFamilyRelations)
        if (individual.spouseIds && individual.spouseIds.length > 0) {
            result.s = individual.spouseIds;
        }
        
        // Siblings (extraits par DataExtractor._extractDirectFamilyRelations)
        if (individual.siblingIds && individual.siblingIds.length > 0) {
            result.b = individual.siblingIds;
        }
        
        // === ÉVÉNEMENTS COMPRESSÉS ===
        // Phase 6 Cloud: Compression systématique des événements
        if (individual.events && individual.events.length > 0) {
            result.e = this._compressEventsToGeneaFanFormat(individual.events);
        }
        
        // === QUALITÉ ===
        if (this.options.calculateQuality) {
            result.q = this._calculateIndividualQuality(individual);
        }
        
        // === MÉTADONNÉES OPTIONNELLES ===
        // Ne stocker que si présent (Phase 9: optimisation champs vides)
        if (individual.metadata?.extractedVia) {
            result._source = individual.metadata.extractedVia;
        }
        
        return result;
    }
    
    /**
     * Compresse les événements au format GeneaFan (Phase 6 Cloud)
     * @private
     */
    _compressEventsToGeneaFanFormat(events) {
        const compressed = [];
        
        for (const event of events) {
            const compressedEvent = this._compressSingleEvent(event);
            if (compressedEvent) {
                compressed.push(compressedEvent);
            }
        }
        
        return compressed;
    }
    
    /**
     * Compresse un événement individuel
     * @private
     */
    _compressSingleEvent(event) {
        if (!event || !event.type) return null;
        
        const compressed = {};
        
        // Type compression (birth → fb, marriage → fm, etc.)
        compressed.t = this._getEventTypeCode(event.type);
        
        // Date compression (DD/MM/YYYY → YYYYMMDD)
        if (event.date) {
            compressed.d = this._compressDate(event.date);
        }
        
        // Lieu (clé normalisée)
        if (event.place) {
            compressed.l = this._normalizePlace(event.place);
        }
        
        // Métadonnées (spouseId, childId, etc.)
        const metadata = {};
        if (event.spouseId) metadata.s = event.spouseId;
        if (event.childId) metadata.c = event.childId;
        
        if (Object.keys(metadata).length > 0) {
            compressed.m = metadata;
        }
        
        return compressed;
    }
    
    /**
     * Code type d'événement selon dictionnaire GeneaFan
     * @private
     */
    _getEventTypeCode(type) {
        const EVENT_CODES = {
            'birth': 'fb',
            'death': 'fd', 
            'marriage': 'fm',
            'divorce': 'fv',
            'child-birth': 'fc',
            'christening': 'fc',
            'baptism': 'fb',
            'occupation': 'po',
            'residence': 'pr'
        };
        
        return EVENT_CODES[type] || type;
    }
    
    /**
     * Compresse une date au format GeneaFan (YYYYMMDD)
     * @private
     */
    _compressDate(dateString) {
        if (!dateString) return null;
        
        // Tentative parsing de différents formats
        try {
            // Format GEDCOM: "DD MMM YYYY" ou "DD/MM/YYYY"
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return parseInt(`${year}${month}${day}`);
            }
        } catch (error) {
            // Fallback: essayer d'extraire l'année au minimum
            const yearMatch = dateString.match(/(\d{4})/);
            if (yearMatch) {
                return parseInt(`${yearMatch[1]}0101`); // 1er janvier de l'année
            }
        }
        
        return null;
    }
    
    /**
     * Normalise un lieu géographique avec parsePlaceParts + logique GeneaFan
     * @private
     */
    _normalizePlace(place) {
        // Utilise le module geoUtils avec parsePlaceParts de read-gedcom
        return normalizePlace(place);
    }
    
    /**
     * Calcule score de qualité d'un individu
     * @private
     */
    _calculateIndividualQuality(individual) {
        let score = 0;
        
        // Identité (30 points max)
        if (individual.name) score += 15;
        if (individual.surname) score += 15;
        if (individual.sex) score += 10;
        
        // Événements (40 points max)
        const events = individual.events || [];
        const hasBirth = events.some(e => e.type === 'birth');
        const hasDeath = events.some(e => e.type === 'death');
        const hasMarriage = events.some(e => e.type === 'marriage');
        
        if (hasBirth) score += 15;
        if (hasDeath) score += 10;
        if (hasMarriage) score += 15;
        
        // Relations (20 points max)
        if (individual.fatherId) score += 10;
        if (individual.motherId) score += 10;
        
        // Dates et lieux (10 points max)
        const eventsWithDate = events.filter(e => e.date).length;
        const eventsWithPlace = events.filter(e => e.place).length;
        score += Math.min(eventsWithDate * 2, 5);
        score += Math.min(eventsWithPlace * 2, 5);
        
        return Math.min(score, 100);
    }
    
    /**
     * Log si mode verbose
     * @private
     */
    /**
     * Construit le cache des sources
     * @private
     */
    async _buildSourcesCache(sourcesData) {
        const cache = new Map();
        if (!Array.isArray(sourcesData)) return cache;
        
        for (const source of sourcesData) {
            if (!source.pointer) continue;
            cache.set(source.pointer, {
                title: source.title || '',
                author: source.author || '',
                publisher: source.publisher || '',
                date: source.date || '',
                repository: source.repository || null,
                quality: source.quality || 'unknown',
                url: source.url || null,
                citations: source.citations || 0
            });
        }
        return cache;
    }
    
    /**
     * Construit le cache des médias
     * @private
     */
    async _buildMediaCache(mediaData) {
        const cache = new Map();
        if (!Array.isArray(mediaData)) return cache;
        
        for (const media of mediaData) {
            if (!media.pointer) continue;
            cache.set(media.pointer, {
                type: media.type || 'unknown',
                format: media.format || '',
                title: media.title || '',
                file: media.file || '',
                url: media.url || null,
                size: media.size || 0,
                date: media.date || null,
                individuals: media.individuals || [],
                notes: media.notes || []
            });
        }
        return cache;
    }
    
    /**
     * Construit le cache des notes
     * @private
     */
    async _buildNotesCache(notesData) {
        const cache = new Map();
        if (!Array.isArray(notesData)) return cache;
        
        for (const note of notesData) {
            if (!note.pointer) continue;
            cache.set(note.pointer, {
                text: note.text || '',
                type: note.type || 'general',
                date: note.date || null,
                author: note.author || null,
                individuals: note.individuals || []
            });
        }
        return cache;
    }
    
    /**
     * Construit le cache des dépôts
     * @private
     */
    async _buildRepositoriesCache(repositoriesData) {
        const cache = new Map();
        if (!Array.isArray(repositoriesData)) return cache;
        
        for (const repo of repositoriesData) {
            if (!repo.pointer) continue;
            cache.set(repo.pointer, {
                name: repo.name || '',
                address: repo.address || null,
                contact: repo.contact || null,
                notes: repo.notes || []
            });
        }
        return cache;
    }
    
    /**
     * Extrait tous les lieux uniques
     * @private
     */
    _extractUniquePlaces(individualsCache, familiesCache) {
        const places = new Set();
        
        // Lieux des individus
        for (const individual of individualsCache.values()) {
            if (individual.e) {
                individual.e.forEach(event => {
                    if (event.l) places.add(event.l);
                });
            }
        }
        
        // Lieux des familles
        for (const family of familiesCache.values()) {
            if (family.e) {
                family.e.forEach(event => {
                    if (event.l) places.add(event.l);
                });
            }
        }
        
        return places;
    }
    
    /**
     * Génère les statistiques globales
     * @private
     */
    _generateStatistics(individualsCache, familiesCache, sourcesCache, mediaCache, places) {
        const individuals = Array.from(individualsCache.values());
        
        // Calcul timespan
        const dates = [];
        individuals.forEach(individual => {
            if (individual.e) {
                individual.e.forEach(event => {
                    if (event.d) dates.push(event.d);
                });
            }
        });
        
        const years = dates.map(d => Math.floor(d / 10000)).filter(y => y > 0);
        const timespan = years.length > 0 ? 
            { min: Math.min(...years), max: Math.max(...years) } : 
            { min: null, max: null };
        
        // Calcul scores qualité
        const qualityScores = individuals
            .map(i => i.q)
            .filter(q => typeof q === 'number');
        
        const qualityStats = qualityScores.length > 0 ? {
            min: Math.min(...qualityScores),
            max: Math.max(...qualityScores),
            avg: Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
        } : { min: 0, max: 0, avg: 0 };
        
        return {
            individuals: individualsCache.size,
            families: familiesCache.size,
            sources: sourcesCache.size,
            media: mediaCache.size,
            places: places.size,
            timespan,
            quality: qualityStats,
            
            // Stats de compression
            compressionRatio: this.stats.compressionRatio,
            processed: this.stats.processed,
            errors: this.stats.errors
        };
    }
    
    _log(message) {
        if (this.options.verbose) {
            console.log(`[CacheBuilder] ${message}`);
        }
    }
}