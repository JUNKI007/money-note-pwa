const GAS_URL = import.meta.env.VITE_GAS_URL as string

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export async function gasPost<T = unknown>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL이 설정되지 않았습니다.')
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...params }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json: ApiResponse<T> = await res.json()
  if (!json.success) throw new Error(json.error ?? '알 수 없는 오류')
  return json.data as T
}
