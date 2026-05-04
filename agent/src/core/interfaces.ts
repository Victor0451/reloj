/**
 * Core Interfaces — Contrato común para todos los adaptadores de dispositivos
 * Esto define la interfaz que TODOS los adaptadores deben implementar
 */

// ─── Device Info ─────────────────────────────────────────────────────────────

export interface DeviceInfo {
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  deviceName: string;
  manufacturer: string;
  macAddress?: string;
  deviceType?: string;
}

// ─── Access Events ────────────────────────────────────────────────────────────

export interface EventQueryOptions {
  startTime?: Date;
  endTime?: Date;
  maxResults?: number;
  eventTypes?: string[];
}

export interface AccessEvent {
  id?: string;
  employeeId: string;
  employeeNo?: string;
  cardNo?: string;
  eventTime: Date;
  major: number;
  minor: number;
  eventType: string;
  verifyMode?: string;
  doorNo?: number;
  alarmType?: string;
  status?: string;
  raw?: Record<string, unknown>;
  /** Extracted from minor=38 events (person name detected by device) */
  detectedName?: string;
  /** Extracted from minor=38 events (employee number string from device) */
  detectedEmployeeNo?: string;
  /** Device serial number (from Hikvision serialNo field) */
  deviceSerialNo?: string;
  /** Card reader number that processed the event */
  cardReaderNo?: number;
  /** Human-readable label from device (e.g. "Check In", "Check Out") */
  label?: string;
}

// ─── Persons ─────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  employeeId?: string;
  employeeNo?: string;
  name: string;
  cardNumber?: string;
  facePhotoUrl?: string;
  fingerprint?: string;
  department?: string;
  status?: 'active' | 'inactive' | 'pending_sync';
}

export interface SyncResult {
  success: boolean;
  employeeNo?: string;
  error?: string;
  code?: string;
  warnings?: string[];
}

// ─── Door Control ─────────────────────────────────────────────────────────────

export type DoorAction = 'open' | 'close' | 'alwaysopen' | 'alwaysclose' | 'normal';

export type DoorStatusType = 'open' | 'closed' | 'locked' | 'unlocked' | 'alarm' | 'unknown';

export interface DoorStatus {
  doorNo: number;
  status: DoorStatusType;
  doorName?: string;
  locked?: boolean;
  online?: boolean;
  alarm?: boolean;
  raw?: Record<string, unknown>;
}

// ─── Health Check ────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  reachable: boolean;
  latency?: number;
  error?: string;
  timestamp: Date;
}

// ─── Adapter Interface ───────────────────────────────────────────────────────

/**
 * Interfaz común para TODOS los adaptadores de dispositivos
 * Cada marca debe implementar esta interfaz
 */
export interface IDeviceAdapter {
  /** Nombre de la marca que implementa este adaptador */
  readonly brand: string;
  
  /** Versión del adaptador */
  readonly version: string;

  // ── Device Info ──────────────────────────────────────────────────────────
  
  /**
   * Obtiene información del dispositivo (serial, modelo, firmware, etc.)
   */
  getDeviceInfo(): Promise<DeviceInfo>;

  // ── Heartbeat ───────────────────────────────────────────────────────────
  
  /**
   * Envía un heartbeat al dispositivo y actualiza last_seen_at
   */
  sendHeartbeat(): Promise<void>;

  // ── Events ──────────────────────────────────────────────────────────────
  
  /**
   * Obtiene eventos de acceso desde el dispositivo
   */
  getEvents(options?: EventQueryOptions): Promise<AccessEvent[]>;

  // ── Persons ──────────────────────────────────────────────────────────────
  
  /**
   * Sincroniza una persona al dispositivo
   */
  syncPerson(person: Person): Promise<SyncResult>;

  /**
   * Crea una persona en el dispositivo (device assigns employeeNo)
   */
  createPersonOnDevice(person: Person): Promise<SyncResult>;

  /**
   * Elimina una persona del dispositivo
   */
  deletePerson(employeeNo: string): Promise<void>;

  /**
   * Obtiene todas las personas del dispositivo
   */
  getPersons(): Promise<Person[]>;

  // ── Door Control ────────────────────────────────────────────────────────
  
  /**
   * Obtiene el estado de una puerta
   */
  getDoorStatus(doorNo?: number): Promise<DoorStatus>;

  /**
   * Controla una puerta (abrir/cerrar/bloquear)
   */
  controlDoor(doorNo: number, action: DoorAction): Promise<void>;

  // ── Health ───────────────────────────────────────────────────────────────
  
  /**
   * Verifica si el dispositivo es alcanzable
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Cierra conexiones y limpia recursos
   */
  disconnect(): Promise<void>;
}

// ─── Adapter Config ──────────────────────────────────────────────────────────

export interface AdapterConfig {
  /** IP del dispositivo */
  ip: string;
  /** Puerto (default 443) */
  port?: number;
  /** Usuario para autenticación */
  username: string;
  /** Contraseña */
  password: string;
  /** Timeout en ms (default 10000) */
  timeout?: number;
  /** Serial del dispositivo (para logging) */
  serialNumber?: string;
  /** Aceptar certificados SSL auto-firmados (default true) */
  rejectUnauthorized?: boolean;
}

// ─── Adapter Registry ────────────────────────────────────────────────────────

/**
 * Tipo de constructor de adaptadores
 */
export type AdapterConstructor = new (config: AdapterConfig) => IDeviceAdapter;

/**
 * Registro de adaptadores disponibles
 */
export const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {};

/**
 * Registra un nuevo adaptador
 */
export function registerAdapter(brand: string, constructor: AdapterConstructor): void {
  ADAPTER_REGISTRY[brand.toLowerCase()] = constructor;
}

/**
 * Obtiene un adaptador por marca
 */
export function getAdapter(brand: string): AdapterConstructor | undefined {
  return ADAPTER_REGISTRY[brand.toLowerCase()];
}

/**
 * Lista de marcas soportadas
 */
export function getSupportedBrands(): string[] {
  return Object.keys(ADAPTER_REGISTRY);
}
