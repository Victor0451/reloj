import type { Config } from '../config'
import { isapiRequest } from './client'
import { parseXml, extractText } from './xml'

export interface DevicePersonRecord {
  employeeNo: string
  name: string
  department?: string
  cardNo?: string
  doorRight?: string
  userType?: string
}

/**
 * Register a new person on the device via ISAPI.
 * POST /ISAPI/AccessControl/UserInfo/Record
 */
export async function createPersonOnDevice(
  config: Config,
  person: {
    employeeNo: string
    name: string
    department?: string
    cardNo?: string
  }
): Promise<{ success: boolean; statusCode?: string }> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<UserInfo>
  <employeeNo>${escapeXml(person.employeeNo)}</employeeNo>
  <name>${escapeXml(person.name)}</name>
  ${person.department ? `<department>${escapeXml(person.department)}</department>` : ''}
  <doorRight>1</doorRight>
  <userType>normal</userType>
  ${person.cardNo ? `<cardList><card><cardNo>${escapeXml(person.cardNo)}</cardNo></card></cardList>` : ''}
</UserInfo>`

  try {
    await isapiRequest(
      config,
      '/ISAPI/AccessControl/UserInfo/Record',
      'POST',
      xmlBody
    )
    return { success: true }
  } catch (err) {
    return {
      success: false,
      statusCode: err instanceof Error ? err.message : 'unknown',
    }
  }
}

/**
 * Update an existing person on the device via ISAPI.
 * PUT /ISAPI/AccessControl/UserInfo/Modify
 */
export async function updatePersonOnDevice(
  config: Config,
  person: {
    employeeNo: string
    name: string
    department?: string
    cardNo?: string
  }
): Promise<{ success: boolean; statusCode?: string }> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<UserInfo>
  <employeeNo>${escapeXml(person.employeeNo)}</employeeNo>
  <name>${escapeXml(person.name)}</name>
  ${person.department ? `<department>${escapeXml(person.department)}</department>` : ''}
  <doorRight>1</doorRight>
  <userType>normal</userType>
  ${person.cardNo ? `<cardList><card><cardNo>${escapeXml(person.cardNo)}</cardNo></card></cardList>` : ''}
</UserInfo>`

  try {
    await isapiRequest(
      config,
      '/ISAPI/AccessControl/UserInfo/Modify',
      'PUT',
      xmlBody
    )
    return { success: true }
  } catch (err) {
    return {
      success: false,
      statusCode: err instanceof Error ? err.message : 'unknown',
    }
  }
}

/**
 * Delete a person from the device via ISAPI.
 * DELETE /ISAPI/AccessControl/UserInfo/Delete
 */
export async function deletePersonFromDevice(
  config: Config,
  employeeNo: string
): Promise<{ success: boolean; statusCode?: string }> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<UserInfoDelCond>
  <EmployeeNoList>
    <employeeNo>${escapeXml(employeeNo)}</employeeNo>
  </EmployeeNoList>
</UserInfoDelCond>`

  try {
    await isapiRequest(
      config,
      '/ISAPI/AccessControl/UserInfo/Delete',
      'PUT',
      xmlBody
    )
    return { success: true }
  } catch (err) {
    return {
      success: false,
      statusCode: err instanceof Error ? err.message : 'unknown',
    }
  }
}

/**
 * Search for a person on the device via ISAPI.
 * POST /ISAPI/AccessControl/UserInfo/Search
 */
export async function searchPersonOnDevice(
  config: Config,
  employeeNo?: string
): Promise<DevicePersonRecord | null> {
  const searchNo = employeeNo ?? ''
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<UserInfoSearchCond>
  <employeeNo>${escapeXml(searchNo)}</employeeNo>
</UserInfoSearchCond>`

  try {
    const response = await isapiRequest<Record<string, unknown>>(
      config,
      '/ISAPI/AccessControl/UserInfo/Search',
      'POST',
      xmlBody
    )

    const parsed = parseXml(response.rawXml ?? '')

    // Navigate the response structure
    const responseStatus = parsed.responseStatus as Record<string, unknown> | undefined
    const searchResult = (parsed.searchResult ?? responseStatus?.searchResult) as Record<string, unknown> | undefined
    const matchList = searchResult?.matchList as Record<string, unknown> | undefined
    const matchItem = matchList?.UserInfo as Record<string, unknown> | undefined

    if (!matchItem) return null

    const cardList = matchItem.cardList as Record<string, unknown> | undefined
    const card = cardList?.card as Record<string, unknown> | undefined

    return {
      employeeNo: String(matchItem.employeeNo ?? ''),
      name: String(matchItem.name ?? ''),
      department: String(matchItem.department ?? ''),
      cardNo: String(card?.cardNo ?? ''),
      doorRight: String(matchItem.doorRight ?? ''),
      userType: String(matchItem.userType ?? ''),
    }
  } catch {
    return null
  }
}

/**
 * Upload face photo data to the device via ISAPI.
 * POST /ISAPI/Intelligent/FDLib/FaceDataRecord
 */
export async function uploadFaceData(
  config: Config,
  employeeNo: string,
  faceData: string // base64 encoded image
): Promise<{ success: boolean; faceId?: string }> {
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<FaceDataRecord>
  <employeeNo>${escapeXml(employeeNo)}</employeeNo>
  <faceImgType>jpg</faceImgType>
  <FaceDataBase64>${faceData}</FaceDataBase64>
</FaceDataRecord>`

  try {
    await isapiRequest(
      config,
      '/ISAPI/Intelligent/FDLib/FaceDataRecord',
      'POST',
      xmlBody
    )
    return { success: true }
  } catch (err) {
    return {
      success: false,
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
