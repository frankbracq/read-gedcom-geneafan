/**
 * SourceExtractor - Extraction des sources GEDCOM
 * 
 * Ce module gère l'extraction de tous les éléments de sources :
 * - Enregistrements de sources (SOUR records)
 * - Dépôts/repositories (REPO records)
 * - Sources d'événements et de notes
 * - Données de publication et d'auteur
 * - Références croisées
 */

export class SourceExtractor {
    constructor(options = {}) {
        this.options = {
            extractSources: true,
            extractRepositories: true,
            extractNotes: true,
            verbose: false,
            ...options
        };
    }

    /**
     * Extrait toutes les sources (SOUR records) du GEDCOM
     * @param {Object} rootSelection - Sélection racine read-gedcom
     * @returns {Promise<Array>} Liste des sources extraites
     */
    async extractSources(rootSelection) {
        const sources = [];
        
        try {
            const sourceRecords = rootSelection.getSourceRecord().arraySelect();
            this.log(`Extraction de ${sourceRecords.length} enregistrements SOURCE...`);
            
            for (let i = 0; i < sourceRecords.length; i++) {
                const sourceRecord = sourceRecords[i];
                const sourceData = await this.extractSingleSource(sourceRecord);
                if (sourceData) {
                    sources.push(sourceData);
                }
            }
            
        } catch (error) {
            this.log(`Erreur extraction sources: ${error.message}`);
        }
        
        return sources;
    }

    /**
     * Extrait tous les dépôts/repositories (REPO records) du GEDCOM
     * @param {Object} rootSelection - Sélection racine read-gedcom
     * @returns {Promise<Array>} Liste des dépôts extraits
     */
    async extractRepositories(rootSelection) {
        const repositories = [];
        
        try {
            const repoRecords = rootSelection.getRepositoryRecord().arraySelect();
            this.log(`Extraction de ${repoRecords.length} enregistrements REPOSITORY...`);
            
            for (let i = 0; i < repoRecords.length; i++) {
                const repoRecord = repoRecords[i];
                const repoData = await this.extractSingleRepository(repoRecord);
                if (repoData) {
                    repositories.push(repoData);
                }
            }
            
        } catch (error) {
            this.log(`Erreur extraction dépôts: ${error.message}`);
        }
        
        return repositories;
    }

    /**
     * Extrait un enregistrement SOURCE complet
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {Promise<Object>} Données de la source extraites
     */
    async extractSingleSource(sourceRecord) {
        try {
            const pointer = sourceRecord.pointer()[0];
            if (!pointer) return null;
            
            this.log(`Extraction source ${pointer}...`);
            
            const sourceData = {
                pointer,
                
                // Informations de base
                title: this.extractSourceTitle(sourceRecord),
                author: this.extractSourceAuthor(sourceRecord),
                publication: this.extractSourcePublication(sourceRecord),
                text: this.extractSourceText(sourceRecord),
                
                // Références
                repositories: this.extractSourceRepositories(sourceRecord),
                notes: this.options.extractNotes ? this.extractSourceNotes(sourceRecord) : [],
                multimedia: this.extractSourceMultimedia(sourceRecord),
                
                // Métadonnées
                abbreviation: this.extractSourceAbbreviation(sourceRecord),
                callNumber: this.extractSourceCallNumber(sourceRecord),
                quality: this.extractSourceQuality(sourceRecord),
                changeDate: this.extractChangeDate(sourceRecord),
                
                // Type et catégorie
                type: this.extractSourceType(sourceRecord),
                category: this.categorizeSource(sourceRecord)
            };
            
            this.log(`✅ Source ${pointer}: ${sourceData.title || 'Sans titre'}`);
            return sourceData;
            
        } catch (error) {
            this.log(`Erreur extraction source individuelle: ${error.message}`);
            return null;
        }
    }

