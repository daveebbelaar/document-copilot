# To do

Schritt-für-Schritt-Plan, um **Document Copilot** fertigzustellen: ein interner Chatbot für die Analysten von Driftwood Capital. Er beantwortet Fragen zu SEC-Berichten (10-Ks) und belegt jede Aussage mit einer Quelle.

Grundlage: [client-brief.md](client-brief.md) (was der Kunde will) und [architecture.md](architecture.md) (wie es technisch gebaut wird).

**Stand heute (04.10.2026):** Es gibt die Planungsdokumente, die Setup-Anleitungen und 25 heruntergeladene 10-K-Berichte (Apple, Amazon, Alphabet, Microsoft, NVIDIA, 2021 bis 2025). Backend und Frontend sind noch leer, es gibt also noch keinen App-Code.

**Prinzip der Reihenfolge:** Zuerst das Gerüst und eine lauffähige Verbindung von A bis Z (Login, Chat, Antwort mit Platzhalter). Danach wird die echte Intelligenz Schritt für Schritt eingebaut. So läuft nach jeder Phase etwas, das man ausprobieren kann.

---

## Offen

### Phase 0: Vorbereitung (Konten und Zugänge)

- [ ] Supabase-Konto und -Projekt anlegen, siehe [guides/supabase-setup.md](guides/supabase-setup.md)
- [ ] In Supabase die E-Mail-Bestätigung für die Entwicklung ausschalten (vor dem Livegang wieder einschalten)
- [ ] OpenAI-API-Key besorgen (zuerst in `~/.claude/env.shared` nachschauen, ob schon einer existiert)
- [ ] `backend/.env` und `frontend/.env` aus den `.env.example`-Vorlagen erstellen und ausfüllen
- [ ] Optional: Supabase CLI installieren (praktisch, aber nicht zwingend)

### Phase 1: Backend-Grundgerüst

- [ ] Python-Pakete installieren (Befehl steht in [guides/backend-setup.md](guides/backend-setup.md))
- [ ] Einstellungen zentral in `app/config.py` (bricht beim Start ab, wenn ein Wert fehlt)
- [ ] `app/main.py` mit FastAPI und einem einfachen Health-Check (`GET /health`)
- [ ] CORS so einstellen, dass das Frontend auf `localhost:5173` zugreifen darf
- [ ] Logging mit `structlog`, Test-Setup mit `pytest` und `ruff`
- [ ] Prüfen: Backend startet lokal und `/health` antwortet

### Phase 2: Frontend-Grundgerüst

- [ ] Vite + React + TypeScript aufsetzen (Befehle in [guides/frontend-setup.md](guides/frontend-setup.md))
- [ ] Tailwind CSS, shadcn/ui und React Router einrichten
- [ ] `src/lib/env.ts`, die einzige Stelle, an der Einstellungen gelesen werden
- [ ] Grundlayout mit leeren Seiten: Login, Chat
- [ ] Prüfen: `pnpm dev` läuft, `pnpm tsc --noEmit` und `pnpm lint` ohne Fehler

### Phase 3: Datenbank

- [ ] SQLAlchemy-Modelle in `app/database/models.py`: `profiles`, `chat_threads`, `chat_messages`, `message_citations`, `source_documents`, `document_chunks`
- [ ] Alembic einrichten (direkte Datenbankverbindung, nicht den Pooler)
- [ ] Erste Migration: `pgvector`-Erweiterung, Tabellen, Volltext-Spalte, Indizes (HNSW + GIN)
- [ ] Zugriffsregeln (RLS): Jeder Nutzer sieht nur seine eigenen Chats
- [ ] Migration auf Supabase anwenden und im Dashboard kontrollieren

### Phase 4: Login von A bis Z

- [ ] Frontend: Login und Registrierung mit E-Mail über Supabase Auth
- [ ] Frontend: geschützte Seiten (ohne Login geht es zurück zur Login-Seite), Logout
- [ ] Frontend: `src/lib/http.ts` und `src/lib/api.ts`, die das Login-Token automatisch mitschicken
- [ ] Backend: Token prüfen (`app/auth/dependencies.py`), ohne gültiges Token gibt es 401
- [ ] Backend: beim ersten Login automatisch einen Eintrag in `profiles` anlegen
- [ ] Optional: nur Driftwood-E-Mail-Adressen zulassen
- [ ] Prüfen: einloggen und einen geschützten Backend-Endpoint erfolgreich aufrufen

### Phase 5: Chat mit Platzhalter-Antwort

- [ ] Backend: Endpoints für Chats (erstellen, auflisten, Verlauf laden)
- [ ] Backend: `POST /chat/stream`, der eine feste Platzhalter-Antwort Wort für Wort streamt
- [ ] Backend: Fragen und Antworten in der Datenbank speichern
- [ ] Frontend: Chat-Oberfläche mit dem Vercel AI SDK (`useChat`), angebunden an FastAPI
- [ ] Frontend: Seitenleiste mit den bisherigen Chats
- [ ] Prüfen: Frage stellen, Antwort erscheint live, nach Neuladen ist der Chat noch da

