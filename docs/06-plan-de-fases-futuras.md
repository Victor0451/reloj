# Fases 2-7: Plan de Implementación

## Descripción General

Este documento detalla el plan de implementación para todas las fases restantes del sistema web de gestión biométrica Hikvision, incluyendo arquitectura, entregables, endpoints ISAPI a consumir y criterios de aceptación.

---

## Fase 2: Agente Bridge

### Objetivo

Desarrollar un agente Node.js que se ejecute en la red local del cliente, se comunique con el reloj Hikvision vía ISAPI/HTTPS, y sincronice datos con Supabase.

### Arquitectura

```
┌───────────────────────────────────────────────────┐
│              Red Local del Cliente                │
│                                                   │
│  ┌─────────────────┐         ┌─────────────────┐ │
│  │  Agente Bridge  │────ISAPI/HTTPS────>│  Hikvision    │ │
│  │  (Node.js)      │  Digest Auth         │  DS-K1T320MFWX│ │
│  │  Puerto: 3001   │                      │  192.168.1.175│ │
│  └────────┬────────┘                      └─────────────┘ │
│           │                                               │
│           │ Supabase SDK (service_role)                   │
└───────────┼───────────────────────────────────────────────┘
            │
            │ HTTPS
            ▼
┌───────────────────────────────────────────────────┐
│              Supabase Cloud                       │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │ PostgreSQL  │  │  Realtime    │               │
│  │  - devices  │  │  (opcional)  │               │
│  │  - events   │  └──────────────┘               │
│  └─────────────┘                                  │
└───────────────────────────────────────────────────┘
```

### Entregables

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| Agente principal | `agent/src/index.ts` | Entry point del agente |
| Configuración | `agent/.env.example` | Variables de entorno |
| Módulo ISAPI | `agent/src/isapi/client.ts` | Cliente HTTP para el reloj |
| Sincronizador | `agent/src/sync/events.ts` | Polling de eventos cada 30s |
| Heartbeat | `agent/src/sync/heartbeat.ts` | Señal de vida cada 60s |
| Personas Sync | `agent/src/sync/persons.ts` | Sincronización bidireccional |
| Comandos | `agent/src/commands/door.ts` | Apertura/cierre de puerta |

### Endpoints ISAPI a Consumir

| Método | Endpoint | Función | Frecuencia |
|--------|----------|---------|------------|
| GET | `/ISAPI/System/deviceInfo` | Info del dispositivo | Startup + cada 5min |
| POST | `/ISAPI/AccessControl/AcsEvent` | Consultar eventos | Cada 30s |
| POST | `/ISAPI/AccessControl/UserInfo/Search` | Listar personas | Startup + sync |
| PUT | `/ISAPI/AccessControl/RemoteControl/door/1` | Abrir/cerrar puerta | On demand |
| GET | `/ISAPI/AccessControl/Door/Status/1` | Estado de puerta | Cada 10s |

### Variables de Entorno del Agente

```env
# Supabase
SUPABASE_URL=https://gpbfwcfvclxdjbjthsiq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Reloj Hikvision
DEVICE_IP=192.168.1.175
DEVICE_PORT=443
DEVICE_USERNAME=admin
DEVICE_PASSWORD=your-password

# Agente
POLL_INTERVAL_MS=30000
HEARTBEAT_INTERVAL_MS=60000
LOG_LEVEL=info
```

### Plan de Implementación

**Semana 1:**

| Día | Tarea |
|-----|-------|
| 1 | Setup del proyecto agent (npm init, TypeScript, estructura) |
| 2 | Cliente ISAPI con HTTPS + Digest Auth |
| 3 | Endpoint deviceInfo + registro del dispositivo en Supabase |
| 4-5 | Sincronización de eventos (AcsEvent) con polling cada 30s |
| 6-7 | Heartbeat + reconexión automática |

### Criterios de Aceptación

- [ ] El agente se conecta al reloj y obtiene info del dispositivo
- [ ] Los eventos de acceso aparecen en Supabase dentro de los 60s de producirse
- [ ] El heartbeat actualiza `last_seen_at` cada 60s
- [ ] Si el reloj se desconecta, el agente actualiza el estado a `offline`
- [ ] Si el reloj vuelve, el agente recupera eventos perdidos
- [ ] El agente se instala y configura con un `.env`

---

## Fase 3: Gestión de Personas

### Objetivo

Implementar el CRUD completo de personas con alta/baja/modificación, foto facial y huella, sincronizando con el reloj.

### Funcionalidades

