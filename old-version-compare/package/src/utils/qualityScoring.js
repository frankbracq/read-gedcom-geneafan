/**
 * Système de scoring de qualité des données généalogiques
 * Évalue la complétude et la fiabilité des informations
 */

/**
 * Calcule le score de qualité d'un individu
 * Score sur 100 basé sur plusieurs critères
 * @param {Object} individual - Données individuelles enrichies
 * @returns {Object} Score détaillé
 */
export function calculateQualityScore(individual) {
    if (!individual) {
        return { score: 0, details: { error: 'No individual data' } };
    }
    
    const scoring = {
        identity: 0,        // 25 points max - Identité de base
        events: 0,          // 25 points max - Événements de vie
        sources: 0,         // 20 points max - Sources documentaires
        relations: 0,       // 15 points max - Relations familiales
        multimedia: 0,      // 10 points max - Médias attachés
        completeness: 0     // 5 points max - Complétude générale
    };
    
    const details = {};
    
    // === 1. IDENTITÉ DE BASE (25 points) ===
    let identityScore = 0;
    
    // Nom complet (10 points)
    if (individual.name) {
        if (individual.name.given && individual.name.surname) {
            identityScore += 10;
            details.name = 'Nom complet disponible';
        } else if (individual.name.given || individual.name.surname) {
            identityScore += 5;
            details.name = 'Nom partiel';
        }
    }
    
    // Sexe (3 points)
    if (individual.sex && individual.sex !== 'U') {
        identityScore += 3;
        details.sex = 'Sexe défini';
    }
    
    // Dates vitales (12 points)
    const birthEvent = findEvent(individual.events, 'birth');
    const deathEvent = findEvent(individual.events, 'death');
    
    if (birthEvent?.date) {
        identityScore += 6;
        details.birth = 'Date de naissance';
        
        // Bonus pour lieu de naissance
        if (birthEvent.place) {
            identityScore += 2;
            details.birthPlace = 'Lieu de naissance';
        }
    }
    
    if (deathEvent?.date) {
        identityScore += 4;
        details.death = 'Date de décès';
    }
    
    scoring.identity = Math.min(identityScore, 25);
    
    // === 2. ÉVÉNEMENTS DE VIE (25 points) ===
    let eventsScore = 0;
    
    if (individual.events && Array.isArray(individual.events)) {
        const eventCount = individual.events.length;
        const eventTypes = new Set(individual.events.map(e => e.type));
        
        // Points par événement (max 15)
        eventsScore += Math.min(eventCount * 2, 15);
        
        // Bonus diversité d'événements (max 5)
        eventsScore += Math.min(eventTypes.size, 5);
        
        // Bonus événements clés (max 5)
        const keyEvents = ['marriage', 'occupation', 'residence', 'military-service'];
        const hasKeyEvents = keyEvents.filter(type => eventTypes.has(type)).length;
        eventsScore += hasKeyEvents;
        
        details.events = {
            count: eventCount,
            types: eventTypes.size,
            keyEvents: hasKeyEvents
        };
    }
    
    scoring.events = Math.min(eventsScore, 25);
    
    // === 3. SOURCES DOCUMENTAIRES (20 points) ===
    let sourcesScore = 0;
    
    if (individual.sources && Array.isArray(individual.sources)) {
        const sourceCount = individual.sources.length;
        
        // Points par source (max 15)
        sourcesScore += Math.min(sourceCount * 5, 15);
        
        // Bonus sources multiples (max 5)
        if (sourceCount >= 3) {
            sourcesScore += 5;
            details.sources = 'Sources multiples (fiabilité élevée)';
        } else if (sourceCount >= 1) {
            sourcesScore += sourceCount;
            details.sources = `${sourceCount} source(s)`;
        }
    }
    
    scoring.sources = Math.min(sourcesScore, 20);
    
    // === 4. RELATIONS FAMILIALES (15 points) ===
    let relationsScore = 0;
    
    // Parents (6 points)
    let parentCount = 0;
    if (individual.familyAsChild && individual.familyAsChild.length > 0) {
        // Compter via relations familiales
        parentCount = 2; // Approximation
        relationsScore += 6;
        details.parents = 'Parents identifiés';
    }
    
    // Conjoints (4 points)
    if (individual.familyAsSpouse && individual.familyAsSpouse.length > 0) {
        relationsScore += 4;
        details.spouse = 'Conjoint(s) identifié(s)';
    }
    
    // Enfants (3 points)
    const childEvents = individual.events?.filter(e => e.type === 'child-birth') || [];
    if (childEvents.length > 0) {
        relationsScore += 3;
        details.children = `${childEvents.length} enfant(s)`;
    }
    
    // Fratrie (2 points)
    // Note: À calculer via les relations familiales
    
    scoring.relations = Math.min(relationsScore, 15);
    
    // === 5. MULTIMEDIA (10 points) ===
    let multimediaScore = 0;
    
    if (individual.multimedia && Array.isArray(individual.multimedia)) {
        const mediaCount = individual.multimedia.length;
        multimediaScore += Math.min(mediaCount * 3, 10);
        
        details.multimedia = `${mediaCount} média(s)`;
    }
    
    scoring.multimedia = Math.min(multimediaScore, 10);
    
    // === 6. COMPLÉTUDE GÉNÉRALE (5 points) ===
    let completenessScore = 0;
    
    // Bonus notes personnelles
    if (individual.notes && individual.notes.length > 0) {
        completenessScore += 2;
        details.notes = 'Notes disponibles';
    }
    
    // Bonus données enrichies
    const enrichedFields = ['occupations', 'education', 'addresses', 'identifiers'];
    const hasEnriched = enrichedFields.filter(field => 
        individual[field] && (Array.isArray(individual[field]) ? 
            individual[field].length > 0 : 
            Object.keys(individual[field]).length > 0)
    ).length;
    
    completenessScore += Math.min(hasEnriched, 3);
    
    scoring.completeness = Math.min(completenessScore, 5);
    
    // === CALCUL FINAL ===
    const totalScore = Object.values(scoring).reduce((sum, score) => sum + score, 0);
    
    // Déterminer le niveau de qualité
    let level = 'poor';
    if (totalScore >= 80) level = 'excellent';
    else if (totalScore >= 60) level = 'good';
    else if (totalScore >= 40) level = 'fair';
    
    return {
        score: totalScore,
        level,
        breakdown: scoring,
        details,
        recommendations: generateRecommendations(scoring, individual)
    };
}