    /**
     * Extrait un enregistrement REPOSITORY complet
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {Promise<Object>} Données du dépôt extraites
     */
    async extractSingleRepository(repoRecord) {
        try {
            const pointer = repoRecord.pointer()[0];
            if (!pointer) return null;
            
            this.log(`Extraction dépôt ${pointer}...`);
            
            const repoData = {
                pointer,
                
                // Informations de base
                name: this.extractRepositoryName(repoRecord),
                address: this.extractRepositoryAddress(repoRecord),
                
                // Contact
                phone: this.extractRepositoryPhone(repoRecord),
                email: this.extractRepositoryEmail(repoRecord),
                website: this.extractRepositoryWebsite(repoRecord),
                
                // Métadonnées
                notes: this.options.extractNotes ? this.extractRepositoryNotes(repoRecord) : [],
                changeDate: this.extractChangeDate(repoRecord),
                
                // Type d'institution
                type: this.extractRepositoryType(repoRecord)
            };
            
            this.log(`✅ Dépôt ${pointer}: ${repoData.name || 'Sans nom'}`);
            return repoData;
            
        } catch (error) {
            this.log(`Erreur extraction dépôt individuel: ${error.message}`);
            return null;
        }
    }

    /**
     * Extrait les sources d'un événement ou attribut
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des sources de l'événement
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
                        quality: null,
                        text: null,
                        date: null
                    };
                    
                    // Page de référence
                    const pageSelection = source.get('PAGE');
                    if (pageSelection && pageSelection.length > 0) {
                        sourceData.page = pageSelection.value()[0];
                    }
                    
                    // Qualité (QUAY)
                    const qualitySelection = source.get('QUAY');
                    if (qualitySelection && qualitySelection.length > 0) {
                        sourceData.quality = parseInt(qualitySelection.value()[0]);
                    }
                    
                    // Texte de citation
                    const textSelection = source.get('TEXT');
                    if (textSelection && textSelection.length > 0) {
                        sourceData.text = textSelection.value()[0];
                    }
                    
                    // Date de la source
                    const dateSelection = source.get('DATE');
                    if (dateSelection && dateSelection.length > 0) {
                        sourceData.date = dateSelection.value()[0];
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
     * Extrait le titre d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string|null} Titre de la source
     */
    extractSourceTitle(sourceRecord) {
        try {
            const titleSelection = sourceRecord.get('TITL');
            if (titleSelection && titleSelection.length > 0) {
                return titleSelection.value()[0];
            }
        } catch (error) {
            this.log(`Erreur extraction titre source: ${error.message}`);
        }
        return null;
    }

    /**
     * Extrait l'auteur d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string|null} Auteur de la source
     */
    extractSourceAuthor(sourceRecord) {
        try {
            const authorSelection = sourceRecord.get('AUTH');
            if (authorSelection && authorSelection.length > 0) {
                return authorSelection.value()[0];
            }
        } catch (error) {
            // Pas d'auteur spécifié
        }
        return null;
    }

    /**
     * Extrait les informations de publication d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {Object|null} Informations de publication
     */
    extractSourcePublication(sourceRecord) {
        try {
            const publSelection = sourceRecord.get('PUBL');
            if (publSelection && publSelection.length > 0) {
                const publication = {
                    text: publSelection.value()[0],
                    date: null,
                    place: null
                };
                
                // Date de publication
                const dateSelection = publSelection.get('DATE');
                if (dateSelection && dateSelection.length > 0) {
                    publication.date = dateSelection.value()[0];
                }
                
                // Lieu de publication
                const placeSelection = publSelection.get('PLAC');
                if (placeSelection && placeSelection.length > 0) {
                    publication.place = placeSelection.value()[0];
                }
                
                return publication;
            }
        } catch (error) {
            // Pas d'informations de publication
        }
        return null;
    }

    /**
     * Extrait le texte d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string|null} Texte de la source
     */
    extractSourceText(sourceRecord) {
        try {
            const textSelection = sourceRecord.get('TEXT');
            if (textSelection && textSelection.length > 0) {
                return textSelection.value()[0];
            }
        } catch (error) {
            // Pas de texte source
        }
        return null;
    }

