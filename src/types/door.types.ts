export type DoorAction = 'open' | 'close' | 'alwaysopen' | 'alwaysclose';
export type DoorCommandStatus = 'pending' | 'completed' | 'failed';

export interface DoorCommand {
  id: string;
  device_serial: string;
  action: DoorAction;
  status: DoorCommandStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}
