/**
 * Device Adapter Manager
 * Factory que crea y gestiona adaptadores según la marca del dispositivo
 */

import {
  IDeviceAdapter,
  AdapterConfig,
  getAdapter,
  getSupportedBrands,
} from "./interfaces";
import * as log from "../utils/logger";

// ─── Circuit Breaker Types ────────────────────────────────────────────────────

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: Date;
  nextProbeTime: Date;
}

export interface DeviceConfig {
  /** ID del dispositivo en la DB */
  id: string;
  /** Número de serie */
  serialNumber: string;
  /** IP del dispositivo */
  ip: string;
  /** Puerto */
  port?: number;
  /** Marca del dispositivo */
  brand: string;
  /** Modelo */
  model?: string;
  /** Usuario para autenticación */
  username?: string;
  /** Contraseña (idealmente encriptada) */
  password?: string;
  /** Permite certificados autofirmados o expirados */
  allowSelfSignedCert?: boolean;
}

export class AdapterManager {
  private adapters: Map<string, IDeviceAdapter> = new Map();
  private circuitBreakerState: Map<string, CircuitBreakerState> = new Map();

  /**
   * Obtiene o crea un adaptador para un dispositivo
   */
  async getAdapter(device: DeviceConfig, verifyHealth = false): Promise<IDeviceAdapter> {
    const existing = this.adapters.get(device.id);
    if (existing) {
      return existing;
    }

    const adapter = await this.createAdapter(device, verifyHealth);
    this.adapters.set(device.id, adapter);
    return adapter;
  }

  /**
   * Crea un nuevo adaptador según la marca
   * @param verifyHealth If true, perform blocking health check before returning (blocks if device unreachable)
   */
  private async createAdapter(device: DeviceConfig, verifyHealth = false): Promise<IDeviceAdapter> {
    const brand = (device.brand || "hikvision").toLowerCase();

    log.info("adapterManager", `Creating adapter for brand: ${brand}`, {
      deviceId: device.id,
      serial: device.serialNumber,
    });

    const AdapterClass = getAdapter(brand);

    if (!AdapterClass) {
      const supported = getSupportedBrands().join(", ");
      throw new Error(
        `Marca "${brand}" no soportada. Marcas disponibles: ${supported}`
      );
    }

    // Validar que tenemos las credenciales
    if (!device.username || !device.password) {
      throw new Error(
        `El dispositivo ${device.serialNumber} no tiene credenciales configuradas`
      );
    }

    const config: AdapterConfig = {
      ip: device.ip,
      port: device.port || 443,
      username: device.username,
      password: device.password,
      serialNumber: device.serialNumber,
      rejectUnauthorized: device.allowSelfSignedCert ? false : true,
    };

    const adapter = new AdapterClass(config);

    // Optional blocking health check - caller decides when to verify
    if (verifyHealth) {
      const health = await adapter.healthCheck();
      if (!health.reachable) {
        throw new Error(
          `No se puede conectar al dispositivo ${device.serialNumber}: ${health.error}`
        );
      }

      log.info("adapterManager", `Adapter created and verified`, {
        deviceId: device.id,
        brand,
        latency: health.latency,
      });
    } else {
      log.info("adapterManager", `Adapter created successfully (no health check)`, {
        deviceId: device.id,
        brand,
      });
    }

    return adapter;
  }

  /**
   * Obtiene un adaptador existente sin crear uno nuevo
   */
  getExistingAdapter(deviceId: string): IDeviceAdapter | undefined {
    return this.adapters.get(deviceId);
  }

  /**
   * Elimina un adaptador
   */
  async removeAdapter(deviceId: string): Promise<void> {
    const adapter = this.adapters.get(deviceId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(deviceId);
      log.info("adapterManager", `Adapter removed`, { deviceId });
    }
  }

  /**
   * Cierra todos los adaptadores
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.entries()).map(
      async ([id, adapter]) => {
        try {
          await adapter.disconnect();
        } catch (err) {
          log.error("adapterManager", `Error disconnecting adapter ${id}`, { err: err as Error });
        }
      }
    );

    await Promise.all(disconnectPromises);
    this.adapters.clear();
    log.info("adapterManager", "All adapters disconnected");
  }

  /**
   * Lista de dispositivos activos
   */
  getActiveDevices(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Verifica salud de todos los adaptadores
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const checks = Array.from(this.adapters.entries()).map(async ([id, adapter]) => {
      try {
        const health = await adapter.healthCheck();
        results.set(id, health.reachable);
      } catch {
        results.set(id, false);
      }
    });

    await Promise.all(checks);
    return results;
  }

  // ─── Circuit Breaker State ─────────────────────────────────────────────────

  /**
   * Obtiene el estado del circuit breaker para un dispositivo
   */
  getCircuitState(deviceId: string): CircuitBreakerState | undefined {
    return this.circuitBreakerState.get(deviceId);
  }

  /**
   * Establece el estado del circuit breaker para un dispositivo
   */
  setCircuitState(deviceId: string, state: CircuitBreakerState): void {
    this.circuitBreakerState.set(deviceId, state);
    log.debug("adapterManager", `Circuit state updated for ${deviceId}`, {
      state: state.state,
      failureCount: state.failureCount,
    });
  }

  /**
   * Resetea el estado del circuit breaker para un dispositivo
   */
  resetCircuitState(deviceId: string): void {
    this.circuitBreakerState.delete(deviceId);
    log.debug("adapterManager", `Circuit state reset for ${deviceId}`);
  }
}

// Singleton instance
let managerInstance: AdapterManager | null = null;

export function getAdapterManager(): AdapterManager {
  if (!managerInstance) {
    managerInstance = new AdapterManager();
  }
  return managerInstance;
}

export function resetAdapterManager(): void {
  if (managerInstance) {
    managerInstance.disconnectAll();
    managerInstance = null;
  }
}
