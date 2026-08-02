import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://rxgeupwuhohyvbzgiyst.supabase.co"
const supabaseAnonKey = "sb_publishable_wehrWEBsiAoDMa8R7usVYQ_ZGJXiWD2"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)