/**
 * AttributeExtractor - Extraction des attributs GEDCOM
 * 
 * Ce module gère l'extraction spécialisée des attributs individuels :
 * - Attributs standards (occupation, résidence, religion, etc.)
 * - Attributs personnalisés (FACT)
 * - Données associées (dates, lieux, notes, sources)
 * - Traitement des attributs comme événements
 */

export class AttributeExtractor {
    constructor(options = {}) {
        this.options = {
            extractNotes: true,
            extractSources: true,
            extractMedia: true,
            verbose: false,
            ...options
        };
    }

    /**
     * Extrait TOUS les attributs individuels (13 types standards + customs)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des attributs extraits
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
                sources: this.options.extractSources ? this.extractEventSources(attr) : [],
                multimedia: this.options.extractMedia ? this.extractEventMultimedia(attr) : []
            };
            
            // Données spécifiques selon le type
            if (type === 'fact') {
                attrData.factType = this.extractFactType(attr);
            }
            
            // Validation et nettoyage
            const cleanedAttr = this.cleanAttributeData(attrData);
            if (cleanedAttr) {
                attributes.push(cleanedAttr);
            }
        }
        
        return attributes;
    }

    /**
     * Extrait le type d'un attribut FACT personnalisé
     * @param {Object} attrSelection - Sélection read-gedcom de l'attribut
     * @returns {string|null} Type du fact personnalisé
     */
    extractFactType(attrSelection) {
        try {
            const typeSelection = attrSelection.get('TYPE');
            if (typeSelection && typeSelection.length > 0) {
                return typeSelection.value()[0];
            }
        } catch (error) {
            this.log(`Erreur extraction TYPE fact: ${error.message}`);
        }
        return null;
    }

    /**
     * Extrait les attributs d'une profession (OCCU)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des professions détaillées
     */
    extractOccupations(individualSelection) {
        const occupations = [];
        const occupationSelection = individualSelection.getAttributeOccupation();
        
        occupationSelection.arraySelect().forEach(occu => {
            const occupation = {
                type: 'occupation',
                value: occu.value()[0] || null,
                date: this.extractDate(occu.getDate()),
                place: this.extractPlace(occu.getPlace()),
                employer: this.extractEmployer(occu),
                industry: this.extractIndustry(occu),
                notes: this.options.extractNotes ? this.extractEventNotes(occu) : [],
                sources: this.options.extractSources ? this.extractEventSources(occu) : []
            };
            
            occupations.push(occupation);
        });
        
        return occupations;
    }

    /**
     * Extrait les attributs de résidence (RESI)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des résidences détaillées
     */
    extractResidences(individualSelection) {
        const residences = [];
        const residenceSelection = individualSelection.getAttributeResidence();
        
        residenceSelection.arraySelect().forEach(resi => {
            const residence = {
                type: 'residence',
                value: resi.value()[0] || null,
                date: this.extractDate(resi.getDate()),
                place: this.extractPlace(resi.getPlace()),
                address: this.extractAddress(resi),
                phone: this.extractPhone(resi),
                notes: this.options.extractNotes ? this.extractEventNotes(resi) : [],
                sources: this.options.extractSources ? this.extractEventSources(resi) : []
            };
            
            residences.push(residence);
        });
        
        return residences;
    }

    /**
     * Extrait les attributs d'éducation (EDUC)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des formations détaillées
     */
    extractEducation(individualSelection) {
        const education = [];
        const educationSelection = individualSelection.getAttributeScholasticAchievement();
        
        educationSelection.arraySelect().forEach(educ => {
            const educationData = {
                type: 'education',
                value: educ.value()[0] || null,
                date: this.extractDate(educ.getDate()),
                place: this.extractPlace(educ.getPlace()),
                institution: this.extractInstitution(educ),
                degree: this.extractDegree(educ),
                notes: this.options.extractNotes ? this.extractEventNotes(educ) : [],
                sources: this.options.extractSources ? this.extractEventSources(educ) : []
            };
            
            education.push(educationData);
        });
        
        return education;
    }

    /**
     * Extrait l'employeur d'une profession
     * @param {Object} occuSelection - Sélection read-gedcom de la profession
     * @returns {string|null} Nom de l'employeur
     */
    extractEmployer(occuSelection) {
        try {
            const employerSelection = occuSelection.get('EMPL');
            if (employerSelection && employerSelection.length > 0) {
                return employerSelection.value()[0];
            }
        } catch (error) {
            // Pas d'employeur spécifié
        }
        return null;
    }

    /**
     * Extrait l'industrie d'une profession
     * @param {Object} occuSelection - Sélection read-gedcom de la profession
     * @returns {string|null} Secteur d'activité
     */
    extractIndustry(occuSelection) {
        try {
            const industrySelection = occuSelection.get('INDU');
            if (industrySelection && industrySelection.length > 0) {
                return industrySelection.value()[0];
            }
        } catch (error) {
            // Pas d'industrie spécifiée
        }
        return null;
    }

