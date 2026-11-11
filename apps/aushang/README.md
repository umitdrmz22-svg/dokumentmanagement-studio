# aushang. – Standortgebundene digitale Gesetzesaushänge

Eigenständiges Gesetzesportal für Unternehmen. Vor der Anmeldung erscheint ausschließlich die Zugangsanmeldung mit Registrierung und Wiederherstellung; die fachlichen Menüs und Quellenverzeichnisse sind erst nach Authentifizierung und Freischaltung erreichbar. Die Startseite des registrierten Werks öffnet direkt „Aushangpflichtige Gesetze“. „Alle Gesetze“ zeigt bei Bedarf das alphabetische Verzeichnis mit 69 Rechtsquellen. Die Sammlung umfasst weiterhin 41 hinterlegte Gesetzes-/Verordnungstexte (drei gekennzeichnete Auszüge) und drei BGN-PDFs; zusätzliche Quellen sind klar als externe Originalquellen gekennzeichnet. Themenbereiche erschließen insgesamt 86 unterschiedliche Quellen, darunter technische Regeln und lizenzpflichtige Normen. Jede angemeldete Inhaltsseite besitzt eine Suche; Verzeichnisse suchen im jeweiligen Bereich, Verwaltungs- und Dokumentseiten bieten zusätzlich eine bereichsübergreifende Suche. Favoriten sind kontoabhängig und erst nach Anmeldung sichtbar. Alphabetische Filter erleichtern den Zugriff. Bekanntmachungspflichten werden mit Rechtsgrundlage und betrieblicher Bedingung erläutert; Buchinhalte sind nicht pauschal für jeden Betrieb aushangpflichtig.

## Zugang und Standortbindung

Die Registrierung erfolgt in zwei Schritten: Benutzername/Passwort, danach Firma, Werk, Straße, Hausnummer, fünfstellige PLZ und Ort in Deutschland. Alle Standortfelder sind auch serverseitig Pflichtfelder. Ein Konto hat genau eine unveränderliche Standortzuordnung, die auf jeder angemeldeten Seite angezeigt wird. Standortangaben stammen stets aus dem authentifizierten Serverkonto, nicht aus URL-Parametern oder Browser-Speicher.

Favoriten werden pro Konto in D1 gespeichert. Passwörter werden mit zufälligem Salt und scrypt (`N=32768,r=8,p=3`) gehasht. Wiederherstellung erfolgt über einen einmal angezeigten, hochentropischen Code; serverseitig wird nur dessen Hash gespeichert. Eine erfolgreiche Wiederherstellung rotiert den Code. Passwortänderung/Wiederherstellung beenden alte Sitzungen. Sitzungs-Token werden ebenfalls nur gehasht gespeichert und mit HttpOnly/Secure/SameSite-Cookies übertragen. Gleiche-Origin-Prüfungen schützen Schreibzugriffe, Datenbank-basierte Limits begrenzen Anmeldeversuche. Keine Passwörter oder Konto-Adressen werden in Git gespeichert.

Neue Registrierungen sind unverbindliche **Zugangsanfragen mit Status `pending`**. Sie öffnen weder Sammlung noch Gerätezugänge. Der Betreiber bestätigt einen tatsächlich eingegangenen Betrag anhand einer Rechnungs-/Zahlungsreferenz und setzt das gesondert vereinbarte Enddatum. Nur `active` mit zukünftigem `license_valid_until` erlaubt Texte, PDFs, Favoriten und Gerätezugänge; dies wird bei jedem Zugriff serverseitig geprüft. Auch frühere Pilotkonten erhalten dadurch nicht automatisch eine bezahlte Freischaltung. Preise und Zahlungswege sind bewusst nicht erfunden; es gibt derzeit keine automatische Zahlungsabwicklung oder Aboverlängerung.

### Freischaltung durch den Betreiber

Die durch Sites bestätigte Betreiberidentität darf über `get_customer_requests`, `activate_customer_access` und `suspend_customer_access` Kundenanfragen verwalten. Aktivieren erfordert ausdrücklich `paymentConfirmed: true`, den exakten registrierten Benutzernamen, eine konkrete `reference` und das vereinbarte `validUntil` als JJJJ-MM-TT (einschließlich, Europe/Berlin). Das Werkzeug zieht kein Geld ein. Freigaben/Sperren werden in `access_events` protokolliert. Kunden- und Gerätelesesitzungen dürfen diese Werkzeuge nicht aufrufen.

