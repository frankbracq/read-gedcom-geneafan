/**
 * Test direct de read-gedcom pour debug
 */

import { readGedcom } from 'read-gedcom';
import { readFileSync } from 'fs';

async function testDirectReadGedcom() {
    console.log('🧪 Test direct read-gedcom\n');
    
    try {
        // Charger le fichier
        console.log('📁 Chargement...');
        const gedcomData = readFileSync('../geneafan/assets/scripts/gedcom/test_utf8.ged');
        console.log(`✅ Fichier chargé: ${gedcomData.length} bytes`);
        
        // Parser directement
        console.log('🚀 Parsing avec read-gedcom...');
        const gedcom = readGedcom(gedcomData);
        
        console.log('✅ Parsing réussi !');
        console.log(`📊 Individus: ${gedcom.getIndividualRecord().length}`);
        console.log(`📊 Familles: ${gedcom.getFamilyRecord().length}`);
        console.log(`📊 Sources: ${gedcom.getSourceRecord().length}`);
        
        // Test extraction famille
        const families = gedcom.getFamilyRecord().arraySelect();
        if (families.length > 0) {
            const firstFamily = families[0];
            console.log('\n👪 Première famille:');
            console.log(`- Pointer: ${firstFamily.pointer()[0] || 'N/A'}`);
            
            const husband = firstFamily.getHusband();
            if (husband.length > 0) {
                console.log(`- Mari: ${husband.value()[0] || 'N/A'}`);
            }
            
            const wife = firstFamily.getWife();
            if (wife.length > 0) {
                console.log(`- Épouse: ${wife.value()[0] || 'N/A'}`);
            }
            
            const children = firstFamily.getChild();
            console.log(`- Enfants: ${children.length}`);
            if (children.length > 0) {
                children.arraySelect().slice(0, 3).forEach((child, i) => {
                    console.log(`  - Enfant ${i+1}: ${child.value()[0] || 'N/A'}`);
                });
            }
            
            const marriage = firstFamily.getEventMarriage();
            if (marriage.length > 0) {
                const marriageEvent = marriage.arraySelect()[0];
                const marriageDate = marriageEvent.getDate();
                if (marriageDate.length > 0) {
                    console.log(`- Mariage: ${marriageDate.value()[0] || 'N/A'}`);
                }
                
                const marriagePlace = marriageEvent.getPlace();
                if (marriagePlace.length > 0) {
                    console.log(`- Lieu mariage: ${marriagePlace.value()[0] || 'N/A'}`);
                }
            }
        }
        
        // Test extraction d'un individu (API correcte)
        const individuals = gedcom.getIndividualRecord().arraySelect();
        if (individuals.length > 0) {
            const firstIndividual = individuals[0];
            console.log('\n🔍 Premier individu:');
            console.log(`- Pointer: ${firstIndividual.pointer()[0] || 'N/A'}`);
            
            const names = firstIndividual.getName();
            if (names.length > 0) {
                console.log(`- Nom: ${names.value()[0] || 'N/A'}`);
            }
            
            const sex = firstIndividual.getSex();
            if (sex.length > 0) {
                console.log(`- Sexe: ${sex.value()[0] || 'N/A'}`);
            }
            
            const birth = firstIndividual.getEventBirth();
            if (birth.length > 0) {
                const birthEvent = birth.arraySelect()[0];
                const birthDate = birthEvent.getDate();
                if (birthDate.length > 0) {
                    console.log(`- Naissance: ${birthDate.value()[0] || 'N/A'}`);
                }
                
                const birthPlace = birthEvent.getPlace();
                if (birthPlace.length > 0) {
                    console.log(`- Lieu naissance: ${birthPlace.value()[0] || 'N/A'}`);
                }
            }
            
            // Test relations familiales directes
            const familiesAsSpouse = firstIndividual.getFamilyAsSpouse();
            console.log(`- Familles comme époux: ${familiesAsSpouse.length}`);
            if (familiesAsSpouse.length > 0) {
                const spouseFamily = familiesAsSpouse.arraySelect()[0];
                console.log(`  - Famille ID: ${spouseFamily.pointer()[0]}`);
                
                const husband = spouseFamily.getHusband();
                const wife = spouseFamily.getWife();
                console.log(`  - Mari: ${husband.length > 0 ? husband.value()[0] : 'N/A'}`);
                console.log(`  - Épouse: ${wife.length > 0 ? wife.value()[0] : 'N/A'}`);
                
                // Déduire époux/épouse
                const spouseId = husband.value()[0] === firstIndividual.pointer()[0] 
                    ? wife.value()[0] 
                    : husband.value()[0];
                console.log(`  - Époux/Épouse de ${firstIndividual.pointer()[0]}: ${spouseId}`);
            }
            
            const familiesAsChild = firstIndividual.getFamilyAsChild();
            console.log(`- Familles comme enfant: ${familiesAsChild.length}`);
            if (familiesAsChild.length > 0) {
                const parentFamily = familiesAsChild.arraySelect()[0];
                console.log(`  - Famille parentale ID: ${parentFamily.pointer()[0]}`);
                
                const father = parentFamily.getHusband();
                const mother = parentFamily.getWife();
                console.log(`  - Père direct: ${father.length > 0 ? father.value()[0] : 'N/A'}`);
                console.log(`  - Mère directe: ${mother.length > 0 ? mother.value()[0] : 'N/A'}`);
                
                // Frères et sœurs (autres enfants de la même famille)
                const allChildren = parentFamily.getChild().arraySelect();
                const siblings = allChildren
                    .filter(child => child.value()[0] !== firstIndividual.pointer()[0])
                    .map(child => child.value()[0]);
                console.log(`  - Frères/sœurs directs: [${siblings.join(', ')}]`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        console.error(error);
    }
}

testDirectReadGedcom();