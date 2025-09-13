---
"confkit": minor
---

feat: support dotenv files in `source().file()`

- `source().file()` now parses dotenv files: `.env`, `.env.local`, `.env.*`, and files ending in `.env`.
- Docs updated to mention dotenv support for `file()`.
- Note: unlike `source().env()`, explicitly pointing `file('.env')` loads in production as well.

