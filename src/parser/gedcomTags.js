/**
 * Tags GEDCOM standards et leurs catégories
 * Basé sur la spécification GEDCOM 5.5.1
 */

export const GEDCOM_TAGS = {
    // Structure Records
    RECORD: {
        HEAD: 'HEAD',    // Header
        TRLR: 'TRLR',    // Trailer
        INDI: 'INDI',    // Individual
        FAM: 'FAM',      // Family
        SOUR: 'SOUR',    // Source
        REPO: 'REPO',    // Repository
        OBJE: 'OBJE',    // Multimedia object
        NOTE: 'NOTE',    // Note
        SUBM: 'SUBM'     // Submitter
    },
    
    // Individual Events
    INDIVIDUAL_EVENT: {
        BIRT: 'BIRT',    // Birth
        CHR: 'CHR',      // Christening
        DEAT: 'DEAT',    // Death
        BURI: 'BURI',    // Burial
        CREM: 'CREM',    // Cremation
        ADOP: 'ADOP',    // Adoption
        BAPM: 'BAPM',    // Baptism
        BARM: 'BARM',    // Bar Mitzvah
        BASM: 'BASM',    // Bat Mitzvah
        BLES: 'BLES',    // Blessing
        CHRA: 'CHRA',    // Adult Christening
        CONF: 'CONF',    // Confirmation
        FCOM: 'FCOM',    // First Communion
        ORDN: 'ORDN',    // Ordination
        NATU: 'NATU',    // Naturalization
        EMIG: 'EMIG',    // Emigration
        IMMI: 'IMMI',    // Immigration
        CENS: 'CENS',    // Census
        PROB: 'PROB',    // Probate
        WILL: 'WILL',    // Will
        GRAD: 'GRAD',    // Graduation
        RETI: 'RETI',    // Retirement
        EVEN: 'EVEN'     // Generic Event
    },
    
    // Individual Attributes
    INDIVIDUAL_ATTRIBUTE: {
        CAST: 'CAST',    // Caste
        DSCR: 'DSCR',    // Physical Description
        EDUC: 'EDUC',    // Education
        IDNO: 'IDNO',    // ID Number
        NATI: 'NATI',    // Nationality
        NCHI: 'NCHI',    // Children Count
        NMR: 'NMR',      // Marriage Count
        OCCU: 'OCCU',    // Occupation
        PROP: 'PROP',    // Property
        RELI: 'RELI',    // Religion
        RESI: 'RESI',    // Residence
        TITL: 'TITL',    // Title
        FACT: 'FACT'     // Fact
    },
    
    // Family Events
    FAMILY_EVENT: {
        ANUL: 'ANUL',    // Annulment
        CENS: 'CENS',    // Census
        DIV: 'DIV',      // Divorce
        DIVF: 'DIVF',    // Divorce Filed
        ENGA: 'ENGA',    // Engagement
        MARR: 'MARR',    // Marriage
        MARB: 'MARB',    // Marriage Bann
        MARC: 'MARC',    // Marriage Contract
        MARL: 'MARL',    // Marriage License
        MARS: 'MARS',    // Marriage Settlement
        EVEN: 'EVEN'     // Generic Event
    },
    
    // Name Components
    NAME: {
        NAME: 'NAME',    // Name
        NPFX: 'NPFX',    // Name Prefix
        GIVN: 'GIVN',    // Given Name
        NICK: 'NICK',    // Nickname
        SPFX: 'SPFX',    // Surname Prefix
        SURN: 'SURN',    // Surname
        NSFX: 'NSFX',    // Name Suffix
        ROMN: 'ROMN',    // Romanized
        FONE: 'FONE'     // Phonetic
    },
    
    // Place Components
    PLACE: {
        PLAC: 'PLAC',    // Place
        FORM: 'FORM',    // Format
        MAP: 'MAP',      // Map
        LATI: 'LATI',    // Latitude
        LONG: 'LONG'     // Longitude
    },
    
    // Source Components
    SOURCE: {
        DATA: 'DATA',    // Data
        EVEN: 'EVEN',    // Events Recorded
        AGNC: 'AGNC',    // Agency
        NOTE: 'NOTE',    // Note
        AUTH: 'AUTH',    // Author
        TITL: 'TITL',    // Title
        ABBR: 'ABBR',    // Abbreviation
        PUBL: 'PUBL',    // Publication
        TEXT: 'TEXT'     // Text
    },
    
    // Citation Components
    CITATION: {
        PAGE: 'PAGE',    // Page
        QUAY: 'QUAY',    // Quality
        DATA: 'DATA',    // Data
        TEXT: 'TEXT'     // Text
    },
    
    // Multimedia Components
    MULTIMEDIA: {
        FILE: 'FILE',    // File Reference
        FORM: 'FORM',    // Format
        TITL: 'TITL'     // Title
    },
    
    // Contact
    CONTACT: {
        ADDR: 'ADDR',    // Address
        ADR1: 'ADR1',    // Address Line 1
        ADR2: 'ADR2',    // Address Line 2
        ADR3: 'ADR3',    // Address Line 3
        CITY: 'CITY',    // City
        STAE: 'STAE',    // State
        POST: 'POST',    // Postal Code
        CTRY: 'CTRY',    // Country
        PHON: 'PHON',    // Phone
        EMAIL: 'EMAIL',  // Email
        FAX: 'FAX',      // Fax
        WWW: 'WWW'       // Web
    },
    
    // Links
    LINK: {
        FAMC: 'FAMC',    // Family as Child
        FAMS: 'FAMS',    // Family as Spouse
        ASSO: 'ASSO',    // Association
        RELA: 'RELA',    // Relationship
        ANCI: 'ANCI',    // Ancestor Interest
        DESI: 'DESI',    // Descendant Interest
        HUSB: 'HUSB',    // Husband
        WIFE: 'WIFE',    // Wife
        CHIL: 'CHIL'     // Child
    },
    
    // Other
    OTHER: {
        DATE: 'DATE',    // Date
        TIME: 'TIME',    // Time
        AGE: 'AGE',      // Age
        CAUS: 'CAUS',    // Cause
        TYPE: 'TYPE',    // Type
        RELA: 'RELA',    // Relationship
        SEX: 'SEX',      // Sex
        LANG: 'LANG',    // Language
        PEDI: 'PEDI',    // Pedigree
        STAT: 'STAT',    // Status
        ROLE: 'ROLE',    // Role
        REFN: 'REFN',    // Reference Number
        RIN: 'RIN',      // Record ID Number
        CHAN: 'CHAN',    // Change
        CONC: 'CONC',    // Concatenation
        CONT: 'CONT'     // Continuation
    }
};

