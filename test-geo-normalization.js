#!/usr/bin/env node

/**
 * Test de la normalisation géographique avec parsePlaceParts + logique GeneaFan
 */

import { normalizePlace, extractPlaceComponents } from './src/utils/geoUtils.js';

console.log('🧪 Test de normalisation géographique read-gedcom-geneafan');
console.log('================================================================');

const testPlaces = [
    "Huisseau-sur-Mauves, 45130, Loiret, Centre, France",
    "Paris XVème, 75015, Paris, Île-de-France, France",
    "Saint-Denis, 93200, Seine-Saint-Denis, Île-de-France, France",
    "Bertignolles, 10110, France",
    "Lyon, 69000, Rhône, Auvergne-Rhône-Alpes, France",
    "Nazareth, Belgique",
    "Paris (75), France",
    "Marseille 13, France"
];

console.log('\n🔍 Tests de normalisation:');
console.log('=============================');

testPlaces.forEach((place, index) => {
    console.log(`\n${index + 1}. "${place}"`);
    
    try {
        const normalized = normalizePlace(place);
        const components = extractPlaceComponents(place);
        
        console.log(`   ✅ Clé normalisée: "${normalized}"`);
        console.log(`   📍 Ville: "${components.town}"`);
        console.log(`   📮 Code postal: "${components.postalCode}"`);
        console.log(`   🗺️  Département: "${components.department}"`);
        console.log(`   🌍 Pays: "${components.country}"`);
        
    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
    }
});

console.log('\n🎯 Comparaison avec ancien système:');
console.log('====================================');

const problematicPlace = "Huisseau-sur-Mauves, 45130, Loiret, Centre, France";
console.log(`\nLieu: "${problematicPlace}"`);

// Ancien système (normalization brute)
const oldNormalization = problematicPlace.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

console.log(`❌ Ancien: "${oldNormalization}"`);
console.log(`✅ Nouveau: "${normalizePlace(problematicPlace)}"`);

console.log('\n🔍 Test détaillé des composants géographiques:');
console.log('===================================================');

const detailedPlaces = [
    "Huisseau-sur-Mauves, 45130, Loiret, Centre, France",
    "Paris XVème, 75015, Paris, Île-de-France, France", 
    "Saint-Denis, 93200, Seine-Saint-Denis, Île-de-France, France",
    "Bertignolles, 10110, France",
    "Lyon, 69000, Rhône, Auvergne-Rhône-Alpes, France",
    "Nazareth, Belgique",
    "Paris (75), France",
    "Marseille 13, France",
    "Vincennes, Val-de-Marne, Île-de-France, France",
    "New York, NY, USA",
    "Londres, Angleterre, Royaume-Uni",
    "Montréal, Québec, Canada"
];

detailedPlaces.forEach((place, index) => {
    console.log(`\n${index + 1}. 📍 "${place}"`);
    
    try {
        const components = extractPlaceComponents(place);
        
        console.log(`   🏘️  Ville détectée: "${components.town}"`);
        console.log(`   📮 Code postal: ${components.postalCode || "❌ Non détecté"}`);
        console.log(`   🗺️  Département: ${components.department || "❌ Non détecté"}`);
        console.log(`   🌍 Région: ${components.region || "❌ Non détecté"}`);
        console.log(`   🌐 Pays: ${components.country || "❌ Non détecté"}`);
        console.log(`   🔑 Clé normalisée: "${components.normalizedKey}"`);
        
        // Analyse de la qualité
        let qualityScore = 0;
        let qualityDetails = [];
        
        if (components.town) { qualityScore += 30; qualityDetails.push("Ville ✅"); }
        if (components.postalCode) { qualityScore += 20; qualityDetails.push("Code postal ✅"); }
        if (components.department) { qualityScore += 25; qualityDetails.push("Département ✅"); }
        if (components.country) { qualityScore += 25; qualityDetails.push("Pays ✅"); }
        
        const qualityLevel = qualityScore >= 80 ? "🟢 Excellent" : 
                           qualityScore >= 60 ? "🟡 Bon" : 
                           qualityScore >= 40 ? "🟠 Moyen" : "🔴 Faible";
        
        console.log(`   📊 Qualité: ${qualityLevel} (${qualityScore}/100) - ${qualityDetails.join(", ")}`);
        
    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
    }
});

console.log('\n🔍 Comparaison avec placeProcessor GeneaFan:');
console.log('==============================================');

// Test spécifique pour le lieu problématique
const problematicPlace2 = "Huisseau-sur-Mauves, 45130, Loiret, Centre, France";
console.log(`\n📍 Lieu test: "${problematicPlace2}"`);

const ourComponents = extractPlaceComponents(problematicPlace2);
console.log('\n✅ Notre nouvelle approche (parsePlaceParts + geoUtils):');
console.log(`   Ville: "${ourComponents.town}"`);
console.log(`   Code postal: "${ourComponents.postalCode}"`);
console.log(`   Département: "${ourComponents.department}"`);
console.log(`   Région: "${ourComponents.region}"`);
console.log(`   Pays: "${ourComponents.country}"`);
console.log(`   Clé: "${ourComponents.normalizedKey}"`);

// Simulation de l'ancienne approche placeProcessor
console.log('\n🔄 Ancienne approche placeProcessor:');
const segments = problematicPlace2.split(/\s*,\s*/);
console.log(`   Segments bruts: [${segments.map(s => `"${s}"`).join(", ")}]`);
console.log(`   Ville (segment[0]): "${segments[0]}"`);
console.log(`   Code postal: ${segments[1] || "❌ Non détecté clairement"}`);
console.log(`   Département: ${segments[2] || "❌ Non détecté clairement"}`);
console.log(`   Région: ${segments[3] || "❌ Non détecté clairement"}`);
console.log(`   Pays: ${segments[4] || "❌ Non détecté clairement"}`);

console.log('\n🎯 Comparaison finale:');
console.log('====================');
console.log('✅ parsePlaceParts + geoUtils: Plus précis, détection intelligente');
console.log('🔄 placeProcessor segments: Plus simple, mais moins fiable pour les formats complexes');

console.log('\n🎉 Tests terminés !');