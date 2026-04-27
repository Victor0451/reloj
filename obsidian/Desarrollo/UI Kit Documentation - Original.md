# 🎨 UI Kit — Documentación del Sistema de Diseño
### Overpass Design System · Mobile & Web UI Components

---

## Índice

1. [Visión General](#1-visión-general)
2. [Sistema de Color](#2-sistema-de-color)
3. [Sistema Tipográfico](#3-sistema-tipográfico)
4. [Inventario de Componentes](#4-inventario-de-componentes)
   - 4.1 [Botones](#41-botones)
   - 4.2 [Campos de Entrada](#42-campos-de-entrada)
   - 4.3 [Navegación](#43-navegación)
   - 4.4 [Formulario de Login](#44-formulario-de-login)
   - 4.5 [Highlight Update (Story Bar)](#45-highlight-update-story-bar)
   - 4.6 [Panel de Gráfico](#46-panel-de-gráfico-graphic-update)
   - 4.7 [Tarjeta de Perfil](#47-tarjeta-de-perfil-de-usuario)
   - 4.8 [Panel de Mensajería](#48-panel-de-mensajería-chat)
   - 4.9 [Calendario](#49-calendario--schedule)
   - 4.10 [Tarjeta de Reseña](#410-tarjeta-de-reseña-user-review)
5. [Espaciado y Layout](#5-espaciado-y-layout)
6. [Iconografía](#6-sistema-de-iconografía)
7. [Avatares y Estados de Presencia](#7-avatares-y-estados-de-presencia)
8. [Estados e Interacciones](#8-estados-e-interacciones)
9. [Tokens CSS](#9-tokens-de-diseño-css)
10. [Estructura de Archivos](#10-estructura-de-archivos-del-proyecto)

---

## 1. Visión General

Este UI Kit presenta un sistema de diseño moderno, limpio y altamente funcional orientado a **aplicaciones móviles y web**. La paleta cromática se centra en tonos **violeta/púrpura** sobre fondos blancos y gris claro, con una estructura visual que prioriza la legibilidad y la experiencia de usuario.

| Propiedad | Valor |
|---|---|
| **Nombre** | Overpass UI Design System |
| **Tipografía principal** | Overpass (Google Fonts) |
| **Estilo visual** | Clean / Modern / Soft Purple |
| **Modo de diseño** | Light Mode primario |
| **Aplicación objetivo** | Mobile App + Web Dashboard |
| **Archivos incluidos** | `.AI` (Adobe Illustrator), `.EPS` (vectorial), `.JPG` (preview) |

> **Propósito:** Proveer un conjunto cohesivo de componentes reutilizables que permitan construir interfaces consistentes, accesibles y visualmente atractivas para aplicaciones sociales, de mensajería o dashboards analíticos.

---

## 2. Sistema de Color

La paleta está dominada por **violetas y púrpuras** con fondos neutros. Se identifican los siguientes tokens de color:

### 2.1 Paleta Principal

| Muestra | Token | Hex | Uso |
|---|---|---|---|
| 🟣 | `--color-primary-dark` | `#5B21B6` | CTAs principales, hover states, íconos activos |
| 🟣 | `--color-primary` | `#7C3AED` | Botones primarios, badges, highlights |
| 🟣 | `--color-primary-light` | `#A78BFA` | Bordes activos, ring de avatar, gradientes |
| 🟣 | `--color-primary-pale` | `#EDE9FE` | Fondos de tarjeta destacada, chips, pills |
| 🔵 | `--color-accent` | `#6366F1` | Íconos secundarios, gráfico de línea, botón add |
| ⬜ | `--color-border` | `#E5E7EB` | Bordes de input, separadores, divisores |
| 🔲 | `--color-surface` | `#F3F4F6` | Fondo general de pantalla, bg de inputs |
| ⬜ | `--color-white` | `#FFFFFF` | Fondo de tarjetas, modales, contenido principal |
| ⬛ | `--color-text-primary` | `#374151` | Cuerpo de texto principal, etiquetas |
| 🔘 | `--color-text-secondary` | `#9CA3AF` | Placeholders, metadatos, texto de apoyo |
| 🟡 | `--color-star` | `#F59E0B` | Estrellas de rating, íconos de alerta |
| 🟠 | `--color-highlight` | `#F97316` | Valor más alto en gráficos, badges de precio |
| 🟢 | `--color-success` | `#10B981` | Indicadores online, progress completado |

### 2.2 Reglas de Uso del Color

- El color primario `#7C3AED` se usa **exclusivamente** para elementos interactivos: botones, links activos, barras de progreso.
- Los fondos alternan entre `#FFFFFF` (tarjetas) y `#F3F4F6` (fondo base) para generar profundidad sin sombras excesivas.
- El texto **nunca es negro puro**; se usa `#374151` para máximo contraste y `#9CA3AF` para jerarquía secundaria.
- Las sombras son muy sutiles: `box-shadow: 0 2px 8px rgba(0,0,0,0.06)` como máximo.

---

## 3. Sistema Tipográfico

El sistema usa exclusivamente la fuente **Overpass**, un tipo sans-serif humanista de alta legibilidad.

> **Fuente:** Overpass  
> **Autor:** Delve Withrington  
> **URL:** https://fonts.google.com/specimen/Overpass  
> **Licencia:** SIL Open Font License 1.1  
> **CDN:** `@import url('https://fonts.googleapis.com/css2?family=Overpass:wght@300;400;600;700;800&display=swap')`

### 3.1 Escala Tipográfica

| Rol | Tamaño | Weight | Color | Uso |
|---|---|---|---|---|
| Display / Hero | 28–32px | 700 | `#374151` | Títulos de bienvenida |
| Heading H1 | 20–24px | 700 | `#374151` | Nombres, títulos de sección |
| Heading H2 | 16–18px | 600 | `#374151` | Subtítulos, labels |
| Body regular | 14px | 400 | `#374151` | Contenido principal |
| Body small | 12–13px | 400 | `#9CA3AF` | Metadatos, timestamps |
| Caption | 10–11px | 400 | `#9CA3AF` | Labels de eje en gráficos |
| Numeric highlight | 22–28px | 700 | variable | KPIs y métricas |
| Button text | 14–16px | 600 | `#FFFFFF` | Texto sobre botones |

---

## 4. Inventario de Componentes

### 4.1 Botones

#### Variante Filled (Primario)

```css
.btn-primary {
  background:    #7C3AED;
  color:         #FFFFFF;
  font-weight:   600;
  font-size:     14–16px;
  border-radius: 24–32px;       /* pill shape */
  padding:       12px 32px;
  box-shadow:    0 4px 12px rgba(124, 58, 237, 0.35);
}
.btn-primary:hover {
  background:    #5B21B6;
}
```

Ejemplos de uso: `login`, `follow`, `yes, helpfull`

#### Variante Outline (Secundario)

```css
.btn-secondary {
  background:    transparent;
  border:        1.5px solid #E5E7EB;
  color:         #374151;
  font-weight:   500;
  border-radius: 24–32px;       /* pill shape */
}
.btn-secondary:hover {
  border-color:  #7C3AED;
  color:         #7C3AED;
}
```

Ejemplos de uso: `message`, `no, didn't help`

---

### 4.2 Campos de Entrada

#### Input Outlined

```css
.input-outlined {
  border:        1px solid #E5E7EB;
  background:    #FFFFFF;
  border-radius: 8–12px;
  padding:       10px 16px;
  color:         #374151;
}
.input-outlined::placeholder { color: #9CA3AF; }
.input-outlined:focus {
  border-color:  #7C3AED;
  box-shadow:    0 0 0 3px rgba(124, 58, 237, 0.15);
  outline:       none;
}
/* Ícono de búsqueda: posición right, color #7C3AED */
```

#### Input Filled (con ícono activo)

```css
.input-filled {
  background:    #F3F4F6;
  border:        none;
  border-radius: 8–12px;
  padding:       10px 16px;
}
/* Ícono: background #7C3AED · color #FFF · border-radius 50% */
```

---

### 4.3 Navegación

#### Bottom Navigation Bar

| Propiedad | Valor |
|---|---|
| Íconos | Home, Notifications, Bookmark, Lock, Profile |
| Estado activo | `color: #7C3AED` · `border-left: 2px solid #7C3AED` |
| Estado inactivo | `color: #9CA3AF` |
| Background | `#FFFFFF` |
| Tamaño de ícono | 20–22px |

#### Side Menu (Sidebar)

| Propiedad | Valor |
|---|---|
| Secciones | Favorit, Important, Inbox, Trending, News Feed, Videos |
| Indicador activo | `border-right: 2px solid #7C3AED` · texto `#7C3AED` · bold |
| Sección Friends | Avatar circular con badge online verde (`#10B981`) |
| Tipografía | 14px · weight 400/600 · `#374151` / `#7C3AED` |
| Versión compacta | Solo íconos · ancho ~56px |
| Versión expandida | Íconos + labels · ancho ~200px |

---

### 4.4 Formulario de Login

| Propiedad | Valor |
|---|---|
| Título | `'Hi, Welcome back.'` · 28–32px · bold · `#374151` |
| Campo email/usuario | Input outlined · placeholder `username@email.com` |
| Campo password | Caracteres enmascarados · ícono eye toggle (derecha) |
| Link forgot password | `color: #7C3AED` · 14px · `text-align: right` |
| Botón login | Filled button full-width · `background: #7C3AED` |
| Contenedor | Tarjeta blanca · `padding: 32px` · `border-radius: 16px` |
| Sombra de tarjeta | `0 4px 20px rgba(0, 0, 0, 0.06)` |

---

### 4.5 Highlight Update (Story Bar)

| Propiedad | Valor |
|---|---|
| Tipo | Fila horizontal de avatares circulares con scroll |
| Avatar propio | Badge `+` en `#7C3AED` · posición bottom-right |
| Avatar otros | Círculo · `border: 2px solid #A78BFA` · nombre debajo |
| Tamaño de avatar | 48–52px de diámetro |
| Navegación | Flecha `›` derecha para scroll / más items |
| Labels | Nombre del usuario · 10–12px · `#9CA3AF` · centrado |

---

### 4.6 Panel de Gráfico (Graphic Update)

| Propiedad | Valor |
|---|---|
| Tipo de gráfico | Line Chart / Area Chart suavizado (spline) |
| Color de línea | `#7C3AED` / `#6366F1` |
| Área bajo la curva | `gradient: rgba(124,58,237,0.15) → transparent` |
| Eje Y | 0 – 1000 · labels 12px · `#9CA3AF` |
| Eje X | Meses: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep |
| Tooltip de pico | `bg: #374151` · texto blanco · `'highest value 100k 250%↗'` |
| KPIs inferiores | total value 1250k / lowest 210k / highest 764k / average 250k |
| Color KPIs | Default `#374151` · Highest `#F97316` · Average `#7C3AED` |
| Barra de progreso | `color: #7C3AED` · `height: 6px` · `border-radius: 3px` · 80% |
| Label de progreso | `'total target'` · `'80%'` a la derecha · 12px |

---

### 4.7 Tarjeta de Perfil de Usuario

| Propiedad | Valor |
|---|---|
| Avatar | 64px · círculo · `border: 2px solid #A78BFA` |
| Nombre | 18–20px · bold · `#374151` |
| Rating de estrellas | 5 estrellas · filled `#F59E0B` · empty `#E5E7EB` |
| Ícono Email | SVG envelope · `#7C3AED` · seguido de texto |
| Ícono Teléfono | SVG phone · `#7C3AED` · seguido del número |
| Ícono Ubicación | SVG pin · `#7C3AED` · seguido de dirección |
| Botón `follow` | Filled primary button full-width |
| Botón `message` | Outline secondary button full-width |
| Header | `'user profile'` · 12px · `#9CA3AF` + menú `⋮` |

---

### 4.8 Panel de Mensajería (Chat)

| Propiedad | Valor |
|---|---|
| Header del chat | Avatar + nombre + badge `online` verde + íconos `+` y `⋮` |
| Timestamp | Centrado · `'Fri, 02 July 2021  15:24'` · 12px · `#9CA3AF` |
| Burbuja recibida | `bg: #F3F4F6` · `border-radius: 12px 12px 12px 0` |
| Burbuja enviada | `bg: #7C3AED` · `color: #FFF` · `border-radius: 12px 12px 0 12px` |
| Avatar en burbujas | 32px visible en mensajes recibidos |
| Botón enviar | Círculo · `bg: #7C3AED` · ícono avión de papel |
| Input de redacción | Fondo gris claro · `border-radius: 24px` · con botón adjuntar |

---

### 4.9 Calendario / Schedule

| Propiedad | Valor |
|---|---|
| Título | `'July 2021'` · 16px · bold · centrado |
| Cabeceras de día | Mon Tue Wed Thu Fri Sat Sun · 12px · `#9CA3AF` |
| Día seleccionado | Círculo `#7C3AED` · número blanco · bold |
| Día con evento | Ícono calendario pequeño debajo del número |
| Días normales | `color: #374151` · 18–20px |
| Flechas de navegación | `‹` y `›` · `color: #7C3AED` |
| Padding de celda | 8–10px vertical · 10–12px horizontal |

---

### 4.10 Tarjeta de Reseña (User Review)

| Propiedad | Valor |
|---|---|
| Avatar | 40–48px · círculo |
| Nombre + reseñas | Nombre bold · `'105 Reviews'` · 12px · `#9CA3AF` |
| Estrellas de rating | 4 filled `#F59E0B` + 1 empty `#E5E7EB` · 20px |
| Timestamp | 12px · `#9CA3AF` · `'7 August 2021 / 15:24'` |
| Título de reseña | `'Satisfied'` · 14–16px · bold · `#374151` |
| Cuerpo de texto | 14px · `#374151` · máx 5–6 líneas |
| Pregunta de utilidad | `'was this review helpfull?'` · 12–14px · `#9CA3AF` |
| CTA `yes, helpfull` | Filled button full-width · `#7C3AED` |
| CTA `no, didn't help` | Ghost / sin borde · `text: #9CA3AF` |

---

## 5. Espaciado y Layout

El sistema usa una escala de espaciado basada en múltiplos de **4px**:

| Token | Valor | Uso |
|---|---|---|
| `--space-xs` | 4px | Espaciado entre ícono y label |
| `--space-sm` | 8px | Padding interno de badges/pills |
| `--space-md` | 16px | Padding horizontal de inputs |
| `--space-lg` | 24px | Padding de tarjetas (mobile) |
| `--space-xl` | 32px | Padding de tarjetas (desktop) |
| `--space-2xl` | 48px | Separación entre secciones |

### Border Radius

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 8px | Inputs, chips, tooltips |
| `--radius-md` | 12–16px | Tarjetas, modales |
| `--radius-pill` | 9999px | Botones, badges |
| `--radius-full` | 50% | Avatares, botones de acción circular |

### Grid y Layout

> El diseño usa una **grid de 12 columnas** adaptable:
> - **Desktop:** 4 columnas de tarjetas
> - **Tablet:** 2 columnas
> - **Mobile:** 1 columna a ancho completo
>
> Los componentes anchos (gráficos, calendarios) pueden ocupar 2 columnas. El gutter recomendado es de **16–24px**.

---

## 6. Sistema de Iconografía

| Propiedad | Valor |
|---|---|
| Estilo | Line icons / Outlined (trazo 1.5–2px) |
| Tamaño base | 20–24px |
| Color activo | `#7C3AED` |
| Color inactivo | `#9CA3AF` |
| Biblioteca recomendada | Heroicons / Feather Icons / Lucide |

### Íconos Identificados

```
Home · Bell (notif.) · Bookmark · Lock · User/Profile
Search · Eye (password toggle) · Plus · Send (avión de papel)
Dots menu (⋮) · Envelope (email) · Phone · Pin (location)
Chevrons ‹ › · Hamburger menu (≡) · Star (rating) · Calendar
```

---

## 7. Avatares y Estados de Presencia

| Variante | Tamaño | Estilo | Uso |
|---|---|---|---|
| Avatar grande | 64px | `border: 2px solid #A78BFA` | Tarjeta de perfil |
| Avatar medio | 48px | `border-radius: 50%` | Story bar |
| Avatar pequeño | 32–40px | `border-radius: 50%` | Listas y chat |
| Indicador online | 10px | Círculo `#10B981` · bottom-right | Estado de presencia |
| Badge añadir | 18px | Círculo `#7C3AED` + `+` blanco · bottom-right | Agregar story |
| Badge notificación | 8px | Círculo rojo sobre ícono | Conteo de notificaciones |

---

## 8. Estados e Interacciones

### 8.1 Estados de Botón

| Estado | Estilos |
|---|---|
| Default | `bg: #7C3AED` · sombra sutil |
| Hover | `bg: #5B21B6` · sombra aumentada |
| Active / Pressed | `bg: #4C1D95` · sombra reducida · `transform: scale(0.98)` |
| Disabled | `bg: #E5E7EB` · `color: #9CA3AF` · `cursor: not-allowed` |
| Loading | Spinner blanco centrado · texto oculto |

### 8.2 Estados de Input

| Estado | Estilos |
|---|---|
| Default | `border: 1px solid #E5E7EB` |
| Focus | `border: 1.5px solid #7C3AED` · `box-shadow: 0 0 0 3px rgba(124,58,237,0.15)` |
| Filled | `border-color` sin cambio · texto `#374151` |
| Error | `border: 1.5px solid #EF4444` · ring rojo sutil |
| Disabled | `background: #F9FAFB` · `color: #9CA3AF` · `cursor: not-allowed` |

---

## 9. Tokens de Diseño CSS

Variables CSS listas para copiar e implementar directamente en cualquier proyecto:

```css
:root {
  /* ── COLORS ──────────────────────────────────────── */
  --color-primary:          #7C3AED;
  --color-primary-dark:     #5B21B6;
  --color-primary-light:    #A78BFA;
  --color-primary-pale:     #EDE9FE;
  --color-accent:           #6366F1;

  --color-text-primary:     #374151;
  --color-text-secondary:   #9CA3AF;

  --color-border:           #E5E7EB;
  --color-surface:          #F3F4F6;
  --color-white:            #FFFFFF;

  --color-success:          #10B981;
  --color-star:             #F59E0B;
  --color-highlight:        #F97316;
  --color-error:            #EF4444;

  /* ── TYPOGRAPHY ──────────────────────────────────── */
  --font-family:            'Overpass', sans-serif;

  --font-size-xs:           10px;
  --font-size-sm:           12px;
  --font-size-md:           14px;
  --font-size-lg:           16px;
  --font-size-xl:           20px;
  --font-size-2xl:          28px;
  --font-size-3xl:          32px;

  --font-weight-regular:    400;
  --font-weight-medium:     500;
  --font-weight-semibold:   600;
  --font-weight-bold:       700;

  /* ── SPACING ─────────────────────────────────────── */
  --space-xs:               4px;
  --space-sm:               8px;
  --space-md:               16px;
  --space-lg:               24px;
  --space-xl:               32px;
  --space-2xl:              48px;

  /* ── BORDER RADIUS ───────────────────────────────── */
  --radius-sm:              8px;
  --radius-md:              12px;
  --radius-lg:              16px;
  --radius-pill:            9999px;
  --radius-full:            50%;

  /* ── SHADOWS ─────────────────────────────────────── */
  --shadow-card:            0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-card-hover:      0 4px 16px rgba(0, 0, 0, 0.10);
  --shadow-btn:             0 4px 12px rgba(124, 58, 237, 0.35);

  /* ── TRANSITIONS ─────────────────────────────────── */
  --transition-fast:        150ms ease;
  --transition-base:        250ms ease;
}
```

### Ejemplo de uso en componentes

```css
/* Botón primario */
.btn-primary {
  font-family:   var(--font-family);
  background:    var(--color-primary);
  color:         var(--color-white);
  font-size:     var(--font-size-md);
  font-weight:   var(--font-weight-semibold);
  padding:       var(--space-sm) var(--space-xl);
  border-radius: var(--radius-pill);
  box-shadow:    var(--shadow-btn);
  border:        none;
  cursor:        pointer;
  transition:    background var(--transition-fast),
                 box-shadow var(--transition-fast);
}
.btn-primary:hover {
  background:    var(--color-primary-dark);
}

/* Tarjeta */
.card {
  background:    var(--color-white);
  border-radius: var(--radius-lg);
  padding:       var(--space-xl);
  box-shadow:    var(--shadow-card);
}

/* Input */
.input {
  font-family:   var(--font-family);
  border:        1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding:       var(--space-sm) var(--space-md);
  font-size:     var(--font-size-md);
  color:         var(--color-text-primary);
  transition:    border-color var(--transition-fast),
                 box-shadow var(--transition-fast);
}
.input:focus {
  outline:       none;
  border-color:  var(--color-primary);
  box-shadow:    0 0 0 3px var(--color-primary-pale);
}
```

---

## 10. Estructura de Archivos del Proyecto

```
/ui-kit-overpass
├── 5741225.jpg         # Preview raster del UI Kit completo
│                       # → Referencia visual en alta resolución
│
├── 5741226.ai          # Archivo fuente Adobe Illustrator
│                       # → Edición vectorial completa · Requiere Illustrator CC+
│
├── 5741227.eps         # Exportación en formato EPS
│                       # → Compatible con Affinity Designer, CorelDRAW
│                       # → Importable en Figma vía plugin EPS
│
└── Fonts.txt           # Referencia tipográfica
                        # → Overpass · Google Fonts · Licencia SIL OFL
```

### Herramientas de Implementación Recomendadas

| Fase | Herramienta |
|---|---|
| **Diseño / Prototipado** | Figma (importar EPS), Adobe XD |
| **Frontend Web** | React + Tailwind CSS, Vue + SCSS |
| **Tokens** | Las variables CSS de la sección 9 son directamente usables |
| **Iconos** | Heroicons, Lucide React, Feather Icons |
| **Fuente** | Google Fonts CDN (Overpass 300, 400, 600, 700, 800) |

---

*Documentación generada a partir del análisis de los archivos del UI Kit · Overpass Design System*  
*Tipografía: [Overpass](https://fonts.google.com/specimen/Overpass) · Autor: Delve Withrington · Licencia SIL OFL*
