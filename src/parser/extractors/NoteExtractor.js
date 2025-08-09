/**
 * NoteExtractor - Extraction des notes GEDCOM
 * 
 * Ce module gère l'extraction de tous les éléments de notes :
 * - Enregistrements de notes (NOTE records)
 * - Notes inline et références
 * - Notes d'événements et d'individus
 * - Gestion des continuations (CONT/CONC)
 * - Sources des notes
 */

export class NoteExtractor {
    constructor(options = {}) {
        this.options = {
            extractNotes: true,
            extractSources: true,
            verbose: false,
            ...options
        };
    }

    /**
     * Extrait toutes les notes (NOTE records) du GEDCOM
     * @param {Object} rootSelection - Sélection racine read-gedcom
     * @returns {Array} Liste des notes extraites
     */
    extractNotes(rootSelection) {
        const notesList = [];
        
        try {
            const noteRecords = rootSelection.getNoteRecord().arraySelect();
            // Log de synthèse uniquement
            this.log(`Extraction de ${noteRecords.length} enregistrements NOTE...`);
            
            for (let i = 0; i < noteRecords.length; i++) {
                const noteRecord = noteRecords[i];
                const noteData = this.extractSingleNote(noteRecord);
                if (noteData) {
                    notesList.push(noteData);
                }
            }
            
        } catch (error) {
            this.log(`Erreur extraction notes: ${error.message}`);
        }
        
        return notesList;
    }

    /**
     * Extrait un enregistrement NOTE complet
     * @param {Object} noteRecord - Enregistrement note read-gedcom
     * @returns {Object|null} Données de la note extraites
     */
    extractSingleNote(noteRecord) {
        try {
            const pointer = noteRecord.pointer()[0];
            if (!pointer) return null;
            
            // Extraction silencieuse (log désactivé pour éviter la pollution)
            // this.log(`   Extraction note ${pointer}...`);
            
            // Extraire le texte de la note (avec CONT/CONC)
            const noteText = this.extractNoteText(noteRecord);
            
            if (!noteText) {
                this.log(`   Note ${pointer} sans texte, ignorée`);
                return null;
            }
            
            const noteData = {
                pointer,
                text: noteText,
                sources: this.extractNoteSources(noteRecord)
            };
            
            // Log désactivé pour éviter la pollution console
            // this.log(`   ✅ Note ${pointer}: ${noteText.substring(0, 50)}...`);
            return noteData;
            
        } catch (error) {
            this.log(`Erreur extraction note individuelle: ${error.message}`);
            return null;
        }
    }

