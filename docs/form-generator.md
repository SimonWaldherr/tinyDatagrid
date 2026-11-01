# Tabellen als Eingabeformular

Lege eine Kopfzeile an, zum Beispiel **Name · Email · Telefonnummer · Geburtsdatum**. Wähle anschließend **Formular** unter der Tabelle oder **Dokument → Formular erstellen**. Die Browserdemo bietet **Formular erstellen** unter Werkzeuge. Das Formular kann unmittelbar lokal benutzt werden. Jede erfolgreiche Antwort fügt eine neue Zeile hinzu.

## Feldtypen

Der Generator nutzt Überschriften, bis zu 30 vorhandene Werte je Spalte und Tabellenvalidierungen. Namen werden als Text, E-Mail als E-Mail-Feld, Telefon als Telefonfeld und Datumsüberschriften als Datum erkannt. Unterstützt sind außerdem HTTP(S)-Webadressen, Dezimal-/Ganzzahlen, Uhrzeiten, Ja/Nein, mehrzeilige Texte, Farben im Format `#rrggbb` und vorhandene Auswahllisten.

Telefonnummern, Postleitzahlen und Kennungen bleiben Text: führende Nullen und das Pluszeichen gehen nicht verloren. Dezimalfelder erlauben `12.34`, `12,34` und korrekt gruppierte Werte wie `1.234,56`; fehlerhafte Gruppierung wird abgelehnt. Lange Zahlen bleiben exakte Dezimalwerte bzw. große Ganzzahlen. Datumsfelder speichern Kalenderdaten, Uhrzeitfelder eigene Uhrzeitwerte. Formulartexte werden grundsätzlich als Text geschrieben, selbst wenn sie mit `=` beginnen.

Unter **Feldtypen und Pflichtfelder anpassen** lassen sich Bezeichnung, Typ und Pflichtstatus ändern. **Vorschau aktualisieren** übernimmt die Einstellungen. In der App bleiben diese Einstellungen pro Arbeitsblatt/Tabelle im Dokument gespeichert. Nicht erkannte Typen sind sichere Textfelder. Neue Auswahloptionen werden in der Tabellenvalidierung definiert, damit Tabelle und Formular dieselbe Liste benutzen.

Berechnete Spalten erscheinen nicht als Eingabefelder. Der Generator übernimmt die letzte vorhandene Formel als normalisierte Vorlage und verschiebt relative Bezüge beim Anhängen der Antwort. Geschützte Zielzellen werden nicht überschrieben. Änderungen an Kopfzeile, Formelmuster oder Validierungsregeln verlangen ein neu erzeugtes Formular. Eine Spalte, die sowohl Formeln als auch manuell eingegebene Werte enthält, wird vorsichtshalber als berechnete Spalte behandelt.

Innerhalb einer benannten Tabelle verwendet der Generator deren Kopfzeile und Spalten. Ohne benannte Tabelle verwendet er die erste verwendete Zeile als Kopfzeile. Antworten landen am Ende dieser Tabelle bzw. des verwendeten Blattbereichs; vorhandene Zeilen werden nicht aufgefüllt oder geändert. Fehlende Überschriften werden ausgelassen. Grenzen: 10.000 Zeilen und 256 Spalten.

## Als Webseite im lokalen Netzwerk freigeben

Diese Funktion steht ausschließlich im nativen iPhone-/iPad-Prototyp und im Mac-Host zur Verfügung.
Diese Hosts werden separat entwickelt. Das lokale Verzeichnis `ios-prototype/`
ist von Git ignoriert und weder im Repository noch im npm-Paket enthalten.

1. Öffne das Formular und prüfe die Vorschau.
2. Wähle **Als Webseite im WLAN freigeben**. iOS/macOS können nach der Berechtigung für das lokale Netzwerk fragen.
3. Der native Server vergibt einen freien Port und zeigt die aktuellen IPv4-Adressen von WLAN/Ethernet an. Bei mehreren Netzwerkschnittstellen wähle die passende Adresse.
4. Scanne den QR-Code oder öffne den Link auf einem anderen Gerät im selben Netzwerk.
5. Die Browserantwort wird mit denselben Regeln geprüft, als Zeile übernommen und gespeichert. Erst danach zeigt die Webseite „Antwort gespeichert“.
6. **Freigabe beenden** oder das Schließen des Generators beendet den Server. Auf iOS endet die Freigabe auch im App-Hintergrund; beim Mac-Host beim Ausblenden oder Beenden der App. Ein neues Starten erstellt einen neuen Link.

