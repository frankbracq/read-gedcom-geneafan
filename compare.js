/**
 * Comparaison entre read-gedcom-geneafan et le parser original GeneaFan
 */

import { parseGedcomToGeneaFan } from './src/index.js';
import { readFileSync } from 'fs';

// Import du parser original GeneaFan
import { toJson } from '../geneafan/assets/scripts/gedcom/parse.js';

async function compareParser() {
    console.log('🔍 COMPARAISON DES PARSERS\n');
    
    const gedcomFile = '../geneafan/dev/gedcom/deleau.ged';
    const gedcomData = readFileSync(gedcomFile);
    console.log(`📁 Fichier: ${gedcomFile}`);
    console.log(`📊 Taille: ${gedcomData.length} bytes\n`);
    
    console.log('=' .repeat(80));
    console.log('🚀 TEST 1: PARSER ORIGINAL GENEAFAN (parse-gedcom)');
    console.log('=' .repeat(80));
    
    try {
        const startTime1 = Date.now();
        
        // Parser original avec parse-gedcom
        const originalResult = await toJson(gedcomData.toString('utf8'));
        
        const duration1 = Date.now() - startTime1;
        
        console.log(`⚡ Durée: ${duration1}ms`);
        console.log(`📊 Type résultat:`, typeof originalResult);
        console.log(`📊 Clés disponibles:`, Object.keys(originalResult || {}));
        
        // Analyser la structure du résultat
        if (originalResult) {
            if (originalResult.individuals) {
                const individualsArray = Array.isArray(originalResult.individuals) ? originalResult.individuals : Object.values(originalResult.individuals);
                console.log(`📊 Individus: ${individualsArray.length}`);
                
                const cacheSize = JSON.stringify(originalResult.individuals).length;
                console.log(`💾 Taille cache: ${Math.round(cacheSize / 1024)} KB`);
                console.log(`💾 Ratio: ${Math.round(cacheSize / individualsArray.length)} bytes/individu`);
            }
            
            if (originalResult.families) {
                const familiesArray = Array.isArray(originalResult.families) ? originalResult.families : Object.values(originalResult.families);
                console.log(`📊 Familles: ${familiesArray.length}`);
            }
        }
        
        console.log('✅ Parser original: SUCCÈS\n');
        
    } catch (error) {
        console.log(`❌ Parser original: ERREUR - ${error.message}\n`);
    }
    
    console.log('=' .repeat(80));
    console.log('🚀 TEST 2: NOUVEAU PARSER (read-gedcom-geneafan)');
    console.log('=' .repeat(80));
    
    try {
        const startTime2 = Date.now();
        
        // Nouveau parser read-gedcom-geneafan
        const newResult = await parseGedcomToGeneaFan(gedcomData, {
            fixEncoding: false,
            extractMedia: true,
            extractNotes: true,
            extractSources: true,
            calculateQuality: true,
            verbose: false
        });
        
        const duration2 = Date.now() - startTime2;
        
        console.log(`⚡ Durée: ${duration2}ms`);
        console.log(`📊 Individus: ${newResult.individualsCache.size}`);
        console.log(`📊 Familles: ${newResult.familiesCache.size}`);
        console.log(`📊 Sources: ${newResult.sourcesCache.size}`);
        console.log(`📊 Médias: ${newResult.mediaCache.size}`);
        
        // Taille cache
        const cacheSize = JSON.stringify(Array.from(newResult.individualsCache.entries())).length;
        console.log(`💾 Taille cache: ${Math.round(cacheSize / 1024)} KB`);
        console.log(`💾 Ratio: ${Math.round(cacheSize / newResult.individualsCache.size)} bytes/individu`);
        
        if (newResult.statistics) {
            console.log(`📈 Période: ${newResult.statistics.timespan.min}-${newResult.statistics.timespan.max}`);
            console.log(`📈 Qualité moyenne: ${newResult.statistics.quality.avg}/100`);
        }
        
        console.log('✅ Nouveau parser: SUCCÈS\n');
        
    } catch (error) {
        console.log(`❌ Nouveau parser: ERREUR - ${error.message}\n`);
    }
    
    console.log('=' .repeat(80));
    console.log('📊 RÉSUMÉ DE LA COMPARAISON');
    console.log('=' .repeat(80));
    console.log('Fonctionnalités:');
    console.log('- Parser original: parse-gedcom + transformations GeneaFan');
    console.log('- Nouveau parser: read-gedcom + format optimisé direct');
    console.log('');
    console.log('Avantages nouveau parser:');
    console.log('✅ API moderne et maintenue (read-gedcom)');
    console.log('✅ Format optimisé produit directement');
    console.log('✅ Exploitation 100% des tags GEDCOM');
    console.log('✅ Système de qualité intégré');
    console.log('✅ Support multimedia, notes, sources');
    console.log('✅ Compression événements et champs');
}

compareParser().catch(console.error);