    /**
     * Extrait le texte complet d'une note (avec CONT/CONC)
     * Gère correctement les tags GEDCOM :
     *  - CONC = concaténation (même ligne)
     *  - CONT = continuation (nouvelle ligne)
     * @param {Object} noteRecord - Enregistrement note read-gedcom
     * @returns {string|null} Texte complet de la note
     */
    extractNoteText(noteRecord) {
        try {
            // Méthode 1 : via value() qui gère automatiquement CONT/CONC
            const textValue = noteRecord.value();
            if (textValue && textValue.length > 0 && textValue[0]) {
                return textValue[0];
            }
            
            // Méthode 2 : Reconstruction manuelle si nécessaire
            return this.reconstructNoteText(noteRecord);
            
        } catch (error) {
            this.log(`Erreur extraction texte note: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Reconstruit le texte complet d'une note GEDCOM inline
     * Gère correctement les tags GEDCOM :
     *  - CONC = concaténation (même ligne)
     *  - CONT = continuation (nouvelle ligne)
     * @param {Object} noteNode - Nœud de note read-gedcom
     * @returns {string|null} Texte complet de la note
     */
    reconstructNoteText(noteNode) {
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
     * Extrait les notes d'un individu (références ET inline)
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Object} Objet contenant refs et inline
     */
    extractIndividualNotes(individualSelection) {
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
                        const fullText = this.extractNoteText(note);
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
        } catch (error) {
            this.log(`Erreur extraction notes individu: ${error.message}`);
        }
        
        if (inlineNotes.length > 0) {
            this.log(`📝 ${inlineNotes.length} notes inline trouvées pour ${pointer}`);
        }
        
        return { refs: noteRefs, inline: inlineNotes };
    }

    /**
     * Extrait les notes d'un événement ou attribut
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des notes de l'événement
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
     * Extrait les sources d'un enregistrement NOTE
     * @param {Object} noteRecord - Enregistrement note read-gedcom
     * @returns {Array} Liste des sources de la note
     */
    extractNoteSources(noteRecord) {
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
            this.log(`Erreur extraction sources note: ${error.message}`);
        }
        
        return sources;
    }

    /**
     * Collecte toutes les notes des événements d'un individu
     * @param {Array} allEvents - Liste de tous les événements de l'individu
     * @param {string} pointer - Pointeur de l'individu
     * @returns {Array} Liste des notes d'événements
     */
    collectEventNotes(allEvents, pointer) {
        const eventNotes = [];
        let eventNoteCounter = 0;
        
        allEvents.forEach((event, eventIndex) => {
            if (event.notes && event.notes.length > 0) {
                // Tableau pour stocker les IDs de notes de cet événement
                const eventNoteIds = [];
                
                event.notes.forEach(noteData => {
                    if (noteData.type === 'embedded' && noteData.text) {
                        // Créer une note inline pour cet événement
                        const noteId = `INLINE_EVENT_${pointer}_${eventIndex}_${eventNoteCounter++}`;
                        const eventInlineNote = {
                            text: noteData.text,
                            type: 'event',
                            eventType: event.type,
                            id: noteId
                        };
                        eventNotes.push(eventInlineNote);
                        eventNoteIds.push(noteId);  // Ajouter l'ID à la liste
                    } else if (noteData.type === 'reference' && noteData.pointer) {
                        eventNoteIds.push(noteData.pointer);  // Ajouter la référence à la liste
                    }
                });
                
                // Ajouter les IDs de notes à l'événement pour la compression
                if (eventNoteIds.length > 0) {
                    event.noteIds = eventNoteIds;
                }
            }
        });
        
        return eventNotes;
    }

    /**
     * Valide le contenu d'une note
     * @param {Object} noteData - Données de la note
     * @returns {Object} Résultat de validation
     */
    validateNote(noteData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Vérifications de base
        if (!noteData.pointer && !noteData.id) {
            validation.isValid = false;
            validation.errors.push('Identifiant manquant (pointer ou id)');
        }
        
        if (!noteData.text || noteData.text.trim().length === 0) {
            validation.isValid = false;
            validation.errors.push('Texte de note vide');
        }
        
        // Avertissements
        if (noteData.text && noteData.text.length > 8192) {
            validation.warnings.push('Note très longue (>8KB)');
        }
        
        if (noteData.text && noteData.text.includes('\x00')) {
            validation.warnings.push('Caractères nuls détectés');
        }
        
        return validation;
    }

    /**
     * Nettoie et formate le texte d'une note
     * @param {string} text - Texte brut de la note
     * @returns {string} Texte nettoyé
     */
    cleanNoteText(text) {
        if (!text) return '';
        
        return text
            // Supprimer les caractères nuls
            .replace(/\x00/g, '')
            // Normaliser les sauts de ligne
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            // Supprimer les espaces en fin de ligne
            .replace(/[ \t]+$/gm, '')
            // Limiter les sauts de ligne multiples
            .replace(/\n{3,}/g, '\n\n')
            // Supprimer les espaces en début/fin
            .trim();
    }

    /**
     * Extrait les métadonnées d'une note
     * @param {Object} noteRecord - Enregistrement note read-gedcom
     * @returns {Object} Métadonnées de la note
     */
    extractNoteMetadata(noteRecord) {
        const metadata = {
            changeDate: null,
            language: null,
            submitter: null
        };
        
        try {
            // Date de modification
            const changeSelection = noteRecord.get('CHAN');
            if (changeSelection && changeSelection.length > 0) {
                const dateSelection = changeSelection.get('DATE');
                if (dateSelection && dateSelection.length > 0) {
                    metadata.changeDate = dateSelection.value()[0];
                }
            }
            
            // Langue (non standard mais parfois présent)
            const langSelection = noteRecord.get('LANG');
            if (langSelection && langSelection.length > 0) {
                metadata.language = langSelection.value()[0];
            }
            
            // Soumetteur
            const submSelection = noteRecord.get('SUBM');
            if (submSelection && submSelection.length > 0) {
                metadata.submitter = submSelection.value()[0];
            }
            
        } catch (error) {
            this.log(`Erreur extraction métadonnées note: ${error.message}`);
        }
        
        return metadata;
    }

    /**
     * Extrait les notes d'une famille
     * @param {Object} familySelection - Sélection read-gedcom de la famille
     * @returns {Array} Liste des notes de la famille
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
                            const fullText = this.extractNoteText(note);
                            if (fullText) {
                                notes.push({
                                    type: 'embedded',
                                    text: fullText
                                });
                            }
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
     * Statistiques sur les notes extraites
     * @param {Array} notes - Liste des notes
     * @returns {Object} Statistiques
     */
    getNoteStatistics(notes) {
        const stats = {
            total: notes.length,
            withSources: 0,
            averageLength: 0,
            maxLength: 0,
            minLength: Infinity,
            languages: new Set()
        };
        
        let totalLength = 0;
        
        notes.forEach(note => {
            if (note.sources && note.sources.length > 0) {
                stats.withSources++;
            }
            
            if (note.text) {
                const length = note.text.length;
                totalLength += length;
                stats.maxLength = Math.max(stats.maxLength, length);
                stats.minLength = Math.min(stats.minLength, length);
            }
            
            if (note.metadata && note.metadata.language) {
                stats.languages.add(note.metadata.language);
            }
        });
        
        stats.averageLength = notes.length > 0 ? Math.round(totalLength / notes.length) : 0;
        stats.minLength = stats.minLength === Infinity ? 0 : stats.minLength;
        stats.languages = Array.from(stats.languages);
        
        return stats;
    }

    /**
     * Log si mode verbose
     * @param {string} message - Message à logger
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[NoteExtractor] ${message}`);
        }
    }
}