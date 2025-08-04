/**
 * Test simple du parser read-gedcom-geneafan
 */

import { parseGedcomToGeneaFan } from './src/index.js';
import { readFileSync } from 'fs';

async function testParser() {
    console.log('🧪 Test du parser read-gedcom-geneafan\n');
    
    try {
        // Charger le fichier test
        console.log('📁 Chargement du fichier GEDCOM test...');
        const gedcomData = readFileSync('../geneafan/dev/gedcom/deleau.ged');
        console.log(`✅ Fichier chargé: ${gedcomData.length} bytes\n`);
        
        // Parser avec options complètes
        console.log('🚀 Parsing avec read-gedcom-geneafan...');
        const startTime = Date.now();
        
        const result = await parseGedcomToGeneaFan(gedcomData, {
            fixEncoding: false,
            extractMedia: true,
            extractNotes: true,
            extractSources: true,
            calculateQuality: true,
            verbose: true
        });
        
        const duration = Date.now() - startTime;
        console.log(`⚡ Parsing terminé en ${duration}ms\n`);
        
        // Afficher résultats
        console.log('📊 RÉSULTATS:');
        console.log(`- Individus: ${result.individualsCache.size}`);
        console.log(`- Familles: ${result.familiesCache.size}`);
        console.log(`- Sources: ${result.sourcesCache.size}`);
        console.log(`- Médias: ${result.mediaCache.size}`);
        console.log(`- Lieux uniques: ${result.places.size}`);
        
        if (result.statistics) {
            console.log(`- Période: ${result.statistics.timespan.min}-${result.statistics.timespan.max}`);
            console.log(`- Qualité moyenne: ${result.statistics.quality.avg}/100`);
        }
        
        console.log('\n🔍 ÉCHANTILLON INDIVIDU BRUT:');
        if (result.metadata && result.metadata.debugInfo && result.metadata.debugInfo.rawIndividuals) {
            const firstIndividualRaw = result.metadata.debugInfo.rawIndividuals[0];
            console.log('Relations familiales extraites:', {
                name: firstIndividualRaw.name,
                surname: firstIndividualRaw.surname,
                fatherId: firstIndividualRaw.fatherId,
                motherId: firstIndividualRaw.motherId,
                spouseIds: firstIndividualRaw.spouseIds,
                childrenIds: firstIndividualRaw.childrenIds,
                events: firstIndividualRaw.events?.length || 0
            });
        }
        
        console.log('\n🔍 ÉCHANTILLON INDIVIDU FINAL:');
        const firstIndividual = Array.from(result.individualsCache.values())[0];
        console.log(JSON.stringify(firstIndividual, null, 2));
        
        console.log('\n📈 STATISTIQUES QUALITÉ:');
        if (result.qualityStats) {
            console.log(`- Distribution excellent: ${result.qualityStats.distribution.excellent.percent}%`);
            console.log(`- Distribution good: ${result.qualityStats.distribution.good.percent}%`);
            console.log(`- Score moyen: ${result.qualityStats.averageScore.toFixed(1)}/100`);
        }
        
        // Calcul taille cache
        const cacheSize = JSON.stringify(Array.from(result.individualsCache.entries())).length;
        const cacheSizeKB = Math.round(cacheSize / 1024);
        
        console.log('\n💾 TAILLE CACHE:');
        console.log(`- Cache individus: ${cacheSizeKB} KB`);
        console.log(`- Ratio: ${Math.round(cacheSize / result.individualsCache.size)} bytes/individu`);
        
        if (result.metadata.compressionStats) {
            console.log(`- Individus traités: ${result.metadata.compressionStats.processed}`);
            console.log(`- Erreurs: ${result.metadata.compressionStats.errors}`);
        }
        
        console.log('\n✅ Test réussi !');
        
    } catch (error) {
        console.error('❌ Erreur de test:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Lancer le test
testParser();