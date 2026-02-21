# Procedura: testy i push do GitHub

## 1. Uruchom testy

```bash
cd ak-qualrix
npm run test
```

Powinny przejść 3 testy e2e (Playwright).

## 2. Uruchom lint

```bash
npm run lint
```

Kod wyjścia powinien być 0 (ostrzeżenia są OK).

## 3. Push do GitHub

```bash
git push origin main
```

Gdy zapyta:
- **Username:** Twoja nazwa użytkownika GitHub (np. `biurko2015-eng`)
- **Password:** **Personal Access Token** (nie hasło!)  
  Token tworzysz: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic), zakres **repo**.

---

## Skrypty debug (opcjonalnie)

Z katalogu `ak-qualrix` (z uzupełnionym `.env.local`):

- `node scripts/debug/test_login.js`
- `node scripts/debug/check_db.js`
- `npx tsx scripts/debug/test-db.ts`
- `npx tsx scripts/debug/test-actions.ts`