### Phase 6: Berichte aufbereiten (Ingestion)

- [ ] Skript in `backend/ingest/`: 10-K-HTML in sauberes Markdown umwandeln
- [ ] Seitenzahlen und Abschnitte (z.B. "Item 1A Risk Factors", "Item 7 MD&A") erkennen, denn die Quellenangabe braucht Seite oder Abschnitt
- [ ] Text in sinnvolle Stücke (Chunks) teilen, Tabellen nicht zerreissen
- [ ] Zu jedem Chunk Metadaten speichern: Firma, Ticker, Jahr, Datum, Accession Number, Seite, Abschnitt
- [ ] Embeddings über OpenAI erzeugen und alles in Supabase schreiben
- [ ] Skript so bauen, dass ein erneuter Lauf keine Duplikate erzeugt
- [ ] Alle 25 Berichte einlesen und Stichproben in der Datenbank kontrollieren
- [ ] Tests für Umwandlung und Chunking

### Phase 7: Suche (Retrieval)

- [ ] Semantische Suche mit `pgvector` (findet Passagen mit ähnlicher Bedeutung)
- [ ] Stichwortsuche mit Postgres-Volltextsuche (findet exakte Begriffe und Zahlen)
- [ ] Beide Ergebnislisten mit Reciprocal Rank Fusion zusammenführen
- [ ] Filter nach Firma und Jahr, Nachbar-Chunks für mehr Kontext laden
- [ ] Tests für die Suche
- [ ] Mit den 10 Beispielfragen aus dem Brief prüfen: Kommen die richtigen Passagen?

### Phase 8: KI-Antworten (Agent)

- [ ] PydanticAI-Agent in `app/assistant/` mit klar definierten Ein- und Ausgaben
- [ ] Systemanweisungen: nur aus den gefundenen Passagen antworten, alles belegen, keine Anlageempfehlungen
- [ ] Werkzeuge für den Agenten: `search_filings`, `read_chunk`, `read_surrounding_chunks`
- [ ] Platzhalter-Antwort im Chat durch den echten Agenten ersetzen

### Phase 9: Vertrauen absichern (Grounding)

- [ ] Prüfung in `app/grounding/validator.py`: Jedes Zitat muss zu einer tatsächlich gefundenen Passage gehören
- [ ] Ohne Beleg antwortet der Bot "nicht genug Informationen im Korpus" statt zu raten
- [ ] Wenn die Prüfung fehlschlägt: kontrollierte Fehlermeldung statt erfundener Antwort
- [ ] Tests für Zitate und Grounding (laut Projektregeln Pflicht)

### Phase 10: Oberfläche fertigstellen

- [ ] Quellenangaben in der Antwort anklickbar (Firma, Bericht, Datum, Seite oder Abschnitt)
- [ ] Originalpassage mit einem Klick anzeigen
- [ ] Leerzustand mit Beispielfragen, Ladeanzeige, verständliche Fehlermeldungen
- [ ] Design durchgehen und verfeinern

### Phase 11: Qualität prüfen

- [ ] Alle 10 Beispielfragen durchspielen und Antworten auf Richtigkeit kontrollieren
- [ ] Gezielt Fallen testen: Fragen, deren Antwort nicht in den Berichten steht (Bot muss das sagen)
- [ ] Suche, Chunking und Anweisungen anhand der Ergebnisse nachschärfen
- [ ] Kosten pro Frage (OpenAI) grob abschätzen

### Phase 12: Livegang auf Railway

- [ ] Backend als eigenen Service auf Railway deployen
- [ ] Frontend als eigenen Service auf Railway deployen
- [ ] Umgebungsvariablen auf Railway setzen, CORS auf die echte Frontend-Adresse einstellen
- [ ] Datenbank-Migrationen auf die produktive Datenbank anwenden
- [ ] In Supabase die E-Mail-Bestätigung wieder einschalten
- [ ] Prüfen: kompletter Ablauf (Login, Frage, belegte Antwort) online

### Phase 13: Pilot mit dem Kunden

- [ ] README um "So startet man das lokal" ergänzen
- [ ] Zugänge für 5 Senior-Analysten einrichten, kurze Anleitung schreiben
- [ ] Eine Woche testen lassen und Feedback einsammeln
- [ ] Ziel aus dem Brief messen: mindestens 3 Stunden Zeitersparnis pro Analyst und Woche
- [ ] Bei Erfolg: Rollout an alle ~40 Analysten

### Später (nicht für den Pilot nötig)

- [ ] Korpus erweitern: 10-Qs und weitere S&P-500-Firmen (laut Brief vorgesehen)

## Erledigt

- [x] Planungsdokumente: Client Brief und Architektur
- [x] Setup-Anleitungen für Supabase, Backend und Frontend
- [x] Vorlagen für `.env`-Dateien
- [x] Download-Skript für SEC-Berichte, 25 Beispiel-10-Ks heruntergeladen
- [x] Werkzeuge installiert: Python 3.12, uv, Node 22, pnpm, Railway CLI
