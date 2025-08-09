/**
 * FamilyExtractor - Extraction des données familiales GEDCOM
 * 
 * Ce module gère l'extraction de tous les éléments familiaux :
 * - Enregistrements familiaux (FAM records)
 * - Relations familiales (époux/épouse/enfants)
 * - Événements familiaux (mariage, divorce, etc.)
 * - Pedigree et détails d'adoption
 */

export class FamilyExtractor {
    constructor(options = {}) {
        this.options = {
            extractMedia: true,
            extractNotes: true,
            extractSources: true,
            verbose: false,
            ...options
        };
    }

    /**
     * Extrait toutes les familles avec leurs relations et événements
     * @param {Object} rootSelection - Sélection racine read-gedcom
     * @returns {Promise<Array>} Liste des familles extraites
     */
    async extractFamilies(rootSelection) {
        const families = [];
        const familyRecords = rootSelection.getFamilyRecord().arraySelect();
        
        for (let i = 0; i < familyRecords.length; i++) {
            const family = familyRecords[i];
            const extractedFamily = await this.extractSingleFamily(family);
            if (extractedFamily) {
                families.push(extractedFamily);
            }
        }
        
        return families;
    }

    /**
     * Extrait une famille complète avec toutes ses données
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Promise<Object>} Famille complète extraite
     */
    async extractSingleFamily(familySelection) {
        const pointer = familySelection.pointer()[0];
        if (!pointer) return null;
        
        const result = {
            pointer,
            
            // === ÉPOUX/ÉPOUSE ===
            husband: this.extractSpouseReference(familySelection.getHusband()),
            wife: this.extractSpouseReference(familySelection.getWife()),
            
            // === ENFANTS ===
            children: this.extractChildrenReferences(familySelection.getChild()),
            
            // === ÉVÉNEMENTS FAMILIAUX ===
            events: this.extractFamilyEvents(familySelection),
            
            // === NOTES & SOURCES ===
            notes: this.options.extractNotes ? this.extractFamilyNotes(familySelection) : [],
            sources: this.options.extractSources ? this.extractFamilySources(familySelection) : [],
            multimedia: this.options.extractMedia ? this.extractFamilyMultimedia(familySelection) : [],
            
            // === MÉTADONNÉES ===
            metadata: {
                changeDate: this.extractChangeDate(familySelection),
                quality: 0 // Calculé plus tard
            }
        };
        
        return result;
    }

    /**
     * Extrait référence époux/épouse
     * @param {Object} spouseSelection - Sélection read-gedcom de l'époux/épouse
     * @returns {string|null} ID de l'époux/épouse
     */
    extractSpouseReference(spouseSelection) {
        if (spouseSelection.length === 0) return null;
        return spouseSelection.value()[0] || null;
    }

    /**
     * Extrait références des enfants
     * @param {Object} childrenSelection - Sélection read-gedcom des enfants
     * @returns {Array} Liste des IDs des enfants
     */
    extractChildrenReferences(childrenSelection) {
        const children = [];
        const childArray = childrenSelection.arraySelect();
        
        for (let i = 0; i < childArray.length; i++) {
            const childRef = childArray[i].value()[0];
            if (childRef) {
                children.push(childRef);
            }
        }
        
        return children;
    }

    /**
     * Extrait tous les événements familiaux
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Array} Liste des événements familiaux
     */
    extractFamilyEvents(familySelection) {
        const events = [];
        
        // Événements familiaux standards
        const familyEvents = [
            { method: 'getEventMarriage', type: 'marriage' },
            { method: 'getEventDivorce', type: 'divorce' },
            { method: 'getEventEngagement', type: 'engagement' },
            { method: 'getEventMarriageBann', type: 'marriage-bann' },
            { method: 'getEventMarriageContract', type: 'marriage-contract' },
            { method: 'getEventMarriageLicense', type: 'marriage-license' },
            { method: 'getEventMarriageSettlement', type: 'marriage-settlement' },
            { method: 'getEventAnnulment', type: 'annulment' },
            { method: 'getEventSeparation', type: 'separation' }
        ];
        
        // Extraire événements standards
        familyEvents.forEach(({ method, type }) => {
            if (typeof familySelection[method] === 'function') {
                const eventSelection = familySelection[method]();
                events.push(...this.extractEventDetails(eventSelection, type));
            }
        });
        
        return events.filter(event => event !== null);
    }

    /**
     * Extrait les détails d'un événement familial
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @param {string} baseType - Type de base de l'événement
     * @returns {Array} Liste des événements détaillés
     */
    extractEventDetails(eventSelection, baseType) {
        const events = [];
        const eventArray = eventSelection.arraySelect();
        
        for (let i = 0; i < eventArray.length; i++) {
            const event = eventArray[i];
            const eventData = {
                type: baseType,
                date: this.extractDate(event.getDate()),
                place: this.extractPlace(event.getPlace()),
                age: typeof event.getAge === 'function' ? this.extractAge(event.getAge()) : null,
                cause: this.extractCause(event),
                notes: this.options.extractNotes ? this.extractEventNotes(event) : [],
                sources: this.options.extractSources ? this.extractEventSources(event) : [],
                multimedia: this.options.extractMedia ? this.extractEventMultimedia(event) : []
            };
            
            events.push(eventData);
        }
        
        return events;
    }

