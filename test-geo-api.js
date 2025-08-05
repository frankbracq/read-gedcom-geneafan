#!/usr/bin/env node

/**
 * Test simple de l'API geo-data et des nouvelles fonctionnalités
 */

import { extractPlaceComponents, normalizePlace, formatDisplayString, extractGeolocation } from './src/utils/geoUtils.js';

console.log('🧪 Test de l\'API geo-data et des nouvelles fonctionnalités');
console.log('===========================================================\n');

async function testGeoUtils() {
    const testCases = [
        "Nomain,59310,Nord,Nord-Pas-de-Calais,FRANCE,",
        "Humacao,,,Porto Rico,USA,PORTO RICO / USA",
        "Paris, 75001, Paris, Île-de-France, France",
        "New York, NY, USA",
        "Huisseau-sur-Mauves, 45130, Loiret, Centre, France"
    ];

    console.log('🔍 Test des nouveaux extractPlaceComponents():');
    console.log('================================================\n');

    for (const testCase of testCases) {
        console.log(`📍 Test: "${testCase}"`);
        
        try {
            const components = await extractPlaceComponents(testCase);
            const normalized = normalizePlace(testCase);
            const displayString = formatDisplayString(components);
            
            console.log(`   🏘️  Ville: ${components.town}`);
            console.log(`   📮 Code postal: ${components.postalCode || 'N/A'}`);
            console.log(`   🗺️  Département: ${components.department || 'N/A'}`);
            console.log(`   🌍 Région: ${components.region || 'N/A'}`);
            console.log(`   🌐 Pays: ${components.country || 'N/A'}`);
            console.log(`   🔑 Clé normalisée: "${normalized}"`);
            console.log(`   📄 Affichage: "${displayString}"`);
            
            if (components.departmentColor) {
                console.log(`   🎨 Couleur département: ${components.departmentColor}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}`);
        }
        
        console.log('');
    }

    console.log('🗺️ Test extractGeolocation():');
    console.log('==============================\n');

    // Test avec un arbre GEDCOM simulé
    const mockTree = [
        {
            tag: 'MAP',
            tree: [
                { tag: 'LATI', data: '48.8566' },
                { tag: 'LONG', data: '2.3522' }
            ]
        }
    ];

    const coordinates = extractGeolocation(mockTree);
    console.log(`📍 Coordonnées extraites: lat=${coordinates.latitude}, lng=${coordinates.longitude}`);

    // Test sans coordonnées
    const emptyCoords = extractGeolocation([]);
    console.log(`📍 Sans coordonnées: lat=${emptyCoords.latitude}, lng=${emptyCoords.longitude}`);
    
    console.log('\n✅ Tests terminés !');
}

testGeoUtils().catch(error => {
    console.error('❌ Erreur lors des tests:', error);
});