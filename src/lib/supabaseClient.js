import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://roqlxsfaleuwcfwordfk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_0MvSNh-6L6v3q2iV2cxWiw_ect60eLk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