    /**
     * Extrait les dépôts associés à une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {Array} Liste des dépôts
     */
    extractSourceRepositories(sourceRecord) {
        const repositories = [];
        
        try {
            const repoSelection = sourceRecord.get('REPO');
            if (repoSelection && repoSelection.length > 0) {
                repoSelection.arraySelect().forEach(repo => {
                    const repoData = {
                        pointer: repo.value()[0],
                        callNumber: null,
                        mediaType: null
                    };
                    
                    // Numéro d'appel
                    const callSelection = repo.get('CALN');
                    if (callSelection && callSelection.length > 0) {
                        repoData.callNumber = callSelection.value()[0];
                        
                        // Type de média
                        const mediaSelection = callSelection.get('MEDI');
                        if (mediaSelection && mediaSelection.length > 0) {
                            repoData.mediaType = mediaSelection.value()[0];
                        }
                    }
                    
                    repositories.push(repoData);
                });
            }
        } catch (error) {
            this.log(`Erreur extraction dépôts source: ${error.message}`);
        }
        
        return repositories;
    }

    /**
     * Extrait l'abréviation d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string|null} Abréviation de la source
     */
    extractSourceAbbreviation(sourceRecord) {
        try {
            const abbrSelection = sourceRecord.get('ABBR');
            if (abbrSelection && abbrSelection.length > 0) {
                return abbrSelection.value()[0];
            }
        } catch (error) {
            // Pas d'abréviation
        }
        return null;
    }

    /**
     * Extrait le numéro d'appel d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string|null} Numéro d'appel
     */
    extractSourceCallNumber(sourceRecord) {
        try {
            const callSelection = sourceRecord.get('CALN');
            if (callSelection && callSelection.length > 0) {
                return callSelection.value()[0];
            }
        } catch (error) {
            // Pas de numéro d'appel
        }
        return null;
    }

    /**
     * Extrait la qualité d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {number|null} Qualité (0-3)
     */
    extractSourceQuality(sourceRecord) {
        try {
            const qualitySelection = sourceRecord.get('QUAY');
            if (qualitySelection && qualitySelection.length > 0) {
                return parseInt(qualitySelection.value()[0]);
            }
        } catch (error) {
            // Pas de qualité spécifiée
        }
        return null;
    }

    /**
     * Extrait le type d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string|null} Type de source
     */
    extractSourceType(sourceRecord) {
        try {
            const typeSelection = sourceRecord.get('TYPE');
            if (typeSelection && typeSelection.length > 0) {
                return typeSelection.value()[0];
            }
        } catch (error) {
            // Pas de type spécifié
        }
        return null;
    }

    /**
     * Catégorise une source selon son contenu
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {string} Catégorie de la source
     */
    categorizeSource(sourceRecord) {
        const title = this.extractSourceTitle(sourceRecord) || '';
        const author = this.extractSourceAuthor(sourceRecord) || '';
        const combined = (title + ' ' + author).toLowerCase();
        
        // Catégories basées sur les mots-clés
        if (combined.includes('census') || combined.includes('recensement')) {
            return 'census';
        } else if (combined.includes('birth') || combined.includes('naissance')) {
            return 'birth-record';
        } else if (combined.includes('death') || combined.includes('décès')) {
            return 'death-record';
        } else if (combined.includes('marriage') || combined.includes('mariage')) {
            return 'marriage-record';
        } else if (combined.includes('church') || combined.includes('parish') || combined.includes('église')) {
            return 'church-record';
        } else if (combined.includes('military') || combined.includes('militaire')) {
            return 'military-record';
        } else if (combined.includes('newspaper') || combined.includes('journal')) {
            return 'newspaper';
        } else if (combined.includes('book') || combined.includes('livre')) {
            return 'book';
        } else if (combined.includes('photo') || combined.includes('image')) {
            return 'photograph';
        } else if (combined.includes('will') || combined.includes('testament')) {
            return 'will';
        } else if (combined.includes('land') || combined.includes('property') || combined.includes('propriété')) {
            return 'land-record';
        } else {
            return 'other';
        }
    }

