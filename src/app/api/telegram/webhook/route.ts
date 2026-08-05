import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!botToken || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const update = await req.json();
    const chatId = update.message?.chat?.id?.toString();
    const text = update.message?.text;

    if (!chatId || !text) return NextResponse.json({ ok: true });

    let replyText = 'Для начала работы нажмите кнопку "Открыть доску" в левом нижнем углу.';

    // Если пользователь вручную напишет /stop, мы все равно удалим его из базы
    if (text === '/stop' || text === '/unsubscribe') {
      await supabase.from('telegram_users').delete().eq('chat_id', chatId);
      replyText = "Вы отписались от уведомлений NOVIKOV PRODUCTION.";
    }

    // Отправляем ответ и ПРОСИМ TELEGRAM УБРАТЬ КЛАВИАТУРУ с кнопками
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        reply_markup: JSON.stringify({ remove_keyboard: true })
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}