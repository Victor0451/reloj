#!/usr/bin/env ts-node

/**
 * Script para verificación de conectividad programada
 * Este script puede ser ejecutado como tarea programada (cron job)
 * 
 * Uso: node scripts/check-connectivity.js
 */

import { runConnectivityCheck } from '../src/lib/cron-jobs'

async function main() {
  console.log('🚀 Iniciando script de verificación de conectividad...')
  
  try {
    const result = await runConnectivityCheck()
    
    if (result.success) {
      console.log('✅ Verificación completada exitosamente')
      console.log(result.message)
    } else {
      console.error('❌ Error en la verificación:')
      console.error(result.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error inesperado:')
    console.error(error)
    process.exit(1)
  }
  
  console.log('👋 Finalizando script de verificación de conectividad')
}

// Solo ejecutar si el script se llama directamente
if (require.main === module) {
  main()
}

export default main