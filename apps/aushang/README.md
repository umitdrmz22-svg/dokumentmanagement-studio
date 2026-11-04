# aushang. – Standortgebundene digitale Gesetzesaushänge

Eigenständiges Gesetzesportal für Unternehmen. Die Startseite enthält sämtliche 44 Titel der Sammlung; 41 Gesetzes-/Verordnungstexte (drei gekennzeichnete Auszüge) und drei BGN-PDFs. Betriebliche Dokumente, Ansprechpartnerverzeichnisse, interne EHS-Inhalte und Standortwechsel sind entfernt.

## Zugang und Standortbindung

Die Registrierung erfolgt in zwei Schritten: Benutzername/Passwort, danach Firma, Werk, Straße, Hausnummer, fünfstellige PLZ und Ort in Deutschland. Alle Standortfelder sind auch serverseitig Pflichtfelder. Ein Konto hat genau eine unveränderliche Standortzuordnung, die auf jeder angemeldeten Seite angezeigt wird. Standortangaben stammen stets aus dem authentifizierten Serverkonto, nicht aus URL-Parametern oder Browser-Speicher.

Favoriten werden pro Konto in D1 gespeichert. Passwörter werden mit zufälligem Salt und scrypt (`N=32768,r=8,p=3`) gehasht. Wiederherstellung erfolgt über einen einmal angezeigten, hochentropischen Code; serverseitig wird nur dessen Hash gespeichert. Eine erfolgreiche Wiederherstellung rotiert den Code. Passwortänderung/Wiederherstellung beenden alte Sitzungen. Sitzungs-Token werden ebenfalls nur gehasht gespeichert und mit HttpOnly/Secure/SameSite-Cookies übertragen. Gleiche-Origin-Prüfungen schützen Schreibzugriffe, Datenbank-basierte Limits begrenzen Anmeldeversuche. Keine Passwörter oder Konto-Adressen werden in Git gespeichert.

Die derzeitige Registrierung ist ein **Pilotzugang ohne Zahlungsbuchung**. Preise, Vertragslaufzeit, bezahlte Aktivierung und Zahlungsabwicklung sind nicht erfunden oder stillschweigend aktiviert. Diese sind vor entgeltlichem Vertrieb gesondert festzulegen. Die Standortzuordnung ist die technische Grundlage einer Standortlizenz; sie beweist keinen tatsächlichen Aufenthaltsort und ersetzt keinen kommerziellen Vertrag.

## Monatliche Quellenaktualisierung

Der unbeaufsichtigte Auftrag lädt die freigegebenen HTTPS-Quellen in seiner Ausführungsumgebung. Er übermittelt ausschließlich diese öffentlichen Quelldateien an den geschützten Wartungszugriff; die Site prüft ZIP-Inhalt, Dokumentkennung, ausgewählte Paragraphen, XML/PDF-Struktur und Hash-Rücklesung. Die Laufzeit speichert vollständige Versionen der öffentlichen Rechtsquellen in D1 und originale BGN-PDFs in R2. Eine neue Version wird zunächst separat aufgebaut. Nur wenn alle 44 Quellen vollständig geladen und geprüft wurden, wird die aktive Version atomar umgeschaltet. Ein fehlgeschlagener Lauf verändert weder den aktiven Stand noch das Datum der letzten erfolgreichen Prüfung. Quelldatei-Identifikatoren, ausgewählte Paragraphen, XML-Struktur, Quellen-Hashes, Grenzen und PDF-Signaturen werden geprüft. Die Transformation lässt nur feste HTML-Tags zu; Quellattribute und Scripts werden nicht ausgegeben.

Die oberste Leiste zeigt den letzten erfolgreichen vollständigen Quellenabgleich. Gesetzesfassungen und Abrufdaten stehen zusätzlich beim einzelnen Text. Ein neuer Prüftermin bedeutet nicht zwingend eine Gesetzesänderung. Statische Anwendbarkeitsschwellen werden nicht als automatisch geprüfte Rechtssätze dargestellt. Eine elektronische Sammlung ersetzt keine erforderlichen standortbezogenen Bekanntmachungen des Arbeitgebers.

### Betreiber-Werkzeuge (Site-MCP)

`/mcp` bietet `get_update_status`, `begin_legal_update`, `continue_legal_update` und `publish_legal_update`. Schreibende Werkzeuge erfordern vom Sites-Dispatcher bestätigte Identität und die konfigurierte Betreiber-E-Mail. Produktkonten können diese Werkzeuge nicht aufrufen. Quellenzugriff verändert keine Konten, Adressen oder Favoriten.

Unbeaufsichtigter Ablauf: Status lesen, Lauf beginnen, `continue_legal_update` mit der zurückgegebenen Run-ID **sequenziell** wiederholen (je drei Quellen), erst bei `readyToPublish=true` veröffentlichen, anschließend Status zurücklesen. Bei Fehler: aktiven Stand behalten und Betreiber informieren. Ein neuer Lauf kann nach einer konkreten behobenen Ursache begonnen werden. Keine parallelen Fortsetzungen und kein ungeprüftes Setzen von Aktualisierungsdaten.

