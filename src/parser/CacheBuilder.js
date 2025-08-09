/**
 * CacheBuilder - Assemblage final du format GeneaFan optimisé
 * Transforme les données enrichies en caches compressées
 */

import { compressEventArray, EVENT_TYPE_COMPRESSION } from '../compression/eventCompression.js';
import { compressIndividualFields, conditionalCompressFields } from '../compression/fieldCompression.js';
import { calculateQualityScore, calculateCacheQualityStats } from '../utils/qualityScoring.js';
import { normalizePlace, extractPlaceComponents } from '../utils/geoUtils.js';

export class CacheBuilder {
    constructor(options = {}) {
        this.options = {
            calculateQuality: true,
            compressEvents: true,
            compressFields: true,
            extractPlaces: true,
            generateStats: true,
            enrichGeocoding: false,
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
            
            // ÉTAPE 1: Construction des caches de base (AVANT compression des individus)
            this._log('Construction du cache des sources...');
            const sourcesCache = await this._buildSourcesCache(enrichedData.sources);
            
            this._log('Construction du cache des médias...');
            const mediaCache = await this._buildMediaCache(enrichedData.media);
            
            this._log('Construction du cache des notes...');
            const notesCache = await this._buildNotesCache(enrichedData.notes);
            
            this._log('Construction du cache des dépôts...');
            const repositoriesCache = await this._buildRepositoriesCache(enrichedData.repositories);
            
            // ÉTAPE 2: Phase de référencement croisé - AVANT compression !
            // CRITIQUE: Les noteIds des subdivisions doivent être créés AVANT la compression des événements
            this._log('Référencement croisé notes/médias ↔ individus (AVANT compression)...');
            this._crossReferenceNotesAndMedia(enrichedData.individuals, notesCache, mediaCache);
            
            // ÉTAPE 3: Construction du cache individus APRÈS cross-reference 
            // Les noteIds des subdivisions sont maintenant disponibles pour la compression
            this._log('Construction du cache des individus optimisé (APRÈS cross-reference)...');
            const individualsCache = await this._buildOptimizedIndividualsCache(enrichedData.individuals);
            
            // Les familles ne sont plus nécessaires (relations intégrées dans individus)
            this._log('Construction du cache des familles...');
            const familiesCache = new Map(); // VIDE car relations dans individualsCache
            
            // Ajouter les références aux notes dans individualsCache APRÈS le cross-reference
            this._log('Ajout des références de notes dans individualsCache...');
            this._addNotesReferencesToIndividuals(enrichedData.individuals, individualsCache, notesCache);
            
            // Générer familyTownsStore de base (données extraites sans enrichissement)
            const familyTownsStore = this.options.extractPlaces ? 
                await this._generateFamilyTownsStore(enrichedData.individuals, familiesCache) : {};
            
            // Extraire les lieux uniques (pour compatibilité)
            const places = Object.keys(familyTownsStore).length > 0 ? 
                new Set(Object.keys(familyTownsStore)) : new Set();
            
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
                
                // 🗺️ NOUVEAU: FamilyTownsStore de base pour geneafan
                familyTownsStore,
                
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
        
        // 🌍 ENRICHISSEMENT GÉOCODAGE: Désactivé - sera fait par geneafan en arrière-plan
        // L'enrichissement (couleurs + coordonnées) sera géré par familyTownsStore.js
        
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
        if (individual.name) {
            const surname = individual.name.surname || '';
            const given = individual.name.given || '';
            result.fn = `${surname}|${given}`;
        }
        
        // Phase 14: Compression gender (M/F/U)
        if (individual.sex) {
            result.g = individual.sex; // Déjà au format M/F/U depuis IndividualExtractor
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
            result.e = await this._compressEventsToGeneaFanFormat(individual.events);
        }
        
        // === NOTES (références uniquement) ===
        // Les références aux notes seront ajoutées APRÈS _crossReferenceNotesAndMedia
        // via _addNotesReferencesToIndividuals()
        
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
    async _compressEventsToGeneaFanFormat(events) {
        const compressed = [];
        
        for (const event of events) {
            const compressedEvent = await this._compressSingleEvent(event);
            if (compressedEvent) {
                compressed.push(compressedEvent);
            }
        }
        
        return compressed;
    }
    
    /**
     * Compresse un événement individuel SANS dupliquer les coordonnées
     * @private
     */
    async _compressSingleEvent(event) {
        if (!event || !event.type) return null;
        
        const compressed = {};
        
        // Type compression (birth → fb, marriage → fm, etc.)
        compressed.t = this._getEventTypeCode(event.type);
        
        // Date compression (DD/MM/YYYY → YYYYMMDD)
        if (event.date) {
            compressed.d = this._compressDate(event.date);
        }
        
        // Lieu - IMPORTANT : Ne stocker QUE la clé normalisée, PAS les coordonnées
        if (event.place) {
            // Si place est un objet temporaire avec coordonnées ET subdivision
            if (typeof event.place === 'object' && event.place.value) {
                compressed.l = await this._normalizePlace(event.place.value);
                // [NOUVEAU] Extraire la subdivision si présente
                if (event.place.subdivision) {
                    // Stocker dans les métadonnées (sera ajouté plus bas)
                    if (!event.subdivision) event.subdivision = event.place.subdivision;
                }
                // ⚠️ NE PAS stocker _tempLatitude/_tempLongitude ici !
                // Les coordonnées seront dans familyTownsStore uniquement
            } 
            // Fallback si place est une string (rétrocompatibilité)
            else if (typeof event.place === 'string') {
                compressed.l = await this._normalizePlace(event.place);
            }
        }
        
        // Métadonnées standards (spouseId, childId, etc.)
        const metadata = {};
        if (event.spouseId) metadata.s = event.spouseId;
        if (event.childId) metadata.c = event.childId;
        
        // [NOUVEAU] Ajouter la valeur pour les attributs (occupation, etc.)
        if (event.value) {
            metadata.v = event.value;
        }
        
        // [NOUVEAU] Ajouter le customType pour les événements EVEN
        if (event.customType) {
            metadata.ct = event.customType;
        }
        
        // [NOUVEAU] Ajouter les IDs de notes si présents
        if (event.noteIds && event.noteIds.length > 0) {
            metadata.n = event.noteIds;
        }
        
        // [NOUVEAU] Ajouter la subdivision si présente (Synagogue, École, etc.)
        if (event.subdivision) {
            metadata.sd = event.subdivision; // sd = subdivision
        }
        
        // [NOUVEAU] Ajouter les cérémonies multiples pour les mariages fusionnés
        if (event.ceremonies && event.ceremonies.length > 0) {
            metadata.ceremonies = await Promise.all(event.ceremonies.map(async c => {
                const ceremony = {
                    t: c.type === 'civil' ? 'c' : 'r',  // c=civil, r=religious
                    d: this._compressDate(c.date),
                    l: c.place ? await this._normalizePlace(c.place) : undefined
                };
                
                // [SUPPRIMÉ] marriageType redondant avec t: "r"/"c"
                
                // [NOUVEAU] Préserver les notes de la cérémonie
                if (c.notes && c.notes.length > 0) {
                    ceremony.n = c.notes.map(n => n.id || n.pointer).filter(Boolean);
                }
                
                // [NOUVEAU] Préserver la subdivision de la cérémonie (Synagogue, Église, etc.)
                if (c.subdivision) {
                    ceremony.sd = c.subdivision; // sd = subdivision
                }
                
                return ceremony;
            }));
        }
        
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
        // Utiliser le dictionnaire complet de eventCompression.js
        return EVENT_TYPE_COMPRESSION[type] || type;
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
    async _normalizePlace(place) {
        if (!place || typeof place !== 'string') return null;
        
        // 🔍 LOGGING DÉTAILLÉ: Désactivé pour production propre
        // Le logging détaillé peut être réactivé avec this.options.logPlaces = true
        
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
     * Référencement croisé : remplit le champ 'individuals' dans les caches notes/médias
     * @private
     */
    _crossReferenceNotesAndMedia(individualsData, notesCache, mediaCache) {
        if (!Array.isArray(individualsData)) return;
        
        let noteLinks = 0;
        let mediaLinks = 0;
        
        // Parcourir tous les individus pour collecter leurs références
        for (const individual of individualsData) {
            if (!individual.pointer) continue;
            
            // Traiter les références aux notes (nouvelle structure: individual.notes.refs)
            if (individual.notes && individual.notes.refs && Array.isArray(individual.notes.refs)) {
                for (const noteRef of individual.notes.refs) {
                    const note = notesCache.get(noteRef);
                    if (note) {
                        if (!note.individuals) note.individuals = [];
                        if (!note.individuals.includes(individual.pointer)) {
                            note.individuals.push(individual.pointer);
                            noteLinks++;
                        }
                    }
                }
            }
            
            // Traiter les notes inline (nouvelle structure: individual.notes.inline)
            if (individual.notes && individual.notes.inline && Array.isArray(individual.notes.inline)) {
                for (const inlineNote of individual.notes.inline) {
                    // Ajouter la note inline au cache des notes
                    if (!notesCache.has(inlineNote.id)) {
                        notesCache.set(inlineNote.id, {
                            text: inlineNote.text,
                            type: inlineNote.type || 'individual',
                            date: null,
                            author: null,
                            individuals: [individual.pointer]
                        });
                        noteLinks++;
                    }
                }
            }
            
            // Compatibilité avec l'ancienne structure (au cas où)
            if (individual.noteRefs && Array.isArray(individual.noteRefs)) {
                for (const noteRef of individual.noteRefs) {
                    const note = notesCache.get(noteRef);
                    if (note) {
                        if (!note.individuals) note.individuals = [];
                        if (!note.individuals.includes(individual.pointer)) {
                            note.individuals.push(individual.pointer);
                            noteLinks++;
                        }
                    }
                }
            }
            
            if (individual.inlineNotes && Array.isArray(individual.inlineNotes)) {
                for (const inlineNote of individual.inlineNotes) {
                    if (!notesCache.has(inlineNote.id)) {
                        notesCache.set(inlineNote.id, {
                            text: inlineNote.text,
                            type: inlineNote.type || 'individual',
                            date: null,
                            author: null,
                            individuals: [individual.pointer]
                        });
                        noteLinks++;
                    }
                }
            }
            
            // Traiter les références aux médias
            if (individual.mediaRefs && Array.isArray(individual.mediaRefs)) {
                for (const mediaRef of individual.mediaRefs) {
                    const media = mediaCache.get(mediaRef);
                    if (media) {
                        if (!media.individuals) media.individuals = [];
                        if (!media.individuals.includes(individual.pointer)) {
                            media.individuals.push(individual.pointer);
                            mediaLinks++;
                        }
                    }
                }
            }
            
            // Aussi traiter les notes/médias dans les événements
            if (individual.events && Array.isArray(individual.events)) {
                for (const event of individual.events) {
                    // Notes dans les événements
                    if (event.notes && Array.isArray(event.notes)) {
                        for (const noteData of event.notes) {
                            if (noteData.pointer) {
                                // Notes avec références externes
                                const note = notesCache.get(noteData.pointer);
                                if (note) {
                                    if (!note.individuals) note.individuals = [];
                                    if (!note.individuals.includes(individual.pointer)) {
                                        note.individuals.push(individual.pointer);
                                        noteLinks++;
                                    }
                                }
                            } else if (noteData.type === 'embedded' && noteData.text) {
                                // Notes inline dans les événements
                                const eventNoteId = `INLINE_EVENT_${individual.pointer}_${event.type}_${noteLinks}`;
                                if (!notesCache.has(eventNoteId)) {
                                    notesCache.set(eventNoteId, {
                                        text: noteData.text,
                                        type: 'event',
                                        date: null,
                                        author: null,
                                        individuals: [individual.pointer],
                                        eventType: event.type,
                                        customType: event.customType || null
                                    });
                                    noteLinks++;
                                    
                                    // Créer noteIds dans l'événement pour la compression
                                    if (!event.noteIds) event.noteIds = [];
                                    event.noteIds.push(eventNoteId);
                                }
                            }
                        }
                    }
                    
                    // Médias dans les événements
                    if (event.multimedia && Array.isArray(event.multimedia)) {
                        for (const mediaData of event.multimedia) {
                            if (mediaData.pointer) {
                                const media = mediaCache.get(mediaData.pointer);
                                if (media) {
                                    if (!media.individuals) media.individuals = [];
                                    if (!media.individuals.includes(individual.pointer)) {
                                        media.individuals.push(individual.pointer);
                                        mediaLinks++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        this._log(`   ✅ Référencement croisé: ${noteLinks} liens notes, ${mediaLinks} liens médias`);
    }
    
    /**
     * Ajoute les références aux notes dans le cache des individus
     * @private
     */
    _addNotesReferencesToIndividuals(individualsData, individualsCache, notesCache) {
        if (!Array.isArray(individualsData)) return;
        
        let referencesAdded = 0;
        
        for (const individual of individualsData) {
            if (!individual.pointer) continue;
            
            const cachedIndividual = individualsCache.get(individual.pointer);
            if (!cachedIndividual) continue;
            
            // Collecter les IDs de notes inline pour cet individu
            const noteIds = [];
            
            if (individual.notes && individual.notes.inline && Array.isArray(individual.notes.inline)) {
                for (const inlineNote of individual.notes.inline) {
                    if (inlineNote.id && notesCache.has(inlineNote.id)) {
                        noteIds.push(inlineNote.id);
                    }
                }
            }
            
            // Ajouter les références dans le cache de l'individu
            if (noteIds.length > 0) {
                cachedIndividual.n = noteIds;
                referencesAdded++;
            }
        }
        
        this._log(`   ✅ ${referencesAdded} individus mis à jour avec références de notes`);
    }
    
    /**
     * 🗺️ GÉNÈRE familyTownsStore avec coordonnées natives centralisées
     * @private
     */
    async _generateFamilyTownsStore(individualsData, familiesCache) {
        const familyTownsStore = {};
        
        this._log('🏗️ Génération familyTownsStore avec coordonnées natives centralisées...');
        
        // Structure pour collecter TOUS les lieux et leurs coordonnées
        const placesData = new Map();
        let coordsExtracted = 0;
        
        // Phase 1 : Collecter tous les lieux uniques et leurs coordonnées
        if (Array.isArray(individualsData)) {
            for (const individual of individualsData) {
                if (individual.events && Array.isArray(individual.events)) {
                    for (const event of individual.events) {
                        if (event.place) {
                            // Extraire la valeur du lieu (gère l'objet temporaire ou string)
                            const placeValue = typeof event.place === 'object' ? 
                                event.place.value : event.place;
                            
                            if (!placeValue) continue;
                            
                            const normalizedKey = await this._normalizePlace(placeValue);
                            
                            if (normalizedKey) {
                                // Initialiser l'entrée si première fois
                                if (!placesData.has(normalizedKey)) {
                                    placesData.set(normalizedKey, {
                                        normalizedKey,
                                        samples: new Set(),
                                        latitude: null,
                                        longitude: null,
                                        coordsCount: 0
                                    });
                                }
                                
                                const placeInfo = placesData.get(normalizedKey);
                                placeInfo.samples.add(placeValue);
                                
                                // Capturer les coordonnées temporaires si disponibles
                                if (typeof event.place === 'object' && 
                                    event.place._tempLatitude !== undefined && 
                                    event.place._tempLongitude !== undefined &&
                                    event.place._tempLatitude !== null && 
                                    event.place._tempLongitude !== null) {
                                    
                                    // Stocker les coordonnées (on pourrait faire une moyenne si plusieurs)
                                    if (placeInfo.latitude === null) {
                                        placeInfo.latitude = event.place._tempLatitude;
                                        placeInfo.longitude = event.place._tempLongitude;
                                        coordsExtracted++;
                                    }
                                    placeInfo.coordsCount++;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Phase 2 : Générer familyTownsStore avec coordonnées centralisées
        for (const [key, data] of placesData) {
            // Extraire les composants géographiques
            const firstSample = Array.from(data.samples)[0] || '';
            const components = await extractPlaceComponents(firstSample);
            
            // Construire townDisplay avec contexte
            const townName = components.town || key;
            let townDisplay = townName;
            
            if (components.department) {
                townDisplay = `${townName} (${components.department})`;
            } else if (components.country && components.country !== 'France') {
                townDisplay = `${townName} (${components.country})`;
            }
            
            // Créer l'entrée avec coordonnées SI disponibles
            familyTownsStore[key] = {
                town: townName,
                townDisplay: townDisplay,
                // Coordonnées natives du GEDCOM (une seule fois par lieu !)
                latitude: data.latitude !== null ? String(data.latitude) : "",
                longitude: data.longitude !== null ? String(data.longitude) : "",
                departement: components.department || "",
                country: components.country || "",
                departementColor: "",                  // Sera enrichi par geneafan
                countryColor: "",                      // Sera enrichi par geneafan
                _samples: Array.from(data.samples).slice(0, 3)
            };
            
            // Ajouter des métadonnées de tracking si coordonnées natives
            if (data.latitude !== null && data.longitude !== null) {
                familyTownsStore[key]._hasNativeCoords = true;
                if (data.coordsCount > 1) {
                    familyTownsStore[key]._coordsOccurrences = data.coordsCount;
                }
            }
        }
        
        // Phase 3 : Logging et statistiques
        const totalPlaces = Object.keys(familyTownsStore).length;
        const placesWithCoords = coordsExtracted;
        
        this._log(`✅ FamilyTownsStore généré: ${totalPlaces} lieux uniques`);
        
        if (placesWithCoords > 0) {
            const percentage = ((placesWithCoords / totalPlaces) * 100).toFixed(1);
            this._log(`   📍 ${placesWithCoords} lieux avec coordonnées natives (${percentage}%)`);
            this._log(`   💰 ${placesWithCoords} appels API geocoding économisés !`);
            
            // Exemples pour debug
            const examples = Object.entries(familyTownsStore)
                .filter(([_, data]) => data._hasNativeCoords)
                .slice(0, 3);
            
            if (examples.length > 0 && this.options.verbose) {
                this._log(`   📌 Exemples :`);
                examples.forEach(([key, data]) => {
                    this._log(`      - ${data.townDisplay}: ${data.latitude}, ${data.longitude}`);
                });
            }
        } else {
            this._log(`   ℹ️  Aucune coordonnée native trouvée dans ce fichier GEDCOM`);
        }
        
        return familyTownsStore;
    }
    
    /**
     * Extrait tous les lieux uniques (DEPRECATED - utilisé pour compatibilité)
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
    
    // 🗑️ ENRICHISSEMENT GÉOCODAGE: Retiré - sera géré par geneafan/familyTownsStore.js
    // Toutes les méthodes d'enrichissement ont été supprimées pour garder 
    // read-gedcom-geneafan focalisé sur l'extraction pure des données GEDCOM
    
    _log(message) {
        if (this.options.verbose) {
            console.log(`[CacheBuilder] ${message}`);
        }
    }
}