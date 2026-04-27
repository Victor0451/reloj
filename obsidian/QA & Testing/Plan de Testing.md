---
tags: [qa, testing, plan]
date: 2026-04-13
---

# Plan de Testing

> [!example] Estado: **Pendiente** — [[Fase 7 - QA y Hardening]]

---

## Áreas de Testing

| Área | Tipo | Herramienta |
|------|------|-------------|
| Unit Tests | Server Actions, utilidades | Vitest / Jest |
| Integration Tests | Flujos E2E | Playwright |
| Performance | Lighthouse score > 90 | Lighthouse CI |
| Security Audit | RLS, credenciales, XSS, CSRF | Manual + tools |
| Cross-browser | Chrome, Firefox, Safari, Edge | Manual |
| Responsive | Desktop y tablet | Manual |

## Checklist de Seguridad

- [ ] RLS policies en todas las tablas
- [ ] Service Role Key nunca expuesta al browser
- [ ] Credenciales del reloj cifradas
- [ ] Sanitización de inputs (XSS)
- [ ] CSRF protegido por Next.js + Supabase
- [ ] HTTPS forzado en producción
- [ ] Audit logs inmutables

## Checklist de Performance

| Métrica | Target |
|---------|--------|
| Dashboard load | < 2s |
| Reporte 10K eventos | < 5s |
| Sync de eventos | < 60s |
| FCP | < 1.5s |
| LCP | < 2.5s |

## Ver También

- [[Checklist de Seguridad]]
- [[Checklist de Performance]]
- [[Fase 7 - QA y Hardening]]