Für ausdrücklich gewünschte kostenlose Vorführungen gibt es getrennt `grant_demo_access` (Dienstaktion `customer-demo`), begrenzt auf 30 Kalendertage. Dabei wird ausschließlich ein `demo`-Ereignis erfasst; es wird kein Zahlungseingang bestätigt. Aktive und gesperrte Freigaben werden damit nicht überschrieben.

Beispiel einer späteren Betreiberanweisung: „Zahlung zu Rechnung R-2026-001 für Benutzer firma-werk-01 ist eingegangen. Bis 31.12.2027 freischalten.“ Fehlende Zahlungsbestätigung, Referenz oder vereinbarte Laufzeit müssen vor der tatsächlichen Freigabe geklärt werden. Der geschützte Dienstzugriff bietet dieselben eng begrenzten Operationen `customer-list`, `customer-activate` und `customer-suspend`; hierfür gelten dieselben Credential-Regeln wie beim Quellenimport. Kein Schlüssel darf an Kunden weitergegeben oder in einen Link geschrieben werden.

Für einen entgeltlichen Rollout sind das konkrete Angebot, Rechnungs-/Steuerprozess und die tatsächlichen Hosting-/Auftragsverarbeitungs-/Transferbedingungen gesondert festzulegen. Werbung ist aktuell nicht eingebunden. Die technische Standortzuordnung ersetzt keinen Vertrag und prüft keinen tatsächlichen Aufenthaltsort.

## Bekanntmachungen im Werk und gemeinsame Lesegeräte

Die Aushang-Startseite verwendet eine typografisch betonte Verzeichnisansicht mit warmem Papierhintergrund, dunkler Schrift und zurückhaltenden Linien. Gemerkte Titel sind direkt oberhalb der Liste erreichbar. Rechts stehen Werkbekanntmachungen, tatsächlicher Quellenstand und Vollbildzugriff. Gerätesitzungen zeigen keine Lizenzlaufzeit oder Verwaltungsschaltflächen. Alle fachlichen Inhalte bleiben hinter Anmeldung und Freischaltung.

`site_notices` enthält pro Konto getrennte JSON-Fassungen für Entwurf und Veröffentlichung. Nur Passwortsitzungen können Entwürfe speichern und ausdrücklich veröffentlichen; Geräteleser erhalten ausschließlich veröffentlichte Angaben. Der Server ignoriert übermittelte Kontozuordnungen, begrenzt Eingaben und verhindert überschreibende Bearbeitung mit Revisionsnummern. Die Oberfläche kodiert sämtliche Freitexte. Bei einem Kontowechsel werden die geladenen Werkangaben verworfen.

Felder: AGG-Beschwerdestelle, Aufsichtsbehörde bei Jugendlichen, Arbeitszeiten/Pausen bei mindestens drei Jugendlichen sowie Hinweise auf geltende Tarifverträge/Betriebsvereinbarungen. Fehlende Angaben und ungeprüfte Anwendbarkeit werden ausdrücklich gekennzeichnet. Keine zuständige Person, Behörde, Adresse oder Arbeitszeit wird erfunden oder automatisch als geprüft bestätigt. Die AGG-Stelle kann nicht als generell unzutreffend deaktiviert werden. Ein Hinweis auf Vereinbarungen ersetzt weder die erforderlichen Volltexte noch deren gesetzliche Bekanntmachungsform.

Die neue Tabelle wird durch eine additive Migration angelegt; bestehende Konten, Lizenzen und Gerätefreigaben bleiben unberührt. Die Anzeige eines Freigabedatums ist keine automatische Rechtsprüfung. Für Geräte-/Internetausfälle ist ein geeigneter Papier- oder lokaler PDF-Ersatz betrieblich vorzuhalten; diese Änderung implementiert keinen automatischen Offline-Cache.

## Freiwillige Firmendokumente

