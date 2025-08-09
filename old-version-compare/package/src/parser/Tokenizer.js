/**
 * Tokenizer GEDCOM
 * Découpe le fichier en tokens (lignes GEDCOM structurées)
 */

export class Tokenizer {
    constructor(options = {}) {
        this.options = options;
    }
    
    /**
     * Tokenise le texte GEDCOM (async)
     * @param {string} text - Texte GEDCOM
     * @returns {Promise<Array>} Tokens
     */
    async tokenize(text) {
        return this.tokenizeSync(text);
    }
    
    /**
     * Tokenise le texte GEDCOM (sync)
     * @param {string} text - Texte GEDCOM
     * @returns {Array} Tokens
     */
    tokenizeSync(text) {
        const lines = text.split(/\r?\n/);
        const tokens = [];
        let lineNumber = 0;
        
        for (const line of lines) {
            lineNumber++;
            
            // Ignorer les lignes vides
            if (!line.trim()) continue;
            
            // Parser la ligne GEDCOM : NIVEAU [POINTEUR] TAG [VALEUR]
            const match = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)(\s+(.*))?$/);
            
            if (!match) {
                if (this.options.strict) {
                    throw new Error(`Ligne GEDCOM invalide à la ligne ${lineNumber}: ${line}`);
                }
                continue; // Ignorer en mode non-strict
            }
            
            const [, level, pointer, tag, , value] = match;
            
            tokens.push({
                level: parseInt(level, 10),
                pointer: pointer ? pointer.trim() : null,
                tag: tag.toUpperCase(),
                value: value || '',
                lineNumber,
                raw: line
            });
        }
        
        // Validation basique
        if (tokens.length === 0) {
            throw new Error('Aucun token GEDCOM trouvé');
        }
        
        if (tokens[0].tag !== 'HEAD') {
            throw new Error('Le fichier GEDCOM doit commencer par HEAD');
        }
        
        if (tokens[tokens.length - 1].tag !== 'TRLR') {
            throw new Error('Le fichier GEDCOM doit se terminer par TRLR');
        }
        
        return tokens;
    }
}