    /**
     * Extrait l'adresse d'une résidence
     * @param {Object} resiSelection - Sélection read-gedcom de la résidence
     * @returns {Object|null} Adresse détaillée
     */
    extractAddress(resiSelection) {
        try {
            const addrSelection = resiSelection.get('ADDR');
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
     * Extrait le téléphone d'une résidence
     * @param {Object} resiSelection - Sélection read-gedcom de la résidence
     * @returns {string|null} Numéro de téléphone
     */
    extractPhone(resiSelection) {
        try {
            const phoneSelection = resiSelection.get('PHON');
            if (phoneSelection && phoneSelection.length > 0) {
                return phoneSelection.value()[0];
            }
        } catch (error) {
            // Pas de téléphone disponible
        }
        return null;
    }

    /**
     * Extrait l'institution d'une formation
     * @param {Object} educSelection - Sélection read-gedcom de la formation
     * @returns {string|null} Nom de l'institution
     */
    extractInstitution(educSelection) {
        try {
            const instSelection = educSelection.get('INST');
            if (instSelection && instSelection.length > 0) {
                return instSelection.value()[0];
            }
        } catch (error) {
            // Pas d'institution spécifiée
        }
        return null;
    }

    /**
     * Extrait le diplôme d'une formation
     * @param {Object} educSelection - Sélection read-gedcom de la formation
     * @returns {string|null} Diplôme obtenu
     */
    extractDegree(educSelection) {
        try {
            const degreeSelection = educSelection.get('DEGR');
            if (degreeSelection && degreeSelection.length > 0) {
                return degreeSelection.value()[0];
            }
        } catch (error) {
            // Pas de diplôme spécifié
        }
        return null;
    }

    /**
     * Nettoie et valide les données d'un attribut
     * @param {Object} attrData - Données brutes de l'attribut
     * @returns {Object|null} Données nettoyées ou null si invalide
     */
    cleanAttributeData(attrData) {
        // Valider que l'attribut a au moins une valeur ou une date
        if (!attrData.value && !attrData.date && !attrData.place) {
            return null;
        }
        
        // Nettoyer la valeur
        if (attrData.value) {
            attrData.value = attrData.value.trim();
            if (attrData.value.length === 0) {
                attrData.value = null;
            }
        }
        
        // Nettoyer le lieu
        if (attrData.place) {
            attrData.place = attrData.place.trim();
            if (attrData.place.length === 0) {
                attrData.place = null;
            }
        }
        
        return attrData;
    }

    // === MÉTHODES UTILITAIRES ===

    /**
     * Extrait la date d'un attribut
     * @param {Object} dateSelection - Sélection read-gedcom de la date
     * @returns {string|null} Date au format string
     */
    extractDate(dateSelection) {
        if (dateSelection.length === 0) return null;
        return dateSelection.value()[0] || null;
    }

    /**
     * Extrait le lieu d'un attribut
     * @param {Object} placeSelection - Sélection read-gedcom du lieu
     * @returns {string|null} Lieu
     */
    extractPlace(placeSelection) {
        if (placeSelection.length === 0) return null;
        return placeSelection.value()[0] || null;
    }

    /**
     * Extrait l'âge d'un attribut
     * @param {Object} ageSelection - Sélection read-gedcom de l'âge
     * @returns {string|null} Âge
     */
    extractAge(ageSelection) {
        if (ageSelection.length === 0) return null;
        return ageSelection.value()[0] || null;
    }

    /**
     * Extrait les notes d'un attribut
     * @param {Object} attrSelection - Sélection read-gedcom de l'attribut
     * @returns {Array} Liste des notes
     */
    extractEventNotes(attrSelection) {
        const notes = [];
        
        try {
            if (typeof attrSelection.getNote === 'function') {
                const noteSelection = attrSelection.getNote();
                
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
            this.log(`Erreur extraction notes attribut: ${error.message}`);
        }
        
        return notes;
    }

    /**
     * Extrait les sources d'un attribut
     * @param {Object} attrSelection - Sélection read-gedcom de l'attribut
     * @returns {Array} Liste des sources
     */
    extractEventSources(attrSelection) {
        const sources = [];
        
        try {
            const sourceSelection = attrSelection.get('SOUR');
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
            this.log(`Erreur extraction sources attribut: ${error.message}`);
        }
        
        return sources;
    }

    /**
     * Extrait les médias d'un attribut
     * @param {Object} attrSelection - Sélection read-gedcom de l'attribut
     * @returns {Array} Liste des médias
     */
    extractEventMultimedia(attrSelection) {
        const multimedia = [];
        
        try {
            const multimediaRefs = attrSelection.getMultimedia ? attrSelection.getMultimedia() : attrSelection.get('OBJE');
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
            this.log(`Erreur extraction médias attribut: ${error.message}`);
        }
        
        return multimedia;
    }

    /**
     * Statistiques sur les attributs extraits
     * @param {Array} attributes - Liste des attributs
     * @returns {Object} Statistiques détaillées
     */
    getAttributeStatistics(attributes) {
        const stats = {
            total: attributes.length,
            byType: {},
            withDates: 0,
            withPlaces: 0,
            withSources: 0,
            withNotes: 0
        };
        
        attributes.forEach(attr => {
            // Compter par type
            if (!stats.byType[attr.type]) {
                stats.byType[attr.type] = 0;
            }
            stats.byType[attr.type]++;
            
            // Compter les attributs avec données
            if (attr.date) stats.withDates++;
            if (attr.place) stats.withPlaces++;
            if (attr.sources && attr.sources.length > 0) stats.withSources++;
            if (attr.notes && attr.notes.length > 0) stats.withNotes++;
        });
        
        return stats;
    }

    /**
     * Log si mode verbose
     * @param {string} message - Message à logger
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[AttributeExtractor] ${message}`);
        }
    }
}