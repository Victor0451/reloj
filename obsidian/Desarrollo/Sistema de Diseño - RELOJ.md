---
tags: [ui, ux, design-system, dark-theme, light-theme, implementado]
date: 2026-04-14
---

# Sistema de Diseño - RELOJ

> [!success] Estado: **IMPLEMENTADO & OPTIMIZADO** ✅
> Fecha actualización: 14-Abr-2026 (Fix Light Theme & Dynamic Contrast)
> Referencia: [[UI Kit Overpass]]

---

## Resumen Ejecutivo

Sistema de diseño dinámico para el dashboard del sistema de control de acceso biométrico Hikvision.

**Características principales**:
- 🎨 **Multi-tema Nativo**: Soporte completo para Light y Dark Mode vía Tailwind v4.
- ✨ **Efectos Glassmorphism**: Transparencias adaptativas según el tema.
- 🟣 **Acentos Violeta**: Identidad visual basada en `#7C3AED`.
- 📐 **Elevación Sutil**: Sombras optimizadas para evitar ruido visual.

---

## Paleta de Colores Dinámica

El sistema utiliza variables CSS que cambian automáticamente según el tema del sistema o preferencia del usuario.

### Modo Oscuro (Predeterminado)

| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#0a0a0a` | Fondo principal |
| `--foreground` | `#e5e5e5` | Texto principal |
| `--primary` | `#7C3AED` | Acento violeta |
| `--card` | `#141414` | Tarjetas |
| `--border` | `#3f3f3f` | Bordes y divisores |

### Modo Claro (Optimizado)

| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#ffffff` | Fondo blanco radiante |
| `--foreground` | `#111827` | Texto de alto contraste (gray-900) |
| `--muted-foreground` | `#6B7280` | Texto secundario legible (gray-500) |
| `--border` | `#D1D5DB` | Bordes visibles (gray-300) |
| `--primary-pale` | `#EDE9FE` | Fondos de acento suaves |

---

## Tipografía Overpass

Se utiliza **Overpass** como fuente principal para mantener la estética técnica y legible.

| Peso | Uso |
|------|-----|
| **Bold (700)** | Títulos de página y KPIs |
| **SemiBold (600)** | Títulos de sección y botones primarios |
| **Medium (500)** | Navegación y labels |
| **Regular (400)** | Cuerpo de texto y placeholders |

---

## Componentes Destacados

### 1. Sidebar Premium (Dynamic Glass)
Refactorizado para ser el eje visual de la aplicación.
- **Efecto**: `backdrop-blur-xl` con bordes sutiles.
- **Active State**: Fondo violeta al 10%, texto `primary` y barrita lateral animada.
- **Header**: Icono Fingerprint con degradado y glow dinámico.

### 2. KPI Cards (Low Elevation)
Se redujo la elevación para mejorar la integración con el layout.
- **Shadow (Light)**: `0 2px 6px rgba(0,0,0,0.04)`
- **Shadow (Dark)**: `0 1px 4px rgba(0,0,0,0.15)`
- **Hover**: Incremento suave de sombra y glow violeta.

### 3. Botones UI Kit
Siguiendo el estándar Overpass.
- **Shape**: Pill-shaped (border-radius: 9999px).
- **Shadow**: Glow violeta sutil (`#7C3AED`).
- **Secondary**: Borde de 1.5px definido para visibilidad en Light Mode.

---

## Implementación Técnica (Tailwind v4)

Las variables se inyectan dinámicamente en el bloque `@theme` de Tailwind v4:

```css
@theme inline {
  --color-background: var(--color-background);
  --color-foreground: var(--color-foreground);
  --color-primary: var(--color-primary);
  /* ... resto de tokens mapeados a variables CSS ... */
}
```

---

## Reglas de Diseño

1. **Contraste primero**: Nunca usar textos en gris claro sobre fondo blanco. Asegurar legibilidad AA.
2. **Jerarquía Visual**: El violeta es para acciones principales. El resto debe ser sobrio.
3. **Coherencia**: Mantener el uso de `glass` y `glass-card` para contenedores principales.

---
*Actualizado el 14 de Abril 2026 - Fix Light Theme & Dynamic Contrast Implementado*
