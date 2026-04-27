# Sistema de Conectividad de Dispositivos

Documentación técnica del sistema de conectividad implementado para el monitoreo y gestión de dispositivos Hikvision.

## Tabla de Contenidos
- [[Arquitectura del Sistema de Conectividad]]
- [[Componentes Técnicos]]
- [[API y Endpoints]]
- [[Tareas Programadas]]
- [[Manejo de Errores]]

## Descripción General

El sistema de conectividad implementado proporciona una solución robusta y confiable para monitorear y gestionar la conectividad de los dispositivos Hikvision registrados en el sistema. A diferencia del sistema anterior que dependía únicamente de un "Agente Bridge" no implementado, esta solución ofrece:

- Verificación activa de conectividad mediante health checks reales
- Actualización automática del estado de los dispositivos
- Monitoreo en tiempo real con interfaz intuitiva
- Manejo proactivo de errores y dispositivos offline
- Tareas programadas para mantenimiento automático

## Características Principales

### 1. Verificación Activa
- Health checks reales mediante solicitudes HTTP
- Detección de timeout y errores de red
- Latencia medida en cada verificación

### 2. Actualización Automática
- Estados actualizados en tiempo real en la base de datos
- Interfaz de usuario con información actualizada
- Refresco automático mediante suscripciones Realtime

### 3. Monitoreo Proactivo
- Detección de dispositivos inactivos
- Marcação automática de dispositivos offline
- Panel de control dedicado

### 4. Interfaz Intuitiva
- Botones para verificar conectividad individual
- Página dedicada de conectividad con resumen
- Dashboard mejorado con indicadores claros

## Tecnologías Utilizadas

- **TypeScript**: Lógica del sistema
- **Supabase**: Base de datos y Realtime
- **Next.js Server Actions**: Acciones del servidor
- **React Components**: Interfaz de usuario
- **Node.js Scripts**: Tareas programadas

## Próximos Pasos

1. Implementar notificaciones por email/slack para dispositivos offline
2. Agregar logs de conectividad históricos
3. Implementar verificación más avanzada (puertos específicos, servicios, etc.)
4. Agregar configuración de credenciales por dispositivo
5. Implementar encriptación de comunicaciones

---
**Última actualización:** April 15, 2026