import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    botToken: process.env.TELEGRAM_BOT_TOKEN ? "ЕСТЬ" : "НЕТ",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "ЕСТЬ" : "НЕТ",
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "ЕСТЬ" : "НЕТ"
  });
}