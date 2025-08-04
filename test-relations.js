#!/usr/bin/env node

/**
 * Test des relations parentales via read-gedcom-geneafan
 * Vérification que les champs f (père) et m (mère) sont bien générés
 */

import { parseGedcomToGeneaFan } from './src/index.js';
import fs from 'fs';
import path from 'path';

async function testRelations() {
    console.log('🧪 Test des relations parentales read-gedcom-geneafan');
    console.log('================================================');
    
    // Utiliser le fichier GEDCOM de référence
    const testFiles = [
        '../geneafan/dev/gedcom/deleau.ged'
    ];
    
    let gedcomPath = null;
    for (const testFile of testFiles) {
        if (fs.existsSync(testFile)) {
            gedcomPath = testFile;
            break;
        }
    }
    
    if (!gedcomPath) {
        console.error('❌ Aucun fichier GEDCOM de test trouvé');
        console.log('Fichiers cherchés:', testFiles);
        return;
    }
    
    console.log(`📁 Fichier GEDCOM: ${gedcomPath}`);
    
    try {
        // Lire le fichier GEDCOM
        const gedcomContent = fs.readFileSync(gedcomPath, 'utf-8');
        console.log(`📊 Taille du fichier: ${gedcomContent.length} caractères`);
        
        // Parser avec read-gedcom-geneafan
        console.log('\n🚀 Parsing avec read-gedcom-geneafan...');
        const result = await parseGedcomToGeneaFan(gedcomContent, { 
            verbose: true,
            fixEncoding: false  // Désactiver la correction d'encodage
        });
        
        console.log('\n📋 Résultats du parsing:');
        console.log(`- Individus: ${result.individualsCache.size}`);
        console.log(`- Familles: ${result.familiesCache.size}`);
        
        // Analyser les relations parentales
        console.log('\n🔍 Analyse des relations parentales:');
        
        let withFather = 0;
        let withMother = 0;
        let withBoth = 0;
        let orphans = 0;
        
        const samples = [];
        
        for (const [id, individual] of result.individualsCache) {
            const hasFather = individual.f !== undefined;
            const hasMother = individual.m !== undefined;
            
            if (hasFather) withFather++;
            if (hasMother) withMother++;
            if (hasFather && hasMother) withBoth++;
            if (!hasFather && !hasMother) orphans++;
            
            // Collecter quelques échantillons pour debug
            if (samples.length < 5 && (hasFather || hasMother)) {
                samples.push({
                    id,
                    name: individual.fn || 'Nom inconnu',
                    father: individual.f || null,
                    mother: individual.m || null,
                    hasFullName: !!individual.fn,
                    hasGender: !!individual.g
                });
            }
        }
        
        console.log(`\n📊 Statistiques des relations:`);
        console.log(`- Avec père: ${withFather}`);
        console.log(`- Avec mère: ${withMother}`);
        console.log(`- Avec les deux parents: ${withBoth}`);
        console.log(`- Sans parents (racines): ${orphans}`);
        
        console.log(`\n🔬 Échantillons d'individus avec relations:`);
        samples.forEach((sample, i) => {
            console.log(`${i + 1}. ${sample.name} (${sample.id})`);
            console.log(`   Père: ${sample.father || 'N/A'}`);
            console.log(`   Mère: ${sample.mother || 'N/A'}`);
            console.log(`   Nom compressé: ${sample.hasFullName ? '✅' : '❌'}`);
            console.log(`   Genre: ${sample.hasGender ? '✅' : '❌'}`);
        });
        
        // Vérification du succès
        if (withFather > 0 || withMother > 0) {
            console.log('\n✅ SUCCÈS: Relations parentales détectées !');
            console.log('🚀 Les champs f (père) et m (mère) sont bien générés par read-gedcom-geneafan');
        } else {
            console.log('\n❌ ÉCHEC: Aucune relation parentale détectée');
            console.log('🔧 Vérifier l\'extraction des relations dans DataExtractor et CacheBuilder');
        }
        
    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Exécuter le test
testRelations();