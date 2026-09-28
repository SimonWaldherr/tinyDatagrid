/** UI translations; formulas and workbook contents keep their original language. */
const messages = {
  en: {
    grid:'Spreadsheet', editor:'Cell value or formula', fill:'Fill selected cells', fillHint:'Drag to fill or double-click to fill down', filter:'Filter', autofill:'Fill method',
    rowHeight:'Row height', columnWidth:'Column width', height:'Height', width:'Width', back:'Back',
    copyRow:'Copy row', clear:'Clear contents', insertRowBefore:'Insert row above', insertRowAfter:'Insert row below', deleteRow:'Delete row', autoFitRow:'Fit row height', hideRow:'Hide row', showRows:'Show all hidden rows',
    copyColumn:'Copy column', insertColumnBefore:'Insert column left', insertColumnAfter:'Insert column right', deleteColumn:'Delete column', autoFitColumn:'Fit column width', hideColumn:'Hide column', showColumns:'Show all hidden columns',
    ascending:'Sort ascending', descending:'Sort descending', search:'Search', searchValues:'Search filter values', selectAll:'Select all', empty:'Empty', clearFilter:'Clear filter', apply:'Apply',
    multipleFills:'Choose how to fill these cells', series:'Continue series', repeat:'Repeat pattern'
  },
  de: {
    grid:'Tabellenkalkulation', editor:'Zellwert oder Formel', fill:'Ausgewählte Zellen ausfüllen', fillHint:'Zum Ausfüllen ziehen oder doppelklicken', filter:'Filter', autofill:'Ausfüllmethode',
    rowHeight:'Zeilenhöhe', columnWidth:'Spaltenbreite', height:'Höhe', width:'Breite', back:'Zurück',
    copyRow:'Zeile kopieren', clear:'Inhalte löschen', insertRowBefore:'Zeile darüber einfügen', insertRowAfter:'Zeile darunter einfügen', deleteRow:'Zeile löschen', autoFitRow:'Zeilenhöhe automatisch anpassen', hideRow:'Zeile ausblenden', showRows:'Alle ausgeblendeten Zeilen einblenden',
    copyColumn:'Spalte kopieren', insertColumnBefore:'Spalte links einfügen', insertColumnAfter:'Spalte rechts einfügen', deleteColumn:'Spalte löschen', autoFitColumn:'Spaltenbreite automatisch anpassen', hideColumn:'Spalte ausblenden', showColumns:'Alle ausgeblendeten Spalten einblenden',
    ascending:'Aufsteigend sortieren', descending:'Absteigend sortieren', search:'Suchen', searchValues:'Filterwerte suchen', selectAll:'Alle auswählen', empty:'Leer', clearFilter:'Filter löschen', apply:'Anwenden',
    multipleFills:'Ausfüllmethode auswählen', series:'Serie fortsetzen', repeat:'Muster wiederholen'
  }
};
export function translate(locale,key){return (messages[String(locale).toLowerCase().startsWith('de')?'de':'en'][key]||messages.en[key]||key)}