| Función | Prioridad | Descripción |
|---------|-----------|-------------|
| Alta de persona | **Alta** | Registrar nombre, foto, huella, nro. empleado |
| Baja de persona | **Alta** | Eliminar del reloj y marcar como inactiva |
| Modificación | **Alta** | Actualizar datos, foto o huella |
| Listado y búsqueda | **Alta** | Tabla con filtros por nombre, ID, estado |
| Importación masiva | Media | Importar desde CSV/Excel |
| Sincronización | Media | Detectar diferencias entre Supabase y reloj |

### Componentes UI

| Componente | Ruta | Descripción |
|------------|------|-------------|
| PersonsTable | `/dashboard/persons` | Tabla con búsqueda, filtros, acciones |
| PersonDialog | - | Formulario de alta/edición en modal |
| PersonForm | - | Campos: name, employee_id, department, card_number |
| PhotoUpload | - | Upload de foto facial a Supabase Storage |
| PersonDetail | `/dashboard/persons/[id]` | Detalle de persona (opcional) |

### Endpoints ISAPI

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/ISAPI/AccessControl/UserInfo/Record` | Registrar persona |
| PUT | `/ISAPI/AccessControl/UserInfo/Modify` | Modificar persona |
| DELETE | `/ISAPI/AccessControl/UserInfo/Delete` | Eliminar persona |
| POST | `/ISAPI/AccessControl/UserInfo/Search` | Buscar personas |
| POST | `/ISAPI/Intelligent/FDLib/FaceDataRecord` | Agregar foto facial |
| POST | `/ISAPI/Intelligent/FDLib/FDSearch` | Buscar en librería de caras |

### Plan de Implementación

**Semana 2-3:**

| Semana | Tarea |
|--------|-------|
| 2.1 | Server Actions: crearPersona, actualizarPersona, eliminarPersona |
| 2.2 | PersonsTable con paginación, búsqueda y filtros |
| 2.3 | PersonDialog con formulario de alta/edición |
| 2.4 | Upload de foto a Supabase Storage |
| 3.1 | Sincronización: enviar persona al reloj vía ISAPI |
| 3.2 | Baja: eliminar del reloj + marcar inactiva en Supabase |
| 3.3 | Importación masiva desde CSV |

### Criterios de Aceptación

- [ ] Un operador puede crear una persona con foto desde la web
- [ ] La persona se registra en el reloj dentro de los 30s
- [ ] La persona puede acceder al reloj físicamente
- [ ] Se puede buscar y filtrar personas por nombre, ID, estado
- [ ] Se puede dar de baja una persona y se elimina del reloj
- [ ] Se puede importar una lista desde CSV

---

## Fase 4: Eventos y Dashboard

### Objetivo

Visualizar eventos de acceso en tiempo real con filtros avanzados, y completar el dashboard con KPIs.

### Funcionalidades

| Función | Prioridad | Descripción |
|---------|-----------|-------------|
| Listado de eventos | **Alta** | Tabla con fecha, hora, persona, tipo, resultado |
| Filtros avanzados | **Alta** | Por persona, rango de fechas, tipo, resultado |
| Polling en tiempo real | **Alta** | Actualización automática cada 30s |
| Detalle de evento | Media | Ver foto capturada en el momento del acceso |
| Exportación CSV | **Alta** | Exportar eventos filtrados |
| KPIs del día | Media | Total accesos, tasa de éxito, sin fichar |

### Componentes UI

| Componente | Descripción |
|------------|-------------|
| EventsTable | Tabla de eventos con columnas: fecha, persona, tipo, modo, resultado |
| EventFilters | Filtros: fecha desde/hasta, persona, tipo de evento, resultado |
| EventBadge | Badge visual para tipo de evento (verde=ok, rojo=denegado) |
| DashboardKPIs | Cards con métricas del día |
| RecentEvents | Lista de últimos 10 eventos con auto-refresh |

### Dashboard KPIs

| KPI | Fuente | Cálculo |
|-----|--------|---------|
| Total accesos hoy | `access_events` | `COUNT WHERE event_time >= today` |
| Tasa de éxito | `access_events` | `COUNT(granted) / COUNT(total) * 100` |
| Personas sin fichar | `persons` - `access_events` | Personas activas sin evento hoy |
| Último evento | `access_events` | `ORDER BY event_time DESC LIMIT 1` |

### Plan de Implementación

**Semana 4:**

| Día | Tarea |
|-----|-------|
| 1 | EventsTable con datos reales de Supabase |
| 2 | EventFilters con date picker, select de persona, tipo |
| 3 | Polling automático cada 30s (revalidatePath o SWR) |
| 4 | KPIs del dashboard con queries optimizadas |
| 5 | Exportación a CSV |
| 6-7 | Refinamiento UI, detalle de evento, fotos |

### Criterios de Aceptación

- [ ] Los eventos aparecen en la web dentro de los 60s de producirse
- [ ] Se puede filtrar por persona, fecha, tipo y resultado
- [ ] El dashboard muestra KPIs del día correctamente
- [ ] Se puede exportar la lista filtrada a CSV
- [ ] La tabla se actualiza automáticamente cada 30s

---

## Fase 5: Reportes y Exportación

### Objetivo

Generar reportes de asistencia por persona, rango de fechas y tipo de evento, con exportación a PDF y Excel.

### Tipos de Reportes

| Tipo | Descripción | Filtros |
|------|-------------|---------|
| Reporte diario | Entradas y salidas por persona para un día | Fecha |
| Reporte por rango | Asistencia de todo el personal en un período | Fecha desde/hasta |
| Reporte por persona | Historial completo de una persona | Persona + período |
| Resumen de KPIs | Accesos, tasa de éxito, ausentes | Período |

### Componentes UI

| Componente | Descripción |
|------------|-------------|
| ReportSelector | Selector de tipo de reporte |
| ReportFilters | Filtros según tipo de reporte |
| ReportPreview | Vista previa del reporte en la web |
| ReportActions | Botones: Exportar PDF, Exportar Excel |

### Tecnologías

| Función | Tecnología | Uso |
|---------|------------|-----|
| PDF | `@react-pdf/renderer` | Generación de PDF con logo y formato |
| Excel | `xlsx` (SheetJS) | Exportación de datos crudos a .xlsx |
| Gráficos | `recharts` | Charts en el resumen de KPIs |

### Plan de Implementación

**Semana 5:**

| Día | Tarea |
|-----|-------|
| 1 | ReportSelector + ReportFilters |
| 2 | Reporte diario con tabla de datos |
| 3 | Reporte por rango de fechas |
| 4 | Reporte por persona |
| 5 | Exportación a Excel (SheetJS) |
| 6-7 | Exportación a PDF (@react-pdf/renderer) + KPIs con Recharts |

### Criterios de Aceptación

- [ ] Se puede generar un reporte por rango de fechas
- [ ] Se puede generar un reporte por persona
- [ ] El reporte PDF tiene logo y formato profesional
- [ ] El reporte Excel tiene datos crudos con headers
- [ ] Un reporte de hasta 10,000 eventos se genera en < 5s

---

## Fase 6: Control de Puerta y Auditoría

### Objetivo

Implementar el control remoto de la puerta (abrir/cerrar) y el log completo de auditoría de acciones de operadores.

### Control de Puerta

| Función | Prioridad | Descripción |
|---------|-----------|-------------|
| Abrir puerta | **Alta** | Enviar comando de apertura remota |
| Cerrar/bloquear | **Alta** | Enviar comando de cierre/bloqueo |
| Estado de puerta | **Alta** | Ver si está abierta, cerrada o en alarma |
| Historial de comandos | Media | Log de quién envió comandos y cuándo |

#### Endpoints ISAPI

| Método | Endpoint | Función |
|--------|----------|---------|
| PUT | `/ISAPI/AccessControl/RemoteControl/door/1` | Abrir/cerrar puerta |
| GET | `/ISAPI/AccessControl/Door/Status/1` | Estado actual |
| PUT | `/ISAPI/AccessControl/Door/param/1` | Configurar puerta |

### Auditoría

| Función | Prioridad | Descripción |
|---------|-----------|-------------|
| Log de acciones | **Alta** | Registrar toda acción de operadores |
| Visualización | **Alta** | Tabla filtrable de audit_logs |
| Inmutabilidad | **Alta** | Sin DELETE ni UPDATE (garantizado por RLS) |

#### Acciones a Auditar

| Acción | Target | Detalles |
|--------|--------|----------|
| `create_person` | person | ID de la persona creada |
| `delete_person` | person | ID de la persona eliminada |
| `update_person` | person | Campos modificados |
| `open_door` | door | Quién abrió y cuándo |
| `close_door` | door | Quién cerró y cuándo |
| `change_device_config` | device | Configuración modificada |
| `login` | user | IP de acceso |
| `logout` | user | Sesión cerrada |

### Plan de Implementación

**Semana 6:**

| Día | Tarea |
|-----|-------|
| 1 | Server Action: openDoor, closeDoor vía agente |
| 2 | UI de Door Control con estado visual en tiempo real |
| 3 | Polling de estado de puerta |
| 4 | Función de auditoría: logAction() en cada Server Action |
| 5 | Página de Auditoría con tabla filtrable |
| 6-7 | Historial de comandos de puerta + refinamiento |

### Criterios de Aceptación

- [ ] La puerta se abre remotamente desde la web con latencia < 3s
- [ ] El estado de puerta se muestra correctamente (abierta/cerrada/alarma)
- [ ] Cada acción de operador queda registrada en audit_logs
- [ ] La tabla de auditoría muestra quién, qué, cuándo y a qué
- [ ] Los audit_logs no se pueden modificar ni eliminar

---

## Fase 7: QA y Hardening

### Objetivo

Testing integral, revisión de seguridad, documentación final y ajustes de producción.

### Áreas de Testing

| Área | Tipo | Descripción |
|------|------|-------------|
| Unit Tests | Jest | Server Actions, utilidades |
| Integration Tests | Playwright | Flujos E2E (login → dashboard → persona) |
| Performance Tests | Lighthouse | Lighthouse score > 90 |
| Security Audit | Manual + tools | Revisión de RLS, credenciales, XSS, CSRF |
| Cross-browser | Manual | Chrome, Firefox, Safari, Edge |
| Responsive | Manual | Desktop y tablet (mínimo 1280px) |

### Checklist de Seguridad

| Item | Verificación |
|------|-------------|
| RLS policies | ¿Todas las tablas tienen RLS habilitado? |
| Service Role Key | ¿Nunca se expone al browser? |
| Credenciales del reloj | ¿Cifradas en Supabase? |
| XSS | ¿Sanitización de inputs? |
| CSRF | ¿Protegido por Next.js + Supabase? |
| Rate limiting | ¿En endpoints sensibles? |
| HTTPS | ¿Forzado en producción? |
| Audit logs | ¿Inmutables? |

### Checklist de Performance

| Métrica | Target | Verificación |
|---------|--------|--------------|
| FCP (First Contentful Paint) | < 1.5s | Lighthouse |
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse |
| TTI (Time to Interactive) | < 3.5s | Lighthouse |
| Dashboard load | < 2s | Manual |
| Reporte 10K eventos | < 5s | Manual |
| Sync de eventos | < 60s | Agente |

### Checklist de Accesibilidad

| Criterio | Nivel | Verificación |
|----------|-------|--------------|
| WCAG 2.1 AA | AA | axe DevTools |
| Navegación por teclado | - | Manual |
| Contraste de colores | AA | Lighthouse |
| Labels en formularios | A | Manual |
| Alt text en imágenes | A | Manual |

### Plan de Implementación

**Semana 7:**

| Día | Tarea |
|-----|-------|
| 1-2 | Tests E2E con Playwright (flujos críticos) |
| 3 | Tests unitarios de Server Actions |
| 4 | Audit de seguridad (RLS, credenciales, sanitización) |
| 5 | Performance tuning (queries, índices, caching) |
| 6 | Cross-browser testing + fixes |
| 7 | Documentación final, release notes, preparación de deploy |

### Criterios de Aceptación

- [ ] Todos los tests E2E pasan
- [ ] Lighthouse score > 90 en todas las métricas
- [ ] No hay vulnerabilidades de seguridad conocidas
- [ ] El sistema funciona en Chrome, Firefox, Safari, Edge
- [ ] Responsive en desktop y tablet
- [ ] Documentación completa y actualizada
- [ ] Deploy a producción configurado en Vercel

---

## Resumen de Cronograma

| Fase | Duración | Semanas | Dependencias |
|------|----------|---------|--------------|
| **Fase 2** | Agente Bridge | 1 | Ninguna |
| **Fase 3** | Gestión de Personas | 2 | Fase 2 |
| **Fase 4** | Eventos y Dashboard | 1 | Fase 2 |
| **Fase 5** | Reportes | 1 | Fase 3, Fase 4 |
| **Fase 6** | Control de Puerta | 1 | Fase 2 |
| **Fase 7** | QA y Hardening | 1 | Todas las anteriores |
| **Total** | | **~7 semanas** | |

---

## Dependencias entre Fases

```
Fase 1 (completa)
    │
    ▼
Fase 2: Agente Bridge ──────────────────────────────────┐
    │                                                    │
    ├──────────┬─────────────────────────────────────┐   │
    ▼          ▼                                     │   │
Fase 3    Fase 4                                  Fase 6  │
(Personas) (Eventos)                                 │   │
    │          │                                     │   │
    ▼          │                                     │   │
Fase 5 ◄───────┘                                     │   │
(Reportes)                                            │   │
    │                                                 │   │
    └──────────────────┬──────────────────────────────┘   │
                       │                                  │
                       ▼                                  ▼
                  Fase 7: QA y Hardening ◄────────────────┘
```

---

*Documento creado el 13 de abril de 2026*
