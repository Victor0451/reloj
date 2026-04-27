**HIKVISION**

**Sistema Web de Gestión Biométrica**

*Documento de Requisitos del Producto (PRD)*

  ---------------------------- ------------------------------------------
  **Versión**                  1.0

  **Fecha**                    Abril 2026

  **Dispositivo**              Hikvision DS-K1T320MFWX

  **Protocolo**                ISAPI / HTTPS

  **Estado**                   Borrador
  ---------------------------- ------------------------------------------

**1. Resumen Ejecutivo**

Este documento define los requisitos para el desarrollo de un sistema
web que permita gestionar de forma centralizada y remota el terminal de
reconocimiento facial Hikvision DS-K1T320MFWX. El sistema se conecta al
dispositivo mediante la API REST ISAPI de Hikvision (HTTPS) a través de
un agente bridge local, y expone todas sus funcionalidades a través de
una interfaz web moderna alojada en la nube.

El sistema cubre el ciclo completo de gestión: altas y bajas de
personas, monitoreo de eventos de acceso en tiempo real, generación de
reportes, y control remoto de la puerta.

**2. Contexto y Problema**

**2.1 Situación Actual**

El terminal biométrico Hikvision DS-K1T320MFWX opera de forma aislada.
Su administración se realiza localmente a través de su interfaz web
embebida (accesible solo desde la red local), lo que implica las
siguientes limitaciones:

-   No hay acceso remoto desde fuera de la red local.

-   No existe un historial de eventos centralizado ni exportable
    fácilmente.

-   Gestionar personas (altas, bajas, modificaciones) requiere acceso
    físico o VPN.

-   No hay reportes ni dashboards de asistencia.

-   No se pueden gestionar múltiples relojes desde un único lugar.

**2.2 Solución Propuesta**

Desarrollar un sistema web full-stack alojado en la nube que, mediante
un agente bridge instalado en la red local del cliente, se comunique con
el reloj vía ISAPI y exponga todas sus funcionalidades a través de una
interfaz moderna, segura y accesible desde cualquier lugar.

**3. Objetivos del Producto**

**3.1 Objetivos Primarios**

1.  Centralizar la gestión del reloj biométrico en una interfaz web
    accesible desde cualquier lugar.

2.  Permitir el alta, baja y modificación de personas con foto facial y
    huella dactilar desde la web.

3.  Registrar y consultar todos los eventos de acceso (fichajes,
    intentos fallidos, aperturas).

4.  Generar reportes de asistencia exportables en PDF y Excel.

5.  Proveer control remoto de la puerta (abrir/cerrar).

**3.2 Objetivos Secundarios**

-   Soporte para múltiples dispositivos/sucursales desde un único panel.

-   Alertas y notificaciones por eventos críticos (acceso denegado,
    puerta forzada).

-   Auditoría de acciones del operador (quién hizo qué y cuándo).

**4. Alcance**

**4.1 Dentro del Alcance (v1.0)**

-   Gestión completa de usuarios/personas en el reloj (CRUD).

-   Visualización de eventos de acceso en tiempo real y con filtros.

-   Reportes de asistencia por persona, rango de fechas y tipo de
    evento.

-   Control remoto de la puerta (apertura/cierre).

-   Panel de estado del dispositivo (online/offline, firmware,
    capacidades).

-   Agente bridge local que sincroniza datos con Supabase.

-   Sistema de autenticación para operadores del sistema.

**4.2 Fuera del Alcance (v1.0)**

-   Integración con sistemas de nómina o ERP.

-   Reconocimiento facial desde la web (solo gestión de perfiles).

-   Soporte para otros modelos/marcas de relojes.

-   App móvil nativa.

**5. Usuarios y Roles**

  --------------------------------------------------------------------------
  **Rol**             **Descripción**           **Permisos**
  ------------------- ------------------------- ----------------------------
  **Administrador**   Control total del sistema Todo: configuración,
                      y del dispositivo.        usuarios, reportes, puerta.

  **Operador RRHH**   Gestión del personal      Alta/baja personas, ver
                      registrado en el reloj.   eventos, exportar reportes.

  **Supervisor**      Monitoreo de asistencia y Solo lectura: eventos,
                      accesos.                  reportes, dashboard.

  **Técnico**         Mantenimiento y           Estado del dispositivo,
                      configuración del         firmware, configuración red.
                      dispositivo.              
  --------------------------------------------------------------------------

