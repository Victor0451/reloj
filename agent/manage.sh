#!/bin/bash
# Script de gestión del Agent Bridge con PM2

AGENT_DIR="/media/vlongo/Archivos/Projectos/reloj/agent"
LOG_DIR="$AGENT_DIR/logs"
PROCESS_NAME="reloj-agent"

# Crear directorio de logs si no existe
mkdir -p "$LOG_DIR"

cd "$AGENT_DIR" || exit 1

case "$1" in
  start)
    echo "🚀 Iniciando Agent Bridge..."
    
    # Verificar si ya está corriendo
    if pm2 list | grep -q "$PROCESS_NAME"; then
      echo "⚠️  El proceso ya está corriendo"
      pm2 status "$PROCESS_NAME"
    else
      pm2 start ecosystem.config.cjs
      pm2 save
      echo "✅ Agent Bridge iniciado"
    fi
    ;;
    
  stop)
    echo "🛑 Deteniendo Agent Bridge..."
    pm2 stop "$PROCESS_NAME"
    pm2 save
    echo "✅ Agent Bridge detenido"
    ;;
    
  restart)
    echo "🔄 Reiniciando Agent Bridge..."
    pm2 restart "$PROCESS_NAME"
    pm2 save
    echo "✅ Agent Bridge reiniciado"
    ;;
    
  status)
    echo "📊 Estado del Agent Bridge:"
    pm2 status "$PROCESS_NAME"
    ;;
    
  logs)
    echo "📜 Logs del Agent Bridge (Ctrl+C para salir):"
    pm2 logs "$PROCESS_NAME" --lines 50 --nostream
    ;;
    
  logs:live)
    echo "📜 Logs en tiempo real (Ctrl+C para salir):"
    pm2 logs "$PROCESS_NAME" --nostream
    ;;
    
  monit)
    echo "📊 Monitor de PM2 (Ctrl+C para salir):"
    pm2 monit
    ;;
    
  startup)
    echo "🔧 Configurando inicio automático..."
    pm2 startup
    pm2 save
    echo "✅ Inicio automático configurado"
    ;;
    
  delete)
    echo "🗑️  Eliminando proceso..."
    pm2 delete "$PROCESS_NAME"
    echo "✅ Proceso eliminado"
    ;;
    
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|logs:live|monit|startup|delete}"
    echo ""
    echo "Commands:"
    echo "  start       - Iniciar el Agent Bridge"
    echo "  stop        - Detener el Agent Bridge"
    echo "  restart     - Reiniciar el Agent Bridge"
    echo "  status      - Ver estado del proceso"
    echo "  logs        - Ver últimos logs"
    echo "  logs:live   - Ver logs en tiempo real"
    echo "  monit       - Abrir monitor de PM2"
    echo "  startup     - Configurar inicio automático"
    echo "  delete      - Eliminar el proceso de PM2"
    exit 1
    ;;
esac
