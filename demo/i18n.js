const text = {
  localSQLTitle: ["SQL-Abfragen", "SQL queries"],
  localSQLHint: [
    "Tabellen dieses Blatts mit SELECT abfragen. INTO Sheet2:A5 schreibt das Ergebnis als Tabelle. Unterstützt: WHERE, GROUP BY, HAVING, COUNT/SUM/AVG/MIN/MAX, ORDER BY, LIMIT. Ctrl / ⌘ + Enter führt die Abfrage aus.",
    "Query tables in this sheet with SELECT. INTO Sheet2:A5 writes the result as a table. Supports WHERE, GROUP BY, HAVING, COUNT/SUM/AVG/MIN/MAX, ORDER BY and LIMIT. Ctrl / ⌘ + Enter runs the query.",
  ],
  localSQLExample: ["Beispiel einsetzen", "Use example"],
  localSQLQuery: ["SQL-Abfrage", "SQL query"],
  localSQLRun: ["Abfrage ausführen", "Run query"],
  localSQLMaterialize: ["Als Tabelle auf neuem Blatt", "Table in new sheet"],
  localSQLMaterializeHint: [
    "Das gesamte Ergebnis als bearbeitbare Momentaufnahme speichern. Text bleibt Text; späteres Ändern der Quelldaten aktualisiert diese Tabelle nicht.",
    "Save the entire result as an editable snapshot. Text stays text; later source changes do not update this table.",
  ],
  localSQLResultName: ["SQL-Ergebnis", "SQL result"],
  localSQLMaterialized: ["Ergebnistabelle erstellt", "Result table created"],
  localSQLOpenDestination: ["Ergebnistabelle öffnen", "Open result table"],
  biMetrics: ["Kennzahlen", "Key metrics"],
  biDistinct: ["Eindeutige Werte", "Distinct values"],
  toggleTools: ["Werkzeuge ein- oder ausblenden", "Show or hide tools"],
  pivotAsFormula: ["Als Formel einfügen", "Insert as formula"],
  pivotFormulaHint: [
    "Ergebnis wächst automatisch in freie Zellen. Der Quellbereich bleibt fest; Filter gelten bei „Sichtbare Zeilen“. Bestehende Pivot-Objekte werden nicht umgewandelt.",
    "Results expand into empty cells. The source range stays fixed; filters apply with “Visible rows”. Existing pivot objects are not converted.",
  ],
  pivotFormulaInserted: [
    "Pivot-Formel eingefügt. Einstellungen in der Eingabezeile bearbeiten.",
    "Pivot formula inserted. Edit its settings in the formula bar.",
  ],
  pivotFormulaSelectionEmpty: [
    "Die Auswahl enthält keine Datenzeilen der Quelltabelle.",
    "The selection contains no data rows from the source table.",
  ],

  moreTools: ["Weitere Werkzeuge ▾", "More tools ▾"],
  sourceTable: ["Quelltabelle", "Source table"],
  pivotDestination: ["Zielzelle", "Destination cell"],

  sheetObjects: ["Objekte", "Objects"],
  objectsHint: [
    "Objekte aller Blätter. Anklicken öffnet das Blatt und den Bereich. Entfernen einer Tabelle behält ihre Zellwerte.",
    "Objects across all sheets. Click to open the sheet and range. Removing a table preserves cell values.",
  ],
  noObjects: [
    "Noch keine Tabellen, Pivots oder Diagramme im Workbook.",
    "No tables, pivots or charts in this workbook yet.",
  ],
  objectTables: ["Tabellen", "Tables"],
  objectPivots: ["Pivot-Tabellen", "Pivot tables"],
  objectCharts: ["Diagramme", "Charts"],
  removeObject: ["Objekt entfernen", "Remove object"],
  selectTableRange: [
    "Markiere den gewünschten Datenbereich einschließlich Kopfzeile.",
    "Select the data range including its header row.",
  ],

  sidebarPickTarget: [
    "Wähle eine leere Zielzelle außerhalb der Quelldaten.",
    "Select an empty destination cell outside the source data.",
  ],
  sidebarOnDemand: ["Auf Anfrage", "On demand"],
  sidebarWorkspace: ["Arbeitsbereich", "Workspace"],
  sidebarConfigure: ["Einrichten", "Configure"],
  sidebarResults: ["Ergebnis", "Results"],
  sidebarLive: ["Automatisch", "Automatic"],
  sidebarEmpty: [
    "Formatiere deine Daten als Tabelle, um eine Pivot-Auswertung einzurichten.",
    "Format your data as a table to configure a pivot summary.",
  ],
  sidebarPreview: ["Vorschau anzeigen →", "Show preview →"],
  sidebarHelp: ["So funktioniert die Auswertung", "How analysis works"],
  sidebarRefresh: ["Aktualisieren", "Refresh"],
  sidebarDrillHint: [
    "Wert anklicken, um die Quelldatensätze zu öffnen.",
    "Click a value to open its source records.",
  ],
  sidebarChart: ["Grafischer Vergleich", "Visual comparison"],
  sidebarTarget: [
    "Zielzelle für Pivot, z. B. F1",
    "Pivot destination cell, e.g. F1",
  ],
  sidebarUseSelection: ["Auswahl verwenden", "Use selection"],

  chartLinkHint: [
    "Kategorie anklicken oder mit Pfeiltasten wählen und Enter drücken, um die Tabelle zu filtern. Zusammengefasste „Andere“-Segmente sind ausgenommen.",
    "Click a category or select it with arrows and press Enter to filter the table. Combined Other slices are excluded.",
  ],
  captureSelection: ["Aktuelle Auswahl übernehmen", "Use current selection"],
  analysisScope: ["Datenbasis", "Data scope"],
  scopeVisible: ["Sichtbare Zeilen", "Visible rows"],
  scopeAll: ["Alle Zeilen", "All rows"],
  scopeSelection: ["Ausgewählte Zeilen", "Selected rows"],
  analysisHint: [
    "Gilt für Pivot-Vorschau, neue Pivots und Diagramme. „Ausgewählte Zeilen“ merkt sich die Auswahl beim Umschalten. Pivot-Werte öffnen ihre Quelldaten.",
    "Applies to pivot preview, new pivots and charts. Selected rows captures the selection when switching scope. Pivot values open their source records.",
  ],
  heatmap: ["Heatmap", "Heatmap"],
  sourceRows: ["Quelldatensätze", "Source records"],
  selectPivotValue: [
    "Wähle eine Ergebniszelle einer eingefügten Pivot-Tabelle.",
    "Select a result cell in an inserted pivot table.",
  ],
  row: ["Zeile", "Row"],
  previousPage: ["Vorherige Seite", "Previous page"],
  nextPage: ["Nächste Seite", "Next page"],
  simulations: ["Simulationen", "Simulations"],
  demoLife: ["Conway’s Game of Life", "Conway’s Game of Life"],
  demoMandelbrot: ["Mandelbrot", "Mandelbrot"],
  simulationHint: [
    "Die Vorschau bleibt getrennt vom Workbook. Erst „Als neues Blatt einfügen“ speichert den aktuellen Zustand.",
    "The preview is separate from your workbook. Insert as new sheet saves the current state.",
  ],
  simulationKeyboard: [
    "Game of Life: Zellen anklicken oder mit Pfeiltasten wählen und mit Leertaste umschalten.",
    "Game of Life: click cells or select with arrow keys and toggle with Space.",
  ],
  simulationFormulas: [
    "Mandelbrot als Zellformeln einfügen",
    "Insert Mandelbrot as cell formulas",
  ],
  simulationInsert: ["Als neues Blatt einfügen", "Insert as new sheet"],
  simulationInserted: [
    "Simulation als neues Blatt eingefügt.",
    "Simulation inserted as a new sheet.",
  ],
  speed: ["Schritte pro Sekunde", "Steps per second"],
  wrapEdges: ["Ränder verbinden", "Wrap edges"],
  span: ["Ausschnittbreite", "View width"],
  iterations: ["Iterationen", "Iterations"],
  singleStep: ["Einzelschritt", "Single step"],
  reset: ["Zurücksetzen", "Reset"],
  pause: ["Pause", "Pause"],
  start: ["Start", "Start"],
  calculate: ["Berechnen", "Calculate"],
  progress: ["Fortschritt", "Progress"],
  generation: ["Generation", "Generation"],
  livingCells: ["lebende Zellen", "living cells"],

  ocean: ["Ozean", "Ocean"],
  paper: ["Papier", "Paper"],
  midnight: ["Mitternacht", "Midnight"],
  graphite: ["Graphit", "Graphite"],
  contrast: ["Hoher Kontrast", "High contrast"],
  appearanceButton: ["Farben & Schrift", "Colors & typeface"],
  appearanceTitle: ["Darstellung anpassen", "Customize appearance"],
  appearanceHint: [
    "Wähle eine Farbwelt und Schrift. Die Auswahl wirkt sofort und wird auf diesem Gerät gespeichert.",
    "Choose a color theme and typeface. Changes apply instantly and are saved on this device.",
  ],
  colorTheme: ["Farbwelt", "Color theme"],
  typeface: ["Schrift", "Typeface"],
  fontSystem: ["System", "System"],
  fontSerif: ["Serif", "Serif"],
  fontMono: ["Monospace", "Monospace"],
  freezeTooLarge: [
    "Die Fixierung würde den sichtbaren Bereich ausfüllen. Wähle eine Zelle weiter oben oder links.",
    "The frozen area would fill the viewport. Choose a cell closer to the top or left.",
  ],
  freezeRowShort: ["Oberste Zeile", "Top row"],
  freezeColumnShort: ["Erste Spalte", "First column"],
  freezeSelectionShort: ["Bis Auswahl", "Up to selection"],
  unfreezeShort: ["Aufheben", "Unfreeze"],
  freezeRow: ["Oberste Zeile fixieren", "Freeze top row"],
  freezeColumn: ["Erste Spalte fixieren", "Freeze first column"],
  freezeSelection: [
    "Bis zur aktiven Zelle fixieren",
    "Freeze up to active cell",
  ],
  freezeSelectionHint: [
    "Fixiert alle Zeilen oberhalb und Spalten links der aktiven Zelle.",
    "Freeze all rows above and columns to the left of the active cell.",
  ],
  unfreeze: ["Fixierung aufheben", "Unfreeze panes"],
  demoTimetable: ["Stundenplan", "Class timetable"],
  demoWeek: ["Wochenplan", "Weekly planner"],
  demoTimesheet: ["Zeiterfassung", "Timesheet"],
  demoComparison: ["Angebotsvergleich", "Offer comparison"],
  demoLearning: ["Lernfortschritt", "Learning progress"],
  loadFile: ["Laden …", "Open …"],
  saveFile: ["Speichern", "Save"],
  demoContents: ["Demo-Inhalte", "Demo contents"],
  demoBlank: ["Leeres Blatt", "Blank sheet"],
  demoBudget: ["Budget", "Budget"],
  demoProject: ["Projektplan", "Project plan"],
  demoInventory: ["Inventar", "Inventory"],
  demoText: ["Textfunktionen", "Text functions"],
  demoGeometry: ["Geometrie", "Geometry"],
  loadDemo: ["Beispiel laden", "Load example"],
  loadDemoHint: [
    "Ersetzt das Blatt · rückgängig möglich",
    "Replaces sheet · can be undone",
  ],
  demoLoaded: [
    "Inhalt geladen. Rückgängig stellt das vorherige Blatt wieder her.",
    "Content loaded. Undo restores the previous sheet.",
  ],
  pdfPrint: ["PDF / Drucken", "PDF / Print"],
  exportRange: [
    "Bereich (Workbook speichert alles)",
    "Range (workbook saves everything)",
  ],
  usedCells: ["Benutzter Bereich", "Used range"],
  visualExportHint: [
    "PNG/PDF exportieren sichtbare Zellen im hellen Drucklayout. PDF öffnet den Druckdialog; dort „Als PDF speichern“ wählen. Speichern lädt eine bearbeitbare Workbook-Datei herunter.",
    "PNG/PDF export visible cells in a light print layout. PDF opens the print dialog; choose Save as PDF there. Save downloads an editable workbook file.",
  ],
  filledCells: ["Belegte sichtbare Zellen", "Populated visible cells"],
  refreshAnalysis: ["Auswertung aktualisieren", "Refresh analysis"],
  analysisManual: [
    "Großer Bereich: Auswertung bei Bedarf aktualisieren.",
    "Large range: refresh analysis on demand.",
  ],
  analysisTooLarge: [
    "Für die Vorschau bitte eine Tabelle mit höchstens 500.000 Zellen wählen.",
    "For a preview, choose a table with at most 500,000 cells.",
  ],
  analysisTruncated: [
    "Vorschau: erste 200 Ergebniszeilen.",
    "Preview: first 200 result rows.",
  ],
  savingLocal: ["Wird lokal gespeichert …", "Saving locally …"],
  savedLocal: ["Lokal gespeichert", "Saved locally"],
  saveFailed: [
    "Lokales Speichern nicht verfügbar – bitte exportieren",
    "Local saving unavailable — please export",
  ],
  total: ["Gesamt", "Total"],
  column: ["Spalte", "Column"],
  worksheet: ["Arbeitsblatt", "Worksheet"],
  title: ["Tabelle 1", "Sheet 1"],
  local: ["Lokal · ohne Cloud", "Local · no cloud"],
  file: ["Datei", "File"],
  import: ["Importieren", "Import"],
  export: ["Exportieren", "Export"],
  share: ["Teilen", "Share"],
  home: ["Allgemein", "General"],
  data: ["Daten", "Data"],
  view: ["Ansicht", "View"],
  undo: ["Rückgängig", "Undo"],
  redo: ["Wiederholen", "Redo"],
  history: ["Verlauf", "History"],
  font: ["Text", "Text"],
  bold: ["Fett", "Bold"],
  italic: ["Kursiv", "Italic"],
  left: ["Linksbündig", "Align left"],
  center: ["Zentriert", "Align center"],
  right: ["Rechtsbündig", "Align right"],
  alignment: ["Ausrichtung", "Alignment"],
  number: ["Zahlenformat", "Number format"],
  general: ["Standard", "General"],
  decimal: ["Zahl", "Number"],
  currency: ["Währung (€)", "Currency (€)"],
  percent: ["Prozent", "Percentage"],
  sum: ["Summe", "Sum"],
  average: ["Mittelwert", "Average"],
  count: ["Anzahl", "Count"],
  min: ["Minimum", "Minimum"],
  max: ["Maximum", "Maximum"],
  autosum: ["AutoSumme", "AutoSum"],
  find: ["Suchen", "Find"],
  tools: ["Werkzeuge", "Tools"],
  table: ["Als Tabelle", "Format as table"],
  ascending: ["Aufsteigend", "Ascending"],
  descending: ["Absteigend", "Descending"],
  clearFilters: ["Filter löschen", "Clear filters"],
  sorting: ["Sortieren & Filtern", "Sort & filter"],
  autoWidth: ["Spaltenbreite anpassen", "Fit column width"],
  unhide: ["Alles einblenden", "Unhide all"],
  layout: ["Layout", "Layout"],
  readOnly: ["Schreibschutz", "Read-only"],
  inspector: ["Auswertung", "Insights"],
  help: ["Kurzhilfe", "Quick help"],
  language: ["Sprache", "Language"],
  theme: ["Darstellung", "Appearance"],
  system: ["System", "System"],
  light: ["Hell", "Light"],
  dark: ["Waldgrün", "Forest green"],
  address: ["Zelle oder Bereich, z. B. A1:C10", "Cell or range, e.g. A1:C10"],
  formula: ["Zellwert oder Formel", "Cell value or formula"],
  apply: ["Übernehmen", "Apply"],
  cancel: ["Abbrechen", "Cancel"],
  formulaPlaceholder: [
    "Wert oder Formel eingeben …",
    "Enter a value or formula …",
  ],
  skip: ["Zur Tabelle springen", "Skip to spreadsheet"],
  gridHint: [
    "Pfeiltasten navigieren. Umschalt + Pfeiltasten markieren. Enter bearbeitet. Alt + Pfeil nach unten öffnet den Spaltenfilter. Tab wechselt zum nächsten Bedienelement.",
    "Arrow keys navigate. Shift + arrows select. Enter edits. Alt + Down opens the column filter. Tab moves to the next control.",
  ],
  searchPlaceholder: [
    "Werte und Formeln durchsuchen …",
    "Search values and formulas …",
  ],
  previous: ["Vorheriger Treffer", "Previous match"],
  next: ["Nächster Treffer", "Next match"],
  close: ["Schließen", "Close"],
  noMatches: ["Keine Treffer", "No matches"],
  matches: ["Treffer", "matches"],
  pivotTool: ["Pivot-Tabelle", "Pivot table"],
  pivotToolHint: [
    "Pivot-Auswertung öffnen und ins Blatt einfügen",
    "Open pivot settings and insert a summary into the sheet",
  ],
  fitColumnsTool: ["Breite anpassen", "Fit columns"],
  overview: ["Auf einen Blick", "At a glance"],
  visibleRows: ["Sichtbare Datensätze", "Visible records"],
  formulas: ["Formeln", "Formulas"],
  pivot: ["Pivot-Auswertung", "Pivot summary"],
  groupBy: ["Gruppieren nach", "Group by"],
  columns: ["Spalten", "Columns"],
  values: ["Werte", "Values"],
  aggregate: ["Berechnung", "Calculation"],
  none: ["Keine", "None"],
  pivotHint: [
    "Wertet die Tabelle gemäß der gewählten Datenbasis aus.",
    "Summarizes table rows using the selected data scope.",
  ],
  noTable: [
    "Formatiere deine Daten als Tabelle, um sie auszuwerten.",
    "Format your data as a table to see insights.",
  ],
  noData: ["Keine sichtbaren Daten", "No visible data"],
  chart: [
    "Vergleich der ersten Wertespalte",
    "Comparison of the first value column",
  ],
  sheet: ["Blattname", "Sheet name"],
  ready: ["Bereit", "Ready"],
  editing: ["Bearbeiten", "Editing"],
  selection: ["Auswahl", "Selection"],
  rows: ["Zeilen", "Rows"],
  offline: [
    "Dein Blatt wird automatisch in diesem Browser gespeichert. Nutze Exportieren für eine zusätzliche Sicherung.",
    "Your sheet is saved automatically in this browser. Export a copy for an additional backup.",
  ],
  exportTitle: ["Tabelle exportieren", "Export spreadsheet"],
  exportHint: [
    "Workbook erhält Formeln, Formatierung und Layout. Die anderen Formate exportieren die Daten.",
    "Workbook preserves formulas, formatting and layout. Other formats export the data.",
  ],
  format: ["Dateiformat", "File format"],
  download: ["Herunterladen", "Download"],
  downloaded: ["Download gestartet", "Download started"],
  shareTitle: ["Mit einem Link teilen", "Share with a link"],
  shareHint: [
    "Der Link enthält eine Kopie des gesamten Blatts – einschließlich ausgeblendeter Zellen. Jeder mit dem Link kann die Daten öffnen.",
    "The link contains a copy of the entire sheet, including hidden cells. Anyone with the link can open the data.",
  ],
  copy: ["Link kopieren", "Copy link"],
  copied: ["Link kopiert", "Link copied"],
  manualCopy: [
    "Kopieren nicht möglich. Markiere den Link und kopiere ihn manuell.",
    "Copy unavailable. Select the link and copy it manually.",
  ],
  shareURL: ["Teilbarer Link", "Shareable link"],
  longLink: [
    "Dieser Link ist sehr lang. Ein Workbook-Export ist für große Tabellen zuverlässiger.",
    "This link is very long. A workbook export is more reliable for large sheets.",
  ],
  recalculate: ["Neu berechnen", "Recalculate"],
  recalculateHint: [
    "Formeln neu berechnen und neue Zufallswerte erzeugen",
    "Recalculate formulas and generate new random values",
  ],
  recalculated: ["Formeln neu berechnet", "Formulas recalculated"],
  inferImportTypes: [
    "Datentypen erkennen (ausschalten: alles als Text)",
    "Detect data types (off: keep everything as text)",
  ],
  applyImport: ["Datei übernehmen", "Import file"],
  importPreviewHint: [
    "CSV/TSV: Original → Wert (Typ). Prüfe insbesondere Kennungen und Dezimalzahlen. Lange Ganzzahlen bleiben exakt, nicht verlustfrei konvertierbare Dezimalzahlen bleiben Text.",
    "CSV/TSV: original → value (type). Review identifiers and decimals. Large integers remain exact; decimals that cannot be converted without losing digits remain text.",
  ],
  importPreviewSample: [
    "Vorschau: bis zu 6 Zeilen und 8 Spalten",
    "Preview: up to 6 rows and 8 columns",
  ],
  importPreviewOther: [
    "Für dieses Format ist keine Typvorschau verfügbar.",
    "Type preview is not available for this format.",
  ],
  expandFormula: ["Eingabezeile vergrößern", "Expand formula input"],
  functionHelp: ["Funktionshilfe", "Function help"],
  functionSearch: ["Funktion suchen …", "Find a function …"],
  references: ["Zellbezüge", "Cell references"],
  precedents: ["Vorgänger", "Precedents"],
  dependents: ["Nachfolger", "Dependents"],
  moveRange: ["Auswahl verschieben", "Move selection"],
  moveTarget: ["Linke obere Zielzelle", "Top-left destination cell"],
  moveHint: [
    "Zellbezüge folgen der Quelle, auch absolute Bezüge. Vorhandene Zielwerte werden ersetzt.",
    "References follow the source, including absolute references. Existing destination values are replaced.",
  ],
  moveRejected: [
    "Dieser Bereich kann nicht verschoben werden.",
    "This range cannot be moved.",
  ],
  noReferences: [
    "Keine Vorgänger oder Nachfolger gefunden.",
    "No precedents or dependents found.",
  ],
  traceHint: [
    "Verfolgt Formeln, Pivot- und SQL-Ergebnisse über alle Blätter und mehrere Schritte. Pivot/SQL zeigen den vollständigen Eingabebereich. Anklicken zum Öffnen.",
    "Trace formulas, pivot and SQL results across worksheets and multiple steps. Pivot/SQL show the complete input range. Click to navigate.",
  ],
  multilineHint: [
    "Enter: übernehmen ↓ · Strg/⌘ + Enter: ↑ · Tab: → · Shift + Tab: ← · Shift + Enter: neue Zeile · Esc: verwerfen",
    "Enter: apply ↓ · Ctrl/⌘ + Enter: ↑ · Tab: → · Shift + Tab: ← · Shift + Enter: new line · Esc: discard",
  ],
  historyConflict: [
    "Andere Blattwerte wurden inzwischen geändert. Dieser Verlaufsschritt wurde nicht angewendet.",
    "Other sheet values changed since this step. The history step was not applied.",
  ],
  insertPivot: ["Ins Blatt einfügen", "Insert into sheet"],
  removePivot: ["Pivot entfernen", "Remove pivot"],
  pivotInserted: [
    "Pivot eingefügt. Ergebniszellen können in Formeln verwendet werden.",
    "Pivot inserted. Result cells can be referenced in formulas.",
  ],
  pivotInsertHint: [
    "Wähle eine freie Zielzelle außerhalb der Quelldaten. Die gewählte Datenbasis wird im Pivot gespeichert; „Sichtbare Zeilen“ folgt den Tabellenfiltern.",
    "Select an empty destination outside the source data. The selected scope is stored with the pivot; Visible rows follows table filters.",
  ],
  textFunctions: ["Text & reguläre Ausdrücke", "Text & regular expressions"],
  textHint: [
    "TRIM entfernt äußere Leerzeichen; SQUEEZE fasst auch innere zusammen. SUBSTR zählt ab 1; negative Positionen zählen vom Ende. REGEXP liefert wahr oder falsch.",
    "TRIM removes outer whitespace; SQUEEZE also collapses internal whitespace. SUBSTR counts from 1; negative positions count from the end. REGEXP returns true or false.",
  ],
  extendedFunctions: [
    "Geo, Geometrie, Hashes & Zufall",
    "Geo, geometry, hashes & randomness",
  ],
  extendedHint: [
    "Geo-Koordinaten: Breitengrad, Längengrad in Grad. Entfernungen standardmäßig in km. RANDOM.SEEDED liefert reproduzierbare Werte; andere Zufallswerte ändern sich bei Neuberechnung.",
    "Geo coordinates: latitude, longitude in degrees. Distances default to km. RANDOM.SEEDED produces repeatable values; other random values change on recalculation.",
  ],
  functionReference: [
    "Funktionsreferenz mit Einheiten und Beispielen (Englisch, Markdown)",
    "Function reference with units and examples (English, Markdown)",
  ],
  undone: ["Änderung rückgängig gemacht", "Change undone"],
  redone: ["Änderung wiederhergestellt", "Change redone"],
  helpTitle: ["Schneller arbeiten", "Work faster"],
  helpEdit: ["Zelle bearbeiten", "Edit cell"],
  helpSelect: ["Bereich markieren", "Select range"],
  helpFilter: ["Spaltenfilter öffnen", "Open column filter"],
  helpFind: ["Im Blatt suchen", "Find in sheet"],
  helpUndo: ["Rückgängig / Wiederholen", "Undo / Redo"],
  helpNavigate: [
    "Zellenauswahl bewegen (außerhalb der Bearbeitung)",
    "Move cell selection (when not editing)",
  ],
  helpCommitDown: ["Übernehmen und nach unten", "Apply and move down"],
  helpCommitUp: ["Übernehmen und nach oben", "Apply and move up"],
  helpCommitAcross: [
    "Übernehmen und rechts / links",
    "Apply and move right / left",
  ],
  helpNewline: ["Zeilenumbruch beim Bearbeiten", "New line while editing"],
  helpLeave: [
    "Nächstes Bedienelement (außerhalb der Bearbeitung)",
    "Next control (when not editing)",
  ],
  helpFormula: [
    "Formeln beginnen mit =. Zellbezüge und Funktionen bleiben beim Sprachwechsel unverändert.",
    "Formulas start with =. Cell references and function names stay unchanged when switching languages.",
  ],
  invalidAddress: [
    "Bitte einen Bereich bis IV10000 mit höchstens 10.000 Zellen eingeben.",
    "Enter a range up to IV10000 with at most 10,000 cells.",
  ],
  imported: ["Datei importiert", "File imported"],
  failed: ["Aktion fehlgeschlagen", "Action failed"],
  invalidLink: [
    "Der geteilte Link konnte nicht geladen werden. Das Beispiel wurde geöffnet.",
    "The shared link could not be loaded. The example has been opened.",
  ],
  sumHint: [
    "Wähle einen Zahlenbereich mit einer freien Zelle direkt darunter.",
    "Select a numeric range with an empty cell directly below.",
  ],
  sumAdded: [
    "Summe unter der Auswahl eingefügt",
    "Sum inserted below the selection",
  ],
  sortHint: [
    "Wähle eine Spalte innerhalb der Tabelle.",
    "Select a column inside the table.",
  ],
  importTitle: ["Datei öffnen", "Open a file"],
  importHint: [
    "Der Import ersetzt das aktuelle Blatt. Du kannst ihn mit Rückgängig zurücknehmen.",
    "Import replaces the current sheet. You can undo it.",
  ],
  chooseFile: ["Datei auswählen", "Choose file"],
  replaceFormats: [
    "CSV, TSV, JSON, NDJSON, HTML, Markdown oder SpreadsheetML XML",
    "CSV, TSV, JSON, NDJSON, HTML, Markdown or SpreadsheetML XML",
  ],
  savedPrefs: [
    "Sprache und Darstellung werden auf diesem Gerät gespeichert.",
    "Language and appearance preferences are saved on this device.",
  ],
  rename: ["Blatt umbenennen", "Rename sheet"],
  clearStyle: ["Textformat zurücksetzen", "Reset text style"],
  tableHint: [
    "Die Auswahl wird zur eigenen Tabelle. Bei einer einzelnen Zelle wird der zusammenhängende Datenblock erkannt.",
    "The selection becomes an independent table. A single cell detects its contiguous data block.",
  ],
};
import fr from "./locales/fr.js";
import es from "./locales/es.js";
import it from "./locales/it.js";
import nl from "./locales/nl.js";
import featureText from "../src/feature-i18n.js";

const locales = { fr, es, it, nl };
/** UI languages offered by the demo; German and English are complete, others fall back to English per key. */
export const languages = [
  ["de", "Deutsch"],
  ["en", "English"],
  ["fr", "Français"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["nl", "Nederlands"],
];
export function detectLanguage(candidates = []) {
  const codes = languages.map(([code]) => code);
  for (const candidate of candidates) {
    const code = String(candidate || "")
      .toLowerCase()
      .split(/[-_]/)[0];
    if (codes.includes(code)) return code;
  }
  return "en";
}
// Newer feature texts live in i18n-features.js as [de, en, fr, es, it, nl].
const order = ["de", "en", "fr", "es", "it", "nl"];
export function translator(language) {
  const table = locales[language],
    index = Math.max(0, order.indexOf(language));
  return (key) => {
    const extra = featureText[key];
    if (language === "de") return text[key]?.[0] ?? extra?.[0] ?? key;
    return (
      table?.[key] ?? extra?.[index] ?? extra?.[1] ?? text[key]?.[1] ?? key
    );
  };
}
