---
tags: [modulo, personas]
date: 2026-04-13
status: pendiente
---

# Módulo - Personas

> [!example] Estado: **Pendiente** — [[Fase 3 - Gestión de Personas]]
> CRUD completo de personas con foto facial, huella y sincronización ISAPI.

---

## Funcionalidades Planificadas

| Función | Prioridad | Descripción |
|---------|-----------|-------------|
| Listado + búsqueda | Alta | Tabla con filtros por nombre, ID, estado |
| Alta de persona | Alta | Nombre, foto facial, huella, nro. empleado |
| Baja de persona | Alta | Elimina del reloj + marca inactiva |
| Modificación | Alta | Actualiza datos, foto o huella |
| Importación masiva | Media | CSV/Excel → registro en lote |
| Sincronización | Media | Detecta diferencias entre Supabase y reloj |

## Endpoints ISAPI Requeridos

| Método | Endpoint | Función |
|--------|----------|---------|
| POST | `/ISAPI/AccessControl/UserInfo/Search` | Listar personas |
| POST | `/ISAPI/AccessControl/UserInfo/Record` | Registrar persona |
| PUT | `/ISAPI/AccessControl/UserInfo/Modify` | Modificar persona |
| DELETE | `/ISAPI/AccessControl/UserInfo/Delete` | Eliminar persona |
| POST | `/ISAPI/Intelligent/FDLib/FaceDataRecord` | Agregar foto facial |

## Ver También

- [[Fase 3 - Gestión de Personas]]
- [[Tabla - persons]]
- [[Referencia ISAPI#UserInfo]]
