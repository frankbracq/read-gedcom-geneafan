/**
 * TreeBuilder
 * Construit l'arbre hiérarchique à partir des tokens GEDCOM
 */

export class TreeBuilder {
    constructor(options = {}) {
        this.options = options;
    }
    
    /**
     * Construit l'arbre GEDCOM (async)
     * @param {Array} tokens - Tokens GEDCOM
     * @returns {Promise<Object>} Arbre GEDCOM
     */
    async build(tokens) {
        return this.buildSync(tokens);
    }
    
    /**
     * Construit l'arbre GEDCOM (sync)
     * @param {Array} tokens - Tokens GEDCOM
     * @returns {Object} Arbre GEDCOM
     */
    buildSync(tokens) {
        const root = {
            level: -1,
            tag: 'ROOT',
            children: [],
            records: {
                individuals: new Map(),
                families: new Map(),
                sources: new Map(),
                repositories: new Map(),
                media: new Map(),
                notes: new Map(),
                submitters: new Map()
            }
        };
        
        const stack = [root];
        let currentIndex = 0;
        
        while (currentIndex < tokens.length) {
            const token = tokens[currentIndex];
            
            // Gérer CONC et CONT
            if (token.tag === 'CONC' || token.tag === 'CONT') {
                this._handleContinuation(stack, token);
                currentIndex++;
                continue;
            }
            
            // Trouver le parent approprié dans la pile
            while (stack.length > 1 && stack[stack.length - 1].level >= token.level) {
                stack.pop();
            }
            
            const parent = stack[stack.length - 1];
            
            // Créer le nœud
            const node = {
                level: token.level,
                tag: token.tag,
                pointer: token.pointer,
                value: token.value,
                children: [],
                lineNumber: token.lineNumber
            };
            
            // Ajouter au parent
            parent.children.push(node);
            
            // Enregistrer les records principaux
            if (token.level === 0 && token.pointer) {
                this._registerRecord(root.records, node);
            }
            
            // Ajouter à la pile
            stack.push(node);
            currentIndex++;
        }
        
        // Post-traitement
        this._postProcess(root);
        
        return root;
    }
    
    /**
     * Gère CONC et CONT
     * @private
     */
    _handleContinuation(stack, token) {
        const parent = stack[stack.length - 1];
        
        if (!parent || parent.level !== token.level - 1) {
            return; // Ignorer si pas de parent valide
        }
        
        if (token.tag === 'CONC') {
            // Concaténation (sans espace)
            parent.value += token.value;
        } else if (token.tag === 'CONT') {
            // Continuation (nouvelle ligne)
            parent.value += '\n' + token.value;
        }
    }
    
    /**
     * Enregistre les records principaux
     * @private
     */
    _registerRecord(records, node) {
        switch (node.tag) {
            case 'INDI':
                records.individuals.set(node.pointer, node);
                break;
            case 'FAM':
                records.families.set(node.pointer, node);
                break;
            case 'SOUR':
                records.sources.set(node.pointer, node);
                break;
            case 'REPO':
                records.repositories.set(node.pointer, node);
                break;
            case 'OBJE':
                records.media.set(node.pointer, node);
                break;
            case 'NOTE':
                if (node.pointer) {
                    records.notes.set(node.pointer, node);
                }
                break;
            case 'SUBM':
                records.submitters.set(node.pointer, node);
                break;
        }
    }
    
    /**
     * Post-traitement de l'arbre
     * @private
     */
    _postProcess(root) {
        // Extraire les métadonnées du header
        const header = root.children.find(c => c.tag === 'HEAD');
        if (header) {
            root.metadata = this._extractMetadata(header);
        }
        
        // Compter les statistiques
        root.statistics = {
            individuals: root.records.individuals.size,
            families: root.records.families.size,
            sources: root.records.sources.size,
            media: root.records.media.size,
            notes: root.records.notes.size,
            repositories: root.records.repositories.size
        };
    }
    
    /**
     * Extrait les métadonnées du header
     * @private
     */
    _extractMetadata(header) {
        const metadata = {};
        
        // Encodage
        const charNode = this._findChild(header, 'CHAR');
        if (charNode) {
            metadata.encoding = charNode.value;
        }
        
        // Source/Software
        const sourNode = this._findChild(header, 'SOUR');
        if (sourNode) {
            metadata.software = sourNode.value;
            const versNode = this._findChild(sourNode, 'VERS');
            if (versNode) {
                metadata.version = versNode.value;
            }
        }
        
        // Date
        const dateNode = this._findChild(header, 'DATE');
        if (dateNode) {
            metadata.date = dateNode.value;
        }
        
        // Version GEDCOM
        const gedcNode = this._findChild(header, 'GEDC');
        if (gedcNode) {
            const versNode = this._findChild(gedcNode, 'VERS');
            if (versNode) {
                metadata.gedcomVersion = versNode.value;
            }
        }
        
        return metadata;
    }
    
    /**
     * Trouve un enfant par tag
     * @private
     */
    _findChild(node, tag) {
        return node.children.find(c => c.tag === tag);
    }
}