Der Bereich ist für jedes Konto zunächst deaktiviert. Nur die Passwortverwaltung kann ihn aktivieren, PDF/DOCX-Dateien hochladen (10 MB je Datei; 100 Dateien und 100 MB insgesamt), Metadaten ändern oder veröffentlichen. Uploads sind zunächst Entwürfe. Freigegebene Geräte sehen ausschließlich veröffentlichte Dateien ihres eigenen Standortkontos. Deaktivieren blendet den Bereich aus, ohne Daten zu löschen. Papierkorb und Wiederherstellung sind verfügbar; endgültiges Löschen erfordert eine gesonderte Bestätigung. Nach Lizenzablauf kann die Passwortverwaltung vorhandene Unterlagen weiterhin exportieren und verwalten, jedoch nicht neu hochladen.

D1 speichert Metadaten; R2 verwendet getrennte accountbezogene Schlüssel unter `company/`. Downloads laufen ausschließlich über authentifizierte, kontogeprüfte Endpunkte mit `no-store` und Anhang-Disposition. Es gibt keine öffentlichen Datei-URLs. Formatprüfungen sind keine Virenscanner. Die Ablage ersetzt nicht automatisch die jeweilige Bekanntmachungsform, etwa § 77 Abs. 2 BetrVG. Private Dokumente sind ausdrücklich vom Quellenindex und monatlichen Gesetzesimport getrennt.

## Gerätegebundener Direktzugang

„Anmelden“ öffnet den standortgebundenen Aushangbereich. Die vorausgewählte und abwählbare Option „Diesen Firmencomputer dauerhaft einrichten“ erzeugt nach erfolgreicher Anmeldung einen eigenen Link für genau dieses Browserprofil; ein bereits vorhandener lokaler Link wird wiederverwendet. Bei dieser Anmeldung öffnet sich anschließend unmittelbar der persönliche Geräte-Link mit der Aushang-Startseite. Zusätzlich kann unter „Mein Zugang“ ein Geräte-Link eingerichtet werden. Ein nicht exportierbarer ECDSA-P-256-Privatschlüssel liegt als CryptoKey in IndexedDB; der Server erhält nur den öffentlichen Schlüssel. Der Link enthält ausschließlich eine öffentliche Geräte-ID. Ein kopierter Link genügt auf einem anderen Browser nicht: Eine kurzlebige, einmal verwendbare Challenge muss mit dem lokalen Schlüssel signiert werden. Nach einem Cookie-Ablauf kann dieser Nachweis selbstständig eine neue, auf Lesen und Favoriten begrenzte Sitzung erzeugen. Es gibt auf `/geraet/<id>` kein Passwortformular; Netzwerkfehler zeigen eine Verbindungsanzeige und nach dem `online`-Ereignis wird automatisch erneut geöffnet.

Die Verwaltung der Geräte und Passwörter erfordert eine normale Passwortsitzung. Einzelne Freigaben können dort widerrufen werden; Passwortänderung oder Wiederherstellung widerrufen sämtliche bestehenden Gerätefreigaben. Bestehende Kundenkonten und vorherige Sitzungen bleiben durch die additive Datenbankmigration erhalten.

Die Bindung gilt für das Browserprofil, nicht als Hardwareattestierung oder Kopierschutz gegen Betriebssystem-/Profilklonen. Browserdaten können gelöscht oder vom Browser entfernt werden; dann ist eine neue Freigabe nach Anmeldung nötig. Eine dauerhafte „niemals wieder anmelden“-Garantie wäre falsch. Eine gewöhnliche Internetunterbrechung oder ein Browser-/PC-Neustart entfernt den Schlüssel dagegen nicht. Private Browserfenster eignen sich nicht. Auf Windows wird eine `.url`-Verknüpfung ohne Geheimnis angeboten; der Nutzer verschiebt sie auf den Desktop und öffnet sie mit demselben Browserprofil. Das gerätespezifische PWA-Manifest startet unter demselben Geräte-Link.

## Monatliche Quellenaktualisierung über ChatGPT

