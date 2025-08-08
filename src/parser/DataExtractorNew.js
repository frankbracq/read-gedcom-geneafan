/**
 * [MOD 2025-08-08] Amélioration extraction des NOTES :
 *  - Ajout de _extractNoteText() qui reconstruit correctement le texte des notes inline
 *    en gérant explicitement les tags GEDCOM CONC (concaténation) et CONT (saut de ligne).
 *  - Adaptation de _extractIndividualNotes(), _extractEventNotes() et _extractMediaNotes()
 *    pour utiliser _extractNoteText() et capturer à la fois :
 *      • Les notes inline complètes (texte reconstruit)
 *      • Les références @N...@ vers des NOTE records
 *  - Conservation des références distinctes pour résolution ultérieure via getNoteRecord().
 */
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

    _log(...args) {
        if (this.options.verbose) console.log(...args);
    }

    /**
     * Point d'entrée principal
     * @param {SelectionGedcom} rootSelection - résultat de readGedcom(arrayBuffer|Buffer)
     * @returns {Promise<object>}
     */
    async extractAll(rootSelection) {
        const result = {
            individuals: [],
            families: [],
            sources: [],
            repositories: [],
            media: [],
            notes: [],
            metadata: {}
        };

        // Indices et caches (si nécessaires plus tard)
        // ...

        // === INDIVIDUS ===
        this._log('Extraction des individus...');
        const individuals = rootSelection.getIndividualRecord();
        const indiArray = individuals ? individuals.arraySelect() : [];
        for (let i = 0; i < indiArray.length; i++) {
            const individualSelection = indiArray[i];
            const indi = await this._extractIndividual(individualSelection, rootSelection);
            if (indi) result.individuals.push(indi);
        }
        this._log(`✅ Individus extraits: ${result.individuals.length}`);

        // === FAMILLES ===
        this._log('Extraction des familles...');
        const families = rootSelection.getFamilyRecord();
        const famArray = families ? families.arraySelect() : [];
        for (let i = 0; i < famArray.length; i++) {
            const familySelection = famArray[i];
            const fam = this._extractFamily(familySelection);
            if (fam) result.families.push(fam);
        }
        this._log(`✅ Familles extraites: ${result.families.length}`);

        // === SOURCES ===
        if (this.options.extractSources) {
            this._log('Extraction des sources...');
            result.sources = await this._extractSources(rootSelection);
        }

        // === REPOSITORIES ===
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

        return result;
    }

    /**
     * Extrait un individu complet (format optimisé GeneaFan)
     * @private
     */
    async _extractIndividual(individualSelection, rootSelection) {
        try {
            const pointer = individualSelection.pointer()[0];
            if (!pointer) return null;

            const name = this._extractName(individualSelection);
            const sex = this._extractSex(individualSelection);

            // Événements + Attributs
            const events = this._extractAllEvents(individualSelection);
            const familyEvents = this._extractFamilyEvents(individualSelection, rootSelection);

            // Relations
            const familyRelations = this._extractFamilyRelations(individualSelection);

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
                
                // Événements complets
                events: allEvents,
                
                // Notes (références ET inline)
                noteRefs: notesData.refs,      // Array des pointeurs vers les notes (@N123@)
                inlineNotes: notesData.inline,  // Array des notes inline complètes
                mediaRefs,  // Array des pointeurs vers les médias (@M123@)
                
                // 🚀 ARCHITECTURE SOLIDE : Attacher l'objet read-gedcom pour APIs natives
                readGedcomIndividual: individualSelection,
                
                // Métadonnées
                metadata: {
                    extractedVia: 'read-gedcom-direct-apis',
                    version: '1.0.0'
                }
            };

            return result;
        } catch (error) {
            this._log(`⚠️ Erreur extraction individu: ${error.message}`);
            return null;
        }
    }

    /**
     * Extrait le nom complet (via API native)
     * @private
     */
    _extractName(individualSelection) {
        const nameSelection = individualSelection.getName();
        if (!nameSelection || nameSelection.length === 0) {
            return { given: '', surname: '', prefix: '', suffix: '', full: '' };
        }
        
        // Utiliser la première occurrence comme principale
        const givenSelection = nameSelection.getGivenName();
        const surnameSelection = nameSelection.getSurname();
        const prefixSelection = nameSelection.getNamePrefix();
        const suffixSelection = nameSelection.getNameSuffix();
        
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
        if (!sexSelection || sexSelection.length === 0) return null;
        const v = sexSelection.value();
        return v && v.length > 0 ? v[0] : null;
    }

    _extractPhoneticName(nameSelection) { return null; }
    _extractRomanizedName(nameSelection) { return null; }

    /**
     * Extrait TOUS les événements (birth, death, etc.)
     * @private
     */
    _extractAllEvents(individualSelection) {
        const events = [];

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
            const attrSelection = individualSelection[method]();
            attributes.push(...this._extractAttributeDetails(attrSelection, type));
        });
        
        // Attributs génériques via getFact
        const factAttributes = individualSelection.getAttributeFact();
        attributes.push(...this._extractAttributeDetails(factAttributes, 'fact'));
        
        return attributes.filter(attr => attr !== null);
    }
    
    /**
     * Extrait les détails d'un attribut (traité comme événement)
     * @private
     */
    _extractAttributeDetails(attrSelection, type) {
        const attributes = [];
        const arr = attrSelection.arraySelect();
        for (let i = 0; i < arr.length; i++) {
            const attr = arr[i];
            const attrData = {
                type,
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

    /**
     * Extrait tous les événements familiaux (mariages, etc.) comme événements liés
     * @private
     */
    _extractFamilyEvents(individualSelection, rootSelection) {
        const events = [];
        // ... (implémentation selon besoins)
        return events;
    }

    /**
     * Extrait relations familiales directes
     * @private
     */
    _extractFamilyRelations(individualSelection) {
        return {
            fatherId: null,
            motherId: null,
            siblingIds: [],
            spouseIds: [],
            childrenIds: []
        };
    }

    /**
     * Extrait la date (placeholder ici)
     * @private
     */
    _extractDate(dateSelection) { 
        // ... parser si besoin
        return null; 
    }

    /**
     * Extrait le lieu + géoloc (placeholder : retourne structure brute)
     * @private
     */
    _extractPlace(placeSelection) {
        const placeData = {
            value: placeSelection && placeSelection.length > 0 ? (placeSelection.value()[0] || null) : null,
            latitude: null,
            longitude: null,
            normalized: null
        };
        try {
            // exemple : extractGeolocation(placeData.value)
            // const geo = extractGeolocation(placeData.value);
            // placeData.latitude = geo?.lat ?? null;
            // placeData.longitude = geo?.lng ?? null;
        } catch (error) {
            this._log(`   ⚠️ Impossible d'extraire coordonnées pour "${placeData.value}": ${error.message}`);
        }
        return placeData;
    }
    _extractAge(ageSelection) { return null; }
    _extractCause(eventSelection) { return null; }

    /**
     * Extrait les notes d'un événement ou attribut
     * [MOD 2025-08-08] Reconstruction des notes inline via _extractNoteText
     * et conservation des références @N...@
     * @private
     */
    _extractEventNotes(eventSelection) {
        const notes = [];
        
        try {
            // [MOD 2025-08-08] Utiliser le mixin getNote() qui retourne inline + références
            if (typeof eventSelection.getNote === 'function') {
                const mixed = eventSelection.getNote();
                if (mixed && mixed.length > 0) {
                    mixed.arraySelect().forEach(n => {
                        const raw = (n.value && n.value()[0]) || '';
                        if (raw && raw.startsWith('@')) {
                            notes.push({ type: 'reference', pointer: raw });
                        } else {
                            const text = this._extractNoteText(n); // gère CONT/CONC
                            if (text) notes.push({ type: 'embedded', text });
                        }
                    });
                }
            }
            
            // [MOD] fallback explicite via get('NOTE')
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
                    const quaySelection = source.get('QUAY');
                    if (quaySelection && quaySelection.length > 0) {
                        sourceData.quality = quaySelection.value()[0];
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
     * Extraction des notes au niveau de l'individu
     * @private
     */
    _extractIndividualNotes(individualSelection) {
        const noteRefs = [];
        const inlineNotes = [];
        
        try {
            const pointer = individualSelection.pointer()[0];
            console.log(`🔍 [DEBUG] Extraction notes pour ${pointer}`);
            
            // Notes au niveau individu (NOTE directes)
            const noteSelection = individualSelection.getNote();
            console.log(`🔍 [DEBUG] getNote() length: ${noteSelection.length}`);
            
            if (noteSelection.length > 0) {
                noteSelection.arraySelect().forEach((note, index) => {
                    const noteValue = note.value()[0];
                    console.log(`🔍 [DEBUG] Note ${index}: "${noteValue}"`);
                    if (!noteValue) return;
                    
                    if (noteValue.startsWith('@')) {
                        // C'est une référence vers une note externe
                        noteRefs.push(noteValue);
                        console.log(`🔍 [DEBUG] → Référence note: ${noteValue}`);
                    } else {
                        // C'est une note inline avec son texte complet
                        const fullText = this._extractNoteText(note);
                        console.log(`🔍 [DEBUG] → Note inline: "${fullText?.substring(0, 50)}..."`);
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
            console.log(`🔍 [DEBUG] get('NOTE') length: ${embeddedNotes ? embeddedNotes.length : 0}`);
            
            if (embeddedNotes && embeddedNotes.length > 0) {
                embeddedNotes.arraySelect().forEach((note, index) => {
                    const text = note.value()[0];
                    console.log(`🔍 [DEBUG] Embedded note ${index}: "${text}"`);
                    if (!text) return;
                    
                    if (text.startsWith('@')) {
                        // C'est une référence - éviter les doublons
                        if (!noteRefs.includes(text)) {
                            noteRefs.push(text);
                            console.log(`🔍 [DEBUG] → Référence note (get): ${text}`);
                        }
                    } else {
                        const fullText = this._extractNoteText(note);
                        console.log(`🔍 [DEBUG] → Note inline (get): "${fullText?.substring(0, 50)}..."`);
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
        
        console.log(`🔍 [DEBUG] RÉSULTAT pour ${pointer}: ${noteRefs.length} refs, ${inlineNotes.length} inline`);
        
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
            const mixed = typeof individualSelection.getMultimedia === 'function'
                ? individualSelection.getMultimedia()
                : null;
            if (mixed && mixed.length > 0) {
                mixed.arraySelect().forEach(m => {
                    const raw = (m.value && m.value()[0]) || '';
                    if (raw && raw.startsWith('@')) mediaRefs.push(raw);
                });
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

    /**
     * Extrait toutes les sources du GEDCOM
     * @private
     */
    async _extractSources(rootSelection) {
        const out = [];
        try {
            const srcSel = rootSelection.getSourceRecord();
            const arr = srcSel ? srcSel.arraySelect() : [];
            for (let i = 0; i < arr.length; i++) {
                const s = arr[i];
                const pointer = s.pointer()[0];
                if (!pointer) continue;
                out.push({
                    pointer,
                    title: (s.get('TITL').value?.()[0]) || null,
                    text: null,
                    notes: [],  // si besoin, appeler getNote() + _extractNoteText
                    repositories: []
                });
            }
        } catch (e) {
            this._log(`⚠️ Erreur extraction sources: ${e.message}`);
        }
        return out;
    }

    /**
     * Extrait tous les dépôts du GEDCOM
     * @private
     */
    async _extractRepositories(rootSelection) {
        const out = [];
        try {
            const repoSel = rootSelection.getRepositoryRecord();
            const arr = repoSel ? repoSel.arraySelect() : [];
            for (let i = 0; i < arr.length; i++) {
                const r = arr[i];
                const pointer = r.pointer()[0];
                if (!pointer) continue;
                out.push({
                    pointer,
                    name: (r.get('NAME').value?.()[0]) || null,
                    addr: (r.get('ADDR').value?.()[0]) || null
                });
            }
        } catch (e) {
            this._log(`⚠️ Erreur extraction repositories: ${e.message}`);
        }
        return out;
    }

    /**
     * Extrait tous les médias (records @M...@)
     * @private
     */
    _extractMedia(rootSelection) {
        const out = [];
        try {
            const mediaSel = rootSelection.getMultimediaRecord();
            const arr = mediaSel ? mediaSel.arraySelect() : [];
            for (let i = 0; i < arr.length; i++) {
                const m = arr[i];
                const md = this._extractSingleMedia(m);
                if (md) out.push(md);
            }
        } catch (e) {
            this._log(`⚠️ Erreur extraction médias: ${e.message}`);
        }
        return out;
    }

    /**
     * Extrait un record média
     * @private
     */
    _extractSingleMedia(mediaRecord) {
        try {
            const pointer = mediaRecord.pointer()[0];
            if (!pointer) return null;

            // FILE
            let file = null;
            const fileViaApi = mediaRecord.getFile?.();
            if (fileViaApi && fileViaApi.length > 0) {
                file = fileViaApi.value()[0];
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
            
            // Déduire format (si pas d’extension)
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
            // TITL peut contenir une extension ; sinon HEAD/FORM dans certains dumps
            const titl = mediaRecord.get('TITL');
            if (titl && titl.length > 0) {
                const v = titl.value()[0] || '';
                const m = v.match(/\.(jpg|jpeg|png|gif|tif|tiff|webp|pdf|mp4|mp3)$/i);
                if (m) return m[1].toLowerCase();
            }
        } catch (e) {}
        return null;
    }

    _hasMediaBlob(mediaRecord) { return false; }
    _getMediaType(format, file) {
        if (!format && !file) return 'other';
        const f = (format || '').toLowerCase();
        if (['jpg','jpeg','png','gif','tif','tiff','webp','bmp'].includes(f)) return 'image';
        if (['mp4','mov','avi','mkv','webm'].includes(f)) return 'video';
        if (['mp3','wav','flac','aac','ogg'].includes(f)) return 'audio';
        if (['pdf'].includes(f)) return 'document';
        if (file && (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('ftp://'))) {
            return 'url';
        }
        return 'other';
    }
    
    /**
     * Extrait les notes d'un enregistrement MULTIMEDIA
     * [MOD 2025-08-08] Support des notes inline + références avec reconstruction CONT/CONC.
     * @private
     */
    _extractMediaNotes(mediaRecord) {
        const notes = [];
        
        try {
            // [MOD 2025-08-08] Supporter getNote() (inline + refs)
            if (typeof mediaRecord.getNote === 'function') {
                const mixed = mediaRecord.getNote();
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

            // [MOD] Fallback via get('NOTE')
            const noteSelection = mediaRecord.get && mediaRecord.get('NOTE');
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
     * Extrait tous les enregistrements NOTE
     * @private
     */
    _extractNotes(rootSelection) {
        const notesList = [];
        
        try {
            const noteRecordSelection = rootSelection.getNoteRecord();
            if (!noteRecordSelection || noteRecordSelection.length === 0) {
                return [];
            }
            
            // Pour chaque NOTE record
            noteRecordSelection.arraySelect().forEach(noteRecord => {
                const noteData = this._extractSingleNote(noteRecord);
                if (noteData) notesList.push(noteData);
            });
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
     * [MOD 2025-08-08] Reconstruction explicite:
     *  - CONC = concaténation (même ligne)
     *  - CONT = continuation (nouvelle ligne)
     * @private
     */
    _extractNoteText(noteNode) {
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
            this._log(`⚠️ Erreur reconstruction NOTE: ${error.message}`);
            return null;
        }
    }
}