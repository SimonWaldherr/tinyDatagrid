import { formulaCatalog, formulaDefinition, formulaLanguage, normalizeFormulaName, resolveFormulaName } from './formula-catalog.js';

const fallbacks={de:'Benutzerdefinierte Funktion; keine Beschreibung hinterlegt.',en:'Custom function; no description provided.',fr:'Fonction personnalisée ; aucune description disponible.',it:'Funzione personalizzata; nessuna descrizione disponibile.'};
export function functionHelp(name,language='en',custom={}) {
  name=normalizeFormulaName(name);const id=resolveFormulaName(name),definition=formulaDefinition(id),code=formulaLanguage(language);
  const entry=custom[name]??custom[id]??Object.entries(custom).find(([alias])=>resolveFormulaName(alias)===id)?.[1];
  const signature=entry?.signature??(definition?`${name}(${definition.args})`:`${name}(…)`);
  return {name,signature,description:entry?.description??entry?.[code]??entry?.en??entry?.de??definition?.descriptions[code]??definition?.descriptions.en??fallbacks[code]};
}
// Backwards compatible complete accepted-name list. UI suggestions use the
// localized catalog instead so one operation isn't shown five times.
export const documentedFunctions=()=>[...new Set(formulaCatalog.flatMap(record=>record.aliases))];
