// Utilitaires pour lire et appliquer le format de PLAC (HEAD > PLAC > FORM)
// GEDCOM 5.5.1: la convention de lieux peut être déclarée dans le header.
// Quand présente, chaque PLAC suit cet ordre, avec virgules pour les niveaux vides.

/**
 * Lis le format de lieux depuis le header GEDCOM.
 * Essaie HEAD > PLAC > FORM via getHeader(); fallback HEAD/PLAC/FORM via get().
 * @param {SelectionGedcom} ged
 * @returns {string|null} ex: "Town, Area code, County, Region, Country, Subdivision"
 */
export function readPlacForm(ged) {
  try {
    // Chemin "officiel" via read-gedcom
    const viaHeader = ged.getHeader?.().get?.('PLAC')?.get?.('FORM')?.value?.()?.[0];
    if (viaHeader) return viaHeader;

    // Fallback strict si certains exports placent PLAC directement sous la racine
    const viaRoot = ged.get?.('HEAD')?.get?.('PLAC')?.get?.('FORM')?.value?.()?.[0]
                 || ged.get?.('PLAC')?.get?.('FORM')?.value?.()?.[0];
    return viaRoot || null;
  } catch {
    return null;
  }
}

/**
 * Applique la convention de PLAC à une chaîne de lieu brute.
 * - Découpe sur les virgules
 * - Tronque/complète selon le nombre de clés défini par le FORM
 * - Normalise les clés (lowercase, espaces -> underscore)
 *
 * @param {string} rawPlac ex: "Paris,75000,Paris,Île-de-France,FRANCE,75016"
 * @param {string|null} form ex: "Town, Area code, County, Region, Country, Subdivision"
 * @param {object} [options]
 * @param {"clip"|"merge-last"} [options.extraPolicy="merge-last"] quoi faire si trop de segments
 * @returns {{raw:string, parts:string[], keys:string[]|null, map:Object|null}}
 */
export function applyPlacForm(rawPlac, form, options = {}) {
  const extraPolicy = options.extraPolicy || 'merge-last';

  const raw = (rawPlac ?? '').trim();
  if (!raw) return { raw, parts: [], keys: form ? splitKeys(form) : null, map: form ? {} : null };

  const parts = raw.split(',').map(s => s.trim());
  if (!form) {
    // sans FORM, renvoyer juste la liste
    return { raw, parts, keys: null, map: null };
  }

  const keys = splitKeys(form);
  const map = {};

  // Ajuster le nombre de segments à la longueur des clés
  let segs = parts.slice(0);
  if (segs.length > keys.length) {
    if (extraPolicy === 'merge-last') {
      // tout ce qui dépasse est fusionné dans la dernière clé
      const head = segs.slice(0, keys.length - 1);
      const tail = segs.slice(keys.length - 1).join(', ');
      segs = [...head, tail];
    } else {
      // "clip" : on coupe
      segs = segs.slice(0, keys.length);
    }
  } else if (segs.length < keys.length) {
    // compléter les manquants par null
    segs = [...segs, ...Array(keys.length - segs.length).fill(null)];
  }

  keys.forEach((k, i) => { map[k] = (segs[i] === '' ? null : segs[i]); });

  return { raw, parts: segs, keys, map };
}

function splitKeys(form) {
  return form.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toLowerCase().replace(/\s+/g, '_')); // "Area code" -> "area_code"
}