**6. Funcionalidades del Sistema**

**6.1 Gestión de Personas**

  -------------------------------------------------------------------------
  **Funcionalidad**      **Descripción**                    **Prioridad**
  ---------------------- ---------------------------------- ---------------
  **Alta de persona**    Registrar nombre, foto facial,     **Alta**
                         huella, nro. de empleado y tarjeta 
                         en el reloj vía ISAPI.             

  **Baja de persona**    Eliminar persona del reloj y       **Alta**
                         marcarla como inactiva en          
                         Supabase.                          

  **Modificación**       Actualizar datos, foto o huella de **Alta**
                         una persona existente.             

  **Listado y búsqueda** Ver todas las personas registradas **Alta**
                         con filtros por nombre, ID,        
                         estado.                            

  **Importación masiva** Importar lista de personas desde   **Media**
                         CSV/Excel y registrarlas en lote.  

  **Sincronización**     Detectar y sincronizar diferencias **Media**
                         entre Supabase y el reloj.         
  -------------------------------------------------------------------------

**6.2 Eventos de Acceso (Fichajes)**

  -------------------------------------------------------------------------
  **Funcionalidad**      **Descripción**                    **Prioridad**
  ---------------------- ---------------------------------- ---------------
  **Listado de eventos** Ver todos los eventos con fecha,   **Alta**
                         hora, persona, tipo y resultado.   

  **Filtros avanzados**  Filtrar por persona, rango de      **Alta**
                         fechas, tipo de evento, resultado. 

  **Polling en tiempo    El agente sincroniza eventos       **Alta**
  real**                 nuevos cada 30 segundos a          
                         Supabase.                          

  **Detalle de evento**  Ver foto capturada por el reloj en **Media**
                         el momento del acceso.             

  **Exportación**        Exportar eventos filtrados a CSV o **Alta**
                         Excel.                             
  -------------------------------------------------------------------------

**6.3 Reportes de Asistencia**

  -------------------------------------------------------------------------
  **Funcionalidad**      **Descripción**                    **Prioridad**
  ---------------------- ---------------------------------- ---------------
  **Reporte diario**     Resumen de entradas y salidas por  **Alta**
                         persona para un día dado.          

  **Reporte por rango**  Asistencia de todo el personal en  **Alta**
                         un período definido.               

  **Reporte por          Historial completo de una persona  **Alta**
  persona**              en un período.                     

  **Exportar PDF**       Generar reporte en PDF con logo y  **Alta**
                         formato profesional.               

  **Exportar Excel**     Generar planilla Excel con datos   **Alta**
                         crudos para análisis.              

  **Resumen de KPIs**    Total de accesos, tasa de éxito,   **Media**
                         personas sin fichar en el día.     
  -------------------------------------------------------------------------

**6.4 Control de Puerta**

  -------------------------------------------------------------------------
  **Funcionalidad**      **Descripción**                    **Prioridad**
  ---------------------- ---------------------------------- ---------------
  **Abrir puerta**       Enviar comando de apertura remota  **Alta**
                         al reloj vía ISAPI.                

  **Cerrar/bloquear**    Enviar comando de cierre/bloqueo   **Alta**
                         al reloj.                          

  **Estado de puerta**   Ver si la puerta está abierta,     **Alta**
                         cerrada o en alarma.               

  **Historial de         Log de quién envió comandos de     **Media**
  comandos**             apertura/cierre y cuándo.          
  -------------------------------------------------------------------------

**6.5 Estado del Dispositivo**

  -------------------------------------------------------------------------
  **Funcionalidad**      **Descripción**                    **Prioridad**
  ---------------------- ---------------------------------- ---------------
  **Panel de estado**    Ver IP, modelo, firmware,          **Alta**
                         capacidades usadas/disponibles.    

  **Estado de conexión** Indicador en tiempo real de        **Alta**
                         online/offline del reloj.          

  **Capacidades**        Ver cuántas personas, tarjetas y   **Media**
                         eventos están cargados vs. el      
                         máximo.                            

  **Reinicio remoto**    Enviar comando de reboot al        **Baja**
                         dispositivo.                       
  -------------------------------------------------------------------------

