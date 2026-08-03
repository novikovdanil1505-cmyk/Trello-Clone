import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!botToken || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const update = await req.json();
    const chatId = update.message?.chat?.id?.toString();
    const text = update.message?.text;
    const username = update.message?.from?.username || "unknown";

    if (!chatId || !text) return NextResponse.json({ ok: true });

    const { data: existingUser } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    let replyText = "";

    // НОВОЕ: Создаем клавиатуру с кнопками
    const replyMarkup = JSON.stringify({
      keyboard: [
        [{ text: "🟢 Начать" }, { text: "🔴 Остановить" }]
      ],
      resize_keyboard: true // Кнопки будут компактными
    });

    // НОВОЕ: Обрабатываем как текстовые команды, так и нажатия кнопок
    if (text === '/stop' || text === '/unsubscribe' || text === '🔴 Остановить') {
      if (existingUser) {
        await supabase.from('telegram_users').delete().eq('chat_id', chatId);
        replyText = "Вы отписались от уведомлений NOVIKOV PRODUCTION. Ваше имя удалено из списка.";
      } else {
        replyText = "Вы еще не зарегистрированы.";
      }
    } else if (!existingUser) {
      if (text === '/start' || text === '🟢 Начать') {
        replyText = "Добро пожаловать! Пожалуйста, введите ваше имя для регистрации в NOVIKOV PRODUCTION.";
      } else {
        const token = randomUUID();
        const { data: newUser, error } = await supabase
          .from('telegram_users')
          .insert([{ chat_id: chatId, name: text, username: username, login_token: token }])
          .select()
          .single();
        
        if (error) {
          replyText = "Произошла ошибка при регистрации. Попробуйте еще раз.";
        } else {
          replyText = `Вы успешно зарегистрированы как ${newUser.name}!\n\nВот ваша персональная ссылка для входа на доску:\nhttps://nprodclone.vercel.app/?tg_token=${token}`;
        }
      }
    } else {
      // Если пользователь уже есть, просто выдаем ему новую ссылку
      const token = randomUUID();
      await supabase.from('telegram_users').update({ login_token: token }).eq('chat_id', chatId);
      replyText = `Вы уже зарегистрированы как ${existingUser.name}.\n\nВот ваша новая ссылка для входа на доску:\nhttps://nprodclone.vercel.app/?tg_token=${token}`;
    }

    // Отправляем ответ с прикрепленной клавиатурой
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        reply_markup: replyMarkup // НОВОЕ: Передаем клавиатуру
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}