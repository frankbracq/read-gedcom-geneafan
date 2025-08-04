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

console.log('\n🎉 Tests terminés !');