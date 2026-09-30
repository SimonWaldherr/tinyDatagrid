/** UI translations; formulas and workbook contents keep their original language. */
const messages = {
  en: {
    grid:'Spreadsheet', editor:'Cell value or formula', fill:'Fill selected cells', fillHint:'Drag to fill or double-click to fill down', filter:'Filter', autofill:'Fill method',
    rowHeight:'Row height', columnWidth:'Column width', height:'Height', width:'Width', back:'Back',
    copyRow:'Copy row', clear:'Clear contents', insertRowBefore:'Insert row above', insertRowAfter:'Insert row below', deleteRow:'Delete row', autoFitRow:'Fit row height', hideRow:'Hide row', showRows:'Show all hidden rows',
    copyColumn:'Copy column', insertColumnBefore:'Insert column left', insertColumnAfter:'Insert column right', deleteColumn:'Delete column', autoFitColumn:'Fit column width', hideColumn:'Hide column', showColumns:'Show all hidden columns',
    ascending:'Sort ascending', descending:'Sort descending', search:'Search', searchValues:'Search filter values', selectAll:'Select all', empty:'Empty', clearFilter:'Clear filter', apply:'Apply',
    multipleFills:'Choose how to fill these cells', series:'Continue series', repeat:'Repeat pattern', pivotCell:'Pivot table · double-click or right-click for settings', listChoose:'Choose a value'
  },
  de: {
    grid:'Tabellenkalkulation', editor:'Zellwert oder Formel', fill:'Ausgewählte Zellen ausfüllen', fillHint:'Zum Ausfüllen ziehen oder doppelklicken', filter:'Filter', autofill:'Ausfüllmethode',
    rowHeight:'Zeilenhöhe', columnWidth:'Spaltenbreite', height:'Höhe', width:'Breite', back:'Zurück',
    copyRow:'Zeile kopieren', clear:'Inhalte löschen', insertRowBefore:'Zeile darüber einfügen', insertRowAfter:'Zeile darunter einfügen', deleteRow:'Zeile löschen', autoFitRow:'Zeilenhöhe automatisch anpassen', hideRow:'Zeile ausblenden', showRows:'Alle ausgeblendeten Zeilen einblenden',
    copyColumn:'Spalte kopieren', insertColumnBefore:'Spalte links einfügen', insertColumnAfter:'Spalte rechts einfügen', deleteColumn:'Spalte löschen', autoFitColumn:'Spaltenbreite automatisch anpassen', hideColumn:'Spalte ausblenden', showColumns:'Alle ausgeblendeten Spalten einblenden',
    ascending:'Aufsteigend sortieren', descending:'Absteigend sortieren', search:'Suchen', searchValues:'Filterwerte suchen', selectAll:'Alle auswählen', empty:'Leer', clearFilter:'Filter löschen', apply:'Anwenden',
    multipleFills:'Ausfüllmethode auswählen', series:'Serie fortsetzen', repeat:'Muster wiederholen', pivotCell:'Pivot-Tabelle · Doppelklick oder Rechtsklick für Einstellungen', listChoose:'Wert auswählen'
  },
  fr: {
    grid:'Tableur', editor:'Valeur ou formule de la cellule', fill:'Remplir les cellules sélectionnées', fillHint:'Faites glisser pour remplir ou double-cliquez pour remplir vers le bas', filter:'Filtre', autofill:'Méthode de remplissage',
    rowHeight:'Hauteur de ligne', columnWidth:'Largeur de colonne', height:'Hauteur', width:'Largeur', back:'Retour',
    copyRow:'Copier la ligne', clear:'Effacer le contenu', insertRowBefore:'Insérer une ligne au-dessus', insertRowAfter:'Insérer une ligne en dessous', deleteRow:'Supprimer la ligne', autoFitRow:'Ajuster la hauteur de ligne', hideRow:'Masquer la ligne', showRows:'Afficher toutes les lignes masquées',
    copyColumn:'Copier la colonne', insertColumnBefore:'Insérer une colonne à gauche', insertColumnAfter:'Insérer une colonne à droite', deleteColumn:'Supprimer la colonne', autoFitColumn:'Ajuster la largeur de colonne', hideColumn:'Masquer la colonne', showColumns:'Afficher toutes les colonnes masquées',
    ascending:'Tri croissant', descending:'Tri décroissant', search:'Rechercher', searchValues:'Rechercher dans les valeurs du filtre', selectAll:'Tout sélectionner', empty:'Vide', clearFilter:'Effacer le filtre', apply:'Appliquer',
    multipleFills:'Choisissez comment remplir ces cellules', series:'Poursuivre la série', repeat:'Répéter le motif', pivotCell:'Tableau croisé dynamique · double-clic ou clic droit pour les réglages', listChoose:'Choisir une valeur'
  },
  es: {
    grid:'Hoja de cálculo', editor:'Valor o fórmula de la celda', fill:'Rellenar las celdas seleccionadas', fillHint:'Arrastra para rellenar o haz doble clic para rellenar hacia abajo', filter:'Filtro', autofill:'Método de relleno',
    rowHeight:'Alto de fila', columnWidth:'Ancho de columna', height:'Alto', width:'Ancho', back:'Atrás',
    copyRow:'Copiar fila', clear:'Borrar contenido', insertRowBefore:'Insertar fila arriba', insertRowAfter:'Insertar fila abajo', deleteRow:'Eliminar fila', autoFitRow:'Ajustar alto de fila', hideRow:'Ocultar fila', showRows:'Mostrar todas las filas ocultas',
    copyColumn:'Copiar columna', insertColumnBefore:'Insertar columna a la izquierda', insertColumnAfter:'Insertar columna a la derecha', deleteColumn:'Eliminar columna', autoFitColumn:'Ajustar ancho de columna', hideColumn:'Ocultar columna', showColumns:'Mostrar todas las columnas ocultas',
    ascending:'Ordenar ascendente', descending:'Ordenar descendente', search:'Buscar', searchValues:'Buscar en los valores del filtro', selectAll:'Seleccionar todo', empty:'Vacío', clearFilter:'Borrar filtro', apply:'Aplicar',
    multipleFills:'Elige cómo rellenar estas celdas', series:'Continuar la serie', repeat:'Repetir el patrón', pivotCell:'Tabla dinámica · doble clic o clic derecho para ajustes', listChoose:'Elegir un valor'
  },
  it: {
    grid:'Foglio di calcolo', editor:'Valore o formula della cella', fill:'Riempi le celle selezionate', fillHint:'Trascina per riempire o fai doppio clic per riempire verso il basso', filter:'Filtro', autofill:'Metodo di riempimento',
    rowHeight:'Altezza riga', columnWidth:'Larghezza colonna', height:'Altezza', width:'Larghezza', back:'Indietro',
    copyRow:'Copia riga', clear:'Cancella contenuto', insertRowBefore:'Inserisci riga sopra', insertRowAfter:'Inserisci riga sotto', deleteRow:'Elimina riga', autoFitRow:'Adatta altezza riga', hideRow:'Nascondi riga', showRows:'Mostra tutte le righe nascoste',
    copyColumn:'Copia colonna', insertColumnBefore:'Inserisci colonna a sinistra', insertColumnAfter:'Inserisci colonna a destra', deleteColumn:'Elimina colonna', autoFitColumn:'Adatta larghezza colonna', hideColumn:'Nascondi colonna', showColumns:'Mostra tutte le colonne nascoste',
    ascending:'Ordina in modo crescente', descending:'Ordina in modo decrescente', search:'Cerca', searchValues:'Cerca nei valori del filtro', selectAll:'Seleziona tutto', empty:'Vuoto', clearFilter:'Cancella filtro', apply:'Applica',
    multipleFills:'Scegli come riempire queste celle', series:'Continua la serie', repeat:'Ripeti il modello', pivotCell:'Tabella pivot · doppio clic o clic destro per le impostazioni', listChoose:'Scegli un valore'
  },
  nl: {
    grid:'Werkblad', editor:'Celwaarde of formule', fill:'Geselecteerde cellen vullen', fillHint:'Sleep om te vullen of dubbelklik om omlaag te vullen', filter:'Filter', autofill:'Vulmethode',
    rowHeight:'Rijhoogte', columnWidth:'Kolombreedte', height:'Hoogte', width:'Breedte', back:'Terug',
    copyRow:'Rij kopiëren', clear:'Inhoud wissen', insertRowBefore:'Rij erboven invoegen', insertRowAfter:'Rij eronder invoegen', deleteRow:'Rij verwijderen', autoFitRow:'Rijhoogte aanpassen', hideRow:'Rij verbergen', showRows:'Alle verborgen rijen tonen',
    copyColumn:'Kolom kopiëren', insertColumnBefore:'Kolom links invoegen', insertColumnAfter:'Kolom rechts invoegen', deleteColumn:'Kolom verwijderen', autoFitColumn:'Kolombreedte aanpassen', hideColumn:'Kolom verbergen', showColumns:'Alle verborgen kolommen tonen',
    ascending:'Oplopend sorteren', descending:'Aflopend sorteren', search:'Zoeken', searchValues:'Filterwaarden zoeken', selectAll:'Alles selecteren', empty:'Leeg', clearFilter:'Filter wissen', apply:'Toepassen',
    multipleFills:'Kies hoe deze cellen worden gevuld', series:'Reeks voortzetten', repeat:'Patroon herhalen', pivotCell:'Draaitabel · dubbelklik of klik met de rechtermuisknop voor instellingen', listChoose:'Waarde kiezen'
  }
};
export function translate(locale,key){const language=String(locale).toLowerCase().split(/[-_]/)[0];return (messages[language]?.[key]||messages.en[key]||key)}
