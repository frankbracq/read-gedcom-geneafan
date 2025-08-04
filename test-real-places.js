#!/usr/bin/env node

/**
 * Test avec un fichier GEDCOM réel pour valider le traitement des lieux
 */

import { parseGedcomToGeneaFan } from './src/index.js';
import { readFileSync } from 'fs';

console.log('🔍 TEST AVEC FICHIER GEDCOM RÉEL');
console.log('=================================');

try {
    // Utiliser le fichier de test existant
    const gedcomPath = './dev/gedcom/deleau.ged';
    const gedcomData = readFileSync(gedcomPath, 'utf8');
    
    console.log(`📄 Fichier chargé: ${gedcomPath}`);
    console.log(`📏 Taille: ${(gedcomData.length / 1024).toFixed(1)} KB`);
    
    console.log('\n🚀 PARSING avec logging des lieux activé...');
    console.log('================================================');
    
    const result = await parseGedcomToGeneaFan(gedcomData, {
        logPlaces: true,           // 🔍 LOGGING DÉTAILLÉ ACTIVÉ
        verbose: false,
        fixEncoding: true
    });
    
    console.log('\n📊 RÉSULTATS:');
    console.log('=============');
    console.log(`✅ ${result.individualsCache.size} individus traités`);
    console.log(`📍 ${result.places.size} lieux uniques extraits`);
    
    if (result.places.size > 0) {
        console.log('\n🗺️ Premiers 10 lieux extraits:');
        console.log('================================');
        [...result.places].slice(0, 10).forEach((place, index) => {
            console.log(`${index + 1}. "${place}"`);
        });
    }
    
    // Compter les événements avec lieux
    let totalEvents = 0;
    let eventsWithPlaces = 0;
    
    for (const individual of result.individualsCache.values()) {
        if (individual.e) {
            totalEvents += individual.e.length;
            eventsWithPlaces += individual.e.filter(e => e.l).length;
        }
    }
    
    console.log(`\n📈 STATISTIQUES ÉVÉNEMENTS:`);
    console.log(`Total événements: ${totalEvents}`);
    console.log(`Événements avec lieux: ${eventsWithPlaces}`);
    console.log(`Taux de couverture: ${((eventsWithPlaces / totalEvents) * 100).toFixed(1)}%`);
    
} catch (error) {
    console.error('❌ Erreur:', error.message);
    
    if (error.code === 'ENOENT') {
        console.log('\n💡 Fichier deleau.ged non trouvé.');
        console.log('Testons avec le fichier sample.ged à la place...');
        
        try {
            const samplePath = './src/test/sample.ged';
            const sampleData = readFileSync(samplePath, 'utf8');
            
            console.log(`\n📄 Fichier sample: ${samplePath}`);
            const result = await parseGedcomToGeneaFan(sampleData, {
                logPlaces: true,
                verbose: false
            });
            
            console.log(`✅ ${result.individualsCache.size} individus traités`);
            console.log(`📍 ${result.places.size} lieux extraits`);
            
        } catch (sampleError) {
            console.error('❌ Erreur sample aussi:', sampleError.message);
        }
    }
}