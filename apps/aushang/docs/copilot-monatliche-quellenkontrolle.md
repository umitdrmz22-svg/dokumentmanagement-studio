# Monatliche Quellenkontrolle in Microsoft 365 Copilot

Der ChatGPT-Zeitplan ist seit 05.11.2026 pausiert. Dieser Auftrag muss vom Betreiber selbst in seinem Microsoft-365-Copilot-Konto gespeichert werden. Eine Copilot-Lizenz und die Freigabe geplanter Prompts durch die Organisation sind erforderlich. Es wurde hier keine Copilot-Aufgabe angelegt.

## Einrichtung

1. Copilot Chat mit dem Microsoft-365-Konto öffnen.
2. Den folgenden Prompt senden.
3. Am Prompt „Diesen Prompt planen“ wählen.
4. Monatlich am 1. um 06:00, Europe/Berlin, erstmals 01.12.2026, einstellen und speichern.
5. Optional eine Benachrichtigung aktivieren. Die tatsächliche Planbestätigung in Copilot ist maßgeblich.

Offizielle Anleitung: https://support.microsoft.com/de-de/microsoft-365-copilot/schedule-your-most-used-copilot-prompts

## Zu kopierender Prompt

```text
Prüfe die öffentlichen Rechtsquellen meiner digitalen Gesetzessammlung aushang.

Öffne zuerst:
https://gesetzesaushang-osi-demo.umitdrmz22.chatgpt.site/quellen

Maschinenlesbare Alternative:
https://gesetzesaushang-osi-demo.umitdrmz22.chatgpt.site/api/public/sources

Dieses Verzeichnis enthält genau die 44 öffentlichen Quellen und die zuletzt im Portal gespeicherten Fassungsangaben. Vergleiche jeden Titel mit der dort verlinkten amtlichen Quelle von Gesetze im Internet beziehungsweise der offiziellen BGN-Fassung. Prüfe nicht nur Seitentitel oder Suchmaschinen-Snippets. Verwende den vollständigen amtlichen Text bzw. das Original-PDF, soweit abrufbar. Übernimm keine Verlagserläuterungen.

Berichte auf Deutsch als Tabelle: Titel | gespeicherter Portalstand | aktueller amtlicher Fassungsstand | Änderung ja/nein/nicht prüfbar | konkrete geänderte Paragraphen und Inkrafttreten, soweit eindeutig festgestellt | offizieller Quellenlink | erforderlicher nächster Schritt.

Nenne zu Beginn Prüfdatum, Anzahl der tatsächlich vollständig geprüften Quellen und die offenen Titel. Behaupte keine vollständige Kontrolle, falls einzelne Quellen, Fassungsangaben oder historische Vergleichstexte fehlen. Unterscheide Veröffentlichungsdatum, Inkrafttreten und Abrufdatum. Nenne keine erfundenen gesetzlichen Pflichten. Weise Änderungen und unklare Anwendbarkeit gesondert aus.

Keine Kundenkonten, Werkadressen, Geräte-Links, Passwörter oder Dienstschlüssel verwenden. Ein neuer Kontrollbericht bedeutet nicht, dass die Portaltexte aktualisiert wurden. Ändere deshalb keine Portaltexte und kein Aktualisierungsdatum. Erstelle einen nachvollziehbaren Kontrollbericht mit amtlichen Belegen für die anschließende Quellenübernahme durch den Betreiber.
```

## Grenze des Auftrags

Ein geplanter Kontroll-Prompt aktualisiert das veröffentlichte Portal nicht selbst. Dafür wäre zusätzlich ein ausdrücklich autorisierter Schreibablauf nötig. Der vorhandene geprüfte Import `scripts/run-source-refresh.py` bleibt für den Betreiber verfügbar, benötigt aber den unterstützten Dienstzugriff; Zugangsdaten gehören nie in einen Copilot-Prompt.