**6.6 Agente Bridge Local**

  -------------------------------------------------------------------------
  **Funcionalidad**      **Descripción**                    **Prioridad**
  ---------------------- ---------------------------------- ---------------
  **Proxy ISAPI**        Recibir peticiones del backend     **Alta**
                         cloud y reenviarlas al reloj       
                         local.                             

  **Sincronización       Consultar                          **Alta**
  eventos**              /ISAPI/AccessControl/AcsEvent cada 
                         30s y guardar en Supabase.         

  **Heartbeat**          Enviar señal de vida al backend    **Alta**
                         cada 60s para monitorear estado.   

  **Reconexión           Reintentar conexión al reloj si se **Media**
  automática**           pierde y notificar al sistema.     

  **Instalación simple** Ejecutable Node.js configurable    **Alta**
                         con un archivo .env.               
  -------------------------------------------------------------------------

**7. Arquitectura del Sistema**

**7.1 Diagrama de Componentes**

+-----------------------------------------------------------------------+
| **\[ Navegador / Operador \]**                                        |
|                                                                       |
| ↕ HTTPS                                                               |
|                                                                       |
| **\[ Next.js App --- Vercel/Cloud \]**                                |
|                                                                       |
| ↕ Supabase SDK / REST                                                 |
|                                                                       |
| **\[ Supabase --- PostgreSQL + Realtime + Auth \]**                   |
|                                                                       |
| ↕ WebSocket / HTTP Polling                                            |
|                                                                       |
| **\[ Agente Bridge --- Node.js en red local \]**                      |
|                                                                       |
| ↕ HTTPS / ISAPI (Digest Auth)                                         |
|                                                                       |
| **\[ Hikvision DS-K1T320MFWX --- 192.168.1.175 \]**                   |
+-----------------------------------------------------------------------+

**7.2 Stack Tecnológico**

  ------------------------------------------------------------------------
  **Capa**           **Tecnología**            **Justificación**
  ------------------ ------------------------- ---------------------------
  **Frontend**       Next.js 14 (App Router)   SSR/SSG, routing nativo,
                                               soporte API Routes
                                               integrado.

  **UI Components**  shadcn/ui + Tailwind CSS  Componentes accesibles,
                                               altamente customizables,
                                               dark mode nativo.

  **Base de Datos**  Supabase (PostgreSQL)     Realtime subscriptions,
                                               Auth integrado, Row Level
                                               Security.

  **Auth**           Supabase Auth             JWT, roles, magic links,
                                               soporte MFA.

  **Backend/API**    Next.js API Routes        Edge functions en Vercel,
                                               misma base de código que el
                                               frontend.

  **Agente Local**   Node.js + Express         Liviano, fácil instalación,
                                               soporte HTTP/HTTPS.

  **Reportes PDF**   react-pdf /               Generación de PDF en el
                     \@react-pdf/renderer      cliente o servidor.

  **Reportes Excel** xlsx (SheetJS)            Exportación de datos a
                                               .xlsx.

  **Gráficos**       Recharts                  Componentes React para
                                               dashboards y KPIs.

  **Deploy           Vercel                    CI/CD automático, Edge
  Frontend**                                   Network, preview por PR.

  **Deploy Agente**  PM2 + Node.js local       Proceso daemon con reinicio
                                               automático en la PC local.
  ------------------------------------------------------------------------

**8. Modelo de Datos (Supabase)**

**8.1 Tablas Principales**

**persons**

Almacena las personas registradas en el sistema.

  --------------------------------------------------------------------------
  **Campo**            **Tipo**        **Descripción**
  -------------------- --------------- -------------------------------------
  id                   UUID (PK)       Identificador único interno.

  employee_id          TEXT            Número de empleado en el reloj.

  name                 TEXT            Nombre completo.

  department           TEXT            Área o departamento.

  card_number          TEXT            Número de tarjeta RFID.

  face_photo_url       TEXT            URL de foto facial en Supabase
                                       Storage.

  device_employee_no   INTEGER         ID asignado por el reloj Hikvision.

  status               ENUM            active \| inactive \| pending_sync

  created_at           TIMESTAMPTZ     Fecha de creación.

  updated_at           TIMESTAMPTZ     Última modificación.
  --------------------------------------------------------------------------

**access_events**

