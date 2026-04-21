# Delta Spec: fase-6-control-puerta

## ADDED Requirements

### Requirement: Agent starts command dispatcher for each device

The agent **MUST** import `startCommandDispatcher` from the dispatcher module and **MUST** call it for each device during the device setup loop in `agent/src/index.ts`.

The call **MUST** be placed alongside existing loops: heartbeat, event sync, and person sync.

The returned cleanup function **MUST** be registered with `registerCleanup()`.

#### Scenario: Agent starts with dispatcher

- GIVEN the agent is configured with one or more devices
- WHEN the agent starts and completes device initialization
- THEN `startCommandDispatcher` **MUST** be called for each device
- AND the dispatcher **MUST** begin polling its respective device's `door_commands` table

#### Scenario: Agent shutdown triggers cleanup

- GIVEN the agent is running with active dispatchers
- WHEN the agent receives a shutdown signal
- THEN the registered cleanup function **MUST** be called
- AND all polling intervals **MUST** be cleared
- AND no further ISAPI commands **MUST** be issued

#### Scenario: Device offline triggers retry with backoff

- GIVEN the dispatcher is polling a device that becomes unreachable
- WHEN an ISAPI command fails due to device offline
- THEN the dispatcher **MUST** retry with exponential backoff
- AND the existing backoff logic **MUST** be preserved (no conflicts with other loops)

### Requirement: Door action type consistency across frontend and agent

The system **MUST** define a consistent `DoorAction` type used by both frontend and agent.

The frontend **MUST** send action strings to the `door_commands` table.
The agent **MUST** read the action string, normalize casing, and execute the corresponding ISAPI command.

#### Scenario: User clicks "Abrir Puerta"

- GIVEN the user clicks the "Abrir Puerta" button
- WHEN the action is stored in `door_commands`
- THEN `action` **MUST** be stored as `"open"`
- AND the agent **MUST** execute ISAPI with `"open"`

#### Scenario: User clicks "Cerrar Puerta"

- GIVEN the user clicks the "Cerrar Puerta" button
- WHEN the action is stored in `door_commands`
- THEN `action` **MUST** be stored as `"close"`
- AND the agent **MUST** execute ISAPI with `"close"`

#### Scenario: User clicks "Mantener Abierta"

- GIVEN the user clicks the "Mantener Abierta" button
- WHEN the action is stored in `door_commands`
- THEN `action` **MUST** be stored as `"alwaysopen"`
- AND the agent **MUST** normalize to lowercase and execute ISAPI with `"alwaysopen"`

#### Scenario: User clicks "Mantener Cerrada"

- GIVEN the user clicks the "Mantener Cerrada" button
- WHEN the action is stored in `door_commands`
- THEN `action` **MUST** be stored as `"alwaysclose"`
- AND the agent **MUST** normalize to lowercase and execute ISAPI with `"alwaysclose"`

### Requirement: End-to-end door control flow

The system **MUST** implement a complete flow from user click to UI feedback.

#### Scenario: Successful door open completes in under 5 seconds

- GIVEN the device is online and responsive
- WHEN the user clicks "Abrir Puerta"
- THEN the command **MUST** be inserted into `door_commands` with status `"pending"`
- AND the agent **MUST** poll, execute ISAPI, and update status to `"completed"` within 5 seconds
- AND the frontend **MUST** receive a realtime update
- AND a success toast **MUST** be displayed

#### Scenario: Failed door open shows error

- GIVEN the device is online but the ISAPI command fails
- WHEN the agent attempts to execute the command
- THEN the status **MUST** be updated to `"failed"`
- AND an error message **MUST** be displayed to the user

#### Scenario: Device offline causes command timeout

- GIVEN the device is offline
- WHEN a door command is issued
- THEN the command **MUST** stay in `"pending"` status
- AND after 30 seconds (configurable), the status **MUST** be updated to `"failed"`
- AND a timeout error **MUST** be displayed to the user

## MODIFIED Requirements

### Requirement: Door control UI with disable state (Previously: Single open button exists)

The system **SHOULD** provide door control buttons that prevent double-sends.

(Previously: Only "Abrir Puerta" button existed)

#### Scenario: Abrir button disabled during pending command

- GIVEN the user clicks "Abrir Puerta" and a command is pending
- WHEN the UI is still rendering with pending status
- THEN the button **MUST** be disabled
- AND no additional commands **MUST** be sent

#### Scenario: Current door state displayed when available

- GIVEN the device status is available from heartbeat
- WHEN the door control UI renders
- THEN the current door state **MUST** be displayed
