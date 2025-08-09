/**
 * EventExtractor - Extraction des événements et attributs GEDCOM
 * 
 * Ce module gère l'extraction de tous les types d'événements :
 * - Événements individuels (naissance, décès, etc.)
 * - Événements familiaux (mariage, divorce, etc.)
 * - Attributs (profession, résidence, etc.)
 * - Événements personnalisés
 */

import { parsePlaceWithSubdivision } from '../../utils/geoUtils.js';

export class EventExtractor {
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
     * Extrait TOUS les événements individuels (21 types standards + customs)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @param {string} pointer - Pointeur de l'individu
     * @returns {Array} Liste des événements
     */
    extractAllEvents(individualSelection, pointer) {
        const events = [];
        
        // Événements standards avec API dédiée
        const standardEvents = [
            { method: 'getEventBirth', type: 'birth' },
            { method: 'getEventChristening', type: 'christening' },
            { method: 'getEventDeath', type: 'death' },
            { method: 'getEventBurial', type: 'burial' },
            { method: 'getEventCremation', type: 'cremation' },
            { method: 'getEventAdoption', type: 'adoption' },
            { method: 'getEventBaptism', type: 'baptism' },
            { method: 'getEventBarMitzvah', type: 'bar-mitzvah' },
            { method: 'getEventBatMitzvah', type: 'bat-mitzvah' },
            { method: 'getEventAdultChristening', type: 'adult-christening' },
            { method: 'getEventConfirmation', type: 'confirmation' },
            { method: 'getEventFirstCommunion', type: 'first-communion' },
            { method: 'getEventNaturalization', type: 'naturalization' },
            { method: 'getEventEmigration', type: 'emigration' },
            { method: 'getEventImmigration', type: 'immigration' },
            { method: 'getEventCensus', type: 'census' },
            { method: 'getEventProbate', type: 'probate' },
            { method: 'getEventWill', type: 'will' },
            { method: 'getEventGraduation', type: 'graduation' },
            { method: 'getEventRetirement', type: 'retirement' }
        ];
        
        // Extraire événements standards
        standardEvents.forEach(({ method, type }) => {
            const eventSelection = individualSelection[method]();
            events.push(...this.extractEventDetails(eventSelection, type));
        });
        
        // Événements génériques/customs via getEventOther
        const otherEvents = individualSelection.getEventOther();
        const customEvents = this.extractEventDetails(otherEvents, 'custom');
        events.push(...customEvents);
        
        // Extraire les attributs et les traiter comme des événements
        const attributes = this.extractAllAttributes(individualSelection);
        events.push(...attributes);
        
        return events.filter(event => event !== null);
    }

    /**
     * Extrait les détails d'un événement avec toutes ses métadonnées
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
            
            // Données spécifiques selon le type
            if (baseType === 'custom') {
                eventData.customType = this.extractCustomEventType(event);
            }
            
            events.push(eventData);
        }
        
        return events;
    }

    /**
     * Extrait TOUS les attributs (13 types standards + customs)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des attributs
     */
    extractAllAttributes(individualSelection) {
        const attributes = [];
        
        const standardAttributes = [
            { method: 'getAttributeCaste', type: 'caste' },
            { method: 'getAttributePhysicalDescription', type: 'physical-description' },
            { method: 'getAttributeScholasticAchievement', type: 'education' },
            { method: 'getAttributeIdentificationNumber', type: 'id-number' },
            { method: 'getAttributeNationality', type: 'nationality' },
            { method: 'getAttributeChildrenCount', type: 'children-count' },
            { method: 'getAttributeRelationshipCount', type: 'marriage-count' },
            { method: 'getAttributeOccupation', type: 'occupation' },
            { method: 'getAttributePossessions', type: 'property' },
            { method: 'getAttributeReligiousAffiliation', type: 'religion' },
            { method: 'getAttributeResidence', type: 'residence' },
            { method: 'getAttributeNobilityTitle', type: 'title' }
        ];
        
        standardAttributes.forEach(({ method, type }) => {
            const attrSelection = individualSelection[method]();
            attributes.push(...this.extractAttributeDetails(attrSelection, type));
        });
        
        // Attributs génériques via getFact
        const factAttributes = individualSelection.getAttributeFact();
        attributes.push(...this.extractAttributeDetails(factAttributes, 'fact'));
        
        return attributes.filter(attr => attr !== null);
    }

