import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import AuthScreen from './components/AuthScreen'
import HouseholdSetup from './components/HouseholdSetup'
import Dashboard from './components/Dashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [householdId, setHouseholdId] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setHouseholdId(null); return }
    supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .then(({ data }) => setHouseholdId(data?.[0]?.household_id ?? null))
  }, [session])

  if (checking) return null
  if (!session) return <AuthScreen />
  if (!householdId) return <HouseholdSetup user={session.user} onReady={setHouseholdId} />
  return <Dashboard user={session.user} householdId={householdId} />
}