Der QR-Code wird mit der gebündelten [scancod.es-Bibliothek](https://scancod.es/howto.html) direkt auf dem Gerät erzeugt. Dafür werden weder Adresse noch Formulardaten an scancod.es gesendet. Die Freigabe verwendet natives `NWListener`, einschließlich [Apples Beschreibung für den lokalen Netzwerkzugriff](https://developer.apple.com/documentation/bundleresources/information-property-list/nslocalnetworkusagedescription).

Die Webseite enthält nur Felddefinitionen und bewusst konfigurierte Auswahllisten, keine vorhandenen Datensätze. Ein zufälliger Sitzungspfad berechtigt zur Eingabe. Requests prüfen Host und Origin; Größen, Verbindungen und ausstehende Antworten sind begrenzt. Erfolgreiche Antworten werden innerhalb der Sitzung anhand einer Anfrage-ID dedupliziert. Ein wiederholter Sendeversuch derselben Antwort erzeugt keine weitere Zeile. Abgelehnte Antworten können nach Korrektur erneut gesendet werden. Änderungen im Dokument und eingehende Formularantworten werden während der Speicherung gegen parallele Bearbeitung abgegrenzt.

Dies ist eine **lokale HTTP-Freigabe**, kein öffentliches Internet-Hosting und kein HTTPS-Dienst. Geräte müssen einander im WLAN erreichen können; Gastnetz-Isolation, Firewall und Berechtigungen können den Zugriff verhindern. Für vertrauliche Daten nur in einem vertrauenswürdigen Netz verwenden. Bei einer Änderung der Netzwerkadresse neu starten. IPv6-only-Netze sind noch nicht unterstützt. Der Prototyp arbeitet im geöffneten App-Prozess und ist kein dauerhaft laufender Hintergrundserver.

## Mac-Prototyp

Die Capacitor-Binärpakete enthalten keine Mac-Catalyst-Variante. Deshalb gibt es unter `ios-prototype/mac/` einen eigenen kleinen AppKit-/WKWebView-Host. Er verwendet dieselbe Oberfläche, dieselbe Formularlogik und denselben Swift-HTTP-Server.

```sh
cd ios-prototype
npm run mac:build
open dist-mac/tinyDatagrid.app
```

Die Mac-App speichert Dokumente unter `~/Library/Application Support/tinyDatagrid-Mac/Documents`. Geöffnete Dateien werden als eigene Kopie importiert. Der Mac-Prototyp bietet lokale Dokumente, Import/Export, Formulare, QR-Freigabe und Webabfragen. Die iOS-spezifische App-Groups-/iCloud-Dateianbindung, Share Extension, AirPrint und App Intents sind im Mac-Host noch nicht eingebunden. Die gebaute App ist lokal ad-hoc-signiert; eine notarierte Verteilung ist ein separater Schritt.

## Bibliotheks-API und Prüfung

`tiny-datagrid/form-generator` exportiert `generateForm`, `inferFormKind`, `formValue` und `appendFormResponse`; `tiny-datagrid/form-ui` bietet die gemeinsame lokale Oberfläche. Die Webansicht wird aus dem gleichen Formularmodell erzeugt. Die Formularlogik benötigt für Prüfung und Schreiben keinen DOM.

`npm test` prüft die Typinferenz, Änderungen an Feldtypen/Pflichtstatus, exakte Werte, Formelfortsetzung, sichere Texte, Validierung und Strukturänderungen. `npm --prefix ios-prototype test` prüft zusätzlich Sitzungstrennung, Speichern vor Bestätigung und offline erzeugte QR-Codes. `npm run test:native-forms` in `ios-prototype/` prüft unter macOS echte HTTP-GET/POSTs, Duplikate, Origin/Host-Prüfung, begrenztes Parsing und Stoppen.

Die nativen Prüfungen setzen den separaten Prototyp voraus. `npm run release:check`
prüft die Bibliothek und das npm-Paket; native Builds, WebView-Darstellung und die
Verbindung zwischen zwei physischen Geräten benötigen eigene Prüfungen.
