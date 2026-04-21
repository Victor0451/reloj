#!/usr/bin/env bash
# Script de Diagnóstico de Conexión con Reloj
# Usage: 
#   bash scripts/diagnose-clock.sh
#   DEVICE_PASSWORD=mipass bash scripts/diagnose-clock.sh

set -e

DEVICE_IP="${DEVICE_IP:-192.168.1.175}"
DEVICE_PORT="${DEVICE_PORT:-443}"
DEVICE_USERNAME="${DEVICE_USERNAME:-admin}"
DEVICE_PASSWORD="${DEVICE_PASSWORD:-}"
BASE_URL="https://${DEVICE_IP}:${DEVICE_PORT}"

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

success() { echo -e "${GREEN}✅ $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo ""
echo "════════════════════════════════════════════════════════════"
echo "🔍  DIAGNÓSTICO DE CONEXIÓN — RELOJ BIOMÉTRICO"
echo "════════════════════════════════════════════════════════════"
echo ""

info "Target: ${BASE_URL}"
info "Usuario: ${DEVICE_USERNAME}"
echo ""

# Test 1: Conectividad de red
info "Probando conectividad de red..."
HTTP_CODE=$(curl -s -k -m 5 -o /tmp/device-response.xml -w "%{http_code}" "${BASE_URL}/ISAPI/System/deviceInfo" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    success "Red OK — dispositivo responde (HTTP ${HTTP_CODE})"
else
    error "No hay conectividad — verificar IP y conexión de red (HTTP ${HTTP_CODE})"
    exit 1
fi
echo ""

# Test 2: Autenticación Digest
info "Probando autenticación Digest..."

if [ -z "$DEVICE_PASSWORD" ]; then
    warn "DEVICE_PASSWORD no está configurado"
    warn "Saltando test de autenticación completa"
    echo ""
    info "Para probar autenticación, ejecutá:"
    echo "    DEVICE_PASSWORD=mipass bash scripts/diagnose-clock.sh"
else
    info "Intentando autenticar con Digest Auth..."
    RESPONSE=$(curl -s -k -m 10 --digest -u "${DEVICE_USERNAME}:${DEVICE_PASSWORD}" \
        -H "Content-Type: application/xml; charset=utf-8" \
        "${BASE_URL}/ISAPI/System/deviceInfo" 2>/dev/null)
    
    if echo "$RESPONSE" | grep -q "DeviceInfo"; then
        success "Autenticación exitosa"
        echo ""
        info "Información del dispositivo:"
        SERIAL=$(echo "$RESPONSE" | grep -oP '(?<=<serialNumber>)[^<]+' | head -1)
        MODEL=$(echo "$RESPONSE" | grep -oP '(?<=<model>)[^<]+' | head -1)
        FIRMWARE=$(echo "$RESPONSE" | grep -oP '(?<=<firmwareVersion>)[^<]+' | head -1)
        NAME=$(echo "$RESPONSE" | grep -oP '(?<=<deviceName>)[^<]+' | head -1)
        echo "  Serial: ${SERIAL:-N/A}"
        echo "  Modelo: ${MODEL:-N/A}"
        echo "  Firmware: ${FIRMWARE:-N/A}"
        echo "  Nombre: ${NAME:-N/A}"
        
        # Guardar info para después
        echo "${SERIAL}" > /tmp/device-serial.txt
        echo "${MODEL}" > /tmp/device-model.txt
    else
        error "Autenticación fallida"
        if echo "$RESPONSE" | grep -q "401"; then
            echo "  El password es incorrecto"
        else
            echo "  Respuesta inesperada:"
            echo "$RESPONSE" | head -5
        fi
    fi
fi
echo ""

# Test 3: Access Control (solo si tenemos password)
if [ -n "$DEVICE_PASSWORD" ]; then
    info "Probando acceso a control de puerta..."
    ACCESS_CTRL=$(curl -s -k -m 10 --digest -u "${DEVICE_USERNAME}:${DEVICE_PASSWORD}" \
        -H "Content-Type: application/xml; charset=utf-8" \
        "${BASE_URL}/ISAPI/AccessControl/Door/status/1" 2>/dev/null)

    if echo "$ACCESS_CTRL" | grep -q "DoorStatus"; then
        success "Access Control API responde"
        DOOR_STATUS=$(echo "$ACCESS_CTRL" | grep -oP '(?<=<doorStatus>)[^<]+' | head -1)
        info "Estado de puerta: ${DOOR_STATUS:-N/A}"
    else
        warn "Access Control no disponible"
    fi
    echo ""
fi

# Resumen
echo "════════════════════════════════════════════════════════════"
echo "📊  RESUMEN"
echo "════════════════════════════════════════════════════════════"

if [ -n "$DEVICE_PASSWORD" ] && [ -f /tmp/device-serial.txt ] && [ -s /tmp/device-serial.txt ]; then
    success "El reloj está completamente accesible"
    echo ""
    echo "Configuración para Agent Bridge (agent/.env):"
    echo "  SUPABASE_URL=https://gpbfwcfvclxdjbjthsiq.supabase.co"
    echo "  DEVICE_IP=${DEVICE_IP}"
    echo "  DEVICE_USERNAME=${DEVICE_USERNAME}"
    echo "  DEVICE_PASSWORD=${DEVICE_PASSWORD}"
    echo ""
    echo "Dispositivo detectado:"
    echo "  Serial: $(cat /tmp/device-serial.txt 2>/dev/null || echo 'N/A')"
    echo "  Modelo: $(cat /tmp/device-model.txt 2>/dev/null || echo 'N/A')"
else
    warn "Falta configurar DEVICE_PASSWORD"
    echo ""
    echo "Para usar este reloj con el Agent Bridge:"
    echo "  1. Ejecutá: DEVICE_PASSWORD=mipass bash scripts/diagnose-clock.sh"
    echo "  2. Si la autenticación es exitosa, copiá la config a agent/.env"
fi
echo ""

# Cleanup
rm -f /tmp/device-response.xml 2>/dev/null
