export function demoWorkbook(key,language){
  const de=language==='de',pick=(a,b)=>de?a:b;
  const demos={
    blank:[pick('Tabelle 1','Sheet 1'),[]],
    timetable:[pick('Stundenplan','Class timetable'),[
      [pick('Zeit','Time'),pick('Montag','Monday'),pick('Dienstag','Tuesday'),pick('Mittwoch','Wednesday'),pick('Donnerstag','Thursday'),pick('Freitag','Friday')],
      ['08:00–08:45',pick('Mathematik','Mathematics'),pick('Englisch','English'),pick('Biologie','Biology'),pick('Mathematik','Mathematics'),pick('Kunst','Art')],
      ['08:50–09:35',pick('Deutsch','German'),pick('Geschichte','History'),pick('Mathematik','Mathematics'),pick('Englisch','English'),pick('Kunst','Art')],
      ['09:35–09:55',...Array(5).fill(pick('Pause','Break'))],
      ['09:55–10:40',pick('Biologie','Biology'),pick('Sport','PE'),pick('Deutsch','German'),pick('Physik','Physics'),pick('Musik','Music')],
      ['10:45–11:30',pick('Geschichte','History'),pick('Sport','PE'),pick('Englisch','English'),pick('Physik','Physics'),pick('Deutsch','German')],
      ['11:35–12:20',pick('Musik','Music'),pick('Informatik','Computing'),pick('Geografie','Geography'),pick('Informatik','Computing'),pick('Klassenrat','Class meeting')]
    ]],
    week:[pick('Wochenplan','Weekly planner'),[
      [pick('Wochentag','Day'),pick('Vormittag','Morning'),pick('Nachmittag','Afternoon'),pick('Abend','Evening'),pick('Priorität','Priority')],
      [pick('Montag','Monday'),pick('Woche planen','Plan the week'),pick('Projektarbeit','Project work'),pick('Sport','Exercise'),pick('Wochenziel festlegen','Set weekly goal')],
      [pick('Dienstag','Tuesday'),pick('Lernen','Study'),pick('Besorgungen','Errands'),pick('Lesen','Reading'),''],
      [pick('Mittwoch','Wednesday'),pick('Projektarbeit','Project work'),pick('Termin','Appointment'),pick('Freizeit','Free time'),''],
      [pick('Donnerstag','Thursday'),pick('Lernen','Study'),pick('Projektarbeit','Project work'),pick('Sport','Exercise'),''],
      [pick('Freitag','Friday'),pick('Offene Aufgaben','Finish tasks'),pick('Wochenrückblick','Weekly review'),pick('Freunde treffen','Meet friends'),''],
      [pick('Samstag','Saturday'),pick('Einkaufen','Shopping'),pick('Ausflug','Day trip'),'',''],
      [pick('Sonntag','Sunday'),pick('Erholung','Rest'),'',pick('Neue Woche planen','Plan next week'),'']
    ]],
    timesheet:[pick('Zeiterfassung','Timesheet'),[
      [pick('Datum','Date'),pick('Tätigkeit','Activity'),pick('Anwesenheit (h)','Attendance (h)'),pick('Pause (min)','Break (min)'),pick('Arbeitszeit (h)','Working time (h)')],
      ['2026-10-05',pick('Planung','Planning'),8.5,30,'=C2-D2/60'],
      ['2026-10-06',pick('Umsetzung','Implementation'),8,45,'=C3-D3/60'],
      ['2026-10-07',pick('Dokumentation','Documentation'),7.5,30,'=C4-D4/60'],
      ['2026-10-08',pick('Umsetzung','Implementation'),8,30,'=C5-D5/60'],
      ['2026-10-09',pick('Abstimmung','Coordination'),6,15,'=C6-D6/60'],
      [pick('Gesamt','Total'),'','=SUM(C2:C6)','=SUM(D2:D6)','=SUM(E2:E6)']
    ]],
    comparison:[pick('Angebotsvergleich','Offer comparison'),[
      [pick('Angebot','Offer'),pick('Preis','Price'),pick('Qualität (0–10)','Quality (0–10)'),pick('Punkte (70 % Qualität)','Score (70% quality)')],
      ['A',120,8,'=ROUND(C2*0.7+MIN($B$2:$B$4)/B2*10*0.3;2)'],
      ['B',95,7,'=ROUND(C3*0.7+MIN($B$2:$B$4)/B3*10*0.3;2)'],
      ['C',150,9,'=ROUND(C4*0.7+MIN($B$2:$B$4)/B4*10*0.3;2)']
    ]],
    learning:[pick('Lernfortschritt','Learning progress'),[
      [pick('Thema','Topic'),pick('Geplante Einheiten','Planned units'),pick('Erledigte Einheiten','Completed units'),pick('Fortschritt','Progress'),pick('Verbleibend','Remaining')],
      [pick('Sprachen','Languages'),20,8,'=IF(B2=0;0;C2/B2)','=MAX(0;B2-C2)'],
      [pick('Mathematik','Mathematics'),12,9,'=IF(B3=0;0;C3/B3)','=MAX(0;B3-C3)'],
      [pick('Programmieren','Programming'),16,4,'=IF(B4=0;0;C4/B4)','=MAX(0;B4-C4)'],
      [pick('Gesamt','Total'),'=SUM(B2:B4)','=SUM(C2:C4)','=IF(B5=0;0;C5/B5)','=SUM(E2:E4)']
    ]],
    budget:[pick('Budget','Budget'),[[pick('Posten','Item'),pick('Geplant','Planned'),pick('Ist','Actual'),pick('Differenz','Difference')],[pick('Material','Materials'),1200,1050,'=B2-C2'],[pick('Transport','Transport'),250,310,'=B3-C3'],[pick('Sonstiges','Other'),150,95,'=B4-C4'],[pick('Gesamt','Total'),'=SUM(B2:B4)','=SUM(C2:C4)','=SUM(D2:D4)']]],
    project:[pick('Projektplan','Project plan'),[[pick('Aufgabe','Task'),pick('Start','Start'),pick('Tage','Days'),pick('Status','Status')],[pick('Planung','Planning'),'2026-10-01',3,pick('Erledigt','Done')],[pick('Umsetzung','Implementation'),'2026-10-05',10,pick('In Arbeit','In progress')],[pick('Abnahme','Review'),'2026-10-19',2,pick('Offen','Open')]]],
    inventory:[pick('Inventar','Inventory'),[[pick('Artikel','Item'),pick('Gruppe','Group'),pick('Anzahl','Quantity'),pick('Einzelwert','Unit value'),pick('Gesamt','Total')],[pick('Stift','Pen'),pick('Büro','Office'),20,1.5,'=C2*D2'],[pick('Heft','Notebook'),pick('Büro','Office'),12,3.2,'=C3*D3'],[pick('Kabel','Cable'),pick('Technik','Equipment'),5,8.9,'=C4*D4'],[pick('Adapter','Adapter'),pick('Technik','Equipment'),3,19,'=C5*D5']]],
    text:[pick('Textfunktionen','Text functions'),[[pick('Eingabe','Input'),'TRIM','UPPER','SUBSTR'],['  Hello world  ','=TRIM(A2)','=UPPER(B2)','=SUBSTR(B2;1;5)'],['  tinyDatagrid  ','=TRIM(A3)','=UPPER(B3)','=SUBSTR(B3;1;4)'],['SEPT1','=TRIM(A4)','=UPPER(B4)','=SUBSTR(B4;1;4)']]],
    json:[pick('JSON-Daten','JSON data'),[
      [pick('Bestellung','Order'),pick('JSON (eine Bestellung pro Zelle)','JSON (one order per cell)'),pick('Kunde','Customer'),pick('Stadt','City'),pick('Positionen','Items'),pick('Summe','Total')],
      [1001,'{"customer":"Ann","city":"Bonn","items":[{"sku":"A-1","qty":2,"price":9.9},{"sku":"B-2","qty":1,"price":24.5}]}','=JSON.GET(B2:B4;"customer")','=JSON.GET(B2:B4;"city")','=JSON.LENGTH(B2:B4;"items")','=MAP(B2:B4;LAMBDA(order;SUMPRODUCT(JSON.GET(order;"items[*].qty");JSON.GET(order;"items[*].price"))))'],
      [1002,'{"customer":"Ben","city":"Köln","items":[{"sku":"C-3","qty":10,"price":3.2}]}'],
      [1003,'{"customer":"Cy","city":"Essen","items":[{"sku":"A-1","qty":1,"price":9.9},{"sku":"C-3","qty":4,"price":3.2},{"sku":"B-2","qty":2,"price":24.5}]}'],
      [],
      [pick('Produkte (JSON-Array)','Products (JSON array)'),'[{"sku":"A-1","name":"Schraube","price":9.9,"stock":120},{"sku":"B-2","name":"Mutter","price":24.5,"stock":40},{"sku":"C-3","name":"Bolzen","price":3.2,"stock":0}]'],
      [pick('Als Tabelle (füllt Zellen automatisch):','As a table (fills cells automatically):')],
      ['=JSON.TABLE(B6)'],
      [],[],[],
      [pick('Preis von B-2','Price of B-2'),'=JSON.LOOKUP("B-2";B6;"sku";"price")'],
      [pick('Lagerbestand gesamt','Total stock'),'=SUM(JSON.GET(B6;"[*].stock"))'],
      [pick('Ausverkauft','Sold out'),'=JSON.STRINGIFY(JSON.GET(B6;"[?(@.stock==0)].name"))'],
      [pick('Objekt aus Zellen bauen','Build an object from cells'),'=JSON.OBJECT("sku";A9;"price";C9)']
    ]],
    arrays:[pick('Dynamische Arrays','Dynamic arrays'),[
      [pick('Name','Name'),pick('Punkte','Points'),'',pick('Sortiert (SORT)','Sorted (SORT)'),'','',pick('Eindeutig (UNIQUE)','Unique (UNIQUE)'),'',pick('Bonus ×1,1','Bonus ×1.1')],
      ['Ann',82,'','=SORT(A2:B7;2;-1)','','','=UNIQUE(B2:B7)','','=ROUND(B2:B7*1.1;1)'],
      ['Ben',91],['Cy',75],['Dana',91],['Eli',68],['Fay',88],
      [],
      [pick('Gefiltert (FILTER ≥ 85)','Filtered (FILTER ≥ 85)'),'','',pick('Folge (SEQUENCE)','Sequence (SEQUENCE)'),'','','','',pick('Großbuchstaben','Upper case')],
      ['=FILTER(A2:B7;B2:B7>=85;"–")','','','=SEQUENCE(3;4)','','','','','=UPPER(A2:A7)'],
      [],[],[],[],
      [pick('Summe der Bonuspunkte','Sum of bonus points'),'=SUM(I2#)'],
      [pick('Zeilen der Sortierung','Rows of the sorted list'),'=ROWS(D2#)'],
      [pick('Alle Namen','All names'),'=TEXTJOIN(", ";TRUE;A2:A7)']
    ]],
    geometry:[pick('Geometrie','Geometry'),[[pick('Radius','Radius'),pick('Kreisfläche','Circle area'),pick('Umfang','Circumference')],[1,'=GEOM.CIRCLE.AREA(A2)','=GEOM.CIRCLE.CIRCUMFERENCE(A2)'],[5,'=GEOM.CIRCLE.AREA(A3)','=GEOM.CIRCLE.CIRCUMFERENCE(A3)'],[10,'=GEOM.CIRCLE.AREA(A4)','=GEOM.CIRCLE.CIRCUMFERENCE(A4)']]]
  };
  if(!Object.hasOwn(demos,key))throw new Error('Unknown demo');
  const [name,data]=demos[key],cells=[];data.forEach((row,r)=>row.forEach((value,c)=>cells.push({row:r,col:c,...(typeof value==='string'&&value.startsWith('=')?{formula:value}:{value}),...(r===0?{style:{fontWeight:'bold'}}:{})})));
  const calendar=key==='timetable'||key==='week',plain=calendar||key==='json'||key==='arrays';
  for(const cell of cells){
    if(calendar)cell.valueType='text';
    if(key==='learning'&&cell.row>0&&cell.col===3)cell.numberFormat={type:'percent',maximumFractionDigits:0};
    if(key==='timesheet'&&cell.row>0&&[2,4].includes(cell.col))cell.numberFormat={type:'number',maximumFractionDigits:2};
    if(key==='comparison'&&cell.row>0&&[1,3].includes(cell.col))cell.numberFormat={type:'number',maximumFractionDigits:2};
  }
  return {format:'tinyDatagrid-workbook',version:2,activeSheetId:'sheet1',sheets:[{id:'sheet1',name,cells,variables:{},table:data.length&&!plain?{r1:0,c1:0,r2:data.length-1,c2:data[0].length-1,headerRow:0,style:'banded'}:null,dimensions:{rows:60,columns:12,columnWidths:Array.from({length:12},(_,c)=>calendar?(c===0?145:185):key==='comparison'&&c===3?235:key==='json'?[190,460,130,120,110,120][c]??130:key==='arrays'?[190,90,40,130,90,70,150,40,140][c]??110:175),rowHeights:Array(60).fill(calendar?40:31)},freezePanes:{rows:0,columns:0},conditionalFormats:[],validationRules:[],pivotTables:[],filters:[]}]};
}
