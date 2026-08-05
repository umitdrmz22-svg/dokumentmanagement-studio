# Dokumentenmanagement Studio

Eigenständiges, browserbasiertes Dokumentenmanagement für gelenkte EHS- und Managementsystem-Dokumente. Der Schwerpunkt liegt auf einem nachvollziehbaren **Ersteller → Prüfer → Freigeber**-Workflow, Versionshistorie, Wiedervorlage und unveränderbarem Audit-Trail.

## Funktionsumfang

- Dokumentnummer, Titel, Dokumentart, Kategorie, Geltungsbereich und Vertraulichkeit
- Revision und fortlaufende Dateiversionen
- Gültig-ab-Datum und Wiedervorlage
- getrennte Rollen für Ersteller, Prüfer und Freigeber
- Statusablauf:
  - Entwurf
  - In Prüfung
  - Freigabe offen
  - Freigegeben
  - Änderung erforderlich
  - Ungültig / Archiviert
- Änderungsvermerk je Version
- private Dateispeicherung in Supabase Storage
- PDF- und Bildvorschau direkt im Browser
- freigegebene Versionen werden unveränderbar
- Änderungen an freigegebenen Dokumenten erfolgen über eine neue Revision
- Audit-Trail mit Zeit, Benutzer, Statuswechsel und Kommentar
- Demo-Modus ohne Backend

## Gemeinsames Supabase-Projekt

Dieses Modul verwendet dasselbe Supabase-Projekt wie BA Studio und Gefahrstoffkataster Online. Dadurch sind Benutzer, Unternehmen und Rollen in allen Modulen identisch.

### Reihenfolge der SQL-Dateien

1. Im Repository `gefahrstoffkataster-online` die Datei `supabase/001_core_and_kataster.sql` im Supabase SQL Editor ausführen.
2. Danach in diesem Repository `supabase/002_document_management.sql` ausführen.

Die zweite Migration erstellt die Dokumenttabellen, Workflow-Funktionen, Audit-Trail und den privaten Storage-Bucket `documents`.

### Verbindung eintragen

In `assets/config.js`:

```js
window.APP_CONFIG = Object.freeze({
  supabaseUrl: 'https://DEIN-PROJEKT.supabase.co',
  supabasePublishableKey: 'sb_publishable_...',
  appName: 'Dokumentenmanagement Studio'
});
```

Nur den Publishable Key verwenden. `service_role`, Secret Key und Datenbankpasswort dürfen nicht im Browser oder Repository gespeichert werden.

## Sicherheitsmodell

- Mandantentrennung mit Row Level Security
- normale Benutzer können Workflow-Status nicht direkt verändern
- Prüfung und Freigabe erfolgen ausschließlich über kontrollierte Datenbankfunktionen
- Ersteller, Prüfer und Freigeber müssen getrennte Personen sein
- Audit-Trail kann vom Browser nicht geändert oder gelöscht werden
- freigegebene Dateiversionen sind unveränderbar

## Fachliche Abgrenzung

Das System unterstützt die Dokumentenlenkung und Audit-Nachweisführung. Es ist kein automatischer Nachweis einer ISO-, EMAS- oder Rechtskonformität. Aufbewahrungsfristen, Zugriffsrechte, Freigaberegeln und Dokumentarten müssen vom jeweiligen Unternehmen festgelegt werden.

## Testen

```bash
npm test
python3 -m http.server 4173
```
