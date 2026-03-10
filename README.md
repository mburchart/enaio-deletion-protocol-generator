# enaio® Loeschprotokoll-Generator

## Disclaimer / Markenhinweis

enaio® ist eine Marke der **OPTIMAL SYSTEMS GmbH**. Das Projekt steht in keiner offiziellen Verbindung zur OPTIMAL SYSTEMS GmbH und wird nicht von ihr unterstuetzt oder verantwortet.

Dieses Projekt ist ein enaio Loeschprotokoll-Generator. Es liest geloeschte Dokumente aus der MSSQL-Datenbank und schreibt sie als CSV-Datei. Optional wird bei Fehlern eine E-Mail gesendet.

## Zweck und Output

Das Projekt erzeugt bzw. erweitert eine CSV-Datei mit geloeschten Dokumenten. Der Pfad wird per `.env` gesetzt:

- `DELETION_PROTOCOL_PATH`

Wenn kein Wert gesetzt ist, wird `./deletion_protocol.log` verwendet.

CSV-Header:

`DokumentenId;Schrankname;Vorgangsname;DokumentenBezeichnung;ErstelltAm;GeloeschtAm;BenutzerId`

## Datenfluss

1. Verbindung zur enaio-MSSQL-Datenbank herstellen.
2. Zieltag bestimmen (immer der Vortag).
3. Konfigurierte Quellen aus `RLOG_SOURCES` laden.
4. Pro Quelle geloeschte Dokumente per SQL lesen.
5. Ergebnisse zusammenfuehren und nach Loeschzeit absteigend sortieren.
6. CSV-Datei schreiben oder erweitern.
7. Bei Fehlern optional E-Mail senden.

## Requirements

- Node.js (LTS empfohlen)
- Zugriff auf die enaio-MSSQL-Datenbank

## Setup

1. Abhaengigkeiten installieren: `npm install`
2. `.env` anhand von `env.example` anlegen und befuellen.
3. Build erzeugen: `npm run build`
4. Ausfuehren: `npm run serve` (enthaelt `tsc` + Start)

## Konfiguration

Alle Variablen werden aus `.env` gelesen. Leere Werte gelten als "nicht gesetzt". Boolean-Werte akzeptieren `1/true/yes/y/on` (sonst `false`).

