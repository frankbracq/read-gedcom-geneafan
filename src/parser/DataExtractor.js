/**
 * DataExtractor - Extrait toutes les données GEDCOM via l'API read-gedcom
 * Produit des données enrichies prêtes pour la compression GeneaFan
 */

import { extractGeolocation } from '../utils/geoUtils.js';

export class DataExtractor {
    constructor(options = {}) {
        this.options = {
            extractMedia: true,
            extractNotes: true,
            extractSources: true,
            extractRepositories: true,
            verbose: false,
            ...options
        };
    }
    
    /**
     * Extrait toutes les données du SelectionGedcom
     * @param {SelectionGedcom} rootSelection - Sélection racine read-gedcom
     * @returns {Promise<Object>} Données enrichies
     */
    async extract(rootSelection) {
        const result = {
            individuals: [],
            families: [],
            sources: [],
            repositories: [],
            media: [],
            notes: [],
            submitters: [],
            metadata: {}
        };
        
        this._log('Extraction optimisée des individus avec relations directes...');
        result.individuals = await this._extractIndividualsOptimized(rootSelection);
        
        if (this.options.extractSources) {
            this._log('Extraction des sources...');
            result.sources = await this._extractSources(rootSelection);
        }
        
        if (this.options.extractRepositories) {
            this._log('Extraction des dépôts...');
            result.repositories = await this._extractRepositories(rootSelection);
        }
        
        if (this.options.extractMedia) {
            this._log('Extraction des médias...');
            result.media = this._extractMedia(rootSelection);
            this._log(`✅ Médias extraits: ${result.media.length}`);
        }
        
        if (this.options.extractNotes) {
            this._log('Extraction des notes...');
            result.notes = this._extractNotes(rootSelection);
            this._log(`✅ Notes extraites: ${result.notes.length}`);
        }
        
        this._log('Extraction des métadonnées...');
        result.metadata = this._extractMetadata(rootSelection);
        
        this._log(`✅ Extraction completed: ${result.individuals.length} individus`);
        
        // Debug: Stocker les données brutes pour analyse
        result.metadata.debugInfo = {
            rawIndividuals: result.individuals.slice(0, 3), // 3 premiers pour debug
            extractionMethod: 'optimized-direct-apis'
        };
        
        return result;
    }
    
    /**
     * Extraction OPTIMISÉE des individus avec relations directes via read-gedcom APIs
     * Élimine le besoin de FamilyIndices intermédiaires
     * @private
     */
    async _extractIndividualsOptimized(rootSelection) {
        const individuals = [];
        const individualRecords = rootSelection.getIndividualRecord().arraySelect();
        
        this._log(`Processing ${individualRecords.length} individuals with direct family APIs...`);
        
        for (let i = 0; i < individualRecords.length; i++) {
            const individual = individualRecords[i];
            const extractedData = await this._extractSingleIndividualOptimized(individual);
            if (extractedData) {
                individuals.push(extractedData);
            }
        }
        
        return individuals;
    }
    
    /**
     * Extraction ULTRA-OPTIMISÉE d'un individu avec format GeneaFan direct
     * Exploite read-gedcom APIs pour relations directes + événements enrichis
     * @private
     */
    async _extractSingleIndividualOptimized(individualSelection) {
        const pointer = individualSelection.pointer()[0];
        if (!pointer) return null;
        
        // === DONNÉES DE BASE ===
        const name = this._extractName(individualSelection);
        const sex = this._extractSex(individualSelection);
        
        // === ÉVÉNEMENTS DE BASE ===
        const events = this._extractAllEvents(individualSelection);
        
        // === RELATIONS DIRECTES VIA READ-GEDCOM APIs ===
        const familyRelations = this._extractDirectFamilyRelations(individualSelection);
        
        // === ÉVÉNEMENTS FAMILIAUX ENRICHIS ===
        const familyEvents = this._extractFamilyEventsOptimized(individualSelection, familyRelations);
        
        // Fusionner tous les événements
        const allEvents = [...events, ...familyEvents];
        
        // Extraire les références aux notes et médias de l'individu
        const noteRefs = this._extractIndividualNoteRefs(individualSelection);
        const mediaRefs = this._extractIndividualMediaRefs(individualSelection);
        
        // === FORMAT GENEAFAN OPTIMISÉ ===
        const result = {
            pointer,
            
            // Données de base
            name: name.full || '',
            surname: name.surname || '',
            sex,
            
            // Relations directes (format GeneaFan)
            fatherId: familyRelations.fatherId,
            motherId: familyRelations.motherId,
            siblingIds: familyRelations.siblingIds,
            spouseIds: familyRelations.spouseIds,
            childrenIds: familyRelations.childrenIds,
            
            // Événements complets
            events: allEvents,
            
            // Références aux notes et médias
            noteRefs,   // Array des pointeurs vers les notes (@N123@)
            mediaRefs,  // Array des pointeurs vers les médias (@M123@)
            
            // 🚀 ARCHITECTURE SOLIDE : Attacher l'objet read-gedcom pour APIs natives
            readGedcomIndividual: individualSelection,
            
            // Métadonnées
            metadata: {
                extractedVia: 'read-gedcom-direct-apis',
                quality: 0 // Calculé plus tard
            }
        };
        
        return result;
    }
    
