import { NextRequest, NextResponse } from 'next/server'
import { getNext2025Settings } from '@/lib/next2025-service'

// Força a rota a ser dinâmica (não fazer pre-render no build)
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BAND_API_BASE_URL = "http://156.67.25.64:1026/v2/entities"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bandId = params.id
    const entityId = `urn:ngsi-ld:Band:${bandId.padStart(3, '0')}`
    
    const headers = {
      'fiware-service': 'smart',
      'fiware-servicepath': '/',
    }
    
    // Adiciona headers de cache nos requests
    const headersWithCache = {
      ...headers,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }

    // Busca todos os scores (X, Y, Z) em paralelo
    const [scoreXRes, scoreYRes, scoreZRes] = await Promise.all([
      fetch(`${BAND_API_BASE_URL}/${entityId}/attrs/scoreX`, { 
        headers: headersWithCache,
        cache: 'no-store'
      }),
      fetch(`${BAND_API_BASE_URL}/${entityId}/attrs/scoreY`, { 
        headers: headersWithCache,
        cache: 'no-store'
      }),
      fetch(`${BAND_API_BASE_URL}/${entityId}/attrs/scoreZ`, { 
        headers: headersWithCache,
        cache: 'no-store'
      })
    ])
    
    const result: any = {}
    
    // Buscar multiplicador de pontos
    const settings = await getNext2025Settings()
    const multiplier = settings.pointsMultiplier || 1.0
    
    if (scoreXRes.ok) {
      const scoreData = await scoreXRes.json()
      // Aplicar multiplicador ao valor
      if (scoreData.value !== undefined) {
        scoreData.value = scoreData.value * multiplier
      }
      result.scoreX = scoreData
    }
    
    if (scoreYRes.ok) {
      const scoreData = await scoreYRes.json()
      // Aplicar multiplicador ao valor
      if (scoreData.value !== undefined) {
        scoreData.value = scoreData.value * multiplier
      }
      result.scoreY = scoreData
    }
    
    if (scoreZRes.ok) {
      const scoreData = await scoreZRes.json()
      // Aplicar multiplicador ao valor
      if (scoreData.value !== undefined) {
        scoreData.value = scoreData.value * multiplier
      }
      result.scoreZ = scoreData
    }
    
    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error(`Erro ao buscar scores da pulseira ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const bandId = params.id
    const entityId = `urn:ngsi-ld:Band:${bandId.padStart(3, '0')}`
    const body = await request.json()
    
    const response = await fetch(`${BAND_API_BASE_URL}/${entityId}/attrs`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'fiware-service': 'smart',
        'fiware-servicepath': '/',
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Erro ao controlar evento: ${response.status}` },
        { status: response.status }
      )
    }
    
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error(`Erro ao controlar evento da pulseira ${params.id}:`, error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}