/**
 * Trouve un événement par type
 * @private
 */
function findEvent(events, type) {
    if (!Array.isArray(events)) return null;
    return events.find(e => e.type === type);
}

/**
 * Génère des recommandations d'amélioration
 * @private
 */
function generateRecommendations(scoring, individual) {
    const recommendations = [];
    
    if (scoring.identity < 20) {
        recommendations.push({
            category: 'identity',
            priority: 'high',
            message: 'Compléter les informations d\'identité de base',
            actions: ['Ajouter nom complet', 'Préciser dates de naissance/décès']
        });
    }
    
    if (scoring.sources < 10) {
        recommendations.push({
            category: 'sources',
            priority: 'high',
            message: 'Ajouter des sources documentaires',
            actions: ['Citer actes d\'état civil', 'Référencer archives consultées']
        });
    }
    
    if (scoring.events < 15) {
        recommendations.push({
            category: 'events',
            priority: 'medium',
            message: 'Enrichir l\'historique de vie',
            actions: ['Ajouter profession', 'Documenter mariages', 'Préciser résidences']
        });
    }
    
    if (scoring.relations < 10) {
        recommendations.push({
            category: 'relations',
            priority: 'medium',
            message: 'Compléter les relations familiales',
            actions: ['Identifier parents', 'Renseigner descendants']
        });
    }
    
    if (scoring.multimedia === 0) {
        recommendations.push({
            category: 'multimedia',
            priority: 'low',
            message: 'Ajouter des documents multimédias',
            actions: ['Joindre photos', 'Scanner actes', 'Ajouter cartes postales']
        });
    }
    
    return recommendations;
}