    /**
     * Extrait le nom complet (via API native)
     * @private
     */
    _extractName(individualSelection) {
        const nameSelection = individualSelection.getName();
        if (nameSelection.length === 0) return { given: '', surname: '' };
        
        const nameParts = nameSelection.valueAsParts();
        if (nameParts.length === 0) return { given: '', surname: '' };
        
        const [given, surname, suffix] = nameParts[0] || ['', '', ''];
        
        return {
            given: given || '',
            surname: surname || '',
            suffix: suffix || '',
            full: nameSelection.value()[0] || '',
            
            // Variations si disponibles
            phonetic: this._extractPhoneticName(nameSelection),
            romanized: this._extractRomanizedName(nameSelection)
        };
    }
    
    /**
     * Extrait le sexe (via API native)
     * @private
     */
    _extractSex(individualSelection) {
        const sexSelection = individualSelection.getSex();
        if (sexSelection.length === 0) return 'U';
        
        const sexValue = sexSelection.value()[0];
        return sexValue || 'U';
    }
    
    /**
     * Extrait TOUS les événements (21 types + customs)
     * @private
     */
    _extractAllEvents(individualSelection) {
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
            events.push(...this._extractEventDetails(eventSelection, type));
        });
        
        // Événements génériques/customs via getEventOther
        const otherEvents = individualSelection.getEventOther();
        events.push(...this._extractEventDetails(otherEvents, 'custom'));
        
        // 🚀 NOUVEAUX ATTRIBUTS COMME ÉVÉNEMENTS 
        // Extraire les attributs et les traiter comme des événements
        const attributes = this._extractAllAttributes(individualSelection);
        events.push(...attributes);
        
        return events.filter(event => event !== null);
    }
    
    /**
     * Extrait les détails d'un événement
     * @private
     */
    _extractEventDetails(eventSelection, baseType) {
        const events = [];
        const eventArray = eventSelection.arraySelect();
        
        for (let i = 0; i < eventArray.length; i++) {
            const event = eventArray[i];
            const eventData = {
                type: baseType,
                date: this._extractDate(event.getDate()),
                place: this._extractPlace(event.getPlace()),
                age: typeof event.getAge === 'function' ? this._extractAge(event.getAge()) : null,
                cause: this._extractCause(event),
                notes: this.options.extractNotes ? this._extractEventNotes(event) : [],
                sources: this.options.extractSources ? this._extractEventSources(event) : [],
                multimedia: this.options.extractMedia ? this._extractEventMultimedia(event) : []
            };
            
            // Données spécifiques selon le type
            if (baseType === 'custom') {
                eventData.customType = this._extractCustomEventType(event);
            }
            
            events.push(eventData);
        }
        
        return events;
    }
    
    /**
     * Extrait TOUS les attributs (13 types + customs)
     * @private
     */
    _extractAllAttributes(individualSelection) {
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
            attributes.push(...this._extractAttributeDetails(attrSelection, type));
        });
        
        // Attributs génériques via getFact
        const factAttributes = individualSelection.getAttributeFact();
        attributes.push(...this._extractAttributeDetails(factAttributes, 'fact'));
        
        return attributes.filter(attr => attr !== null);
    }
    
    /**
     * Extrait les relations familiales comme enfant
     * @private
     */
    _extractFamilyAsChild(individualSelection) {
        const families = [];
        const familyArray = individualSelection.getFamilyAsChild().arraySelect();
        
        for (let i = 0; i < familyArray.length; i++) {
            const family = familyArray[i];
            families.push({
                pointer: family.pointer()[0],
                pedigree: this._extractPedigree(family),
                adoptionDetails: this._extractAdoptionDetails(family)
            });
        }
        
        return families;
    }
    
    /**
     * Log si mode verbose
     * @private
     */
    _log(message) {
        if (this.options.verbose) {
            console.log(`[DataExtractor] ${message}`);
        }
    }
    
    // === PLACEHOLDER METHODS (à implémenter) ===
    
    /**
     * Extrait toutes les familles avec leurs relations et événements
     * @private
     */
    async _extractFamilies(rootSelection) {
        const families = [];
        const familyRecords = rootSelection.getFamilyRecord().arraySelect();
        
        for (let i = 0; i < familyRecords.length; i++) {
            const family = familyRecords[i];
            const extractedFamily = await this._extractSingleFamily(family);
            if (extractedFamily) {
                families.push(extractedFamily);
            }
        }
        
        return families;
    }
    
    /**
     * Extrait une famille complète avec toutes ses données
     * @private
     */
    async _extractSingleFamily(familySelection) {
        const pointer = familySelection.pointer()[0];
        if (!pointer) return null;
        
        const result = {
            pointer,
            
            // === ÉPOUX/ÉPOUSE ===
            husband: this._extractSpouseReference(familySelection.getHusband()),
            wife: this._extractSpouseReference(familySelection.getWife()),
            
            // === ENFANTS ===
            children: this._extractChildrenReferences(familySelection.getChild()),
            
            // === ÉVÉNEMENTS FAMILIAUX ===
            events: this._extractFamilyEvents(familySelection),
            
            // === NOTES & SOURCES ===
            notes: this.options.extractNotes ? this._extractFamilyNotes(familySelection) : [],
            sources: this.options.extractSources ? this._extractFamilySources(familySelection) : [],
            multimedia: this.options.extractMedia ? this._extractFamilyMultimedia(familySelection) : [],
            
            // === MÉTADONNÉES ===
            metadata: {
                changeDate: this._extractChangeDate(familySelection),
                quality: 0 // Calculé plus tard
            }
        };
        
        return result;
    }
    
    /**
     * Extrait référence époux/épouse
     * @private
     */
    _extractSpouseReference(spouseSelection) {
        if (spouseSelection.length === 0) return null;
        return spouseSelection.value()[0] || null;
    }
    
    /**
     * Extrait références des enfants
     * @private
     */
    _extractChildrenReferences(childrenSelection) {
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
     * @private
     */
    _extractFamilyEvents(familySelection) {
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
                events.push(...this._extractEventDetails(eventSelection, type));
            }
        });
        
        return events.filter(event => event !== null);
    }
    _extractSources(rootSelection) { return []; }
    _extractRepositories(rootSelection) { return []; }
    
    /**
     * Extrait tous les médias (OBJE records) du GEDCOM
     * @private
     */
    _extractMedia(rootSelection) {
        const mediaList = [];
        
        try {
            const multimediaRecords = rootSelection.getMultimediaRecord().arraySelect();
            // Log de synthèse uniquement
            this._log(`Extraction de ${multimediaRecords.length} enregistrements MULTIMEDIA...`);
            
            for (let i = 0; i < multimediaRecords.length; i++) {
                const mediaRecord = multimediaRecords[i];
                const mediaData = this._extractSingleMedia(mediaRecord);
                if (mediaData) {
                    mediaList.push(mediaData);
                }
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction médias: ${error.message}`);
        }
        
        return mediaList;
    }
    
    /**
     * Extrait un enregistrement MULTIMEDIA complet
     * @private
     */
    _extractSingleMedia(mediaRecord) {
        try {
            const pointer = mediaRecord.pointer()[0];
            if (!pointer) return null;
            
            // Extraction silencieuse (log désactivé pour éviter la pollution)
            // this._log(`   Extraction média ${pointer}...`);
            
            // Extraire FILE via getFileReference() ou get('FILE')
            let file = null;
            const fileSelection = mediaRecord.getFileReference();
            if (fileSelection.length > 0) {
                file = fileSelection.value()[0];
            } else {
                // Méthode alternative via get
                const fileViaGet = mediaRecord.get('FILE');
                if (fileViaGet && fileViaGet.length > 0) {
                    file = fileViaGet.value()[0];
                }
            }
            
            // Extraire TITL via get('TITL')
            let title = null;
            const titleViaGet = mediaRecord.get('TITL');
            if (titleViaGet && titleViaGet.length > 0) {
                title = titleViaGet.value()[0];
            }
            
            // Extraire FORM
            const format = this._extractMediaFormat(mediaRecord);
            
            const mediaData = {
                pointer,
                file,
                title,
                format,
                notes: this._extractMediaNotes(mediaRecord),
                sources: this._extractMediaSources(mediaRecord),
                
                // Données additionnelles
                hasBlob: this._hasMediaBlob(mediaRecord),
                type: this._getMediaType(format, file)
            };
            
            // Log désactivé pour éviter la pollution console
            // this._log(`   ✅ Média ${pointer}: ${title || 'Sans titre'} (${format || 'format inconnu'})`);
            return mediaData;
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction média individuel: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Extrait le format d'un média
     * @private
     */
    _extractMediaFormat(mediaRecord) {
        try {
            // Essayer différentes méthodes pour obtenir le format
            const formatMethods = ['getFormat', 'getForm'];
            
            for (const method of formatMethods) {
                if (typeof mediaRecord[method] === 'function') {
                    const formatSelection = mediaRecord[method]();
                    if (formatSelection.length > 0) {
                        return formatSelection.value()[0];
                    }
                }
            }
            
            // Méthode générique via get('FORM')
            const formSelection = mediaRecord.get('FORM');
            if (formSelection && formSelection.length > 0) {
                return formSelection.value()[0];
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction format média: ${error.message}`);
        }
        
        return null;
    }
    
    /**
     * Extrait toutes les notes (NOTE records) du GEDCOM
     * @private
     */
    _extractNotes(rootSelection) {
        const notesList = [];
        
        try {
            const noteRecords = rootSelection.getNoteRecord().arraySelect();
            // Log de synthèse uniquement
            this._log(`Extraction de ${noteRecords.length} enregistrements NOTE...`);
            
            for (let i = 0; i < noteRecords.length; i++) {
                const noteRecord = noteRecords[i];
                const noteData = this._extractSingleNote(noteRecord);
                if (noteData) {
                    notesList.push(noteData);
                }
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes: ${error.message}`);
        }
        
        return notesList;
    }
    
    /**
     * Extrait un enregistrement NOTE complet
     * @private
     */
    _extractSingleNote(noteRecord) {
        try {
            const pointer = noteRecord.pointer()[0];
            if (!pointer) return null;
            
            // Extraction silencieuse (log désactivé pour éviter la pollution)
            // this._log(`   Extraction note ${pointer}...`);
            
            // Extraire le texte de la note (avec CONT/CONC)
            const noteText = this._extractNoteText(noteRecord);
            
            if (!noteText) {
                this._log(`   ⚠️ Note ${pointer} sans texte, ignorée`);
                return null;
            }
            
            const noteData = {
                pointer,
                text: noteText,
                sources: this._extractNoteSources(noteRecord)
            };
            
            // Log désactivé pour éviter la pollution console
            // this._log(`   ✅ Note ${pointer}: ${noteText.substring(0, 50)}...`);
            return noteData;
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction note individuelle: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Extrait le texte complet d'une note (avec CONT/CONC)
     * @private
     */
    _extractNoteText(noteRecord) {
        try {
            // Méthode 1 : via value() qui gère automatiquement CONT/CONC
            const textValue = noteRecord.value();
            if (textValue && textValue.length > 0 && textValue[0]) {
                return textValue[0];
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction texte note: ${error.message}`);
        }
        
        return null;
    }
    
    /**
     * Extrait les notes d'un enregistrement MULTIMEDIA
     * @private
     */
    _extractMediaNotes(mediaRecord) {
        const notes = [];
        
        try {
            // Utiliser get('NOTE') au lieu de getNote()
            const noteSelection = mediaRecord.get('NOTE');
            if (noteSelection && noteSelection.length > 0) {
                noteSelection.arraySelect().forEach(note => {
                    const notePointer = note.value()[0];
                    if (notePointer) {
                        notes.push({
                            type: 'reference',
                            pointer: notePointer
                        });
                    }
                });
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes média: ${error.message}`);
        }
        
        return notes;
    }
    
    /**
     * Extrait les sources d'un enregistrement MULTIMEDIA
     * @private
     */
    _extractMediaSources(mediaRecord) {
        const sources = [];
        
        try {
            // Utiliser get('SOUR') au lieu de getSource()
            const sourceSelection = mediaRecord.get('SOUR');
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
            this._log(`⚠️ Erreur extraction sources média: ${error.message}`);
        }
        
        return sources;
    }
    
    /**
     * Extrait les sources d'un enregistrement NOTE
     * @private
     */
    _extractNoteSources(noteRecord) {
        const sources = [];
        
        try {
            // Utiliser get('SOUR') au lieu de getSource()
            const sourceSelection = noteRecord.get('SOUR');
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
            this._log(`⚠️ Erreur extraction sources note: ${error.message}`);
        }
        
        return sources;
    }
    
    /**
     * Vérifie si un média a des données BLOB embarquées
     * @private
     */
    _hasMediaBlob(mediaRecord) {
        try {
            const blobSelection = mediaRecord.get('BLOB');
            return blobSelection && blobSelection.length > 0;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Détermine le type de média à partir du format et du fichier
     * @private
     */
    _getMediaType(format, file) {
        if (!format && !file) return 'unknown';
        
        const formatLower = (format || '').toLowerCase();
        const fileExt = file ? file.split('.').pop()?.toLowerCase() : '';
        
        // Types d'images
        if (['jpeg', 'jpg', 'png', 'gif', 'bmp', 'tiff', 'pict', 'webp'].includes(formatLower) ||
            ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp'].includes(fileExt)) {
            return 'image';
        }
        
        // Types audio
        if (['wav', 'mp3', 'aiff', 'au', 'ogg', 'm4a'].includes(formatLower) ||
            ['wav', 'mp3', 'aif', 'aiff', 'au', 'ogg', 'm4a'].includes(fileExt)) {
            return 'audio';
        }
        
        // Types vidéo
        if (['mov', 'mp4', 'mpeg', 'avi', 'wmv', 'flv'].includes(formatLower) ||
            ['mov', 'mp4', 'mpg', 'mpeg', 'avi', 'wmv', 'flv'].includes(fileExt)) {
            return 'video';
        }
        
        // Documents
        if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(formatLower) ||
            ['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(fileExt)) {
            return 'document';
        }
        
        // URL
        if (file && (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('ftp://'))) {
            return 'url';
        }
        
        return 'other';
    }
    
    /**
     * Extrait les références aux notes d'un individu
     * @private
     */
    _extractIndividualNoteRefs(individualSelection) {
        const noteRefs = [];
        
        try {
            // Notes au niveau individu (références @N123@)
            const noteSelection = individualSelection.getNote();
            if (noteSelection.length > 0) {
                noteSelection.arraySelect().forEach(note => {
                    const notePointer = note.value()[0];
                    if (notePointer && notePointer.startsWith('@')) {
                        noteRefs.push(notePointer);
                    }
                });
            }
            
            // Notes embarquées (NOTE directes)
            const embeddedNotes = individualSelection.get('NOTE');
            if (embeddedNotes && embeddedNotes.length > 0) {
                embeddedNotes.arraySelect().forEach(note => {
                    const text = note.value()[0];
                    if (text && text.startsWith('@')) {
                        // C'est une référence
                        noteRefs.push(text);
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction références notes individu: ${error.message}`);
        }
        
        return noteRefs;
    }
    
    /**
     * Extrait les références aux médias d'un individu
     * @private
     */
    _extractIndividualMediaRefs(individualSelection) {
        const mediaRefs = [];
        
        try {
            // Médias via getMultimedia()
            if (typeof individualSelection.getMultimedia === 'function') {
                const multimediaSelection = individualSelection.getMultimedia();
                if (multimediaSelection.length > 0) {
                    multimediaSelection.arraySelect().forEach(media => {
                        const mediaPointer = media.value()[0];
                        if (mediaPointer && mediaPointer.startsWith('@')) {
                            mediaRefs.push(mediaPointer);
                        }
                    });
                }
            }
            
            // Médias via get('OBJE')
            const objeSelection = individualSelection.get('OBJE');
            if (objeSelection && objeSelection.length > 0) {
                objeSelection.arraySelect().forEach(media => {
                    const mediaPointer = media.value()[0];
                    if (mediaPointer && mediaPointer.startsWith('@')) {
                        mediaRefs.push(mediaPointer);
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction références médias individu: ${error.message}`);
        }
        
        return mediaRefs;
    }
    
    _extractMetadata(rootSelection) { return {}; }
    
    _extractPhoneticName(nameSelection) { return null; }
    _extractRomanizedName(nameSelection) { return null; }
    _extractDate(dateSelection) { 
        if (dateSelection.length === 0) return null;
        return dateSelection.value()[0] || null;
    }
    _extractPlace(placeSelection) { 
        if (placeSelection.length === 0) return null;
        
        const placeValue = placeSelection.value()[0] || null;
        if (!placeValue) return null;
        
        // Structure temporaire pour transporter les coordonnées
        // Note: Cet objet sera utilisé uniquement pendant l'extraction
        // Les coordonnées ne seront PAS stockées dans le cache individuel final
        const placeData = {
            value: placeValue,
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
                                    placeData._tempLatitude = lat;
                                    placeData._tempLongitude = lon;
                                    this._log(`   📍 Coordonnées getCoordinates() pour "${placeValue}": ${lat}, ${lon}`);
                                }
                            }
                        }
                    }
                }
                
                // Méthode 2 : Accès via get('MAP') - API générique
                if (placeData._tempLatitude === null && typeof placeRecord.get === 'function') {
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
                                        placeData._tempLatitude = lat;
                                        placeData._tempLongitude = lon;
                                        // Log removed: coordinate extraction working perfectly
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            // En cas d'erreur, on retourne quand même le lieu sans coordonnées
            this._log(`   ⚠️ Impossible d'extraire coordonnées pour "${placeValue}": ${error.message}`);
        }
        
        // IMPORTANT : Retourner l'objet complet TEMPORAIREMENT
        // CacheBuilder devra extraire les coordonnées et ne stocker que la valeur
        return placeData;
    }
    _extractAge(ageSelection) { return null; }
    _extractCause(eventSelection) { return null; }
    /**
     * Extrait les notes d'un événement ou attribut
     * @private
     */
    _extractEventNotes(eventSelection) {
        const notes = [];
        
        try {
            // Notes liées via référence (@N1@)
            const noteRefs = eventSelection.getNote();
            if (noteRefs.length > 0) {
                noteRefs.arraySelect().forEach(noteRef => {
                    const notePointer = noteRef.value()[0];
                    if (notePointer) {
                        notes.push({
                            type: 'reference',
                            pointer: notePointer
                        });
                    }
                });
            }
            
            // Notes embarquées directement dans l'événement
            const embeddedNotes = eventSelection.get('NOTE');
            if (embeddedNotes && embeddedNotes.length > 0) {
                embeddedNotes.arraySelect().forEach(note => {
                    const text = note.value()[0];
                    if (text && !text.startsWith('@')) { // Pas une référence
                        notes.push({
                            type: 'embedded',
                            text: text
                        });
                    }
                });
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes événement: ${error.message}`);
        }
        
        return notes;
    }
    
    /**
     * Extrait les sources d'un événement ou attribut
     * @private
     */
    _extractEventSources(eventSelection) {
        const sources = [];
        
        try {
            // Utiliser get('SOUR') au lieu de getSource() qui n'existe pas
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
            this._log(`⚠️ Erreur extraction sources événement: ${error.message}`);
        }
        
        return sources;
    }
    
    /**
     * Extrait les médias d'un événement ou attribut
     * @private
     */
    _extractEventMultimedia(eventSelection) {
        const multimedia = [];
        
        try {
            // Médias liés via référence (@M1@) - méthode alternative
            const multimediaRefs = eventSelection.getMultimedia ? eventSelection.getMultimedia() : eventSelection.get('OBJE');
            if (multimediaRefs.length > 0) {
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
            this._log(`⚠️ Erreur extraction médias événement: ${error.message}`);
        }
        
        return multimedia;
    }
    _extractCustomEventType(eventSelection) { return null; }
    /**
     * Extrait les détails d'un attribut (OCCU, RESI, etc.)
     * @private
     */
    _extractAttributeDetails(attrSelection, type) {
        const attributes = [];
        const attrArray = attrSelection.arraySelect();
        
        for (let i = 0; i < attrArray.length; i++) {
            const attr = attrArray[i];
            const attrData = {
                type: type,
                value: attr.value()[0] || null,  // Valeur de l'attribut (ex: "Forgeron" pour occupation)
                date: this._extractDate(attr.getDate()),
                place: this._extractPlace(attr.getPlace()),
                age: typeof attr.getAge === 'function' ? this._extractAge(attr.getAge()) : null,
                notes: this.options.extractNotes ? this._extractEventNotes(attr) : [],
                sources: this.options.extractSources ? this._extractEventSources(attr) : []
            };
            
            attributes.push(attrData);
        }
        
        return attributes;
    }
    _extractFamilyAsSpouse(individualSelection) { return []; }
    _extractAssociations(individualSelection) { return []; }
    _extractMultimedia(individualSelection) { return []; }
    _extractIdentifiers(individualSelection) { return {}; }
    _extractAddresses(individualSelection) { return []; }
    _extractChangeDate(individualSelection) { return null; }
    _extractPedigree(familySelection) { return null; }
    /**
     * OPTIMISATION MAJEURE: Extraction directe des relations familiales
     * Exploite les APIs read-gedcom sans indices intermédiaires
     * @private
     */
    _extractDirectFamilyRelations(individualSelection) {
        const result = {
            fatherId: null,
            motherId: null,
            siblingIds: [],
            spouseIds: [],
            childrenIds: []
        };
        
        // === FAMILLE PARENTALE (où l'individu est enfant) ===
        const familiesAsChild = individualSelection.getFamilyAsChild().arraySelect();
        if (familiesAsChild.length > 0) {
            const parentFamily = familiesAsChild[0]; // Première famille parentale
            
            const father = parentFamily.getHusband();
            if (father.length > 0) {
                result.fatherId = father.value()[0];
            }
            
            const mother = parentFamily.getWife();
            if (mother.length > 0) {
                result.motherId = mother.value()[0];
            }
            
            // Frères et sœurs = autres enfants de la même famille
            const allChildren = parentFamily.getChild().arraySelect();
            result.siblingIds = allChildren
                .map(child => child.value()[0])
                .filter(childId => childId !== individualSelection.pointer()[0]);
        }
        
        // === FAMILLES CONJUGALES (où l'individu est époux/épouse) ===
        const familiesAsSpouse = individualSelection.getFamilyAsSpouse().arraySelect();
        familiesAsSpouse.forEach(spouseFamily => {
            const husband = spouseFamily.getHusband();
            const wife = spouseFamily.getWife();
            
            // Identifier l'époux/épouse (l'autre personne de cette famille)
            const husbandId = husband.length > 0 ? husband.value()[0] : null;
            const wifeId = wife.length > 0 ? wife.value()[0] : null;
            const currentId = individualSelection.pointer()[0];
            
            const spouseId = currentId === husbandId ? wifeId : husbandId;
            if (spouseId && !result.spouseIds.includes(spouseId)) {
                result.spouseIds.push(spouseId);
            }
            
            // Enfants de cette famille
            const children = spouseFamily.getChild().arraySelect();
            children.forEach(child => {
                const childId = child.value()[0];
                if (!result.childrenIds.includes(childId)) {
                    result.childrenIds.push(childId);
                }
            });
        });
        
        return result;
    }
    
    /**
     * Extraction optimisée des événements familiaux avec métadonnées
     * @private  
     */
    _extractFamilyEventsOptimized(individualSelection, familyRelations) {
        const events = [];
        
        // === ÉVÉNEMENTS DE MARIAGE ===
        const familiesAsSpouse = individualSelection.getFamilyAsSpouse().arraySelect();
        familiesAsSpouse.forEach((spouseFamily, index) => {
            const marriageEvents = spouseFamily.getEventMarriage().arraySelect();
            marriageEvents.forEach(marriageEvent => {
                const marriageDate = marriageEvent.getDate();
                const marriagePlace = marriageEvent.getPlace();
                
                if (marriageDate.length > 0) {
                    const spouseId = familyRelations.spouseIds[index] || null;
                    events.push({
                        type: 'marriage',
                        date: marriageDate.value()[0],
                        place: marriagePlace.length > 0 ? marriagePlace.value()[0] : null,
                        spouseId: spouseId
                    });
                }
            });
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
    
    _extractAdoptionDetails(familySelection) { return null; }
}