    /**
     * Extrait le nom d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {string|null} Nom du dépôt
     */
    extractRepositoryName(repoRecord) {
        try {
            const nameSelection = repoRecord.get('NAME');
            if (nameSelection && nameSelection.length > 0) {
                return nameSelection.value()[0];
            }
        } catch (error) {
            this.log(`Erreur extraction nom dépôt: ${error.message}`);
        }
        return null;
    }

    /**
     * Extrait l'adresse d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {Object|null} Adresse du dépôt
     */
    extractRepositoryAddress(repoRecord) {
        try {
            const addrSelection = repoRecord.get('ADDR');
            if (addrSelection && addrSelection.length > 0) {
                const address = {
                    full: addrSelection.value()[0] || '',
                    city: null,
                    state: null,
                    country: null,
                    postalCode: null
                };
                
                // Détails d'adresse
                const citySelection = addrSelection.get('CITY');
                if (citySelection && citySelection.length > 0) {
                    address.city = citySelection.value()[0];
                }
                
                const stateSelection = addrSelection.get('STAE');
                if (stateSelection && stateSelection.length > 0) {
                    address.state = stateSelection.value()[0];
                }
                
                const countrySelection = addrSelection.get('CTRY');
                if (countrySelection && countrySelection.length > 0) {
                    address.country = countrySelection.value()[0];
                }
                
                const postalSelection = addrSelection.get('POST');
                if (postalSelection && postalSelection.length > 0) {
                    address.postalCode = postalSelection.value()[0];
                }
                
                return address;
            }
        } catch (error) {
            // Pas d'adresse disponible
        }
        return null;
    }

    /**
     * Extrait le téléphone d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {string|null} Téléphone
     */
    extractRepositoryPhone(repoRecord) {
        try {
            const phoneSelection = repoRecord.get('PHON');
            if (phoneSelection && phoneSelection.length > 0) {
                return phoneSelection.value()[0];
            }
        } catch (error) {
            // Pas de téléphone
        }
        return null;
    }

    /**
     * Extrait l'email d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {string|null} Email
     */
    extractRepositoryEmail(repoRecord) {
        try {
            const emailSelection = repoRecord.get('EMAIL');
            if (emailSelection && emailSelection.length > 0) {
                return emailSelection.value()[0];
            }
        } catch (error) {
            // Pas d'email
        }
        return null;
    }

    /**
     * Extrait le site web d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {string|null} Site web
     */
    extractRepositoryWebsite(repoRecord) {
        try {
            const wwwSelection = repoRecord.get('WWW');
            if (wwwSelection && wwwSelection.length > 0) {
                return wwwSelection.value()[0];
            }
        } catch (error) {
            // Pas de site web
        }
        return null;
    }

    /**
     * Extrait le type d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {string} Type de dépôt
     */
    extractRepositoryType(repoRecord) {
        const name = this.extractRepositoryName(repoRecord) || '';
        const nameLower = name.toLowerCase();
        
        // Déterminer le type selon le nom
        if (nameLower.includes('archive') || nameLower.includes('archief')) {
            return 'archives';
        } else if (nameLower.includes('library') || nameLower.includes('bibliothèque')) {
            return 'library';
        } else if (nameLower.includes('church') || nameLower.includes('église') || nameLower.includes('parish')) {
            return 'church';
        } else if (nameLower.includes('cemetery') || nameLower.includes('cimetière')) {
            return 'cemetery';
        } else if (nameLower.includes('museum') || nameLower.includes('musée')) {
            return 'museum';
        } else if (nameLower.includes('government') || nameLower.includes('gouvernement') || nameLower.includes('mairie')) {
            return 'government';
        } else if (nameLower.includes('university') || nameLower.includes('université') || nameLower.includes('college')) {
            return 'university';
        } else {
            return 'other';
        }
    }