| Variable                     | Typ     | Beschreibung                                                                 | Standard/Verhalten                                                                 |
| ---------------------------- | ------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DB_USER`                    | string  | Datenbank-Benutzer                                                           | `user`                                                                             |
| `DB_PASSWORD`                | string  | Datenbank-Passwort                                                           | `password`                                                                         |
| `DB_SERVER`                  | string  | MSSQL-Server (Instanzname moeglich, z.B. `SERVER\\INSTANZ`)                 | `localhost`                                                                        |
| `DB_DATABASE`                | string  | Datenbankname                                                                | `osecm`                                                                            |
| `DB_PORT`                    | number  | Datenbank-Port                                                               | `1433`                                                                             |
| `DB_ENCRYPT`                 | boolean | TLS/Encryption aktivieren                                                    | `false`                                                                            |
| `DB_TRUST_SERVER_CERT`       | boolean | Self-signed Zertifikate erlauben                                             | `false`                                                                            |
| `DB_REQUEST_TIMEOUT`         | number  | SQL-Request-Timeout in Millisekunden                                         | `60000`                                                                            |
| `DB_CONNECTION_TIMEOUT`      | number  | SQL-Connection-Timeout in Millisekunden                                      | `15000`                                                                            |
| `DELETION_PROTOCOL_PATH`     | string  | Zielpfad fuer die CSV-Ausgabedatei                                           | `./deletion_protocol.log`                                                          |
| `RLOG_SCHEMA`                | string  | SQL-Schema mit den enaio-Tabellen                                            | `sysadm`                                                                           |
| `RLOG_SOURCES`               | list    | Quellenliste, getrennt mit `\|`; je Eintrag: `label,objectTable,nameField,masterTable,processField` | `VA,object43,feld8,stamm30,feld21\|ASV,object14,feld3,stamm12,feld15` |
| `LOG_LEVEL`                  | string  | Logging-Level (`error`, `warn`, `info`, `debug`, ...)                       | `info`                                                                             |
| `EMAIL_ERROR_NOTIFICATION_TO`| string  | Empfaenger fuer Fehlerbenachrichtigungen                                     | leer = deaktiviert                                                                 |
| `EMAIL_FROM`                 | string  | Absenderadresse fuer SMTP                                                    | leer                                                                               |
| `EMAIL_HOST`                 | string  | SMTP-Host                                                                    | leer                                                                               |
| `EMAIL_PORT`                 | number  | SMTP-Port                                                                    | `587`                                                                              |
| `EMAIL_SECURE`               | boolean | SMTP-TLS (z.B. 465 = `true`, 587 = `false`)                                 | `false`                                                                            |
| `EMAIL_USER`                 | string  | SMTP-Benutzer                                                                | leer                                                                               |
| `EMAIL_PASSWORD`             | string  | SMTP-Passwort                                                                | leer                                                                               |

## Quellen- und SQL-Logik

- `RLOG_SOURCES` ist eine Liste von Quellen, getrennt mit `|`.
- Jeder Quellen-Eintrag hat exakt 5 kommaseparierte Teile:
- `label,objectTable,nameField,masterTable,processField`
- Das `label` wird in der CSV-Spalte `Schrankname` ausgegeben.
- Tabellen- und Feldnamen werden als SQL-Identifier validiert (`[A-Za-z_][A-Za-z0-9_]*`).
- `label` darf kein `;` und keinen Zeilenumbruch enthalten.
- Pro Quelle wird gegen folgende Tabellen gelesen:
- `<schema>.<objectTable>`
- `<schema>.sdrel`
- `<schema>.<masterTable>`
- `<schema>.benutzer`

## Zeitverhalten

- Das Programm verarbeitet immer den Vortag.
- Der SQL-Filter nutzt `o.deleted BETWEEN @start AND @end` (Unix-Sekundenbereich fuer den ganzen Tag).
- Ausgabefelder `ErstelltAm` und `GeloeschtAm` werden mit Locale `de-DE` und Zeitzone `Europe/Berlin` formatiert.

## E-Mail-Benachrichtigungen

- Eine Fehler-Mail wird nur versucht, wenn `EMAIL_ERROR_NOTIFICATION_TO` gesetzt ist.
- SMTP-Transport wird nur initialisiert, wenn `EMAIL_HOST`, `EMAIL_USER` und `EMAIL_PASSWORD` gesetzt sind.
- Der Betreff ist aktuell fest im Code: `Fehler beim enaio Posteingang XML Kataloggenerator`.
- Wenn SMTP nicht vollstaendig konfiguriert ist, wird der Versand uebersprungen und nur geloggt.

## Output-Details

- Wenn die Ausgabedatei noch nicht existiert, wird zuerst der CSV-Header geschrieben.
- Wenn keine Loeschungen gefunden werden, wird die Datei nicht erweitert.
- Neue Zeilen werden mit Semikolon als Trennzeichen angehaengt.
- Das Zielverzeichnis wird bei Bedarf automatisch erstellt.

## Scripts

- `npm run build`: TypeScript-Compile nach `dist/`
- `npm run start`: Start aus `dist/index.js`
- `npm run serve`: Build + Start
- `npm run dev`: Start ueber `nodemon -L`
- `npm run nodemon`: Alias fuer `npm run dev`

## Taegliche Ausfuehrung (Automatisierung)

- Das Skript kann taeglich automatisch gestartet werden, z.B. ueber den Windows-Taskplaner oder unter Linux/Unix mit einem Cron-Job.
- Fuer geplante Jobs kann direkt `npm run serve` genutzt werden (oder `npm run start`, wenn bereits gebaut wurde).

## Mini-Beispiel (`RLOG_SOURCES`)

```env
RLOG_SCHEMA=sysadm
RLOG_SOURCES=VA,object43,feld8,stamm30,feld21|ASV,object14,feld3,stamm12,feld15
```
