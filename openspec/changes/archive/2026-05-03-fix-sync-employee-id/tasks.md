```json
{
  "tasks": [
    {
      "id": "D1",
      "description": "Add device_employee_no to SELECT query in syncPersonsFromDevice to enable comparison",
      "dependsOn": [],
      "verification": "SELECT includes device_employee_no column",
      "status": "complete"
    },
    {
      "id": "D2",
      "description": "Move device_employee_no update outside name-change guard — always sync",
      "dependsOn": [],
      "verification": "device_employee_no update is outside the if (existing.name !== person.name) block",
      "status": "complete"
    },
    {
      "id": "D3",
      "description": "Add conditional employee_id update: only when device value differs from DB",
      "dependsOn": ["D1"],
      "verification": "employee_id update uses conditional: deviceEmployeeNo !== existingDeviceEmployeeNo ? deviceEmployeeNo : existing.employee_id",
      "status": "complete"
    },
    {
      "id": "D4",
      "description": "Verify TypeScript compiles",
      "dependsOn": ["D2", "D3"],
      "verification": "npx tsc --noEmit passes",
      "status": "complete"
    }
  ]
}