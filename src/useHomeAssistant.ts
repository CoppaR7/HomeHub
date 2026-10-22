import { useEffect, useSyncExternalStore } from 'react'
import { homeAssistant } from './home-assistant'

export function useHomeAssistant() {
  const home = useSyncExternalStore(
    homeAssistant.subscribe,
    homeAssistant.getSnapshot,
  )
  useEffect(() => {
    void homeAssistant.resume()
  }, [])
  return home
}
