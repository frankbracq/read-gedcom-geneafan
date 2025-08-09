/**
 * DataExtractor - Orchestrateur principal pour l'extraction GEDCOM
 * Coordonne les extracteurs spécialisés pour produire des données enrichies
 */

import { IndividualExtractor } from './extractors/IndividualExtractor.js';
import { EventExtractor } from './extractors/EventExtractor.js';
import { FamilyExtractor } from './extractors/FamilyExtractor.js';
import { MediaExtractor } from './extractors/MediaExtractor.js';
import { NoteExtractor } from './extractors/NoteExtractor.js';
import { AttributeExtractor } from './extractors/AttributeExtractor.js';
import { SourceExtractor } from './extractors/SourceExtractor.js';
import { setPlacFormat } from '../utils/geoUtils.js';

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
        
        // Initialiser les extracteurs spécialisés
        this.individualExtractor = new IndividualExtractor(this.options);
        this.eventExtractor = new EventExtractor(this.options);
        this.familyExtractor = new FamilyExtractor(this.options);
        this.mediaExtractor = new MediaExtractor(this.options);
        this.noteExtractor = new NoteExtractor(this.options);
        this.attributeExtractor = new AttributeExtractor(this.options);
        this.sourceExtractor = new SourceExtractor(this.options);
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
            result.sources = await this.sourceExtractor.extractSources(rootSelection);
        }
        
        if (this.options.extractRepositories) {
            this._log('Extraction des dépôts...');
            result.repositories = await this.sourceExtractor.extractRepositories(rootSelection);
        }
        
        if (this.options.extractMedia) {
            this._log('Extraction des médias...');
            result.media = await this.mediaExtractor.extractMedia(rootSelection);
        }
        
        if (this.options.extractNotes) {
            this._log('Extraction des notes...');
            result.notes = await this.noteExtractor.extractNotes(rootSelection);
        }
        
        this._log('Extraction des familles...');
        result.families = await this.familyExtractor.extractFamilies(rootSelection);
        
        this._log('Extraction des métadonnées...');
        result.metadata = this._extractMetadata(rootSelection);
        
        return result;
    }
    
    /**
     * Extraction optimisée des individus avec relations directes
     * @private
     */
    async _extractIndividualsOptimized(rootSelection) {
        const individuals = [];
        const individualRecords = rootSelection.getIndividualRecord().arraySelect();
        
        for (const individualSelection of individualRecords) {
            try {
                const individual = await this._extractSingleIndividualOptimized(individualSelection, rootSelection);
                individuals.push(individual);
            } catch (error) {
                this._log(`Erreur extraction individu: ${error.message}`);
            }
        }
        
        this._log(`${individuals.length} individus extraits avec relations directes`);
        return individuals;
    }
    
    /**
     * Extraction optimisée d'un individu avec toutes ses données
     * @private
     */
    async _extractSingleIndividualOptimized(individualSelection, rootSelection) {
        const pointer = individualSelection.pointer()[0];
        
        // Extraction des relations familiales
        const familyRelations = this.individualExtractor.extractDirectFamilyRelations(individualSelection, rootSelection);
        
        // Extraction des données de base
        const individual = {
            pointer,
            name: this.individualExtractor.extractName(individualSelection),
            sex: this.individualExtractor.extractSex(individualSelection),
            
            // Relations familiales directes au niveau racine pour CacheBuilder
            fatherId: familyRelations.fatherId,
            motherId: familyRelations.motherId,
            spouseIds: familyRelations.spouseIds,
            siblingIds: familyRelations.siblingIds,
            childrenIds: familyRelations.childrenIds,
            
            // Garder aussi l'objet complet pour compatibilité
            directFamilyRelations: familyRelations,
            
            // Événements vitaux et familiaux
            events: [],
            
            // Attributs et faits
            attributes: [],
            
            // Familles
            familyAsChild: this.familyExtractor.extractFamilyAsChild(individualSelection),
            familyAsSpouse: this.familyExtractor.extractFamilyAsSpouse(individualSelection),
            
            // Associations et multimédia
            associations: this.individualExtractor.extractAssociations(individualSelection),
            multimedia: this.options.extractMedia ? 
                this.mediaExtractor.extractIndividualMediaRefs(individualSelection) : [],
            
            // Notes
            notes: this.options.extractNotes ? 
                this.noteExtractor.extractIndividualNotes(individualSelection) : [],
            
            // Identifiants et métadonnées
            identifiers: this.individualExtractor.extractIdentifiers(individualSelection),
            addresses: this.individualExtractor.extractAddresses(individualSelection),
            changeDate: this.individualExtractor.extractChangeDate(individualSelection)
        };
        
        // Extraction des événements individuels
        const individualEvents = this.eventExtractor.extractAllEvents(individualSelection, pointer);
        
        // Extraction des attributs
        individual.attributes = this.attributeExtractor.extractAllAttributes(individualSelection);
        
        // Extraction des événements familiaux optimisés
        const familyEvents = this.eventExtractor.extractFamilyEventsOptimized(
            individualSelection, 
            familyRelations
        );
        
        // Combiner tous les événements
        individual.events = [...individualEvents, ...familyEvents];
        
        return individual;
    }
    
    /**
     * Extraction des métadonnées du fichier GEDCOM
     * @private
     */
    _extractMetadata(rootSelection) {
        const metadata = {};
        
        try {
            // Header information
            const header = rootSelection.getHeader();
            if (header && header.length > 0) {
                // Source system
                const source = header.get('SOUR');
                if (source && source.length > 0) {
                    metadata.sourceSystem = source.value()[0];
                    
                    const version = source.get('VERS');
                    if (version && version.length > 0) {
                        metadata.sourceVersion = version.value()[0];
                    }
                    
                    const name = source.get('NAME');
                    if (name && name.length > 0) {
                        metadata.sourceName = name.value()[0];
                    }
                }
                
                // GEDCOM version
                const gedcom = header.get('GEDC');
                if (gedcom && gedcom.length > 0) {
                    const version = gedcom.get('VERS');
                    if (version && version.length > 0) {
                        metadata.gedcomVersion = version.value()[0];
                    }
                }
                
                // Character encoding
                const charset = header.get('CHAR');
                if (charset && charset.length > 0) {
                    metadata.encoding = charset.value()[0];
                }
                
                // File date
                const date = header.get('DATE');
                if (date && date.length > 0) {
                    metadata.fileDate = date.value()[0];
                    
                    const time = date.get('TIME');
                    if (time && time.length > 0) {
                        metadata.fileTime = time.value()[0];
                    }
                }
                
                // Language
                const language = header.get('LANG');
                if (language && language.length > 0) {
                    metadata.language = language.value()[0];
                }
                
                // Place hierarchy
                const placeHierarchy = header.get('PLAC');
                if (placeHierarchy && placeHierarchy.length > 0) {
                    const form = placeHierarchy.get('FORM');
                    if (form && form.length > 0) {
                        metadata.placeHierarchy = form.value()[0];
                        // Configurer le format PLAC pour les extracteurs
                        setPlacFormat(metadata.placeHierarchy);
                        this._log(`Format PLAC configuré: ${metadata.placeHierarchy}`);
                    }
                }
                
                // Submitter
                const submitter = header.get('SUBM');
                if (submitter && submitter.length > 0) {
                    metadata.submitterId = submitter.value()[0];
                }
                
                // File name
                const file = header.get('FILE');
                if (file && file.length > 0) {
                    metadata.fileName = file.value()[0];
                }
                
                // Copyright
                const copyright = header.get('COPR');
                if (copyright && copyright.length > 0) {
                    metadata.copyright = copyright.value()[0];
                }
            }
            
            // Fallback : configurer format PLAC par défaut si non défini
            if (!metadata.placeHierarchy) {
                const defaultPlacFormat = 'Town, Area code, County, Region, Country, Subdivision';
                metadata.placeHierarchy = defaultPlacFormat;
                setPlacFormat(defaultPlacFormat);
                this._log(`Format PLAC par défaut configuré: ${defaultPlacFormat}`);
            }
            
            // Statistics
            metadata.statistics = {
                individuals: rootSelection.getIndividualRecord().length,
                families: rootSelection.getFamilyRecord().length,
                sources: rootSelection.getSourceRecord().length,
                repositories: rootSelection.getRepositoryRecord().length,
                notes: rootSelection.getNoteRecord().length,
                media: rootSelection.getMultimediaRecord().length
            };
            
        } catch (error) {
            this._log(`Erreur extraction métadonnées: ${error.message}`);
        }
        
        return metadata;
    }
    
    /**
     * Log un message si le mode verbose est activé
     * @private
     */
    _log(message) {
        if (this.options.verbose) {
            console.log(`[DataExtractor] ${message}`);
        }
    }
    
    /**
     * Méthodes de compatibilité pour l'API existante
     * Ces méthodes délèguent aux extracteurs spécialisés
     */
    
    // Délégation vers IndividualExtractor
    _extractName(individualSelection) {
        return this.individualExtractor.extractName(individualSelection);
    }
    
    _extractSex(individualSelection) {
        return this.individualExtractor.extractSex(individualSelection);
    }
    
    _extractPhoneticName(nameSelection) {
        return this.individualExtractor.extractPhoneticName(nameSelection);
    }
    
    _extractRomanizedName(nameSelection) {
        return this.individualExtractor.extractRomanizedName(nameSelection);
    }
    
    _extractDirectFamilyRelations(individualSelection, rootSelection) {
        return this.individualExtractor.extractDirectFamilyRelations(individualSelection, rootSelection);
    }
    
    _extractIdentifiers(individualSelection) {
        return this.individualExtractor.extractIdentifiers(individualSelection);
    }
    
    _extractAddresses(individualSelection) {
        return this.individualExtractor.extractAddresses(individualSelection);
    }
    
    _extractChangeDate(individualSelection) {
        return this.individualExtractor.extractChangeDate(individualSelection);
    }
    
    _extractAssociations(individualSelection) {
        return this.individualExtractor.extractAssociations(individualSelection);
    }
    
    // Délégation vers EventExtractor
    _extractAllEvents(individualSelection, pointer) {
        return this.eventExtractor.extractAllEvents(individualSelection, pointer);
    }
    
    _extractEventDetails(eventSelection, baseType) {
        return this.eventExtractor.extractEventDetails(eventSelection, baseType);
    }
    
    _extractDate(dateSelection) {
        return this.eventExtractor.extractDate(dateSelection);
    }
    
    _extractPlace(placeSelection) {
        return this.eventExtractor.extractPlace(placeSelection);
    }
    
    _extractAge(ageSelection) {
        return this.eventExtractor.extractAge(ageSelection);
    }
    
    _extractCause(eventSelection) {
        return this.eventExtractor.extractCause(eventSelection);
    }
    
    _extractCustomEventType(eventSelection) {
        return this.eventExtractor.extractCustomEventType(eventSelection);
    }
    
    _extractFamilyEventsOptimized(individualSelection, familyRelations) {
        return this.eventExtractor.extractFamilyEventsOptimized(individualSelection, familyRelations);
    }
    
    _extractEventNotes(eventSelection) {
        return this.eventExtractor.extractEventNotes(eventSelection);
    }
    
    _extractEventSources(eventSelection) {
        return this.eventExtractor.extractEventSources(eventSelection);
    }
    
    _extractEventMultimedia(eventSelection) {
        return this.eventExtractor.extractEventMultimedia(eventSelection);
    }
    
    // Délégation vers AttributeExtractor
    _extractAllAttributes(individualSelection) {
        return this.attributeExtractor.extractAllAttributes(individualSelection);
    }
    
    _extractAttributeDetails(attrSelection, type) {
        return this.attributeExtractor.extractAttributeDetails(attrSelection, type);
    }
    
    // Délégation vers FamilyExtractor
    _extractFamilies(rootSelection) {
        return this.familyExtractor.extractFamilies(rootSelection);
    }
    
    _extractSingleFamily(familySelection) {
        return this.familyExtractor.extractSingleFamily(familySelection);
    }
    
    _extractFamilyAsChild(individualSelection) {
        return this.familyExtractor.extractFamilyAsChild(individualSelection);
    }
    
    _extractFamilyAsSpouse(individualSelection) {
        return this.familyExtractor.extractFamilyAsSpouse(individualSelection);
    }
    
    _extractSpouseReference(spouseSelection) {
        return this.familyExtractor.extractSpouseReference(spouseSelection);
    }
    
    _extractChildrenReferences(childrenSelection) {
        return this.familyExtractor.extractChildrenReferences(childrenSelection);
    }
    
    _extractFamilyEvents(familySelection) {
        return this.familyExtractor.extractFamilyEvents(familySelection);
    }
    
    _extractPedigree(familySelection) {
        return this.familyExtractor.extractPedigree(familySelection);
    }
    
    _extractAdoptionDetails(familySelection) {
        return this.familyExtractor.extractAdoptionDetails(familySelection);
    }
    
    // Délégation vers MediaExtractor
    _extractMedia(rootSelection) {
        return this.mediaExtractor.extractMedia(rootSelection);
    }
    
    _extractSingleMedia(mediaRecord) {
        return this.mediaExtractor.extractSingleMedia(mediaRecord);
    }
    
    _extractMediaFormat(mediaRecord) {
        return this.mediaExtractor.extractMediaFormat(mediaRecord);
    }
    
    _extractIndividualMediaRefs(individualSelection) {
        return this.mediaExtractor.extractIndividualMediaRefs(individualSelection);
    }
    
    _extractMediaNotes(mediaRecord) {
        return this.mediaExtractor.extractMediaNotes(mediaRecord);
    }
    
    _extractMediaSources(mediaRecord) {
        return this.mediaExtractor.extractMediaSources(mediaRecord);
    }
    
    _extractMultimedia(individualSelection) {
        return this.mediaExtractor.extractIndividualMediaRefs(individualSelection);
    }
    
    // Délégation vers NoteExtractor
    _extractNotes(rootSelection) {
        return this.noteExtractor.extractNotes(rootSelection);
    }
    
    _extractSingleNote(noteRecord) {
        return this.noteExtractor.extractSingleNote(noteRecord);
    }
    
    _extractNoteText(noteNode) {
        return this.noteExtractor.extractNoteText(noteNode);
    }
    
    _extractIndividualNotes(individualSelection) {
        return this.noteExtractor.extractIndividualNotes(individualSelection);
    }
    
    _extractNoteSources(noteRecord) {
        return this.noteExtractor.extractNoteSources(noteRecord);
    }
    
    // Délégation vers SourceExtractor
    _extractSources(rootSelection) {
        return this.sourceExtractor.extractSources(rootSelection);
    }
    
    _extractRepositories(rootSelection) {
        return this.sourceExtractor.extractRepositories(rootSelection);
    }
}