/**
 * MediaExtractor - Extraction des médias GEDCOM
 * 
 * Ce module gère l'extraction de tous les éléments multimédias :
 * - Enregistrements multimedia (OBJE records)
 * - Fichiers, formats, et métadonnées
 * - Notes et sources des médias
 * - Références individuelles aux médias
 * - Données BLOB embarquées
 */

export class MediaExtractor {
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
     * Extrait tous les médias (OBJE records) du GEDCOM
     * @param {Object} rootSelection - Sélection racine read-gedcom
     * @returns {Array} Liste des médias extraits
     */
    extractMedia(rootSelection) {
        const mediaList = [];
        
        try {
            const multimediaRecords = rootSelection.getMultimediaRecord().arraySelect();
            // Log de synthèse uniquement
            this.log(`Extraction de ${multimediaRecords.length} enregistrements MULTIMEDIA...`);
            
            for (let i = 0; i < multimediaRecords.length; i++) {
                const mediaRecord = multimediaRecords[i];
                const mediaData = this.extractSingleMedia(mediaRecord);
                if (mediaData) {
                    mediaList.push(mediaData);
                }
            }
            
        } catch (error) {
            this.log(`Erreur extraction médias: ${error.message}`);
        }
        
        return mediaList;
    }

    /**
     * Extrait un enregistrement MULTIMEDIA complet
     * @param {Object} mediaRecord - Enregistrement multimedia read-gedcom
     * @returns {Object|null} Données du média extraites
     */
    extractSingleMedia(mediaRecord) {
        try {
            const pointer = mediaRecord.pointer()[0];
            if (!pointer) return null;
            
            // Extraction silencieuse (log désactivé pour éviter la pollution)
            // this.log(`   Extraction média ${pointer}...`);
            
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
            const format = this.extractMediaFormat(mediaRecord);
            
            const mediaData = {
                pointer,
                file,
                title,
                format,
                notes: this.extractMediaNotes(mediaRecord),
                sources: this.extractMediaSources(mediaRecord),
                
                // Données additionnelles
                hasBlob: this.hasMediaBlob(mediaRecord),
                type: this.getMediaType(format, file)
            };
            
            // Log désactivé pour éviter la pollution console
            // this.log(`   ✅ Média ${pointer}: ${title || 'Sans titre'} (${format || 'format inconnu'})`);
            return mediaData;
            
        } catch (error) {
            this.log(`Erreur extraction média individuel: ${error.message}`);
            return null;
        }
    }