    /**
     * Extrait les relations familiales comme enfant
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des familles où l'individu est enfant
     */
    extractFamilyAsChild(individualSelection) {
        const families = [];
        const familyArray = individualSelection.getFamilyAsChild().arraySelect();
        
        for (let i = 0; i < familyArray.length; i++) {
            const family = familyArray[i];
            families.push({
                pointer: family.pointer()[0],
                pedigree: this.extractPedigree(family),
                adoptionDetails: this.extractAdoptionDetails(family)
            });
        }
        
        return families;
    }

    /**
     * Extrait les relations familiales comme époux/épouse
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des familles où l'individu est époux/épouse
     */
    extractFamilyAsSpouse(individualSelection) {
        const families = [];
        const familyArray = individualSelection.getFamilyAsSpouse().arraySelect();
        
        for (let i = 0; i < familyArray.length; i++) {
            const family = familyArray[i];
            families.push({
                pointer: family.pointer()[0],
                husband: this.extractSpouseReference(family.getHusband()),
                wife: this.extractSpouseReference(family.getWife()),
                children: this.extractChildrenReferences(family.getChild()),
                events: this.extractFamilyEvents(family)
            });
        }
        
        return families;
    }

    /**
     * Extrait les informations de pedigree
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {string|null} Type de pedigree
     */
    extractPedigree(familySelection) {
        try {
            const pedigreeSelection = familySelection.get('PEDI');
            if (pedigreeSelection && pedigreeSelection.length > 0) {
                return pedigreeSelection.value()[0];
            }
        } catch (error) {
            this.log(`Erreur extraction pedigree: ${error.message}`);
        }
        return null;
    }

    /**
     * Extrait les détails d'adoption
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Object|null} Détails d'adoption
     */
    extractAdoptionDetails(familySelection) {
        try {
            const adoptionSelection = familySelection.get('ADOP');
            if (adoptionSelection && adoptionSelection.length > 0) {
                const adoption = {
                    type: 'adoption',
                    date: null,
                    place: null
                };
                
                // Date d'adoption
                const dateSelection = adoptionSelection.get('DATE');
                if (dateSelection && dateSelection.length > 0) {
                    adoption.date = dateSelection.value()[0];
                }
                
                // Lieu d'adoption
                const placeSelection = adoptionSelection.get('PLAC');
                if (placeSelection && placeSelection.length > 0) {
                    adoption.place = placeSelection.value()[0];
                }
                
                return adoption;
            }
        } catch (error) {
            this.log(`Erreur extraction détails adoption: ${error.message}`);
        }
        return null;
    }

    /**
     * Extrait les notes d'une famille
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Array} Liste des notes
     */
    extractFamilyNotes(familySelection) {
        const notes = [];
        
        try {
            const noteSelection = familySelection.getNote();
            if (noteSelection && noteSelection.length > 0) {
                noteSelection.arraySelect().forEach(note => {
                    const noteValue = note.value()[0];
                    if (noteValue) {
                        if (noteValue.startsWith('@')) {
                            // Référence vers une note externe
                            notes.push({
                                type: 'reference',
                                pointer: noteValue
                            });
                        } else {
                            // Note inline
                            notes.push({
                                type: 'embedded',
                                text: noteValue
                            });
                        }
                    }
                });
            }
        } catch (error) {
            this.log(`Erreur extraction notes famille: ${error.message}`);
        }
        
        return notes;
    }

    /**
     * Extrait les sources d'une famille
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Array} Liste des sources
     */
    extractFamilySources(familySelection) {
        const sources = [];
        
        try {
            const sourceSelection = familySelection.get('SOUR');
            if (sourceSelection && sourceSelection.length > 0) {
                sourceSelection.arraySelect().forEach(source => {
                    const sourcePointer = source.value()[0];
                    if (sourcePointer) {
                        sources.push({
                            pointer: sourcePointer
                        });
                    }
                });
            }
        } catch (error) {
            this.log(`Erreur extraction sources famille: ${error.message}`);
        }
        
        return sources;
    }

    /**
     * Extrait les médias d'une famille
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Array} Liste des médias
     */
    extractFamilyMultimedia(familySelection) {
        const multimedia = [];
        
        try {
            const mediaSelection = familySelection.get('OBJE');
            if (mediaSelection && mediaSelection.length > 0) {
                mediaSelection.arraySelect().forEach(media => {
                    const mediaPointer = media.value()[0];
                    if (mediaPointer) {
                        multimedia.push({
                            type: 'reference',
                            pointer: mediaPointer
                        });
                    }
                });
            }
        } catch (error) {
            this.log(`Erreur extraction médias famille: ${error.message}`);
        }
        
        return multimedia;
    }