Registra cada evento de acceso capturado del reloj.

  ------------------------------------------------------------------------
  **Campo**          **Tipo**        **Descripción**
  ------------------ --------------- -------------------------------------
  id                 UUID (PK)       Identificador único.

  device_serial      TEXT            Número de serie del reloj.

  person_id          UUID (FK)       Referencia a persons.id (si se
                                     identifica).

  employee_id        TEXT            ID de empleado según el reloj.

  event_time         TIMESTAMPTZ     Timestamp del evento.

  major              INTEGER         Código mayor del evento Hikvision.

  minor              INTEGER         Código menor del evento Hikvision.

  event_type         TEXT            Tipo legible: access_granted,
                                     access_denied, door_open, etc.

  verify_mode        TEXT            Modo de verificación: face, card,
                                     fingerprint, password.

  raw_payload        JSONB           Payload completo del evento para
                                     auditoría.

  synced_at          TIMESTAMPTZ     Cuándo fue sincronizado por el
                                     agente.
  ------------------------------------------------------------------------

**devices**

Registro de los relojes biométricos gestionados por el sistema.

  ------------------------------------------------------------------------
  **Campo**          **Tipo**        **Descripción**
  ------------------ --------------- -------------------------------------
  id                 UUID (PK)       Identificador único.

  name               TEXT            Nombre amigable (ej: Entrada
                                     Principal).

  serial_number      TEXT (UNIQUE)   Número de serie del reloj Hikvision.

  model              TEXT            Modelo del dispositivo.

  ip_address         TEXT            IP del dispositivo en red local.

  firmware_version   TEXT            Versión de firmware.

  status             ENUM            online \| offline \| unknown

  last_seen_at       TIMESTAMPTZ     Último heartbeat del agente.

  location           TEXT            Ubicación física del dispositivo.
  ------------------------------------------------------------------------

**audit_logs**

Registro de acciones de los operadores del sistema para auditoría.

  ------------------------------------------------------------------------
  **Campo**          **Tipo**        **Descripción**
  ------------------ --------------- -------------------------------------
  id                 UUID (PK)       Identificador único.

  user_id            UUID (FK)       Operador que realizó la acción.

  action             TEXT            create_person, delete_person,
                                     open_door, etc.

  target_type        TEXT            Entidad afectada: person, device,
                                     door.

  target_id          TEXT            ID de la entidad afectada.

  details            JSONB           Datos adicionales de contexto.

  created_at         TIMESTAMPTZ     Timestamp de la acción.
  ------------------------------------------------------------------------

**9. Endpoints ISAPI Utilizados**

El agente bridge consume los siguientes endpoints de la API ISAPI del
reloj:

  ------------------------------------------------------------------------------------------
  **Método**   **Endpoint**                                **Función**
  ------------ ------------------------------------------- ---------------------------------
  **GET**      /ISAPI/System/deviceInfo                    Obtener información del
                                                           dispositivo.

  **POST**     /ISAPI/AccessControl/UserInfo/Search        Listar personas registradas.

  **POST**     /ISAPI/AccessControl/UserInfo/Record        Registrar una nueva persona.

  **PUT**      /ISAPI/AccessControl/UserInfo/Modify        Modificar datos de una persona.

  **DELETE**   /ISAPI/AccessControl/UserInfo/Delete        Eliminar una persona.

  **POST**     /ISAPI/AccessControl/AcsEvent               Consultar eventos de acceso.

  **PUT**      /ISAPI/AccessControl/Door/param/1           Configurar puerta.

  **PUT**      /ISAPI/AccessControl/RemoteControl/door/1   Abrir/cerrar puerta remotamente.

  **GET**      /ISAPI/AccessControl/Door/Status/1          Obtener estado de la puerta.

  **POST**     /ISAPI/Intelligent/FDLib/FDSearch           Buscar en librería de caras.

  **POST**     /ISAPI/Intelligent/FDLib/FaceDataRecord     Agregar foto facial.
  ------------------------------------------------------------------------------------------

**10. Pantallas del Sistema**

**10.1 Listado de Vistas**

-   Dashboard principal --- KPIs del día, estado del dispositivo,
    últimos accesos.

-   Personas --- Tabla con búsqueda, alta, edición y baja de personas.

-   Alta/Edición de persona --- Formulario con foto, datos y estado de
    sincronización.

-   Eventos de acceso --- Tabla filtrable con polling en tiempo real.

-   Reportes --- Selector de tipo, rango de fechas y exportación.

-   Control de puerta --- Botones de apertura/cierre con estado visual.

-   Estado del dispositivo --- Info del reloj, capacidades, heartbeat.

-   Auditoría --- Log de acciones de operadores.

-   Configuración --- Credenciales del reloj, URL del agente, usuarios
    del sistema.