    /**
     * Extrait les détails d'un attribut (OCCU, RESI, etc.)
     * @param {Object} attrSelection - Sélection read-gedcom de l'attribut
     * @param {string} type - Type de l'attribut
     * @returns {Array} Liste des attributs détaillés
     */
    extractAttributeDetails(attrSelection, type) {
        const attributes = [];
        const attrArray = attrSelection.arraySelect();
        
        for (let i = 0; i < attrArray.length; i++) {
            const attr = attrArray[i];
            const attrData = {
                type: type,
                value: attr.value()[0] || null,  // Valeur de l'attribut (ex: "Forgeron" pour occupation)
                date: this.extractDate(attr.getDate()),
                place: this.extractPlace(attr.getPlace()),
                age: typeof attr.getAge === 'function' ? this.extractAge(attr.getAge()) : null,
                notes: this.options.extractNotes ? this.extractEventNotes(attr) : [],
                sources: this.options.extractSources ? this.extractEventSources(attr) : []
            };
            
            attributes.push(attrData);
        }
        
        return attributes;
    }

    /**
     * Extraction optimisée des événements familiaux avec métadonnées
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @param {Object} familyRelations - Relations familiales de l'individu
     * @returns {Array} Liste des événements familiaux
     */
    extractFamilyEventsOptimized(individualSelection, familyRelations) {
        const events = [];
        
        // === ÉVÉNEMENTS DE MARIAGE ===
        const familiesAsSpouse = individualSelection.getFamilyAsSpouse().arraySelect();
        const marriagesBySpouse = new Map(); // Pour grouper les mariages par conjoint
        
        familiesAsSpouse.forEach((spouseFamily, index) => {
            const marriageEvents = spouseFamily.getEventMarriage().arraySelect();
            const spouseId = familyRelations.spouseIds[index] || null;
            
            marriageEvents.forEach(marriageEvent => {
                const marriageDate = marriageEvent.getDate();
                const marriagePlace = marriageEvent.getPlace();
                
                if (marriageDate.length > 0) {
                    const marriage = {
                        type: 'marriage',
                        date: marriageDate.value()[0],
                        place: marriagePlace.length > 0 ? marriagePlace.value()[0] : null,
                        spouseId: spouseId
                    };
                    
                    // Parser le lieu avec subdivision si disponible
                    if (marriagePlace.length > 0) {
                        const placeString = marriagePlace.value()[0];
                        const placeData = parsePlaceWithSubdivision(placeString);
                        
                        marriage.place = placeData.normalizedPlace || placeString;
                        marriage.fullPlace = placeData.fullPlace;
                        if (placeData.subdivision) {
                            marriage.subdivision = placeData.subdivision;
                        }
                    }
                    
                    // Extraire le TYPE du mariage via l'API read-gedcom
                    try {
                        const marriageType = marriageEvent.getType();
                        if (marriageType && marriageType.length > 0) {
                            const typeValue = marriageType.value()[0];
                            if (typeValue) {
                                marriage.marriageType = typeValue;
                                // Utiliser le TYPE pour déterminer civil/religieux
                                if (typeValue.toLowerCase().includes('religious')) {
                                    marriage.ceremonyType = 'religious';
                                } else if (typeValue.toLowerCase().includes('civil')) {
                                    marriage.ceremonyType = 'civil';
                                }
                            }
                        }
                    } catch (error) {
                        // getType() peut ne pas exister sur certains événements
                    }
                    
                    // Préserver le lieu complet sans normalisation prématurée
                    if (marriagePlace.length > 0) {
                        const fullPlace = marriagePlace.value()[0];
                        marriage.fullPlace = fullPlace; // Lieu complet pour préservation
                        marriage.place = fullPlace; // Pour compatibilité existing
                    }
                    
                    // Extraire les notes du mariage
                    try {
                        const marriageNotes = marriageEvent.getNote();
                        if (marriageNotes && marriageNotes.length > 0) {
                            marriage.notes = this.extractEventNotes(marriageEvent);
                            if (marriage.notes.length > 0) {
                                marriage.noteIds = marriage.notes.map(n => n.id || n.pointer).filter(Boolean);
                            }
                        }
                    } catch (error) {
                        // getNote() peut échouer sur certains événements
                    }
                    
                    // Extraire les sources
                    try {
                        const marriageSources = marriageEvent.get('SOUR');
                        if (marriageSources && marriageSources.length > 0) {
                            marriage.sources = marriageSources.arraySelect().map(source => ({
                                pointer: source.pointer() ? source.pointer()[0] : null
                            })).filter(s => s.pointer);
                        }
                    } catch (error) {
                        // Sources optionnelles
                    }
                    
                    // Grouper les mariages par conjoint
                    if (!marriagesBySpouse.has(spouseId)) {
                        marriagesBySpouse.set(spouseId, []);
                    }
                    marriagesBySpouse.get(spouseId).push(marriage);
                }
            });
        });
        
        // Traiter les mariages groupés par conjoint
        marriagesBySpouse.forEach((marriages, spouseId) => {
            if (marriages.length === 1) {
                // Un seul mariage avec ce conjoint
                events.push(marriages[0]);
            } else {
                // Plusieurs mariages avec le même conjoint - appliquer la règle de fusion
                const fusedMarriages = this.fuseMarriagesWithSameSpouse(marriages, individualSelection);
                events.push(...fusedMarriages);
            }
        });
        
        // === ÉVÉNEMENTS NAISSANCE D'ENFANTS ===
        familyRelations.childrenIds.forEach(childId => {
            // On ne peut pas récupérer facilement la date de naissance de l'enfant
            // sans accéder à l'individu enfant. Ceci sera traité dans la phase suivante.
            events.push({
                type: 'child-birth',
                childId: childId,
                date: null // À enrichir plus tard si nécessaire
            });
        });
        
        return events;
    }

