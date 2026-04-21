# UI Kit Overpass - Análisis de Componentes Existentes

## Sistema de Color Actual (globals.css)
Actualmente usa tonos cian/teal en lugar de violeta/púrpura:
- `--primary: oklch(0.708 0.183 174.89); /* #00d4aa */` (cian)
- Necesita cambiar a violeta: `#7C3AED` (primary), `#5B21B6` (primary-dark), etc.

## Componentes UI Existentes vs Requeridos

### ✅ Componentes que existen y necesitan restyling:

1. **Botones** (`src/components/ui/button.tsx`)
   - Variantes: default, gradient, outline, secondary, ghost, destructive, link
   - Necesitan: colores primarios violeta, estilo pill shape, sombras específicas
   - Esfuerzo: Medio (actualizar variantes de color y estilos)

2. **Inputs** (`src/components/ui/input.tsx`)
   - Necesitan: border color violeta en focus, background correcto, padding
   - Esfuerzo: Bajo-Medio (ajustar colores de borde y focus)

3. **Tarjetas** (`src/components/ui/card.tsx`)
   - Ya tiene variantes default y glass
   - Necesitan: colores de fondo/bordero correctos, sombras premium
   - Esfuerzo: Bajo (ajustar variables de color)

4. **Avatares** (`src/components/ui/avatar.tsx`)
   - Tiene badges y grupos
   - Necesitan: borders de colores específicos (#A78BFA para activos), indicadores de presencia
   - Esfuerzo: Medio (añadir indicadores de presencia y estilos de border)

5. **Badges** (`src/components/ui/badge.tsx`)
   - Variantes: default, secondary, destructive, success, warning, info, outline, ghost, link
   - Necesitan: colores violeta/púrpura correctos
   - Esfuerzo: Bajo (actualizar colores de variantes)

6. **Diálogos/Modales** (`src/components/ui/dialog.tsx`)
   - Ya tiene estructura buena
   - Necesitan: colores de fondo/bordero correctos, sombras
   - Esfuerzo: Bajo

7. **Sidebar** (`src/components/ui/sidebar.tsx`)
   - Completo con estados expandido/colapsado
   - Necesitan: colores violeta para activos, indicadores correctos
   - Esfuerzo: Medio-Alto (ajustar muchos colores de estado)

8. **Separadores** (`src/components/ui/separator.tsx`)
   - Muy simple, solo necesita color de borde correcto
   - Esfuerzo: Muy Bajo

### ❌ Componentes que FALTAN y necesitan crearse:

9. **Navigation Bottom Bar** - No existe
   - Necesita crearse desde cero con íconos activos/inactivos
   - Esfuerzo: Alto

10. **Chat Panel** - No existe
    - Necesita crearse con burbujas de mensaje, input especial, botón enviar
    - Esfuerzo: Alto

11. **Calendar/Schedule** - No existe
    - Necesita crearse con navegación mensual, días seleccionados, indicadores de evento
    - Esfuerzo: Alto

12. **Tarjeta de Perfil de Usuario** - No existe específicamente
    - Podría adaptarse de card existente pero necesita layout específico
    - Esfuerzo: Medio

13. **Tarjeta de Reseña** - No existe
    - Necesita crearse con avatar, rating, texto, CTA buttons
    - Esfuerzo: Medio

14. **Panel de Gráfico** - No existe
    - Necesita crearse con line chart, area bajo curva, tooltip, KPIs
    - Esfuerzo: Alto (requiere integración con librería de gráficos)

15. **Highlight Update (Story Bar)** - No existe
    - Necesita crearse con scroll horizontal de avatares
    - Esfuerzo: Medio

## Archivos Clave a Modificar

1. **src/app/globals.css** - Cambiar completamente el sistema de color de cian a violeta
2. **src/components/ui/button.tsx** - Actualizar variantes de color y estilos
3. **src/components/ui/input.tsx** - Ajustar colores de focus y border
4. **src/components/ui/card.tsx** - Ajustar variables de color y sombras
5. **src/components/ui/badge.tsx** - Actualizar colores de variantes
6. **src/components/ui/avatar.tsx** - Añadir indicadores de presencia y estilos de border
7. **src/components/ui/dialog.tsx** - Ajustar colores y sombras
8. **src/components/ui/sidebar.tsx** - Actualizar muchos colores de estado y activos

## Estimación de Esfuerzo por Área

### Área de Color (globals.css)
- **Esfuerzo:** Bajo
- **Tiempo estimado:** 2-4 horas
- **Detalles:** Reemplazar todas las variables de color oklch con valores hex violeta

### Área de Componentes Básicos
- **Esfuerzo:** Medio-Bajo
- **Tiempo estimado:** 4-6 horas
- **Componentes:** button, input, badge, separator
- **Detalles:** Actualizar variantes de color, focus states, hover effects

### Área de Componentes Complejos
- **Esfuerzo:** Medio
- **Tiempo estimado:** 6-8 horas
- **Componentes:** card, avatar, dialog
- **Detalles:** Ajustar estilos complejos, variantes, sombras premium

### Área de Layout y Navegación
- **Esfuerzo:** Medio-Alto
- **Tiempo estimado:** 8-12 horas
- **Componentes:** sidebar
- **Detalles:** Muchos estados activos/inactivos, colores de grupo, indicadores

### Área de Nuevos Components
- **Esfuerzo:** Alto
- **Tiempo estimado:** 16-24 horas
- **Components:** bottom nav, chat panel, calendar, profile card, review card, chart panel, story bar
- **Detalles:** Creación desde cero con estilos específicos del UI Kit

## Total Estimado
- **Horas:** 36-54 horas (4.5-6.5 días trabajables)
- **Complejidad:** Media-Alta (muchos componentes existen pero necesitan adaptación significativa)
- **Riesgo:** Bajo-Medio (la base de componentes está bien estructurada)