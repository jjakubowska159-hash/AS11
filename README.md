# AS11

Osobisty asystent Reflector.Lab (Yuga) — analiza przed sesją, dokument dla klienta po sesji, dokument wstępny po intake. Użytek prywatny.

## Struktura
- `src/` — aplikacja (React + Vite)
- `api/` — funkcje serwerowe Vercel (tu żyje klucz Anthropic; przeglądarka go nigdy nie widzi)
  - `ana1-analysis.ts` — analiza + plan sesji
  - `ana1-doc.ts` — dokument dla klienta po sesji 1:1
  - `ana1-intake.ts` — dokument wstępny po 30 min

## Uruchomienie lokalne
```bash
npm install
npm run build      # sprawdzenie typów + build
npx vercel dev     # front + /api razem (potrzebny ANTHROPIC_API_KEY w .env.local)
```
`npm run dev` uruchamia sam interfejs — bez `/api`, więc generowanie nie zadziała.

## Wdrożenie (Vercel)
1. Vercel -> Add New Project -> wybierz to repo (framework: Vite wykryje się sam).
2. Settings -> Environment Variables -> `ANTHROPIC_API_KEY`.
3. Deploy. Włącz ochronę hasłem (Settings -> Deployment Protection), skoro to tylko dla Ciebie.

## Dane
Archiwum sesji zapisuje się w `localStorage` przeglądarki (klucz `ana1_sessions`) — nie trafia na serwer ani do Gita.