    /**
     * Extrait le format d'un média
     * @param {Object} mediaRecord - Enregistrement multimedia read-gedcom
     * @returns {string|null} Format du média
     */
    extractMediaFormat(mediaRecord) {
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
            this.log(`Erreur extraction format média: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Extrait les références aux médias d'un individu
     * @param {Object} individualSelection - Sélection read-gedcom de l'individu
     * @returns {Array} Liste des références aux médias
     */
    extractIndividualMediaRefs(individualSelection) {
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
            this.log(`Erreur extraction références médias individu: ${error.message}`);
        }
        
        return mediaRefs;
    }

    /**
     * Extrait les médias d'un événement ou attribut
     * @param {Object} eventSelection - Sélection read-gedcom de l'événement
     * @returns {Array} Liste des médias de l'événement
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
     * Extrait les notes d'un enregistrement MULTIMEDIA
     * @param {Object} mediaRecord - Enregistrement multimedia read-gedcom
     * @returns {Array} Liste des notes du média
     */
    extractMediaNotes(mediaRecord) {
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
            this.log(`Erreur extraction notes média: ${error.message}`);
        }
        
        return notes;
    }

    /**
     * Extrait les sources d'un enregistrement MULTIMEDIA
     * @param {Object} mediaRecord - Enregistrement multimedia read-gedcom
     * @returns {Array} Liste des sources du média
     */
    extractMediaSources(mediaRecord) {
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
            this.log(`Erreur extraction sources média: ${error.message}`);
        }
        
        return sources;
    }

    /**
     * Vérifie si un média a des données BLOB embarquées
     * @param {Object} mediaRecord - Enregistrement multimedia read-gedcom
     * @returns {boolean} True si le média a des données BLOB
     */
    hasMediaBlob(mediaRecord) {
        try {
            const blobSelection = mediaRecord.get('BLOB');
            return blobSelection && blobSelection.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Détermine le type de média à partir du format et du fichier
     * @param {string} format - Format du média
     * @param {string} file - Nom du fichier
     * @returns {string} Type de média (image, audio, video, document, url, other, unknown)
     */
    getMediaType(format, file) {
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
     * Extrait les informations détaillées d'un fichier média
     * @param {Object} fileSelection - Sélection read-gedcom du fichier
     * @returns {Object} Informations détaillées du fichier
     */
    extractFileDetails(fileSelection) {
        const fileDetails = {
            filename: null,
            format: null,
            title: null,
            size: null,
            checksum: null
        };
        
        try {
            // Nom du fichier
            if (fileSelection.length > 0) {
                fileDetails.filename = fileSelection.value()[0];
            }
            
            // Format (FORM)
            const formSelection = fileSelection.get('FORM');
            if (formSelection && formSelection.length > 0) {
                fileDetails.format = formSelection.value()[0];
            }
            
            // Titre (TITL)
            const titleSelection = fileSelection.get('TITL');
            if (titleSelection && titleSelection.length > 0) {
                fileDetails.title = titleSelection.value()[0];
            }
            
            // Taille (SIZE) - non standard mais parfois présent
            const sizeSelection = fileSelection.get('SIZE');
            if (sizeSelection && sizeSelection.length > 0) {
                fileDetails.size = parseInt(sizeSelection.value()[0]);
            }
            
            // Checksum (CHKS) - non standard mais parfois présent
            const checksumSelection = fileSelection.get('CHKS');
            if (checksumSelection && checksumSelection.length > 0) {
                fileDetails.checksum = checksumSelection.value()[0];
            }
            
        } catch (error) {
            this.log(`Erreur extraction détails fichier: ${error.message}`);
        }
        
        return fileDetails;
    }

    /**
     * Extrait les données BLOB d'un média
     * @param {Object} mediaRecord - Enregistrement multimedia read-gedcom
     * @returns {Object|null} Données BLOB extraites
     */
    extractBlobData(mediaRecord) {
        try {
            const blobSelection = mediaRecord.get('BLOB');
            if (blobSelection && blobSelection.length > 0) {
                const blobData = {
                    data: [],
                    encoding: null
                };
                
                // Extraire les données BLOB (peuvent être sur plusieurs lignes)
                blobSelection.arraySelect().forEach(blob => {
                    const blobValue = blob.value()[0];
                    if (blobValue) {
                        blobData.data.push(blobValue);
                    }
                });
                
                // Vérifier l'encodage (généralement base64)
                const encodingSelection = blobSelection.get('ENCO');
                if (encodingSelection && encodingSelection.length > 0) {
                    blobData.encoding = encodingSelection.value()[0];
                }
                
                return blobData;
            }
        } catch (error) {
            this.log(`Erreur extraction données BLOB: ${error.message}`);
        }
        
        return null;
    }

    /**
     * Valide l'intégrité d'un média
     * @param {Object} mediaData - Données du média
     * @returns {Object} Résultat de validation
     */
    validateMedia(mediaData) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Vérifications de base
        if (!mediaData.pointer) {
            validation.isValid = false;
            validation.errors.push('Pointeur manquant');
        }
        
        if (!mediaData.file && !mediaData.hasBlob) {
            validation.isValid = false;
            validation.errors.push('Aucun fichier ni données BLOB');
        }
        
        // Avertissements
        if (!mediaData.title) {
            validation.warnings.push('Titre manquant');
        }
        
        if (!mediaData.format) {
            validation.warnings.push('Format non spécifié');
        }
        
        if (mediaData.file && mediaData.type === 'url') {
            validation.warnings.push('Référence URL - vérifier la disponibilité');
        }
        
        return validation;
    }

    /**
     * Log si mode verbose
     * @param {string} message - Message à logger
     */
    log(message) {
        if (this.options.verbose) {
            console.log(`[MediaExtractor] ${message}`);
        }
    }
}