**10.2 Dashboard Principal**

El dashboard muestra en tiempo real:

-   Indicador de estado del reloj (verde/rojo).

-   Total de accesos del día y tasa de éxito.

-   Personas sin fichar en el día.

-   Últimos 10 eventos de acceso con actualización automática.

-   Botón de apertura rápida de puerta.

**11. Seguridad**

**11.1 Autenticación y Autorización**

-   Login con email/password o magic link via Supabase Auth.

-   JWT con expiración de 1 hora + refresh token.

-   Row Level Security (RLS) en Supabase para aislar datos por
    organización.

-   Control de acceso basado en roles (RBAC) implementado en middleware
    Next.js.

**11.2 Seguridad del Agente Bridge**

-   Comunicación con Supabase via token de servicio (service_role key)
    almacenado en .env.

-   Comunicación con el reloj via HTTPS con certificado autofirmado
    (flag -k en desarrollo, cert personalizado en producción).

-   Autenticación Digest Auth con las credenciales del reloj.

-   El agente NO expone ningún puerto público; solo hace llamadas
    salientes.

**11.3 Datos**

-   Credenciales del reloj cifradas en Supabase Vault (no en texto
    plano).

-   Logs de auditoría inmutables (sin opción de borrado para
    operadores).

-   Fotos faciales almacenadas en Supabase Storage con acceso privado.

**12. Plan de Implementación**

  ------------------------------------------------------------------------------
  **Fase**   **Nombre**            **Entregables**                **Duración**
  ---------- --------------------- ------------------------------ --------------
  **F1**     Infraestructura base  Proyecto Next.js + Supabase +  1 semana
                                   shadcn/ui configurados. Auth   
                                   funcional. Deploy en Vercel.   

  **F2**     Agente Bridge         Agente Node.js conectado al    1 semana
                                   reloj. Sincronización de       
                                   eventos a Supabase. Heartbeat. 

  **F3**     Gestión de Personas   CRUD completo de personas.     2 semanas
                                   Alta con foto facial.          
                                   Sincronización con el reloj.   

  **F4**     Eventos y Dashboard   Listado de eventos en tiempo   1 semana
                                   real. Dashboard con KPIs.      
                                   Filtros avanzados.             

  **F5**     Reportes y            Reportes de asistencia.        1 semana
             Exportación           Exportación PDF y Excel.       

  **F6**     Control de Puerta y   Apertura/cierre remota. Estado 1 semana
             Auditoría             de puerta. Log de auditoría.   

  **F7**     QA y Hardening        Testing, revisión de           1 semana
                                   seguridad, documentación,      
                                   ajustes finales.               
  ------------------------------------------------------------------------------

**13. Requisitos No Funcionales**

**Performance**

-   El dashboard debe cargar en menos de 2 segundos en condiciones
    normales.

-   La sincronización de eventos no debe tener un delay mayor a 60
    segundos.

-   Los reportes de hasta 10.000 eventos deben generarse en menos de 5
    segundos.

**Disponibilidad**

-   El frontend y la BD deben tener un SLA de 99.9% (garantizado por
    Vercel + Supabase).

-   El agente local puede tener downtime planificado sin afectar los
    datos históricos.

**Escalabilidad**

-   El sistema debe soportar hasta 10 dispositivos por organización sin
    cambios de arquitectura.

-   La BD debe soportar hasta 5.000.000 de registros de eventos sin
    degradación.

**Usabilidad**

-   Interfaz responsive (desktop y tablet). Mínimo 1280px de ancho
    objetivo.

-   Soporte para dark mode nativo.

-   Accesibilidad WCAG 2.1 nivel AA.

**14. Criterios de Éxito**

6.  Un operador puede registrar una nueva persona con foto desde la web
    y verificar que puede acceder al reloj físicamente en menos de 2
    minutos.

7.  Los eventos de acceso aparecen en la interfaz web dentro de los 60
    segundos de producirse en el reloj.

8.  Se puede generar y descargar un reporte PDF de asistencia mensual en
    menos de 10 segundos.

9.  La puerta puede abrirse remotamente desde la web con latencia menor
    a 3 segundos.

10. El sistema indica correctamente cuando el reloj está offline y lo
    detecta cuando vuelve a estar online.

*Hikvision DS-K1T320MFWX --- Sistema Web de Gestión Biométrica --- PRD
v1.0 --- Abril 2026*