    /**
     * Extrait la date de modification
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {string|null} Date de modification
     */
    extractChangeDate(familySelection) {
        try {
            const changeSelection = familySelection.get('CHAN');
            if (changeSelection && changeSelection.length > 0) {
                const dateSelection = changeSelection.get('DATE');
                if (dateSelection && dateSelection.length > 0) {
                    return dateSelection.value()[0];
                }
            }
        } catch (error) {
            this.log(`Erreur extraction date modification: ${error.message}`);
        }
        return null;
    }

    // === MÉTHODES UTILITAIRES ===

    /**
     * Extrait la date d'un événement
     * @param {Object} dateSelection - Sélection read-gedcom de la date
     * @returns {string|null} Date au format string
     */
    extractDate(dateSelection) {
        if (dateSelection.length === 0) return null;
        return dateSelection.value()[0] || null;
    }

    /**
     * Extrait le lieu d'un événement
     * @param {Object} placeSelection - Sélection read-gedcom du lieu
     * @returns {string|null} Lieu
     */
    extractPlace(placeSelection) {
        if (placeSelection.length === 0) return null;
        return placeSelection.value()[0] || null;
    }

    /**
     * Extrait l'âge d'un événement
     * @param {Object} ageSelection - Sélection read-gedcom de l'âge
     * @returns {string|null} Âge
     */
    extractAge(ageSelection) {
        if (ageSelection.length === 0) return null;
        return ageSelection.value()[0] || null;
    }

    /**
     * Extrait la cause d'un événement
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {string|null} Cause
     */
    extractCause(eventSelection) {
        try {
            const causeSelection = eventSelection.get('CAUS');
            if (causeSelection && causeSelection.length > 0) {
                return causeSelection.value()[0];
            }
        } catch (error) {
            // Pas de cause disponible
        }
        return null;
    }

    /**
     * Extrait les notes d'un événement
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des notes
     */
    extractEventNotes(eventSelection) {
        const notes = [];
        
        try {
            if (typeof eventSelection.getNote === 'function') {
                const noteSelection = eventSelection.getNote();
                
                if (noteSelection.length > 0) {
                    noteSelection.arraySelect().forEach((note, index) => {
                        const noteValue = note.value()[0];
                        
                        if (noteValue && noteValue.startsWith('@')) {
                            notes.push({ type: 'reference', pointer: noteValue });
                        } else if (noteValue) {
                            notes.push({ type: 'embedded', text: noteValue });
                        }
                    });
                }
            }
        } catch (error) {
            this.log(`Erreur extraction notes événement: ${error.message}`);
        }
        
        return notes;
    }

    /**
     * Extrait les sources d'un événement
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des sources
     */
    extractEventSources(eventSelection) {
        const sources = [];
        
        try {
            const sourceSelection = eventSelection.get('SOUR');
            if (sourceSelection && sourceSelection.length > 0) {
                sourceSelection.arraySelect().forEach(source => {
                    const sourceData = {
                        pointer: source.value()[0],
                        page: null,
                        quality: null
                    };
                    
                    // Page
                    const pageSelection = source.get('PAGE');
                    if (pageSelection && pageSelection.length > 0) {
                        sourceData.page = pageSelection.value()[0];
                    }
                    
                    // Qualité (QUAY)
                    const qualitySelection = source.get('QUAY');
                    if (qualitySelection && qualitySelection.length > 0) {
                        sourceData.quality = parseInt(qualitySelection.value()[0]);
                    }
                    
                    sources.push(sourceData);
                });
            }
        } catch (error) {
            this.log(`Erreur extraction sources événement: ${error.message}`);
        }
        
        return sources;
    }

    /**
     * Extrait les médias d'un événement
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des médias
     */
    extractEventMultimedia(eventSelection) {
        const multimedia = [];
        
        try {
            const multimediaRefs = eventSelection.getMultimedia ? eventSelection.getMultimedia() : eventSelection.get('OBJE');
            if (multimediaRefs && multimediaRefs.length > 0) {
                multimediaRefs.arraySelect().forEach(mediaRef => {
                    const mediaPointer = mediaRef.value()[0];
                    if (mediaPointer) {
                        multimedia.push({
                            type: 'reference',
                            pointer: mediaPointer
                        });
                    }
                });
            }
        } catch (error) {
            this.log(`Erreur extraction médias événement: ${error.message}`);
        }
        
        return multimedia;
    }

    /**
     * Log si mode verbose
     * @param {string} message - Message à logger
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[FamilyExtractor] ${message}`);
        }
    }
}