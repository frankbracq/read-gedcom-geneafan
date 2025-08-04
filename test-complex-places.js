#!/usr/bin/env node

/**
 * Test des cas complexes de lieux géographiques
 */

import { extractPlaceComponents, normalizePlace } from './src/utils/geoUtils.js';

console.log('🔍 TEST CAS COMPLEXES DE LIEUX');
console.log('================================');

const complexCases = [
    "Humacao,,,Porto Rico,USA,PORTO RICO / USA",
    "New York, NY, USA",
    "Montréal, Québec, Canada",
    "Strasbourg, Bas-Rhin, Grand Est, France",
    "Monaco, Monaco",
    "San Juan, Puerto Rico, USA",
    "Londres, England, United Kingdom",
    "Berlin, Berlin, Deutschland",
    "Genève, Genève, Suisse",
    "Casablanca, Maroc"
];

console.log('🧪 Analyse des cas complexes:');
console.log('=============================\n');

complexCases.forEach((place, index) => {
    console.log(`${index + 1}. 📍 "${place}"`);
    
    const components = extractPlaceComponents(place);
    const normalized = normalizePlace(place);
    
    console.log(`   🏘️  Ville: "${components.town || 'N/A'}"`);
    console.log(`   📮 Code postal: ${components.postalCode || 'N/A'}`);
    console.log(`   🗺️  Département: ${components.department || 'N/A'}`);
    console.log(`   🌍 Région: ${components.region || 'N/A'}`);
    console.log(`   🌐 Pays: ${components.country || 'N/A'}`);
    console.log(`   🔑 Clé: "${normalized}"`);
    
    // Analyse du problème
    if (!components.country && place.toLowerCase().includes('usa')) {
        console.log(`   ⚠️  PROBLÈME: USA non détecté comme pays!`);
    }
    if (place.includes('Porto Rico') && components.country !== 'USA') {
        console.log(`   ⚠️  PROBLÈME: Porto Rico devrait avoir USA comme pays!`);
    }
    
    console.log('');
});

console.log('\n📊 ANALYSE DU CAS PORTO RICO:');
console.log('==============================');

const portoRicoCase = "Humacao,,,Porto Rico,USA,PORTO RICO / USA";
console.log(`📍 Source: "${portoRicoCase}"`);

// Analyse détaillée
const parts = portoRicoCase.split(',').map(p => p.trim()).filter(p => p);
console.log(`\n🔍 Segments après split et nettoyage:`);
parts.forEach((part, i) => {
    console.log(`   [${i}] "${part}"`);
});

console.log(`\n💡 LOGIQUE IDÉALE:`);
console.log(`   1. Détecter "USA" dans n'importe quel segment`);
console.log(`   2. Reconnaître "Porto Rico" / "Puerto Rico" comme territoire US`);
console.log(`   3. Gérer les segments vides (,,)`);
console.log(`   4. Ignorer les doublons comme "PORTO RICO / USA"`);

console.log(`\n🎯 RÉSULTAT ATTENDU:`);
console.log(`   Ville: Humacao`);
console.log(`   Département/État: Porto Rico`);
console.log(`   Pays: USA`);

console.log('\n🔧 AMÉLIORATIONS NÉCESSAIRES:');
console.log('============================');
console.log('1. Ajouter "USA" et variantes (US, U.S.A., États-Unis) à la détection pays');
console.log('2. Gérer les territoires (Porto Rico → USA, Gibraltar → UK, etc.)');
console.log('3. Filtrer les segments vides avant traitement');
console.log('4. Détecter et ignorer les doublons/répétitions');
console.log('5. Gérer les abréviations d\'états US (NY, CA, TX, etc.)');

console.log('\n🎉 Test terminé!');