    /**
     * Extrait la date d'un événement
     * @param {Object} dateSelection - Sélection read-gedcom de la date
     * @returns {string|null} Date au format string ou null
     */
    extractDate(dateSelection) {
        if (dateSelection.length === 0) return null;
        return dateSelection.value()[0] || null;
    }

    /**
     * Extrait le lieu d'un événement avec coordonnées et subdivision
     * @param {Object} placeSelection - Sélection read-gedcom du lieu
     * @returns {Object|null} Objet lieu enrichi ou null
     */
    extractPlace(placeSelection) {
        if (placeSelection.length === 0) return null;
        
        const placeValue = placeSelection.value()[0] || null;
        if (!placeValue) return null;
        
        // Parser le lieu avec subdivision
        const placeData = parsePlaceWithSubdivision(placeValue);
        
        // Structure temporaire pour transporter coordonnées ET subdivision
        // Note: Cet objet sera utilisé uniquement pendant l'extraction
        // Les coordonnées ne seront PAS stockées dans le cache individuel final
        const enrichedPlaceData = {
            value: placeData.normalizedPlace || placeValue, // Lieu normalisé
            fullPlace: placeData.fullPlace, // Lieu complet original
            subdivision: placeData.subdivision || null, // Subdivision (Synagogue, École, etc.)
            // Propriétés temporaires pour transport vers familyTownsStore
            _tempLatitude: null,
            _tempLongitude: null
        };
        
        // Tentative d'extraction des coordonnées via API read-gedcom
        try {
            // Obtenir le premier enregistrement de lieu
            const placeRecords = placeSelection.arraySelect();
            if (placeRecords && placeRecords.length > 0) {
                const placeRecord = placeRecords[0];
                
                // Méthode 1 : Utiliser getCoordinates si disponible (API native)
                if (typeof placeRecord.getCoordinates === 'function') {
                    const coords = placeRecord.getCoordinates();
                    if (coords.length > 0) {
                        const coordsValue = coords.value()[0];
                        if (coordsValue) {
                            // Format possible: "lat,lon" ou objet
                            const parts = String(coordsValue).split(',');
                            if (parts.length === 2) {
                                const lat = parseFloat(parts[0].trim());
                                const lon = parseFloat(parts[1].trim());
                                if (!isNaN(lat) && !isNaN(lon)) {
                                    enrichedPlaceData._tempLatitude = lat;
                                    enrichedPlaceData._tempLongitude = lon;
                                    this.log(`Coordonnées getCoordinates() pour "${placeValue}": ${lat}, ${lon}`);
                                }
                            }
                        }
                    }
                }
                
                // Méthode 2 : Accès via get('MAP') - API générique
                if (enrichedPlaceData._tempLatitude === null && typeof placeRecord.get === 'function') {
                    const mapSelection = placeRecord.get('MAP');
                    if (mapSelection && mapSelection.length > 0) {
                        const mapRecords = mapSelection.arraySelect();
                        if (mapRecords && mapRecords.length > 0) {
                            const mapRecord = mapRecords[0];
                            
                            // Extraire LATI et LONG via get()
                            const latiSelection = mapRecord.get('LATI');
                            const longSelection = mapRecord.get('LONG');
                            
                            if (latiSelection && latiSelection.length > 0 && 
                                longSelection && longSelection.length > 0) {
                                
                                const latValue = latiSelection.value()[0];
                                const lonValue = longSelection.value()[0];
                                
                                if (latValue && lonValue) {
                                    const lat = parseFloat(latValue);
                                    const lon = parseFloat(lonValue);
                                    
                                    if (!isNaN(lat) && !isNaN(lon)) {
                                        enrichedPlaceData._tempLatitude = lat;
                                        enrichedPlaceData._tempLongitude = lon;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // En cas d'erreur, on retourne quand même le lieu sans coordonnées
            this.log(`Impossible d'extraire coordonnées pour "${placeValue}": ${error.message}`);
        }
        
        // IMPORTANT : Retourner l'objet complet TEMPORAIREMENT avec subdivision
        // CacheBuilder devra extraire les coordonnées et ne stocker que la valeur + subdivision
        return enrichedPlaceData;
    }

    /**
     * Extrait l'âge d'un événement
     * @param {Object} ageSelection - Sélection read-gedcom de l'âge
     * @returns {string|null} Âge ou null
     */
    extractAge(ageSelection) {
        if (ageSelection.length === 0) return null;
        return ageSelection.value()[0] || null;
    }

    /**
     * Extrait la cause d'un événement (principalement pour décès)
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {string|null} Cause ou null
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
     * Extrait le type personnalisé d'un événement EVEN
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {string|null} Type personnalisé ou null
     */
    extractCustomEventType(eventSelection) {
        // Extraire le TYPE d'un événement EVEN custom
        try {
            const typeSelection = eventSelection.get('TYPE');
            if (typeSelection && typeSelection.length > 0) {
                const typeValue = typeSelection.value()[0];
                return typeValue || null;
            }
        } catch (error) {
            this.log(`Erreur extraction TYPE événement custom: ${error.message}`);
        }
        return null;
    }

    /**
     * Extrait les notes d'un événement ou attribut
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des notes
     */
    extractEventNotes(eventSelection) {
        const notes = [];
        
        try {
            // Méthode 1: Utiliser getNote() si disponible
            if (typeof eventSelection.getNote === 'function') {
                const noteSelection = eventSelection.getNote();
                
                if (noteSelection.length > 0) {
                    noteSelection.arraySelect().forEach((note, index) => {
                        const noteValue = note.value()[0];
                        
                        if (noteValue && noteValue.startsWith('@')) {
                            // Référence vers une note externe
                            notes.push({ type: 'reference', pointer: noteValue });
                        } else {
                            // Note inline - utiliser extractNoteText pour gérer CONT/CONC
                            const fullText = this.extractNoteText(note);
                            if (fullText) {
                                notes.push({ type: 'embedded', text: fullText });
                            }
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
     * Extrait les sources d'un événement ou attribut
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des sources
     */
    extractEventSources(eventSelection) {
        const sources = [];
        
        try {
            // Utiliser get('SOUR') au lieu de getSource() qui n'existe pas toujours
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
     * Extrait les médias d'un événement ou attribut
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des médias
     */
    extractEventMultimedia(eventSelection) {
        const multimedia = [];
        
        try {
            // Médias liés via référence (@M1@) - méthode alternative
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
            
            // Médias embarqués directement dans l'événement
            const embeddedMedia = eventSelection.get('OBJE');
            if (embeddedMedia && embeddedMedia.length > 0) {
                embeddedMedia.arraySelect().forEach(media => {
                    const mediaData = {
                        type: 'embedded',
                        file: null,
                        format: null,
                        title: null
                    };
                    
                    // FILE
                    const fileSelection = media.get('FILE');
                    if (fileSelection && fileSelection.length > 0) {
                        mediaData.file = fileSelection.value()[0];
                    }
                    
                    // FORM
                    const formSelection = media.get('FORM');
                    if (formSelection && formSelection.length > 0) {
                        mediaData.format = formSelection.value()[0];
                    }
                    
                    // TITL
                    const titleSelection = media.get('TITL');
                    if (titleSelection && titleSelection.length > 0) {
                        mediaData.title = titleSelection.value()[0];
                    }
                    
                    multimedia.push(mediaData);
                });
            }
            
        } catch (error) {
            this.log(`Erreur extraction médias événement: ${error.message}`);
        }
        
        return multimedia;
    }

    /**
     * Reconstruit le texte complet d'une note GEDCOM inline
     * Gère correctement les tags GEDCOM :
     *  - CONC = concaténation (même ligne)
     *  - CONT = continuation (nouvelle ligne)
     * @param {Object} noteNode - Nœud de note read-gedcom
     * @returns {string|null} Texte complet de la note
     */
    extractNoteText(noteNode) {
        try {
            // 1) valeur de la ligne NOTE (ou NOTE record) elle-même
            const head = (typeof noteNode.value === 'function' && noteNode.value()[0]) || '';
            const parts = [head];

            // 2) enfants (CONT/CONC) à assembler manuellement
            const children = (typeof noteNode.get === 'function') ? noteNode.get(null) : null;
            if (children && children.length > 0 && typeof children.arraySelect === 'function') {
                children.arraySelect().forEach(child => {
                    const tag = child.tag && child.tag()[0];
                    const v = (child.value && child.value()[0]) || '';
                    if (!tag) return;
                    if (tag === 'CONT') parts.push('\n' + v);
                    else if (tag === 'CONC') parts.push(v);
                });
            }

            const text = parts.join('');
            return text && text.trim().length ? text : null;
        } catch (error) {
            this.log(`Erreur reconstruction NOTE: ${error.message}`);
            return null;
        }
    }

    /**
     * Fusionne intelligemment les mariages avec le même conjoint
     * Règle: fusion sauf si >10 ans d'écart ou divorce entre temps
     * @param {Array} marriages - Liste des mariages avec le même conjoint
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des mariages fusionnés ou séparés
     */
    fuseMarriagesWithSameSpouse(marriages, individualSelection) {
        // Trier les mariages par date
        marriages.sort((a, b) => {
            const dateA = this.parseGedcomDate(a.date);
            const dateB = this.parseGedcomDate(b.date);
            return dateA - dateB;
        });
        
        // Vérifier s'il y a un divorce avec ce conjoint
        const spouseId = marriages[0].spouseId;
        const hasDivorce = this.hasDivorceWithSpouse(individualSelection, spouseId);
        
        // Calculer l'écart entre le premier et dernier mariage
        const firstDate = this.parseGedcomDate(marriages[0].date);
        const lastDate = this.parseGedcomDate(marriages[marriages.length - 1].date);
        const yearsDiff = (lastDate - firstDate) / (365 * 24 * 60 * 60 * 1000);
        
        // Si plus de 10 ans d'écart OU divorce, garder séparés
        if (yearsDiff > 10 || hasDivorce) {
            return marriages;
        }
        
        // Sinon, fusionner en un seul mariage avec cérémonies multiples
        const fusedMarriage = {
            type: 'marriage',
            date: marriages[0].date,  // Date de la première cérémonie
            place: marriages[0].fullPlace || marriages[0].place,
            spouseId: spouseId,
            ceremonies: marriages.map((m, index) => ({
                // Utiliser le ceremonyType extrait ou marriageType
                type: m.ceremonyType || 
                      (m.marriageType ? 
                       (m.marriageType.toLowerCase().includes('religious') ? 'religious' : 'civil') :
                       (index === 0 ? 'civil' : 'religious')), // Fallback: assume civil first
                date: m.date,
                place: m.fullPlace || m.place, // Préserver le lieu complet
                // Préserver la subdivision (Synagogue, Ecole, etc.)
                subdivision: m.subdivision || null,
                // Préserver notes et sources si disponibles
                notes: m.notes || null,
                sources: m.sources || null
            }))
        };
        
        // Conserver les notes et sources du premier mariage au niveau principal
        if (marriages[0].notes) {
            fusedMarriage.notes = marriages[0].notes;
            fusedMarriage.noteIds = marriages[0].noteIds;
        }
        if (marriages[0].sources) {
            fusedMarriage.sources = marriages[0].sources;
        }
        
        return [fusedMarriage];
    }

    /**
     * Parse une date GEDCOM en Date JavaScript
     * @param {string} dateStr - Date au format GEDCOM
     * @returns {Date} Date JavaScript
     */
    parseGedcomDate(dateStr) {
        if (!dateStr) return new Date(0);
        
        // Format: "2 NOV 1956" ou "1956" ou "NOV 1956"
        const months = {
            'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
            'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
        };
        
        const parts = dateStr.split(' ');
        let year = 1900, month = 0, day = 1;
        
        if (parts.length === 3) {
            // "2 NOV 1956"
            day = parseInt(parts[0]) || 1;
            month = months[parts[1]] || 0;
            year = parseInt(parts[2]) || 1900;
        } else if (parts.length === 2) {
            // "NOV 1956"
            month = months[parts[0]] || 0;
            year = parseInt(parts[1]) || 1900;
        } else if (parts.length === 1) {
            // "1956"
            year = parseInt(parts[0]) || 1900;
        }
        
        return new Date(year, month, day);
    }

    /**
     * Vérifie s'il y a un divorce avec un conjoint spécifique
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @param {string} spouseId - ID du conjoint
     * @returns {boolean} True si divorce trouvé
     */
    hasDivorceWithSpouse(individualSelection, spouseId) {
        // Parcourir les familles pour chercher un divorce
        const families = individualSelection.getFamilyAsSpouse().arraySelect();
        for (const family of families) {
            // Vérifier si cette famille a le bon conjoint
            const husb = family.getHusband().length > 0 ? family.getHusband().value()[0] : null;
            const wife = family.getWife().length > 0 ? family.getWife().value()[0] : null;
            const individualPointer = individualSelection.pointer()[0];
            const otherSpouse = (husb === individualPointer) ? wife : husb;
            
            if (otherSpouse === spouseId) {
                // Vérifier s'il y a un divorce dans cette famille
                const divorceEvents = family.getEventDivorce().arraySelect();
                if (divorceEvents.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Log si mode verbose
     * @param {string} message - Message à logger
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[EventExtractor] ${message}`);
        }
    }
}