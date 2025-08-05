/**
 * logger.js - Système de logging centralisé pour read-gedcom-geneafan
 */

// 🔇 Configuration globale des logs
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1, 
    INFO: 2,
    DEBUG: 3
};

// Par défaut, seuls les erreurs et warnings en production
const CURRENT_LOG_LEVEL = LOG_LEVELS.WARN;

/**
 * Logger centralisé
 */
export const logger = {
    error: (module, message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
            console.error(`❌ [${module}] ${message}`, ...args);
        }
    },
    
    warn: (module, message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
            console.warn(`⚠️ [${module}] ${message}`, ...args);
        }
    },
    
    info: (module, message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
            console.log(`ℹ️ [${module}] ${message}`, ...args);
        }
    },
    
    debug: (module, message, ...args) => {
        if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
            console.log(`🔍 [${module}] ${message}`, ...args);
        }
    }
};

/**
 * Helper pour les logs de performance
 */
export const perfLogger = {
    start: (operation) => {
        return {
            operation,
            startTime: Date.now(),
            end: function(module) {
                const duration = Date.now() - this.startTime;
                logger.info(module, `✅ ${this.operation} terminé en ${duration}ms`);
                return duration;
            }
        };
    }
};