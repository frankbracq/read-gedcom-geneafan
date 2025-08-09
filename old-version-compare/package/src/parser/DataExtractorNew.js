/**
 * DataExtractor - Extrait toutes les données GEDCOM via l'API read-gedcom
 * Produit des données enrichies prêtes pour la compression GeneaFan
 */

/**
 * [MOD 2025-08-08] Améliorations:
 *  - Mariages (FAM/MARR) conservés + extraction via _extractFamilies() désormais appelée dans extract()
 *  - NOTES: reconstruction explicite CONC/CONT via _extractNoteText(); _extractEventNotes() gère refs + inline
 *  - PLAC FORM: lecture HEAD>PLAC>FORM + mapping structuré via _applyPlacForm(), exposé dans metadata.placForm
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
        // [MOD 2025-08-08] Lecture du format PLAC défini dans le header (HEAD > PLAC > FORM)
        try {
            this._placForm = this._readPlacFormFromHead(rootSelection);
            if (this._placForm) {
                result.metadata.placForm = this._placForm;
                this._log(`ℹ️ PLAC FORM: ${this._placForm}`);
            }
        } catch (e) {
            this._log(`⚠️ Erreur lecture PLAC FORM: ${e.message}`);
        }

        
        this._log('Extraction optimisée des individus avec relations directes...');
        result.individuals = await this._extractIndividualsOptimized(rootSelection);
        
        // Extraction des familles (époux/épouse, enfants, événements familiaux dont MARR)
        this._log('Extraction des familles...');
        result.families = await this._extractFamilies(rootSelection);
        this._log(`✅ Familles extraites: ${result.families.length}`);
        
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
        
        // Log de synthèse uniquement
        this._log(`Extraction de ${individualRecords.length} enregistrements INDI...`);
        
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
        const notesData = this._extractIndividualNotes(individualSelection);
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
            
            // Événements (perso + familiaux)
            events: allEvents,
            
            // Notes et médias
            noteRefs: notesData.refs,
            inlineNotes: notesData.inline,
            mediaRefs,
            
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
     * Extrait le nom complet (via API natives read-gedcom)
     * @private
     */
    _extractName(individualSelection) {
        const nameSelection = individualSelection.getName();
        if (!nameSelection || nameSelection.length === 0) {
            return { given: '', surname: '', prefix: '', suffix: '', full: '' };
        }
        
        const givenSelection = nameSelection.getGivenName();
        const surnameSelection = nameSelection.getSurname();
        const prefixSelection = nameSelection.get('NPFX');
        const suffixSelection = nameSelection.get('NSFX');
        
        const given = givenSelection && givenSelection.length > 0 ? (givenSelection.value()[0] || '') : '';
        const surname = surnameSelection && surnameSelection.length > 0 ? (surnameSelection.value()[0] || '') : '';
        const prefix = prefixSelection && prefixSelection.length > 0 ? (prefixSelection.value()[0] || '') : '';
        const suffix = suffixSelection && suffixSelection.length > 0 ? (suffixSelection.value()[0] || '') : '';
        
        return {
            given,
            surname,
            prefix: prefix || '',
            suffix: suffix || '',
            full: nameSelection.value()[0] || '',
            phonetic: this._extractPhoneticName(nameSelection),
            romanized: this._extractRomanizedName(nameSelection)
        };
    }
    
    /**
     * Extrait le genre
     * @private
     */
    _extractSex(individualSelection) {
        const sexSelection = individualSelection.getSex();
        if (!sexSelection || sexSelection.length === 0) return null;
        const v = sexSelection.value();
        return v && v.length > 0 ? v[0] : null;
    }
    
    /**
     * Événements + Attributs
     * @private
     */
    _extractAllEvents(individualSelection) {
        const events = [];
        
        // Événements standards (perso)
        const standardEvents = [
            { method: 'getEventBirth', type: 'birth' },
            { method: 'getEventDeath', type: 'death' },
            { method: 'getEventMarriage', type: 'marriage' },
            { method: 'getEventDivorce', type: 'divorce' },
            { method: 'getEventBaptism', type: 'baptism' },
            { method: 'getEventBurial', type: 'burial' },
            { method: 'getEventCremation', type: 'cremation' },
            { method: 'getEventAdoption', type: 'adoption' },
            { method: 'getEventEngagement', type: 'engagement' },
            { method: 'getEventGraduation', type: 'graduation' },
            { method: 'getEventEmigration', type: 'emigration' },
            { method: 'getEventImmigration', type: 'immigration' },
            { method: 'getEventNaturalization', type: 'naturalization' }
        ];
        
        standardEvents.forEach(({ method, type }) => {
            const selection = typeof individualSelection[method] === 'function'
                ? individualSelection[method]()
                : { arraySelect: () => [] };
            events.push(...this._extractEventDetails(selection, type));
        });
        
        // Événements "other" (custom)
        if (typeof individualSelection.getEventOther === 'function') {
            const otherEvents = individualSelection.getEventOther();
            events.push(...this._extractEventDetails(otherEvents, 'custom'));
        }
        
        // Attributs traités comme événements
        const attributes = this._extractAllAttributes(individualSelection);
        events.push(...attributes);
        
        return events.filter(Boolean);
    }
    
    /**
     * Détails d'événements
     * @private
     */
    _extractEventDetails(eventSelection, baseType) {
        const out = [];
        const arr = eventSelection.arraySelect ? eventSelection.arraySelect() : [];
        
        for (let i = 0; i < arr.length; i++) {
            const ev = arr[i];
            const eventData = {
                type: baseType,
                date: this._extractDate(ev.getDate()),
                place: this._extractPlace(ev.getPlace()),
                age: typeof ev.getAge === 'function' ? this._extractAge(ev.getAge()) : null,
                cause: this._extractCause(ev),
                notes: this.options.extractNotes ? this._extractEventNotes(ev) : [],
                sources: this.options.extractSources ? this._extractEventSources(ev) : [],
                multimedia: this.options.extractMedia ? this._extractEventMultimedia(ev) || [] : []
            };
            if (baseType === 'custom') {
                eventData.customType = this._extractCustomEventType(ev) || null;
            }
            out.push(eventData);
        }
        return out;
    }
    
    /**
     * Attributs -> événements
     * @private
     */
    _extractAllAttributes(individualSelection) {
        const attributes = [];
        const standardAttributes = [
            { method: 'getAttributeCaste', type: 'caste' },
            { method: 'getAttributePhysicalDescription', type: 'physical' },
            { method: 'getAttributeEducation', type: 'education' },
            { method: 'getAttributeNationalId', type: 'national_id' },
            { method: 'getAttributeNationality', type: 'nationality' },
            { method: 'getAttributeOccupation', type: 'occupation' },
            { method: 'getAttributeProperty', type: 'property' },
            { method: 'getAttributeReligion', type: 'religion' },
            { method: 'getAttributeResidence', type: 'residence' },
            { method: 'getAttributeRetirement', type: 'retirement' },
            { method: 'getAttributeSocialSecurityNumber', type: 'ssn' },
            { method: 'getAttributeTitle', type: 'title' },
            { method: 'getAttributeNobilityType', type: 'nobility' }
        ];
        
        standardAttributes.forEach(({ method, type }) => {
            const sel = typeof individualSelection[method] === 'function'
                ? individualSelection[method]()
                : { arraySelect: () => [] };
            attributes.push(...this._extractAttributeDetails(sel, type));
        });
        
        if (typeof individualSelection.getAttributeFact === 'function') {
            const factAttributes = individualSelection.getAttributeFact();
            attributes.push(...this._extractAttributeDetails(factAttributes, 'fact'));
        }
        
        return attributes.filter(Boolean);
    }
    
    /**
     * Détails d'attributs
     * @private
     */
    _extractAttributeDetails(attrSelection, type) {
        const out = [];
        const arr = attrSelection.arraySelect ? attrSelection.arraySelect() : [];
        
        for (let i = 0; i < arr.length; i++) {
            const attr = arr[i];
            const data = {
                type,
                value: (attr.value && attr.value()[0]) || null,
                date: this._extractDate(attr.getDate && attr.getDate()),
                place: this._extractPlace(attr.getPlace && attr.getPlace()),
                age: typeof attr.getAge === 'function' ? this._extractAge(attr.getAge()) : null,
                notes: this.options.extractNotes ? this._extractEventNotes(attr) : [],
                sources: this.options.extractSources ? this._extractEventSources(attr) : []
            };
            out.push(data);
        }
        return out;
    }
    
    /**
     * Relations directes (f,m,s, conjoints/enfants)
     * @private
     */
    _extractDirectFamilyRelations(individualSelection) {
        const relations = {
            fatherId: null,
            motherId: null,
            siblingIds: [],
            spouseIds: [],
            childrenIds: []
        };
        
        try {
            // Parents & frères/soeurs via getFamilyAsChild()
            if (typeof individualSelection.getFamilyAsChild === 'function') {
                const famsAsChild = individualSelection.getFamilyAsChild().arraySelect();
                famsAsChild.forEach(fam => {
                    const father = fam.getFather && fam.getFather().value()[0];
                    const mother = fam.getMother && fam.getMother().value()[0];
                    if (father) relations.fatherId = father;
                    if (mother) relations.motherId = mother;
                    
                    // enfants de la même famille -> siblings
                    const children = fam.getChild && fam.getChild().arraySelect();
                    children.forEach(ch => {
                        const cid = ch.value()[0];
                        if (cid && ![relations.fatherId, relations.motherId].includes(cid)) {
                            if (!relations.siblingIds.includes(cid)) relations.siblingIds.push(cid);
                        }
                    });
                });
            }
            
            // Conjoints & enfants via getFamilyAsSpouse()
            if (typeof individualSelection.getFamilyAsSpouse === 'function') {
                const famsAsSpouse = individualSelection.getFamilyAsSpouse().arraySelect();
                famsAsSpouse.forEach(fam => {
                    const husb = fam.getHusband && fam.getHusband().value()[0];
                    const wife = fam.getWife && fam.getWife().value()[0];
                    const me = individualSelection.pointer()[0];
                    const spouse = me === husb ? wife : husb;
                    if (spouse && !relations.spouseIds.includes(spouse)) relations.spouseIds.push(spouse);
                    
                    const children = fam.getChild && fam.getChild().arraySelect();
                    children.forEach(ch => {
                        const cid = ch.value()[0];
                        if (cid && !relations.childrenIds.includes(cid)) relations.childrenIds.push(cid);
                    });
                });
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction relations directes: ${error.message}`);
        }
        
        return relations;
    }
    
    /**
     * Événements familiaux "projetés" sur l'individu (MARR, etc.)
     * @private
     */
    _extractFamilyEventsOptimized(individualSelection, familyRelations) {
        const out = [];
        
        try {
            if (typeof individualSelection.getFamilyAsSpouse !== 'function') return out;
            const fams = individualSelection.getFamilyAsSpouse().arraySelect();
            fams.forEach(fam => {
                const marrSel = fam.getEventMarriage && fam.getEventMarriage();
                const marrArr = marrSel ? marrSel.arraySelect() : [];
                marrArr.forEach(ev => {
                    out.push({
                        type: 'marriage',
                        date: this._extractDate(ev.getDate && ev.getDate()),
                        place: this._extractPlace(ev.getPlace && ev.getPlace()),
                        spouseId: (() => {
                            const me = individualSelection.pointer()[0];
                            const h = fam.getHusband && fam.getHusband().value()[0];
                            const w = fam.getWife && fam.getWife().value()[0];
                            if (me && h === me) return w;
                            if (me && w === me) return h;
                            return null;
                        })(),
                        notes: this._extractEventNotes(ev),
                        sources: this._extractEventSources(ev),
                        multimedia: []
                    });
                });
            });
        } catch (error) {
            this._log(`⚠️ Erreur extraction événements familiaux: ${error.message}`);
        }
        
        return out;
    }
    
    /**
     * Logging helper
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
            
            // === SOURCES / NOTES ===
            sources: this._extractFamilySources(familySelection),
            notes: this._extractFamilyNotes(familySelection),
            
            // === MÉDIAS (si présents sur FAM) ===
            multimedia: this._extractFamilyMultimedia(familySelection)
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
     * Extrait références enfants
     * @private
     */
    _extractChildrenReferences(childrenSelection) {
        const out = [];
        if (!childrenSelection || childrenSelection.length === 0) return out;
        childrenSelection.arraySelect().forEach(ch => {
            const cid = ch.value()[0];
            if (cid) out.push(cid);
        });
        return out;
    }
    
    /**
     * Événements familiaux (MARR, DIV, …)
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
        
        familyEvents.forEach(({ method, type }) => {
            if (typeof familySelection[method] !== 'function') return;
            const selection = familySelection[method]();
            const arr = selection.arraySelect();
            
            arr.forEach(ev => {
                const eventData = {
                    type,
                    date: this._extractDate(ev.getDate()),
                    place: this._extractPlace(ev.getPlace()),
                    age: typeof ev.getAge === 'function' ? this._extractAge(ev.getAge()) : null,
                    cause: this._extractCause(ev),
                    notes: this.options.extractNotes ? this._extractEventNotes(ev) : [],
                    sources: this.options.extractSources ? this._extractEventSources(ev) : [],
                    multimedia: this.options.extractMedia ? this._extractEventMultimedia(ev) || [] : [],
                    // Champs spécifiques
                    eventType: (ev.getType && ev.getType().length > 0) ? (ev.getType().value()[0] || null) : null
                };
                events.push(eventData);
            });
        });
        
        return events;
    }
    
    /**
     * SOURCES au niveau famille
     * @private
     */
    _extractFamilySources(familySelection) {
        const sources = [];
        try {
            const sourceSelection = familySelection.get('SOUR');
            if (sourceSelection && sourceSelection.length > 0) {
                sourceSelection.arraySelect().forEach(source => {
                    const srcPtr = source.value()[0];
                    if (srcPtr) {
                        sources.push({
                            pointer: srcPtr,
                            page: source.get('PAGE')?.value()?.[0] || null,
                            quality: source.get('QUAY')?.value()?.[0] || null
                        });
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction sources famille: ${error.message}`);
        }
        return sources;
    }
    
    /**
     * NOTES au niveau famille (inline + refs)
     * @private
     */
    _extractFamilyNotes(familySelection) {
        // Réutilise la logique d’événement
        return this._extractEventNotes(familySelection);
    }
    
    /**
     * MÉDIAS au niveau famille
     * @private
     */
    _extractFamilyMultimedia(familySelection) {
        const mediaRefs = [];
        try {
            const multimedia = familySelection.get('OBJE');
            if (multimedia && multimedia.length > 0) {
                multimedia.arraySelect().forEach(m => {
                    const ptr = m.value()[0];
                    if (ptr?.startsWith('@')) mediaRefs.push(ptr);
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction médias famille: ${error.message}`);
        }
        return mediaRefs;
    }
    
    /**
     * Extraction des notes (records @N...@)
     * @private
     */
    _extractNotes(rootSelection) {
        const notesList = [];
        
        try {
            const noteRecordSelection = rootSelection.getNoteRecord();
            if (!noteRecordSelection || noteRecordSelection.length === 0) return [];
            
            const noteRecords = noteRecordSelection.arraySelect();
            
            // Log de synthèse uniquement
            this._log(`Extraction de ${noteRecords.length} enregistrements NOTE...`);
            
            noteRecords.forEach(noteRecord => {
                const noteData = this._extractSingleNoteRecord(noteRecord);
                if (noteData) notesList.push(noteData);
            });
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes: ${error.message}`);
        }
        
        return notesList;
    }
    
    /**
     * Extrait un record NOTE
     * @private
     */
    _extractSingleNoteRecord(noteRecord) {
        try {
            const pointer = noteRecord.pointer()[0];
            if (!pointer) return null;
            
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
     * [MOD 2025-08-08] Reconstruction explicite:
     *  - CONC = concaténation (même ligne)
     *  - CONT = continuation (nouvelle ligne)
     * @private
     */
    _extractNoteText(noteNode) {
        try {
            const head = (typeof noteNode.value === 'function' && noteNode.value()?.[0]) || '';
            const parts = [head];
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
            this._log(`⚠️ Erreur reconstruction NOTE: ${error.message}`);
            return null;
        }
    }
            
    /**
     * Lit HEAD > PLAC > FORM si présent
     * @private
     */
    _readPlacFormFromHead(rootSelection) {
        try {
            const head = rootSelection.get && rootSelection.get('HEAD');
            const viaHead = head && head.get && head.get('PLAC') && head.get('PLAC').get && head.get('PLAC').get('FORM') && head.get('PLAC').get('FORM').value && head.get('PLAC').get('FORM').value();
            if (viaHead && viaHead[0]) return viaHead[0];
            const viaRoot = rootSelection.get && rootSelection.get('PLAC') && rootSelection.get('PLAC').get && rootSelection.get('PLAC').get('FORM') && rootSelection.get('PLAC').get('FORM').value && rootSelection.get('PLAC').get('FORM').value();
            return (viaRoot && viaRoot[0]) || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Applique la convention de PLAC à une valeur brute
     * @private
     */
    _applyPlacForm(rawPlac, formString) {
        if (!rawPlac || !formString) return null;
        const keys = formString.split(',').map(s => s.trim()).filter(Boolean).map(s => s.toLowerCase().replace(/\s+/g, '_'));
        const parts = String(rawPlac).split(',').map(s => s.trim());
        let segs = parts.slice(0);
        if (segs.length > keys.length) {
            const head = segs.slice(0, keys.length - 1);
            const tail = segs.slice(keys.length - 1).join(', ');
            segs = [...head, tail];
        } else if (segs.length < keys.length) {
            segs = [...segs, ...Array(keys.length - segs.length).fill(null)];
        }
        const map = {};
        keys.forEach((k, i) => { map[k] = (segs[i] === '' ? null : segs[i]); });
        return map;
    }

    /**
     * Sources d'un record NOTE
     * @private
     */
    _extractNoteSources(noteRecord) {
        const sources = [];
        try {
            const sourceSelection = noteRecord.get('SOUR');
            if (sourceSelection && sourceSelection.length > 0) {
                sourceSelection.arraySelect().forEach(source => {
                    const srcPtr = source.value()[0];
                    if (srcPtr) sources.push({ pointer: srcPtr });
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction sources note: ${error.message}`);
        }
        return sources;
    }
    
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
            // Mapping structuré selon HEAD>PLAC>FORM (si défini)
            structured: (this._placForm ? this._applyPlacForm(placeValue, this._placForm) : null),
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
    /**
     * Extrait les notes d'un événement ou attribut
     * [MOD 2025-08-08] Support mixte: références @N...@ et texte inline avec reconstruction CONT/CONC
     * @private
     */
    _extractEventNotes(eventSelection) {
        const notes = [];
        try {
            if (typeof eventSelection.getNote === 'function') {
                const mixed = eventSelection.getNote();
                if (mixed && mixed.length > 0) {
                    mixed.arraySelect().forEach(n => {
                        const raw = (n.value && n.value()[0]) || '';
                        if (raw && raw.startsWith('@')) {
                            notes.push({ type: 'reference', pointer: raw });
                        } else {
                            const text = this._extractNoteText(n);
                            if (text) notes.push({ type: 'embedded', text });
                        }
                    });
                }
            }
            const embeddedNotes = eventSelection.get && eventSelection.get('NOTE');
            if (embeddedNotes && embeddedNotes.length > 0) {
                embeddedNotes.arraySelect().forEach(n => {
                    const raw = (n.value && n.value()[0]) || '';
                    if (raw && raw.startsWith('@')) {
                        if (!notes.some(x => x.type === 'reference' && x.pointer === raw)) {
                            notes.push({ type: 'reference', pointer: raw });
                        }
                    } else {
                        const text = this._extractNoteText(n);
                        if (text) notes.push({ type: 'embedded', text });
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes événement: ${error.message}`);
        }
        return notes;
    }
    
    /**
     * Extrait les sources d'un événement/attribut
     * @private
     */
    _extractEventSources(eventSelection) {
        const sources = [];
        try {
            const sourceSelection = eventSelection.get('SOUR');
            if (sourceSelection && sourceSelection.length > 0) {
                sourceSelection.arraySelect().forEach(source => {
                    const sourceData = {
                        pointer: source.value()[0] || null,
                        page: source.get('PAGE')?.value()?.[0] || null,
                        quality: source.get('QUAY')?.value()?.[0] || null
                    };
                    sources.push(sourceData);
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction sources événement: ${error.message}`);
        }
        return sources;
    }
    
    /**
     * Notes au niveau INDI (inline + refs)
     * @private
     */
    _extractIndividualNotes(individualSelection) {
        const noteRefs = [];
        const inlineNotes = [];
        const pointer = individualSelection.pointer()[0];
        
        try {
            
            // Notes au niveau individu (NOTE directes)
            const noteSelection = individualSelection.getNote();
            
            if (noteSelection.length > 0) {
                noteSelection.arraySelect().forEach((note, index) => {
                    const noteValue = note.value()[0];
                    if (!noteValue) return;
                    
                    if (noteValue.startsWith('@')) {
                        // C'est une référence vers une note externe
                        noteRefs.push(noteValue);
                    } else {
                        // C'est une note inline avec son texte complet
                        const fullText = this._extractNoteText(note);
                        if (fullText) {
                            inlineNotes.push({
                                text: fullText,
                                type: 'individual',
                                // Générer un ID unique pour cette note inline
                                id: `INLINE_${pointer}_${inlineNotes.length}`
                            });
                        }
                    }
                });
            }
            
            // Vérifier aussi avec get('NOTE') pour couvrir tous les cas
            const embeddedNotes = individualSelection.get('NOTE');
            
            if (embeddedNotes && embeddedNotes.length > 0) {
                embeddedNotes.arraySelect().forEach((note, index) => {
                    const text = note.value()[0];
                    if (!text) return;
                    
                    if (text.startsWith('@')) {
                        // C'est une référence - éviter les doublons
                        if (!noteRefs.includes(text)) {
                            noteRefs.push(text);
                        }
                    } else {
                        // C'est une note inline
                        const fullText = this._extractNoteText(note);
                        if (fullText) {
                            inlineNotes.push({
                                text: fullText,
                                type: 'individual', 
                                id: `INLINE_${pointer}_${inlineNotes.length}`
                            });
                        }
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes individu: ${error.message}`);
        }
        
        
        if (noteRefs.length > 0) {
            this._log(`   📌 ${noteRefs.length} références de notes trouvées pour ${pointer}`);
        }
        if (inlineNotes.length > 0) {
            this._log(`   📝 ${inlineNotes.length} notes inline trouvées pour ${pointer}`);
        }
        
        return { refs: noteRefs, inline: inlineNotes };
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
                        const ptr = media.value()[0];
                        if (ptr && ptr.startsWith('@')) {
                            mediaRefs.push(ptr);
                        }
                    });
                }
            }
            
            // Fallback via get('OBJE')
            const objeSelection = individualSelection.get('OBJE');
            if (objeSelection && objeSelection.length > 0) {
                objeSelection.arraySelect().forEach(media => {
                    const ptr = media.value()[0];
                    if (ptr && ptr.startsWith('@')) {
                        mediaRefs.push(ptr);
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction références médias individu: ${error.message}`);
        }
        
        return mediaRefs;
    }
    
    /**
     * Extraction des SOURCES (records)
     * @private
     */
    async _extractSources(rootSelection) {
        const sourcesList = [];
        
        try {
            const sourceRecords = rootSelection.getSourceRecord().arraySelect();
            
            // Log de synthèse uniquement
            this._log(`Extraction de ${sourceRecords.length} enregistrements SOUR...`);
            
            for (let i = 0; i < sourceRecords.length; i++) {
                const s = sourceRecords[i];
                const pointer = s.pointer()[0];
                if (!pointer) continue;
                
                // Extraire les informations essentielles d'une source
                const sourceData = {
                    pointer,
                    title: (s.get('TITL') && s.get('TITL').value()[0]) || null,
                    text: null,
                    notes: [],
                    repositories: []
                };
                
                sourcesList.push(sourceData);
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction sources: ${error.message}`);
        }
        
        return sourcesList;
    }
    
    /**
     * Extraction des REPOSITORIES (records)
     * @private
     */
    async _extractRepositories(rootSelection) {
        const repositories = [];
        
        try {
            const repoRecords = rootSelection.getRepositoryRecord().arraySelect();
            
            // Log de synthèse uniquement
            this._log(`Extraction de ${repoRecords.length} enregistrements REPO...`);
            
            for (let i = 0; i < repoRecords.length; i++) {
                const r = repoRecords[i];
                const pointer = r.pointer()[0];
                if (!pointer) continue;
                
                repositories.push({
                    pointer,
                    name: (r.get('NAME') && r.get('NAME').value()[0]) || null,
                    addr: (r.get('ADDR') && r.get('ADDR').value()[0]) || null
                });
            }
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction repositories: ${error.message}`);
        }
        
        return repositories;
    }
    
    /**
     * Extraction des MÉDIAS (records)
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
            const titleSelection = mediaRecord.get('TITL');
            const title = (titleSelection && titleSelection.length > 0) ? titleSelection.value()[0] : null;
            
            // Extraire format
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
            // this._log(`   ✅ Média ${pointer}: ${title || file || 'sans titre'}...`);
            return mediaData;
            
        } catch (error) {
            this._log(`⚠️ Erreur extraction média: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Déduit un format de média (heuristique à partir du TITL)
     * @private
     */
    _extractMediaFormat(mediaRecord) {
        try {
            const titl = mediaRecord.get('TITL');
            if (titl && titl.length > 0) {
                const v = titl.value()[0] || '';
                const m = v.match(/\.(jpg|jpeg|png|gif|tif|tiff|webp|pdf|mp4|mp3)$/i);
                if (m) return m[1].toLowerCase();
            }
        } catch (error) {
            // ignore
        }
        return null;
    }
    
    /**
     * Déduit un type de média générique
     * @private
     */
    _getMediaType(format, file) {
        if (!format && !file) return 'other';
        const f = (format || '').toLowerCase();
        if (['jpg','jpeg','png','gif','tif','tiff','webp','bmp'].includes(f)) return 'image';
        if (['mp4','mov','avi','mkv','webm'].includes(f)) return 'video';
        if (['mp3','wav','flac','aac','ogg'].includes(f)) return 'audio';
        if (['pdf'].includes(f)) return 'document';
        if (file && (/^(https?|ftp):\/\//i).test(file)) return 'url';
        return 'other';
    }
    
    /**
     * Notes d’un record média : inline + refs
     * @private
     */
    _extractMediaNotes(mediaRecord) {
        const notes = [];
        try {
            const mixed = mediaRecord.getNote && mediaRecord.getNote();
            if (mixed && mixed.length > 0) {
                mixed.arraySelect().forEach(n => {
                    const raw = (n.value && n.value()[0]) || '';
                    if (raw && raw.startsWith('@')) {
                        notes.push({ type: 'reference', pointer: raw });
                    } else {
                        const text = this._extractNoteText(n);
                        if (text) notes.push({ type: 'embedded', text });
                    }
                });
            }
            const noteSelection = mediaRecord.get('NOTE');
            if (noteSelection && noteSelection.length > 0) {
                noteSelection.arraySelect().forEach(n => {
                    const raw = (n.value && n.value()[0]) || '';
                    if (raw && raw.startsWith('@')) {
                        if (!notes.some(x => x.type === 'reference' && x.pointer === raw)) {
                            notes.push({ type: 'reference', pointer: raw });
                        }
                    } else {
                        const text = this._extractNoteText(n);
                        if (text) notes.push({ type: 'embedded', text });
                    }
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction notes média: ${error.message}`);
        }
        return notes;
    }
    
    /**
     * Sources d’un record média
     * @private
     */
    _extractMediaSources(mediaRecord) {
        const sources = [];
        try {
            const sourceSelection = mediaRecord.get('SOUR');
            if (sourceSelection && sourceSelection.length > 0) {
                sourceSelection.arraySelect().forEach(source => {
                    const ptr = source.value()[0];
                    if (ptr) sources.push({ pointer: ptr });
                });
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction sources média: ${error.message}`);
        }
        return sources;
    }
    
    _hasMediaBlob(_mediaRecord) { return false; }
    
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

    _extractCustomEventType(eventSelection) { 
        // Extraire le TYPE d'un événement EVEN custom
        try {
            const typeSelection = eventSelection.get('TYPE');
            if (typeSelection && typeSelection.length > 0) {
                const typeValue = typeSelection.value()[0];
                return typeValue || null;
            }
        } catch (error) {
            this._log(`⚠️ Erreur extraction TYPE événement custom: ${error.message}`);
        }
        return null;
    }

    _extractMetadata() { 
        const meta = {};
        if (this._placForm) meta.placForm = this._placForm;
        // TODO: ajouter d'autres métadonnées si besoin (source, date d'export, etc.)
        return meta; 
    }
}