// Tags personnalisés courants (non-standard mais fréquents)
export const CUSTOM_TAGS = {
    _MILT: '_MILT',     // Military Service
    _MILI: '_MILI',     // Military
    _DNA: '_DNA',       // DNA Marker
    _MDNA: '_MDNA',     // Mitochondrial DNA
    _YDNA: '_YDNA',     // Y-DNA
    _PHOTO: '_PHOTO',   // Photo
    _TODO: '_TODO',     // To Do
    _UID: '_UID',       // Unique ID
    _FSFTID: '_FSFTID', // FamilySearch ID
    _WEBTAG: '_WEBTAG', // Web Tag
    _EMAIL: '_EMAIL',   // Email (alternative)
    _URL: '_URL'        // URL (alternative)
};

// Catégoriser un tag
export function categorizeTag(tag) {
    // Recherche dans toutes les catégories
    for (const [category, tags] of Object.entries(GEDCOM_TAGS)) {
        if (Object.values(tags).includes(tag)) {
            return category;
        }
    }
    
    // Tags personnalisés
    if (tag.startsWith('_')) {
        return 'CUSTOM';
    }
    
    return 'UNKNOWN';
}

// Tags d'événements (pour la compression)
export const EVENT_TAGS = new Set([
    ...Object.values(GEDCOM_TAGS.INDIVIDUAL_EVENT),
    ...Object.values(GEDCOM_TAGS.FAMILY_EVENT),
    ...Object.values(GEDCOM_TAGS.INDIVIDUAL_ATTRIBUTE)
]);