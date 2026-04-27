# 🎨 UI Kit Overpass - Sistema de Diseño

## Overview

Sistema de diseño **Overpass UI Kit** implementado para el proyecto RELOJ, adaptado a **dark mode** con paleta **violeta**.

**Fuente**: Overpass (Google Fonts)  
**Primary**: `#7C3AED` (violeta)  
**Modo**: Dark Mode  

---

## Sistema de Color

### Tokens CSS (Dark Mode)

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-primary` | `#7C3AED` | Botones, badges |
| `--color-primary-dark` | `#5B21B6` | Hover states |
| `--color-primary-light` | `#A78BFA` | Bordes activos |
| `--color-primary-pale` | `#EDE9FE` | Fondos destacados |
| `--color-accent` | `#6366F1` | Íconos secundarios |
| `--color-background` | `#0a0a0a` | Fondo principal |
| `--color-card` | `#141414` | Tarjetas |
| `--color-surface` | `#1a1a1a` | Superficies |
| `--color-foreground` | `#e5e5e5` | Texto |
| `--color-border` | `#3f3f3f` | Bordes |
| `--color-success` | `#10B981` | Online |
| `--color-star` | `#F59E0B` | Ratings |
| `--color-highlight` | `#F97316` | Valores altos |

### Espaciado

```
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px
--space-xl: 32px
--space-2xl: 48px
```

### Tipografía

- **Font**: Overpass
- **Weights**: 300, 400, 500, 600, 700, 800

---

## Componentes Modificados

### Button
- **Border-radius**: 24px (pill)
- **Shadow**: `0 4px 12px rgba(124, 58, 237, 0.35)`
- **Hover**: primary-dark
- **Outline**: border-primary en hover

### Input
- **Focus**: border-primary + ring violeta
- **Padding**: 10px 16px

### Badge
- **Border-radius**: full (pill)
- **Variantes**: default, primary, primaryLight, secondary, success, warning, destructive, outline, ghost

### Avatar
- **Tamaños**: sm (24px), default (32px), lg (64px), xl (80px)
- **Variantes**: default, active, online
- **Badges**: online (green), add (+)

### Card
- **Border-radius**: xl (12px)
- **Padding**: 24px
- **Shadow**: dark mode

---

## Componentes Nuevos

### Bottom Navigation (`bottom-nav.tsx`)
- Fixed bottom bar
- Items: Home, Notifications, Saved, Security, Profile
- Active: border-left 2px primary

### Chat Panel (`chat-panel.tsx`)
- Burbujas diferenciadas (recibida/enviada)
- Timestamps
- Input con send button

### Calendar (`calendar.tsx`)
- Month view
- Día seleccionado: círculo primary
- Indicadores de eventos

### Profile Card (`profile-card.tsx`)
- Avatar 64px
- Rating estrellas
- Contactos con íconos
- CTAs: follow, message

### Review Card (`review-card.tsx`)
- Avatar + rating
- Texto + CTAs helpful

### Chart Panel (`chart-panel.tsx`)
- Bar chart
- KPIs row
- Progress bar

### Story Bar (`story-bar.tsx`)
- Horizontal scroll
- Avatares con ring
- Badge add (+)

---

## Archivos

### Modificados
- `src/app/globals.css`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/card.tsx`

### Creados
- `src/components/ui/bottom-nav.tsx`
- `src/components/ui/chat-panel.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/profile-card.tsx`
- `src/components/ui/review-card.tsx`
- `src/components/ui/chart-panel.tsx`
- `src/components/ui/story-bar.tsx`

---

## Build Status

✅ **Build pasa sin errores**

---

## Referencia

- Documentación original: `/home/vlongo/VB/Descargas/UI_Kit_Documentation.md`
- Memoria: Engram (`design-system/ui-kit-overpass`)

---

*Implementado: Abril 2026*
