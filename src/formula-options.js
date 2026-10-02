// Enum values have a stable English representation, with aliases in all four
// formula languages. Text arguments, JSON keys and table headers stay untouched.
const unitRows=`day|days|tag|tage|jour|jours|giorno|giorni
week|weeks|woche|wochen|semaine|semaines|settimana|settimane
month|months|monat|monate|mois|mese|mesi
year|years|jahr|jahre|année|années|anno|anni
hour|hours|stunde|stunden|heure|heures|ora|ore
minute|minutes|minuten|minuto|minuti
second|seconds|sekunde|sekunden|seconde|secondes|secondo|secondi
millisecond|milliseconds|millisekunde|millisekunden|milliseconde|millisecondes|millisecondo|millisecondi`;
const key=value=>String(value).trim().normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const units=new Map();for(const row of unitRows.split('\n')){const [id,...aliases]=row.split('|');for(const alias of [id,...aliases])units.set(key(alias),id);}
export function calendarUnit(value){const unit=units.get(key(value));if(!unit)throw new TypeError('Unknown calendar/time unit');return unit;}
