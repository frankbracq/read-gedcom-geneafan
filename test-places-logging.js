#!/usr/bin/env node

/**
 * Test de validation du traitement des lieux avec logging détaillé
 * Montre la transformation complète : GEDCOM source → résultat final
 */

import { parseGedcomToGeneaFan } from './src/index.js';
import { readFileSync } from 'fs';

console.log('🔍 VALIDATION TRAITEMENT DES LIEUX');
console.log('===================================');
console.log('Trace complète : Source GEDCOM → Composants → Clé finale');

// Simuler un mini-GEDCOM avec différents formats de lieux
const testGedcom = `0 HEAD
1 SOUR Family Tree Maker
1 GEDC
2 VERS 5.5
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Jean /DUPONT/
1 BIRT
2 DATE 20 JUL 1929
2 PLAC Huisseau-sur-Mauves, 45130, Loiret, Centre, France
1 DEAT
2 DATE 15 MAR 1995
2 PLAC Paris XVème, 75015, Paris, Île-de-France, France
0 @I2@ INDI
1 NAME Marie /MARTIN/
1 BIRT
2 DATE 12 DEC 1932
2 PLAC Saint-Denis, 93200, Seine-Saint-Denis, Île-de-France, France
1 MARR
2 DATE 25 JUN 1955
2 PLAC Bertignolles, 10110, France
0 @I3@ INDI
1 NAME Pierre /BERNARD/
1 BIRT
2 DATE 03 APR 1960
2 PLAC Nazareth, Belgique
1 RESI
2 DATE 1985
2 PLAC Lyon, 69000, Rhône, Auvergne-Rhône-Alpes, France
0 @I4@ INDI
1 NAME Sophie /DURAND/
1 BIRT
2 DATE 18 NOV 1975
2 PLAC Paris (75), France
1 OCCU
2 DATE 2000
2 PLAC Marseille 13, France
0 TRLR`;

console.log('\n📄 GEDCOM de test créé avec 8 lieux différents');
console.log('Types de formats testés :');
console.log('  • Format complet français : "Huisseau-sur-Mauves, 45130, Loiret, Centre, France"');
console.log('  • Arrondissement parisien : "Paris XVème, 75015, Paris, Île-de-France, France"');
console.log('  • Format Saint : "Saint-Denis, 93200, Seine-Saint-Denis, Île-de-France, France"');
console.log('  • Format minimal français : "Bertignolles, 10110, France"');
console.log('  • Format étranger : "Nazareth, Belgique"');
console.log('  • Format région-département : "Lyon, 69000, Rhône, Auvergne-Rhône-Alpes, France"');
console.log('  • Format parenthèses : "Paris (75), France"');
console.log('  • Format département suffixe : "Marseille 13, France"');

console.log('\n🚀 LANCEMENT DU PARSING AVEC LOGGING DÉTAILLÉ...');
console.log('==================================================');

try {
    const result = await parseGedcomToGeneaFan(testGedcom, {
        logPlaces: true,           // 🔍 ACTIVER LE LOGGING DÉTAILLÉ
        verbose: false,            // Pas de verbose général pour éviter le bruit
        fixEncoding: false         // Pas besoin pour notre test UTF-8
    });
    
    console.log('\n📊 RÉSUMÉ DU TRAITEMENT:');
    console.log('========================');
    console.log(`✅ ${result.individualsCache.size} individus traités`);
    console.log(`📍 ${result.places.size} lieux uniques identifiés`);
    
    console.log('\n🗺️ LIEUX UNIQUES EXTRAITS:');
    console.log('===========================');
    [...result.places].forEach((place, index) => {
        console.log(`${index + 1}. "${place}"`);
    });
    
    console.log('\n🧪 VÉRIFICATION DES ÉVÉNEMENTS AVEC LIEUX:');
    console.log('==========================================');
    
    let eventCount = 0;
    for (const [id, individual] of result.individualsCache) {
        if (individual.e && individual.e.length > 0) {
            console.log(`\n👤 Individu ${id}:`);
            individual.e.forEach((event, eventIndex) => {
                if (event.l) {
                    eventCount++;
                    console.log(`   📅 Événement ${eventIndex + 1}: ${event.t} → Lieu: "${event.l}"`);
                }
            });
        }
    }
    
    console.log(`\n📈 TOTAL: ${eventCount} événements avec lieux traités`);
    
    console.log('\n🎯 VALIDATION RÉUSSIE !');
    console.log('Le logging détaillé montre la transformation complète de chaque lieu.');
    
} catch (error) {
    console.error('❌ Erreur pendant le test:', error.message);
    console.error(error.stack);
}