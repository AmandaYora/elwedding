import { useEffect, useState } from 'react'
import { httpClient } from '@/shared/services/http-client'
import type { ApiEnvelope, InvitationData } from '@/types/api'

interface State {
  data: InvitationData | null
  loading: boolean
  error: boolean
}

/**
 * Fetch SEKALI saat mount, tanpa polling/refetch (PLAN.md §5.3 aturan 5 /
 * F14) - bundle legacy memindahkan node section lewat appendChild/remove
 * setelah bootstrap, jadi re-render ulang daftar section berisiko
 * `NotFoundError: Failed to execute 'removeChild'`.
 */
export function useInvitationData(): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: false })

  useEffect(() => {
    let cancelled = false

    httpClient
      .get<ApiEnvelope<InvitationData>>('/api/v1/public/invitation')
      .then((res) => {
        if (cancelled) return
        setState({ data: res.data.data, loading: false, error: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ data: null, loading: false, error: true })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
