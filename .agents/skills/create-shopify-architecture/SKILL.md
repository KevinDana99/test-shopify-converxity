---
name: create-shopify-architecture
description: Core guide for building a Shopify Affiliate Engine using Remix, Bun, Prisma, Zod, CORS and SDD methodology with production-ready Docker and Fly.io setup
---

# Codex Skill: Shopify Affiliate & Commission Engine

## Role

You are a senior Shopify App Developer.

You MUST:

- Follow Specification-Driven Development (SDD)
- Define specs before coding
- Respect the architecture
- Avoid overengineering
- Keep MVP simple and production-ready

---

## Base Project (MANDATORY)

Use the official **Shopify Remix App Template**

Includes:

- App Bridge (configured)
- OAuth
- Session handling
- Shopify API client

❌ Do NOT reimplement auth

---

## Core Stack

- Shopify Remix App
- TypeScript
- React + Polaris
- Shopify App Bridge
- Bun
- Prisma ORM
- SQLite (MVP)
- PostgreSQL (production)
- Zod (validation)
- CORS (explicit)

---

## Architecture

```txt
Client (?ref)
↓
localStorage
↓
Web Pixel (checkout_completed)
↓
POST /api/conversions
↓
Remix action
↓
Zod validation
↓
Security validation
↓
ConversionService
   ├─ idempotency
   ├─ calculate commissions
   ├─ persist (Prisma)
   └─ BillingService
↓
SQLite
↓
Dashboard (loader)
```

## Codex Folder

.
├── assets
│   ├── design
│   │   ├── admin
│   │   │   ├── admin-panel.design.png
│   │   │   └── modals
│   │   │   ├── modal-create-edit
│   │   │   │   ├── default
│   │   │   │   │   └── Captura de pantalla 2026-04-24 a la(s) 4.54.06 p. m..png
│   │   │   │   └── error
│   │   │   │   └── Captura de pantalla 2026-04-24 a la(s) 4.16.08 p. m..png
│   │   │   └── modal-delete-logout
│   │   │   ├── default
│   │   │   │   └── Captura de pantalla 2026-04-24 a la(s) 3.47.38 p. m..png
│   │   │   └── error
│   │   │   └── Captura de pantalla 2026-04-24 a la(s) 4.49.51 p. m..png
│   │   ├── auth
│   │   │   ├── error
│   │   │   │   ├── login.error.credentials.png
│   │   │   │   ├── login.error.email.png
│   │   │   │   └── login.error.pass.png
│   │   │   └── login.design.png
│   │   └── svg
│   │   ├── login-wave.svg
│   │   └── logo.svg
│   ├── docs
│   ├── examples
│   └── fonts
│   └── DMSans
│   ├── DMSans-Bold.ttf
│   ├── DMSans-BoldItalic.ttf
│   ├── DMSans-ExtraBold.woff2
│   ├── DMSans-Italic.ttf
│   ├── DMSans-Medium.ttf
│   ├── DMSans-MediumItalic.ttf
│   └── DMSans-Regular.ttf
├── constraints
│   ├── admin
│   │   ├── admin-panel.rule.md
│   │   └── admin-ui.rule.md
│   ├── auth
│   │   ├── auth.rule.md
│   │   └── login.rule.md
│   └── global.rule.md
├── drafts
│   ├── login.drafts.md
│   └── mantine.prompt.md
├── fonts
├── history
│   ├── admin-panel.feature.story.md
│   ├── admin-ui.feature.story.md
│   └── auth.feature.story.md
├── plans
│   └── admin
│   └── admin-ui.plan.md
├── prompts
│   ├── admin
│   │   ├── admin-panel.prompt.md
│   │   └── admin-ui.prompt.md
│   └── auth
│   ├── auth.prompt.md
│   └── login.prompt.md
└── specs
├── admin
│   ├── admin-panel.spec.md
│   └── admin-ui.spec.md
└── auth
├── auth.spec.md
└── login.spec.md

32 directories, 37 files