Der bereits verknüpfte Auftrag `Automation_fba510e0ea6c81918ff85a91615ad462` ist auf ausdrücklichen Wunsch des Betreibers wieder aktiviert: jeweils am 1. um 06:00, Europe/Berlin, nächster Termin 01.12.2026. Die vorübergehend gewünschte Copilot-Kontrolle wurde verworfen; weder ein Firmen-Copilot-Konto noch eine Microsoft-Verbindung werden verwendet. Der Auftrag bezieht den unterstützten Dienstzugriff frisch aus `get_site` und führt den produktiv geprüften `scripts/run-source-refresh.py` aus. Er veröffentlicht nur nach vollständigem Erfolg aller 44 Quellen. Konto-, Geräte-, Adress- und Favoritendaten werden nicht geändert. Das native Aufgabenobjekt ist für Aktivierung und Termine maßgeblich.

`/quellen` und `/api/sources` erfordern einen freigeschalteten Kontozugang. Die früheren Endpunkte `/api/public/catalog` und `/api/public/sources` sind ebenfalls geschützt; sie bieten keinen anonymen Zugriff. Das Quellenverzeichnis selbst enthält ausschließlich amtliche Quellenmetadaten einschließlich der zuletzt veröffentlichten Fassungsangaben; auf der HTML-Seite steht zusätzlich der aus der Sitzung bestimmte Nutzungsstandort. Der monatliche Wartungszugriff bleibt unabhängig davon geschützt nutzbar. Ein bloßer Kontrollbericht verändert weder Portaltexte noch das Erfolgsdatum; die tatsächliche Quellenübernahme verwendet den autorisierten Schreibpfad.

## Quellenübernahme nach erfolgreicher Kontrolle

Der unbeaufsichtigte Auftrag lädt die freigegebenen HTTPS-Quellen in seiner Ausführungsumgebung. Er übermittelt ausschließlich diese öffentlichen Quelldateien an den geschützten Wartungszugriff; die Site prüft ZIP-Inhalt, Dokumentkennung, ausgewählte Paragraphen, XML/PDF-Struktur und Hash-Rücklesung. Die Laufzeit speichert vollständige Versionen der öffentlichen Rechtsquellen in D1 und originale BGN-PDFs in R2. Eine neue Version wird zunächst separat aufgebaut. Nur wenn alle 44 Quellen vollständig geladen und geprüft wurden, wird die aktive Version atomar umgeschaltet. Ein fehlgeschlagener Lauf verändert weder den aktiven Stand noch das Datum der letzten erfolgreichen Prüfung. Quelldatei-Identifikatoren, ausgewählte Paragraphen, XML-Struktur, Quellen-Hashes, Grenzen und PDF-Signaturen werden geprüft. Die Transformation lässt nur feste HTML-Tags zu; Quellattribute und Scripts werden nicht ausgegeben.

Die oberste Leiste zeigt den letzten erfolgreichen vollständigen Quellenabgleich. Gesetzesfassungen und Abrufdaten stehen zusätzlich beim einzelnen Text. Ein neuer Prüftermin bedeutet nicht zwingend eine Gesetzesänderung. Statische Anwendbarkeitsschwellen werden nicht als automatisch geprüfte Rechtssätze dargestellt. Eine elektronische Sammlung ersetzt keine erforderlichen standortbezogenen Bekanntmachungen des Arbeitgebers.

### Betreiber-Werkzeuge (Site-MCP)

`/mcp` bietet `get_update_status`, `begin_legal_update`, `continue_legal_update` und `publish_legal_update`. Schreibende Werkzeuge erfordern vom Sites-Dispatcher bestätigte Identität und die konfigurierte Betreiber-E-Mail. Produktkonten können diese Werkzeuge nicht aufrufen. Quellenzugriff verändert keine Konten, Adressen oder Favoriten.

Unbeaufsichtigter Ablauf: Status lesen, Lauf beginnen, `continue_legal_update` mit der zurückgegebenen Run-ID **sequenziell** wiederholen (je drei Quellen), erst bei `readyToPublish=true` veröffentlichen, anschließend Status zurücklesen. Bei Fehler: aktiven Stand behalten und Betreiber informieren. Ein neuer Lauf kann nach einer konkreten behobenen Ursache begonnen werden. Keine parallelen Fortsetzungen und kein ungeprüftes Setzen von Aktualisierungsdaten.

