#!/usr/bin/env node

/**
 * Test spécifique du cas problématique identifié
 * "Nomain,59310,Nord,Nord-Pas-de-Calais,FRANCE,"
 */

import { extractPlaceComponents, normalizePlace } from './src/utils/geoUtils.js';

console.log('🔍 TEST CAS PROBLÉMATIQUE SPÉCIFIQUE');
console.log('====================================');

const problematicPlace = "Nomain,59310,Nord,Nord-Pas-de-Calais,FRANCE,";

console.log(`📍 Source GEDCOM problématique: "${problematicPlace}"`);
console.log('\n🛠️  AVANT correction (logique naïve):');
console.log('   🏘️  Ville: "Nomain"');
console.log('   📮 Code postal: 59310'); 
console.log('   🗺️  Département: FRANCE (❌ ERREUR!)');
console.log('   🌍 Région: Nord-Pas-de-Calais');
console.log('   🌐 Pays: N/A (❌ ERREUR!)');

console.log('\n🚀 APRÈS correction (logique sophistiquée):');
const components = extractPlaceComponents(problematicPlace);
const normalized = normalizePlace(problematicPlace);

console.log(`   🏘️  Ville détectée: "${components.town}"`);
console.log(`   📮 Code postal: ${components.postalCode || "❌ Non détecté"}`);
console.log(`   🗺️  Département: ${components.department || "❌ Non détecté"}`);
console.log(`   🌍 Région: ${components.region || "❌ Non détecté"}`);
console.log(`   🌐 Pays: ${components.country || "❌ Non détecté"}`);
console.log(`   🔑 Clé finale: "${normalized}"`);

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

console.log(`\n📊 Qualité résultat: ${qualityLevel} (${qualityScore}/100)`);
console.log(`   Détails: ${qualityDetails.join(", ")}`);

console.log('\n🎯 VALIDATION:');
if (components.country === "France" && components.department === "Nord" && components.postalCode === "59310") {
    console.log('✅ SUCCÈS: Pays = France, Département = Nord, Code postal = 59310');
    console.log('✅ Le problème a été résolu avec la logique sophistiquée !');
} else {
    console.log('❌ ÉCHEC: La logique doit encore être améliorée');
    console.log(`   Attendu: Pays=France, Département=Nord, Code=59310`);
    console.log(`   Obtenu: Pays=${components.country}, Département=${components.department}, Code=${components.postalCode}`);
}

console.log('\n🧪 Tests supplémentaires avec variations:');
console.log('=========================================');

const testCases = [
    "Fourmies (59), France",
    "Lille, 59000, Nord, Hauts-de-France, France", 
    "Nomain, 59310, Nord, Nord-Pas-de-Calais, FRANCE",
    "Paris (75), France",
    "Marseille 13, Bouches-du-Rhône, France"
];

testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. "${testCase}"`);
    const comp = extractPlaceComponents(testCase);
    console.log(`   → Pays: ${comp.country || "N/A"}, Département: ${comp.department || "N/A"}, Code: ${comp.postalCode || "N/A"}`);
});

console.log('\n🎉 Test terminé !');