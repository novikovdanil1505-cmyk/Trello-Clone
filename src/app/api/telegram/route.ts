import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { chatIds, cardData, type, newStatus } = await req.json();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: "Bot token is not configured" }, { status: 500 });
  }

  let messageText = "";

  if (type === 'status') {
    // Уведомление о смене статуса
    messageText = `🔄 Статус изменен: ${cardData.title}`;
    if (newStatus) messageText += `\n📦 Новый статус: ${newStatus}`;
  } else if (type === 'updated') {
    // Уведомление об обновлении
    messageText = `✏️ Карточка обновлена: ${cardData.title}`;
    if (cardData.due_date) {
      const dateStr = new Date(cardData.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      messageText += `\n📅 Дата: ${dateStr}`;
      if (cardData.due_time) messageText += ` ${cardData.due_time}`;
    }
    if (cardData.comment) messageText += `\n💬 Комментарий: ${cardData.comment}`;
  } else {
    // Уведомление о новой карточке (или новом назначении)
    messageText = `📋 Новая карточка: ${cardData.title}`;
    if (cardData.due_date) {
      const dateStr = new Date(cardData.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      messageText += `\n📅 Дата: ${dateStr}`;
      if (cardData.due_time) messageText += ` ${cardData.due_time}`;
    }
    if (cardData.comment) messageText += `\n💬 Комментарий: ${cardData.comment}`;
  }

  try {
    for (const id of chatIds) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: id,
          text: messageText
        }),
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram API error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}