/**
 * Calcule le score de qualité global d'un cache d'individus
 * @param {Map} individualsCache - Cache des individus
 * @returns {Object} Statistiques globales
 */
export function calculateCacheQualityStats(individualsCache) {
    if (!individualsCache || individualsCache.size === 0) {
        return { error: 'Cache vide' };
    }
    
    const scores = [];
    const levels = { excellent: 0, good: 0, fair: 0, poor: 0 };
    const categories = {
        identity: [],
        events: [],
        sources: [],
        relations: [],
        multimedia: []
    };
    
    // Analyser chaque individu
    for (const individual of individualsCache.values()) {
        const quality = calculateQualityScore(individual);
        scores.push(quality.score);
        levels[quality.level]++;
        
        // Collecter scores par catégorie
        for (const [category, score] of Object.entries(quality.breakdown)) {
            if (categories[category]) {
                categories[category].push(score);
            }
        }
    }
    
    // Calculer moyennes par catégorie
    const categoryAverages = {};
    for (const [category, scoreList] of Object.entries(categories)) {
        if (scoreList.length > 0) {
            categoryAverages[category] = {
                average: scoreList.reduce((sum, score) => sum + score, 0) / scoreList.length,
                min: Math.min(...scoreList),
                max: Math.max(...scoreList)
            };
        }
    }
    
    return {
        totalIndividuals: individualsCache.size,
        
        // Scores globaux
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
        minScore: Math.min(...scores),
        maxScore: Math.max(...scores),
        
        // Distribution par niveau
        distribution: {
            excellent: { count: levels.excellent, percent: (levels.excellent / individualsCache.size * 100).toFixed(1) },
            good: { count: levels.good, percent: (levels.good / individualsCache.size * 100).toFixed(1) },
            fair: { count: levels.fair, percent: (levels.fair / individualsCache.size * 100).toFixed(1) },
            poor: { count: levels.poor, percent: (levels.poor / individualsCache.size * 100).toFixed(1) }
        },
        
        // Moyennes par catégorie
        categories: categoryAverages,
        
        // Recommandations globales
        globalRecommendations: generateGlobalRecommendations(categoryAverages, levels, individualsCache.size)
    };
}

/**
 * Génère des recommandations globales pour le fichier
 * @private
 */
function generateGlobalRecommendations(categories, levels, totalCount) {
    const recommendations = [];
    
    // Problème majeur de sources
    if (categories.sources && categories.sources.average < 10) {
        recommendations.push({
            priority: 'high',
            message: 'Manque critique de sources documentaires',
            impact: `${Math.round((totalCount - levels.excellent - levels.good) / totalCount * 100)}% des individus manquent de sources fiables`,
            action: 'Priorité à la citation des actes d\'état civil et archives'
        });
    }
    
    // Identités incomplètes
    if (categories.identity && categories.identity.average < 15) {
        recommendations.push({
            priority: 'high',
            message: 'Identités de base incomplètes',
            action: 'Compléter noms, dates et lieux de naissance'
        });
    }
    
    // Faible diversité d'événements
    if (categories.events && categories.events.average < 12) {
        recommendations.push({
            priority: 'medium',
            message: 'Historiques de vie peu détaillés',
            action: 'Enrichir avec professions, résidences, événements familiaux'
        });
    }
    
    // Potentiel multimédia
    if (categories.multimedia && categories.multimedia.average < 3) {
        recommendations.push({
            priority: 'low',
            message: 'Potentiel multimédia inexploité',
            action: 'Ajouter photos de famille et documents numérisés'
        });
    }
    
    return recommendations;
}