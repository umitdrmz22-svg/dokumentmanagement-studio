# Kunden nach Zahlungseingang freischalten

1. Der Kunde erstellt Benutzername, Passwort und einen verbindlichen Standort im Portal. Die Registrierung ist nur eine Zugangsanfrage; sie löst keine Zahlung aus und öffnet noch keine Sammlung.
2. Der Anbieter vereinbart Preis, Zahlungsweg und Laufzeit gesondert. Rechnungsstellung, steuerliche Angaben und Zahlungseingang werden außerhalb dieses Portals abgewickelt. Es gibt keine Stripe-/PayPal-Integration und keine automatische Aboverlängerung.
3. Nach tatsächlichem Zahlungseingang kann der Betreiber in seinem persönlichen ChatGPT die Anfrage benennen, zum Beispiel: „Zahlung zu Rechnung R-2026-001 für Benutzer firma-werk-01 ist eingegangen. Bis 31.12.2027 freischalten.“
4. Der Betreiberzugriff `get_customer_requests` löst das genaue Konto auf. `activate_customer_access` benötigt `paymentConfirmed: true`, den exakten Benutzernamen, die Referenz und das vereinbarte Enddatum. Das Werkzeug prüft die vom Sites-Dispatcher bestätigte Betreiberidentität. Es bestätigt einen außerhalb des Portals bereits erfolgten Zahlungseingang und zieht kein Geld ein.
5. Der Kunde meldet sich einmal mit „Anmelden & Geräte-Link erstellen“ an und speichert seine Windows-Verknüpfung. Der gleiche Browser öffnet diese anschließend über den lokalen Geräteschlüssel. Ein kopierter Link allein reicht anderswo nicht.
6. Das Recht endet am angegebenen Datum um 23:59:59 Europe/Berlin. Ohne erneute Anbieterfreigabe gibt es keine Verlängerung. `suspend_customer_access` erlaubt eine ausdrücklich angewiesene Sperre und widerruft zusätzlich Geräte und Sitzungen.

Kontopasswörter werden nur gesalzen gehasht in D1 gespeichert. Der Anbieter kann sie nicht auslesen. Private Geräteschlüssel verlassen den Browser nicht. Preis- und Bankdaten gehören nicht in Geräte-Links. Werbung ist aktuell nicht eingebunden.

Der Portalzugang ist eine technische Dienstleistung. Für amtliche Gesetzes- und Verordnungstexte ist § 5 UrhG zu beachten: https://www.gesetze-im-internet.de/urhg/__5.html . Der Dienst erhebt kein exklusives Urheberrecht an diesen Texten. Konkrete Verträge, Zahlungs-/Rechnungsprozess und Hosting-/Datenschutzbedingungen sind vor entgeltlichem Vertrieb zu vervollständigen.

## Kostenfreier Testzugang

Für eine ausdrücklich gewünschte Vorführung darf der Betreiber `grant_demo_access` mit exaktem Benutzernamen, einem konkreten Testgrund (`reference`) und einem Enddatum innerhalb von 30 Kalendertagen verwenden. Beispiel: „Benutzer osiguenzburg für 14 Tage als kostenlose Demo freischalten.“ Es wird ein `demo`-Ereignis protokolliert, kein Zahlungseingang bestätigt. Aktive oder gesperrte Freigaben werden nicht überschrieben. Die normale kostenpflichtige Freischaltung behält ihre separate Zahlungsbestätigung. Der geschützte Betreiber-Dienstzugriff bietet dieselbe Funktion als `customer-demo`.
