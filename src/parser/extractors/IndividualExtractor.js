/**
 * IndividualExtractor - Extraction des données individuelles
 */

export class IndividualExtractor {
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Extrait le nom complet avec variations
     */
    extractName(individualSelection) {
        const nameSelection = individualSelection.getName();
        if (nameSelection.length === 0) return { given: '', surname: '' };
        
        const nameParts = nameSelection.valueAsParts();
        if (nameParts.length === 0) return { given: '', surname: '' };
        
        const [given, surname, suffix] = nameParts[0] || ['', '', ''];
        
        return {
            given: given || '',
            surname: surname || '',
            suffix: suffix || '',
            full: nameSelection.value()[0] || ''
        };
    }

    /**
     * Extrait le sexe
     */
    extractSex(individualSelection) {
        const sexSelection = individualSelection.getSex();
        if (sexSelection.length === 0) return 'U';
        
        const sexValue = sexSelection.value()[0];
        return sexValue || 'U';
    }

    /**
     * Extrait le nom phonétique
     */
    extractPhoneticName(nameSelection) {
        try {
            const phoneticSelection = nameSelection.get('FONE');
            if (phoneticSelection && phoneticSelection.length > 0) {
                return phoneticSelection.value()[0];
            }
        } catch (e) {
            // Pas de nom phonétique
        }
        return null;
    }

    /**
     * Extrait le nom romanisé
     */
    extractRomanizedName(nameSelection) {
        try {
            const romanSelection = nameSelection.get('ROMN');
            if (romanSelection && romanSelection.length > 0) {
                return romanSelection.value()[0];
            }
        } catch (e) {
            // Pas de nom romanisé
        }
        return null;
    }

    /**
     * Extrait les identifiants (AFN, RIN, etc.)
     */
    extractIdentifiers(individualSelection) {
        const identifiers = {};
        
        try {
            // AFN (Ancestral File Number)
            const afn = individualSelection.get('AFN');
            if (afn && afn.length > 0) {
                identifiers.afn = afn.value()[0];
            }
            
            // RIN (Record Identification Number)
            const rin = individualSelection.get('RIN');
            if (rin && rin.length > 0) {
                identifiers.rin = rin.value()[0];
            }
            
            // RFN (Record File Number)
            const rfn = individualSelection.get('RFN');
            if (rfn && rfn.length > 0) {
                identifiers.rfn = rfn.value()[0];
            }
        } catch (e) {
            // Pas d'identifiants supplémentaires
        }
        
        return identifiers;
    }

    /**
     * Extrait les adresses
     */
    extractAddresses(individualSelection) {
        const addresses = [];
        
        try {
            const addrSelection = individualSelection.get('ADDR');
            if (addrSelection && addrSelection.length > 0) {
                addrSelection.arraySelect().forEach(addr => {
                    const address = {
                        value: addr.value()[0] || ''
                    };
                    
                    // Détails d'adresse
                    const city = addr.get('CITY');
                    if (city && city.length > 0) {
                        address.city = city.value()[0];
                    }
                    
                    const state = addr.get('STAE');
                    if (state && state.length > 0) {
                        address.state = state.value()[0];
                    }
                    
                    const country = addr.get('CTRY');
                    if (country && country.length > 0) {
                        address.country = country.value()[0];
                    }
                    
                    addresses.push(address);
                });
            }
        } catch (e) {
            // Pas d'adresses
        }
        
        return addresses;
    }

    /**
     * Extrait la date de modification
     */
    extractChangeDate(individualSelection) {
        try {
            const changeSelection = individualSelection.get('CHAN');
            if (changeSelection && changeSelection.length > 0) {
                const dateSelection = changeSelection.get('DATE');
                if (dateSelection && dateSelection.length > 0) {
                    return dateSelection.value()[0];
                }
            }
        } catch (e) {
            // Pas de date de modification
        }
        return null;
    }

    /**
     * Extrait les relations familiales directes
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @param {Object} rootSelection - Sélection racine pour résoudre les pointeurs de famille
     */
    extractDirectFamilyRelations(individualSelection, rootSelection) {
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
            // arraySelect() retourne les enregistrements FAM résolus directement
            const parentFamily = familiesAsChild[0];
            
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
            // arraySelect() retourne les enregistrements FAM résolus directement
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
     * Extrait les associations
     */
    extractAssociations(individualSelection) {
        const associations = [];
        
        try {
            const assoSelection = individualSelection.get('ASSO');
            if (assoSelection && assoSelection.length > 0) {
                assoSelection.arraySelect().forEach(asso => {
                    const association = {
                        individualId: asso.value()[0] || ''
                    };
                    
                    const relation = asso.get('RELA');
                    if (relation && relation.length > 0) {
                        association.relation = relation.value()[0];
                    }
                    
                    associations.push(association);
                });
            }
        } catch (e) {
            // Pas d'associations
        }
        
        return associations;
    }
}