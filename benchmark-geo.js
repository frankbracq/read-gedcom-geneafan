#!/usr/bin/env node

/**
 * Benchmark des performances de normalisation géographique
 */

import { normalizePlace, normalizePlacesBatch, clearNormalizationCache, getCacheStats } from './src/utils/geoUtils.js';

const places = [
    'Huisseau-sur-Mauves, 45130, Loiret, Centre, France',
    'Paris XVème, 75015, Paris, Île-de-France, France', 
    'Saint-Denis, 93200, Seine-Saint-Denis, Île-de-France, France',
    'Bertignolles, 10110, France',
    'Lyon, 69000, Rhône, Auvergne-Rhône-Alpes, France',
    'Nazareth, Belgique',
    'Paris (75), France',
    'Marseille 13, France'
];

console.log('🚀 Benchmark normalisation géographique geoUtils.js');
console.log('===============================================');

// Test 1: Normalisation simple
console.time('Normalisation 1000x8 lieux');
for(let i = 0; i < 1000; i++) {
    places.forEach(place => normalizePlace(place));
}
console.timeEnd('Normalisation 1000x8 lieux');

// Test 2: Simulation GEDCOM réel (247 individus × 2-3 lieux moyens)
const realWorldPlaces = [];
for(let i = 0; i < 247; i++) {
    realWorldPlaces.push(...places.slice(0, Math.floor(Math.random() * 3) + 1));
}

console.log(`\n📊 Simulation GEDCOM réel: ${realWorldPlaces.length} lieux`);
console.time('Simulation GEDCOM réel');
realWorldPlaces.forEach(place => normalizePlace(place));
console.timeEnd('Simulation GEDCOM réel');

// Test 3: Performance par lieu individuel
console.log('\n🔍 Performance par lieu:');
places.forEach(place => {
    console.time(`Lieu: "${place.substring(0, 30)}..."`);
    for(let i = 0; i < 100; i++) {
        normalizePlace(place);
    }
    console.timeEnd(`Lieu: "${place.substring(0, 30)}..."`);
});

// Test 4: Performance avec cache (simulation de lieux répétés)
console.log('\n🚀 Test avec cache (lieux répétés):');
clearNormalizationCache();

const repeatedPlaces = [];
for(let i = 0; i < 100; i++) {
    repeatedPlaces.push(...places); // 800 lieux (100×8)
}

console.time('800 lieux avec cache');
repeatedPlaces.forEach(place => normalizePlace(place));
console.timeEnd('800 lieux avec cache');
console.log('📊 Stats cache:', getCacheStats());

// Test 5: Batch processing
console.log('\n🚀 Test batch processing:');
clearNormalizationCache();

console.time('Batch 800 lieux');
const batchResults = normalizePlacesBatch(repeatedPlaces);
console.timeEnd('Batch 800 lieux');
console.log(`📈 Résultats batch: ${batchResults.size} lieux uniques traités`);

console.log('\n✅ Benchmark terminé avec optimisations cache !');