Der alternative Dienstzugriff `/api/maintenance` verwendet dieselben eng begrenzten Update-Operationen. Er benötigt die dokumentierte Sites-Dienstberechtigung plus eine zusätzliche anwendungsseitige Hash-Prüfung. Der unveränderte Dienstschlüssel wird nur zur Laufzeit mit `get_site` bezogen und ausschließlich an genau diese Site übermittelt; weder Quellcode noch Aufgaben-Prompt enthalten ihn. `scripts/run-source-refresh.py` lädt alle 44 offiziellen Dateien und führt den gesamten Ablauf über diesen geprüften Dienstzugriff aus. Es folgt keinen Weiterleitungen und sendet Dienstzugangsdaten ausschließlich an die feste Site-Adresse, niemals an Gesetzesquellen.

Die monatliche Aufgabe ist in Sites mit diesem Projekt verknüpft; die tatsächlich zurückgegebenen Planmetadaten sind maßgeblich. Sie bezieht den unterstützten Dienstzugriff aus `get_site` und verwendet den geprüften Aktualisierungspfad, keine im Prompt hinterlegten Zugangsdaten.

## Daten und Datenschutz

Es werden nur Zugangsdaten, der registrierte Geschäftsstandort, Nutzungsstatus, Favoriten und erforderliche Sicherheitsdaten gespeichert. Keine Betriebsdokumente oder Mitarbeiterverzeichnisse. Konten und Geschäftsadressen können dennoch personenbezogene Daten sein. Datenschutz- und Anbieterinformationen sind öffentlich erreichbar. Anbieterangaben wurden aus dem aktuellen bestehenden DefiDev-Impressum übernommen. Hosting-/Auftragsverarbeitungs- und Transferbedingungen sind vor einem kommerziellen Rollout konkret zu prüfen; ein fehlender interner Dokumentenbereich beseitigt diese Pflichten nicht.

Frühere Offline-Caches des lokalen Demo-Portals werden bei Umstellung entfernt. Authentifizierte Inhalte und Kontoangaben werden nicht im Service-Worker-Cache oder localStorage gespeichert. Die installierbare Web-App benötigt für Anmeldung und Texte Internet.

## Entwicklung und Betrieb

- `web/`: Oberfläche; `server/`: geprüfte Anmeldung, Datenzugriffe, XML-Transformation und Update-Prozess.
- `legal/`: redaktionelle Titelliste, öffentliche Ausgangs-Snapshots und Quellenmanifeste. `scripts/prepare-assets.mjs` generiert Servermodule daraus.
- `db/schema.ts` und `drizzle/`: D1-Schema und unveränderliche Migrationen.
- `.openai/hosting.json`: bestehendes Sites-Projekt mit D1 `DB`, R2 `BUCKET` und MCP-Fähigkeit.
- Runtime-Werte in Sites: `AUTH_RATE_SECRET` (Secret), `MAINTAINER_EMAIL` (Secret), `SITE_ORIGIN`, `MAINTENANCE_KEY_HASH` (nur Hash des autorisierten Dienstschlüssels). Keine Secrets in Quellcode oder Manifest.
- Installation gemäß Sites-Workflow. `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm exec tsc --noEmit`. Für verwaltete Browser-QA `sites-preview start <checkout>` verwenden.
- Vor lokaler D1-Nutzung die generierte SQL-Migration mit dem im Starter beschriebenen lokalen Wrangler-Befehl anwenden. Lokale Testkonten werden nicht produktiv übertragen.

## Validierung

Automatisierte Tests prüfen Passwortschutz, Pflichtfelder, Cookies, Origin-Prüfung, Kontentrennung, Favoriten, Sitzungswiderruf, Einmalcodes, geschützte Betreiber-Werkzeuge, unvollständige/fehlgeschlagene Updates und sichere Textextraktion. Typprüfung und Produktionsbuild gehören zum Veröffentlichungsablauf. Keine Zusicherung einer juristischen Vollständigkeit oder bereits eingerichteten Zahlungsabwicklung.

## Quellen

Gesetzestexte: [Gesetze im Internet](https://www.gesetze-im-internet.de/), DGUV-Fassungen: [BGN](https://www.bgn.de/praevention-arbeitshilfen/praxishilfen-service/vorschriften-und-arbeitssicherheitsinformationen/unfallverhuetungsvorschriften). Ausgangsabruf 04.11.2026; spätere erfolgreiche Laufzeit-Aktualisierungen sind in der Datenbank und der Datumsleiste dokumentiert. Der Sammlungsumfang orientiert sich an handelsüblichen Aushangbüchern mit ergänzenden Vorschriften. Es werden keine kommerziellen Verlagserläuterungen übernommen.
