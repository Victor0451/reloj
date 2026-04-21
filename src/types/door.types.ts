export type DoorAction = 'open' | 'close' | 'alwaysOpen' | 'alwaysClose';
export type DoorCommandStatus = 'pending' | 'done' | 'failed';

export interface DoorCommand {
  id: string;
  device_serial: string;
  action: DoorAction;
  status: DoorCommandStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
