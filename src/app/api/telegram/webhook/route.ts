import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Создаем клиента с правами обхода RLS (используем те же ключи, что и на фронте)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "No token" }, { status: 500 });

  try {
    const update = await req.json();
    const chatId = update.message?.chat?.id?.toString();
    const text = update.message?.text;

    if (!chatId || !text) return NextResponse.json({ ok: true });

    // Проверяем, есть ли уже такой пользователь в базе
    const { data: existingUser } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    let replyText = "";

    if (!existingUser) {
      // Если пользователя нет, проверяем, что он прислал
      if (text === '/start') {
        replyText = "Добро пожаловать! Пожалуйста, введите ваше имя для регистрации в NOVIKOV PRODUCTION.";
      } else {
        // Считаем текст именем и сохраняем
        const { data: newUser, error } = await supabase
          .from('telegram_users')
          .insert([{ chat_id: chatId, name: text }])
          .select()
          .single();
        
        if (error) {
          replyText = "Произошла ошибка при регистрации. Попробуйте еще раз.";
        } else {
          replyText = `Вы успешно зарегистрированы как ${newUser.name}! Теперь вы можете получать уведомления о новых карточках.`;
        }
      }
    } else {
      replyText = `Вы уже зарегистрированы как ${existingUser.name}.`;
    }

    // Отправляем ответ пользователю в Telegram
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: replyText }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}