Der alternative Dienstzugriff `/api/maintenance` verwendet dieselben eng begrenzten Update-Operationen. Er benötigt die dokumentierte Sites-Dienstberechtigung plus eine zusätzliche anwendungsseitige Hash-Prüfung. Der unveränderte Dienstschlüssel wird nur zur Laufzeit mit `get_site` bezogen und ausschließlich an genau diese Site übermittelt; weder Quellcode noch Aufgaben-Prompt enthalten ihn. `scripts/run-source-refresh.py` lädt alle 44 offiziellen Dateien und führt den gesamten Ablauf über diesen geprüften Dienstzugriff aus. Es folgt keinen Weiterleitungen und sendet Dienstzugangsdaten ausschließlich an die feste Site-Adresse, niemals an Gesetzesquellen.

Die monatliche Aufgabe bezieht den unterstützten Dienstzugriff frisch aus `get_site`; im Prompt stehen keine Zugangsdaten. Ein Bericht oder neuer Kontrolltermin allein setzt kein Erfolgsdatum.

## Daten und Datenschutz

Gespeichert werden Zugangsdaten, registrierter Geschäftsstandort, Nutzungsstatus, Favoriten und erforderliche Sicherheitsdaten. Freiwillige Firmendokumente werden erst nach ausdrücklicher Aktivierung durch die Passwortverwaltung aufgenommen. Konten und Geschäftsadressen können dennoch personenbezogene Daten sein. Datenschutz- und Anbieterinformationen sind öffentlich erreichbar. Anbieterangaben wurden aus dem aktuellen bestehenden DefiDev-Impressum übernommen. Hosting-/Auftragsverarbeitungs- und Transferbedingungen sind vor einem kommerziellen Rollout konkret zu prüfen; die optionale Dokumentenablage erfordert zusätzlich die passende vertragliche Zuordnung zwischen Unternehmen und Anbieter.

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


## Unbefristeter eigener Werkzugang und BV-Verknüpfungen

`get_customer_access` liest ausschließlich das genau angegebene Konto. `grant_permanent_access` setzt eine ausdrücklich bestätigte unentgeltliche Dauerfreigabe ohne künstliches Ablaufdatum. `enableOwnSiteEditing` aktiviert dabei den eigenen Dokumenten- und BV-Bereich. Die Aktion bestätigt oder vereinnahmt keine Zahlung und vergibt keine Betreiberrechte. Passwörter, Werkzuordnung, Favoriten und bestehende Gerätezugänge bleiben erhalten. Dieselben begrenzten Aktionen stehen mit der bestehenden Dienstberechtigung als `customer-get` und `customer-permanent` bereit. Alle bleiben ausschließlich dem Betreiber zugänglich. Normale Konten können weder diese Verwaltung verwenden noch andere Kunden abfragen.

Nach Passwortanmeldung können Werkverantwortliche BV-Titel, HTTPS-Link, Version und Veröffentlichung verwalten, Links kopieren und Papierkorbeinträge wiederherstellen. Es werden nur Verknüpfungen gespeichert; die BV-Dateien bleiben im Zielsystem. Veröffentlichte Links können im selben angemeldeten Werkzugang geöffnet und kopiert werden, auch im bestehenden lesenden Gerätezugang. Eine zusätzliche BV-Gerätefreigabe wird nicht verlangt. Entwürfe und Bearbeitung bleiben passwortgeschützt. Fremde Konten erhalten auch bei bekannter Link-ID keinen Zugriff. Der Server lädt oder spiegelt die Zieldateien nicht.

Das Portal erteilt keine Berechtigung im Zielsystem. Ein kopierter Firmenlink ist nur dann außerhalb der Firma unbrauchbar, wenn das Zielsystem dies erzwingt. Bei SharePoint sind Organisations- oder Personenlinks passend zu berechtigen; anonyme „Anyone“-Links gewähren jedem Linkinhaber Zugriff. Quelle: [Microsoft: Sharing and permissions](https://learn.microsoft.com/en-us/sharepoint/modern-experience-sharing-permissions#shareable-links). Die zeitliche Dauerfreigabe hebt vorhandene Mengen- und Speichergrenzen nicht auf.