    /**
     * Extrait les notes d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {Array} Liste des notes
     */
    extractSourceNotes(sourceRecord) {
        const notes = [];
        
        try {
            const noteSelection = sourceRecord.get('NOTE');
            if (noteSelection && noteSelection.length > 0) {
                noteSelection.arraySelect().forEach(note => {
                    const noteValue = note.value()[0];
                    if (noteValue) {
                        if (noteValue.startsWith('@')) {
                            notes.push({
                                type: 'reference',
                                pointer: noteValue
                            });
                        } else {
                            notes.push({
                                type: 'embedded',
                                text: noteValue
                            });
                        }
                    }
                });
            }
        } catch (error) {
            this.log(`Erreur extraction notes source: ${error.message}`);
        }
        
        return notes;
    }

    /**
     * Extrait les notes d'un dépôt
     * @param {Object} repoRecord - Enregistrement dépôt read-gedcom
     * @returns {Array} Liste des notes
     */
    extractRepositoryNotes(repoRecord) {
        const notes = [];
        
        try {
            const noteSelection = repoRecord.get('NOTE');
            if (noteSelection && noteSelection.length > 0) {
                noteSelection.arraySelect().forEach(note => {
                    const noteValue = note.value()[0];
                    if (noteValue) {
                        if (noteValue.startsWith('@')) {
                            notes.push({
                                type: 'reference',
                                pointer: noteValue
                            });
                        } else {
                            notes.push({
                                type: 'embedded',
                                text: noteValue
                            });
                        }
                    }
                });
            }
        } catch (error) {
            this.log(`Erreur extraction notes dépôt: ${error.message}`);
        }
        
        return notes;
    }

    /**
     * Extrait les médias d'une source
     * @param {Object} sourceRecord - Enregistrement source read-gedcom
     * @returns {Array} Liste des médias
     */
    extractSourceMultimedia(sourceRecord) {
        const multimedia = [];
        
        try {
            const mediaSelection = sourceRecord.get('OBJE');
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
            this.log(`Erreur extraction médias source: ${error.message}`);
        }
        
        return multimedia;
    }

    /**
     * Extrait la date de modification
     * @param {Object} record - Enregistrement read-gedcom
     * @returns {string|null} Date de modification
     */
    extractChangeDate(record) {
        try {
            const changeSelection = record.get('CHAN');
            if (changeSelection && changeSelection.length > 0) {
                const dateSelection = changeSelection.get('DATE');
                if (dateSelection && dateSelection.length > 0) {
                    return dateSelection.value()[0];
                }
            }
        } catch (error) {
            // Pas de date de modification
        }
        return null;
    }

    /**
     * Statistiques sur les sources extraites
     * @param {Array} sources - Liste des sources
     * @param {Array} repositories - Liste des dépôts
     * @returns {Object} Statistiques détaillées
     */
    getSourceStatistics(sources, repositories = []) {
        const stats = {
            sources: {
                total: sources.length,
                withAuthor: 0,
                withRepository: 0,
                withNotes: 0,
                byCategory: {}
            },
            repositories: {
                total: repositories.length,
                byType: {}
            }
        };
        
        sources.forEach(source => {
            if (source.author) stats.sources.withAuthor++;
            if (source.repositories && source.repositories.length > 0) stats.sources.withRepository++;
            if (source.notes && source.notes.length > 0) stats.sources.withNotes++;
            
            if (!stats.sources.byCategory[source.category]) {
                stats.sources.byCategory[source.category] = 0;
            }
            stats.sources.byCategory[source.category]++;
        });
        
        repositories.forEach(repo => {
            if (!stats.repositories.byType[repo.type]) {
                stats.repositories.byType[repo.type] = 0;
            }
            stats.repositories.byType[repo.type]++;
        });
        
        return stats;
    }

    /**
     * Log si mode verbose
     * @param {string} message - Message à logger
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[SourceExtractor] ${message}`);
        }
    }
}