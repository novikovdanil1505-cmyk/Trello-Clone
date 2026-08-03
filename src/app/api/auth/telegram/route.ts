import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { token } = await req.json();

  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  // Ищем пользователя по токену
  const { data: user, error } = await supabase
    .from('telegram_users')
    .select('chat_id, name')
    .eq('login_token', token)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Удаляем токен, чтобы его нельзя было использовать дважды
  await supabase.from('telegram_users').update({ login_token: null }).eq('chat_id', user.chat_id);

  return NextResponse.json({ success: true, ...user });
}