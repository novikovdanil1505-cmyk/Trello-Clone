import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { chatIds, cardData } = await req.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: "Bot token is not configured" }, { status: 500 });
  }

  // Формируем текст сообщения
  let messageText = `📋 Новая карточка: ${cardData.title}`;
  
  if (cardData.due_date) {
    const dateStr = new Date(cardData.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    messageText += `\n📅 Дата: ${dateStr}`;
    if (cardData.due_time) messageText += ` ${cardData.due_time}`;
  }
  
  if (cardData.comment) {
    messageText += `\n💬 Комментарий: ${cardData.comment}`;
  }

  // Создаем inline-кнопку
  const replyMarkup = JSON.stringify({
    inline_keyboard: [
      [{ text: "👁 Посмотреть", url: "https://nprodclone.vercel.app/" }]
    ]
  });

  try {
    for (const id of chatIds) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: id,
          text: messageText,
          reply_markup: replyMarkup
        }),
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram API error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}