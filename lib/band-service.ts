// Serviço para integração com a API das pulseiras IoT
// Usar APIs locais para evitar problemas de CORS
const API_BASE_URL = "/api/bands"

export interface BandDevice {
  device_id: string
  apikey: string
  service: string
  service_path: string
  entity_name: string
  entity_type: string
  transport: string
  attributes: Array<{
    object_id: string
    name: string
    type: string
  }>
  lazy: any[]
  commands: Array<{
    object_id: string
    name: string
    type: string
  }>
  static_attributes: any[]
  protocol: string
}

export interface BandLink {
  bandId: string
  userId: string
  userName: string
  userEmail: string
  linkedAt: string
  status: 'available' | 'linked' | 'blocked'
  totalPoints: number
}

export interface BandDevicesResponse {
  count: number
  devices: BandDevice[]
}

export interface BandScore {
  type: string
  value: number
  metadata: any
}

export interface BandScoreResponse {
  scoreX?: BandScore
  scoreY?: BandScore
  scoreZ?: BandScore
}

export interface MovementPreset {
  id: string
  name: string
  description: string
  axis: ('X' | 'Y' | 'Z')[] // Array de eixos (1 ou 2)
  duration: number // em segundos
  threshold?: number
}

// Presets de movimentos predefinidos
export const MOVEMENT_PRESETS: MovementPreset[] = [
  {
    id: 'jump_vertical',
    name: 'Pulos Verticais',
    description: 'Conta pulos verticais usando o eixo Y',
    axis: ['Y'],
    duration: 60,
    threshold: 2.0
  },
  {
    id: 'run_horizontal',
    name: 'Corrida Horizontal',
    description: 'Detecta movimento horizontal usando o eixo X',
    axis: ['X'],
    duration: 120,
    threshold: 1.5
  },
  {
    id: 'side_steps',
    name: 'Passos Laterais',
    description: 'Movimento lateral usando o eixo Z',
    axis: ['Z'],
    duration: 90,
    threshold: 1.8
  },
  {
    id: 'quick_jumps',
    name: 'Pulos Rápidos',
    description: 'Pulos rápidos e baixos - eixo Y',
    axis: ['Y'],
    duration: 30,
    threshold: 1.2
  },
  {
    id: 'march_forward',
    name: 'Marcha Frontal',
    description: 'Marcha para frente - eixo X',
    axis: ['X'],
    duration: 180,
    threshold: 1.0
  }
]

/**
 * Busca todas as pulseiras disponíveis
 */
export async function getBandDevices(): Promise<BandDevicesResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Erro ao buscar dispositivos: ${response.status}`)
    }
    
    const data: BandDevicesResponse = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao buscar dispositivos:', error)
    throw error
  }
}

/**
 * Busca os valores X, Y e Z de uma pulseira específica
 */
export async function getBandScores(bandId: string): Promise<BandScoreResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/${bandId}?_t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Erro ao buscar scores: ${response.status}`)
    }
    
    const result: BandScoreResponse = await response.json()
    return result
  } catch (error) {
    console.error(`Erro ao buscar scores da pulseira ${bandId}:`, error)
    throw error
  }
}

/**
 * Inicia ou para um evento em uma pulseira específica
 */
export async function controlBandEvent(bandId: string, start: boolean): Promise<boolean> {
  try {
    const body = {
      [start ? 'on' : 'off']: {
        type: 'command',
        value: ''
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/${bandId}?_t=${Date.now()}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify(body),
      cache: 'no-store'
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Erro ao ${start ? 'iniciar' : 'parar'} evento: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error(`Erro ao controlar evento da pulseira ${bandId}:`, error)
    throw error
  }
}

/**
 * Inicia evento em múltiplas pulseiras
 */
export async function startEventForAllBands(bandIds: string[]): Promise<{ success: string[], failed: string[] }> {
  const results = await Promise.allSettled(
    bandIds.map(bandId => controlBandEvent(bandId, true))
  )
  
  const success: string[] = []
  const failed: string[] = []
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success.push(bandIds[index])
    } else {
      failed.push(bandIds[index])
    }
  })
  
  return { success, failed }
}

/**
 * Para evento em múltiplas pulseiras
 */
export async function stopEventForAllBands(bandIds: string[]): Promise<{ success: string[], failed: string[] }> {
  const results = await Promise.allSettled(
    bandIds.map(bandId => controlBandEvent(bandId, false))
  )
  
  const success: string[] = []
  const failed: string[] = []
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      success.push(bandIds[index])
    } else {
      failed.push(bandIds[index])
    }
  })
  
  return { success, failed }
}

/**
 * Extrai o ID numérico da pulseira a partir do entity_name
 */
export function extractBandId(entityName: string): string {
  const match = entityName.match(/urn:ngsi-ld:Band:(\d+)/)
  return match ? match[1] : ''
}

/**
 * Formata o ID da pulseira para exibição
 */
export function formatBandId(bandId: string): string {
  return `Pulseira ${bandId}`
}

