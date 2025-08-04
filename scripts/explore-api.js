/**
 * Script pour explorer l'API read-gedcom
 */

import * as readGedcom from 'read-gedcom';

console.log('=== ANALYSE DE LA COUVERTURE read-gedcom ===\n');

// 1. API principale
console.log('1. API principale:');
console.log('- parseGedcom:', typeof readGedcom.parseGedcom);
console.log('- Tag enum:', typeof readGedcom.Tag);
console.log();

// 2. Sélections disponibles
console.log('2. Sélections disponibles:');
const selections = Object.keys(readGedcom).filter(k => k.startsWith('Selection'));
selections.forEach(sel => {
    console.log(`- ${sel}`);
});
console.log();

// 3. Méthodes IndividualRecord
console.log('3. Méthodes SelectionIndividualRecord:');
const IndividualRecord = readGedcom.SelectionIndividualRecord;
const methods = Object.getOwnPropertyNames(IndividualRecord.prototype)
    .filter(n => !n.startsWith('_') && typeof IndividualRecord.prototype[n] === 'function');
methods.forEach(method => {
    console.log(`- ${method}()`);
});
console.log();

// 4. Tags disponibles
console.log('4. Tags GEDCOM (échantillon):');
if (readGedcom.Tag) {
    const tags = Object.keys(readGedcom.Tag).slice(0, 20);
    tags.forEach(tag => {
        console.log(`- ${tag}: ${readGedcom.Tag[tag]}`);
    });
    console.log(`... et ${Object.keys(readGedcom.Tag).length - 20} autres tags`);
}
console.log();

// 5. Événements supportés
console.log('5. Événements identifiés:');
const eventMethods = methods.filter(m => m.startsWith('getEvent'));
eventMethods.forEach(event => {
    console.log(`- ${event}()`);
});
console.log();

// 6. Attributs supportés
console.log('6. Attributs identifiés:');
const attributeMethods = methods.filter(m => m.startsWith('getAttribute'));
attributeMethods.forEach(attr => {
    console.log(`- ${attr}()`);
});
console.log();

console.log('=== RÉSUMÉ ===');
console.log(`- ${selections.length} types de sélections`);
console.log(`- ${methods.length} méthodes sur SelectionIndividualRecord`);
console.log(`- ${eventMethods.length} événements identifiés`);
console.log(`- ${attributeMethods.length} attributs identifiés`);