/**
 * DataExtractor - Extrait toutes les données GEDCOM via l'API read-gedcom
 * Produit des données enrichies prêtes pour la compression GeneaFan
 */

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
            result.media = await this._extractMedia(rootSelection);
        }
        
        if (this.options.extractNotes) {
            this._log('Extraction des notes...');
            result.notes = await this._extractNotes(rootSelection);
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
    _extractMedia(rootSelection) { return []; }
    _extractNotes(rootSelection) { return []; }
    _extractMetadata(rootSelection) { return {}; }
    
    _extractPhoneticName(nameSelection) { return null; }
    _extractRomanizedName(nameSelection) { return null; }
    _extractDate(dateSelection) { 
        if (dateSelection.length === 0) return null;
        return dateSelection.value()[0] || null;
    }
    _extractPlace(placeSelection) { 
        if (placeSelection.length === 0) return null;
        return placeSelection.value()[0] || null;
    }
    _extractAge(ageSelection) { return null; }
    _extractCause(eventSelection) { return null; }
    _extractEventNotes(eventSelection) { return []; }
    _extractEventSources(eventSelection) { return []; }
    _extractEventMultimedia(eventSelection) { return []; }
    _extractCustomEventType(eventSelection) { return null; }
    _extractAttributeDetails(attrSelection, type) { return []; }
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