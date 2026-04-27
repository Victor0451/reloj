# Guía de Operación: DS-K1T320MFWX con Sistema Reloj

## Estado del Sistema

### ✅ Funcionalidades Implementadas

| Funcionalidad | Estado | Detalles |
|---------------|--------|----------|
| Health Check | ✅ Funciona | Verifica conectividad con el reloj |
| Sincronización de Eventos | ✅ Funciona | Eventos se guardan en Supabase |
| Estado Online/Offline | ✅ Funciona | Heartbeat cada 60s |
| Ver eventos en Dashboard | ✅ Funciona | /dashboard/events |
| Ver estado de dispositivos | ✅ Funciona | /dashboard/devices |

### ❌ Funcionalidades Limitadas

| Funcionalidad | Estado | Causa |
|---------------|--------|-------|
| Gestión de usuarios via API | ❌ No soportado | Firmware del dispositivo |
| Crear personas desde web | ❌ No funciona | ISAPI bloqueado por firmware |
| Sincronizar personas al reloj | ❌ No funciona | ISAPI bloqueado por firmware |

## Modelo de Trabajo

Dado que el DS-K1T320MFWX no permite gestión de usuarios via HTTP ISAPI, el flujo de trabajo debe ser:

### Crear/Editar Personas

**Opción 1: Panel LCD del Reloj** (Recomendado para pocas personas)

1. Ir al reloj físicamente
2. Menú → Gestión de Usuarios → Agregar Persona
3. Ingresar: Nombre, ID de empleado, Departmento, Huella/Foto/Tarjeta según corresponda
4. La persona queda registrada en el reloj

**Opción 2: iVMS-4200** (Recomendado para muchas personas)

1. Instalar Hikvision iVMS-4200 en una PC
2. Conectar la PC a la misma red que el reloj
3. Agregar el dispositivo al software
4. Gestionar usuarios desde la interfaz del software
5. Las personas se sincronizan automáticamente al reloj

### Sincronización de Eventos

Una vez que las personas están registradas en el reloj (por cualquiera de los métodos anteriores), los eventos de acceso se capturan automáticamente:

1. Persona registra en el reloj (huella, cara o tarjeta)
2. El reloj genera un evento
3. El **Agent** captura el evento cada 60 segundos
4. El evento aparece en **Dashboard → Eventos**

### Auditar Horarios

1. Ir a **Dashboard → Eventos**
2. Filtrar por persona, rango de fechas, tipo de evento
3. Exportar a Excel o PDF si es necesario

## Configuración Actual

- **Reloj**: xd (192.168.100.60)
- **Credenciales**: admin / evol@2601
- **Certificado**: Expirado (aceptado por el sistema)
- **Agent**: Corriendo en puerto local

## Limitaciones Conocidas

1. **No se pueden crear usuarios desde la web** — El firmware del dispositivo no lo permite
2. **El operador debe crear usuarios** — O desde el LCD del reloj o desde iVMS-4200
3. **Personas en el reloj no aparecen en la web** — Solo eventos de personas registradas se ven

## Recomendaciones

1. **Para pruebas iniciales**: Crear 1-2 personas de prueba desde el LCD del reloj
2. **Para部署 en producción**: Usar iVMS-4200 para gestionar usuarios en batch
3. **Monitorear eventos**: Verificar que los eventos llegan a la DB después de cada jornada

## Contacto de Soporte

Si hay dudas sobre el funcionamiento del reloj, consultar el manual del DS-K1T320MFWX o contactar al proveedor de Hikvision.
