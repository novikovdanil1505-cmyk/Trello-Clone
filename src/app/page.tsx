"use client";
import React, { useState, useEffect } from "react";
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable, MeasuringStrategy,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import "react-day-picker/dist/style.css";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type CardType = { 
  id: string; title: string; column_id: string; due_date?: string | null; due_time?: string | null; 
  comment?: string | null; is_archived?: boolean; client_name?: string | null; phone_number?: string | null; telegram_ids?: string | null;
};
type ColumnType = { id: string; title: string; position: number };
type TelegramUser = { id: string; chat_id: string; name: string };

// --- Палитра цветов для пользователей ---
const USER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const getUserColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

// --- ВЕКТОРНЫЕ ИКОНКИ ---
const SunIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>);
const MoonIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
const ArchiveIcon = ({ size = 24 }: { size?: number }) => (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>);
const TrashIcon = ({ size = 16 }: { size?: number }) => (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>);
const CopyIcon = ({ size = 18 }: { size?: number }) => (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>);
const CheckIcon = ({ size = 18 }: { size?: number }) => (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>);
const LogoutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>);

// --- ФОРМА АВТОРИЗАЦИИ ---
function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setIsLogin(true);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <motion.div className="bg-white/60 dark:bg-zinc-900/80 backdrop-blur-2xl rounded-3xl p-8 border border-white/80 dark:border-white/10 shadow-2xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">NOVIKOV PRODUCTION</h1>
        <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl mb-6">
          <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${isLogin ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>Вход</button>
          <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${!isLogin ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}>Регистрация</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 bg-white/40 dark:bg-zinc-800/50 border border-white/60 dark:border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-slate-400 text-sm text-slate-800 dark:text-white" placeholder="example@mail.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 bg-white/40 dark:bg-zinc-800/50 border border-white/60 dark:border-white/10 rounded-xl outline-none focus:ring-1 focus:ring-slate-400 text-sm text-slate-800 dark:text-white" placeholder="Минимум 6 символов" />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 py-3 rounded-xl font-medium hover:bg-slate-700 dark:hover:bg-white transition-colors shadow-md disabled:opacity-50">{loading ? "Загрузка..." : (isLogin ? "Войти" : "Зарегистрироваться")}</button>
        </form>
      </motion.div>
    </div>
  );
}

// --- Компонент Карточки ---
function Card({ card, telegramUsers, onOpen }: { card: CardType, telegramUsers: TelegramUser[], onOpen: (card: CardType) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: card.id, data: { type: "Card", card } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  
  // Находим данных пользователей, отмеченных в этой карточке
  const tgIds = card.telegram_ids ? card.telegram_ids.split(',').filter(Boolean) : [];
  const assignedUsers = telegramUsers.filter(u => tgIds.includes(u.chat_id));

  return (
    <motion.div ref={setNodeRef} {...attributes} {...listeners} style={style} layout initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: isDragging ? 0.4 : 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} onClick={() => onOpen(card)} className={`bg-white/50 dark:bg-zinc-800/50 backdrop-blur-xl p-3 rounded-2xl mb-3 cursor-pointer active:cursor-grabbing border border-white/80 dark:border-white/10 shadow-sm hover:bg-white/80 dark:hover:bg-zinc-800/80 transition-colors select-none`}>
      <p className="text-sm text-slate-800 dark:text-slate-100 font-medium mb-1">{card.title}</p>
      <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
        {/* НОВОЕ: Цветные маркеры пользователей вместо самолета */}
        {assignedUsers.map(u => {
          const color = getUserColor(u.chat_id);
          return (
            <span key={u.chat_id} style={{ backgroundColor: color }} className="px-1.5 py-1 rounded-md flex items-center gap-1 text-white text-[10px] font-bold uppercase">
              {u.name.charAt(0)}
            </span>
          );
        })}
        {card.client_name && (<span className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md flex items-center gap-1 truncate max-w-[120px]">👤 {card.client_name}</span>)}
        {card.phone_number && (<span className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md flex items-center gap-1">📞 {card.phone_number}</span>)}
        {card.due_date && (<span className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md flex items-center gap-1">📅 {new Date(card.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} {card.due_time || ''}</span>)}
        {card.comment && <span className="bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md flex items-center gap-1">💬</span>}
      </div>
    </motion.div>
  );
}

function DroppableContainer({ id, children }: { id: string, children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 min-h-[50px] overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">{children}</div>;
}

function ArchiveDropZone({ isDragging }: { isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'archive-zone' });
  return (<div ref={setNodeRef} className={`fixed bottom-6 right-6 z-[70] w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-2 transition-all duration-300 ${isDragging ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-50 pointer-events-none'} ${isOver ? 'bg-red-500 border-red-300 scale-110 text-white' : 'bg-slate-800/80 dark:bg-zinc-100/80 backdrop-blur-xl border-white/20 dark:border-black/20 text-white dark:text-zinc-900'}`}><ArchiveIcon size={32} /></div>);
}

function AddCard({ columnId, onAdd }: { columnId: string, onAdd: (colId: string, title: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (title.trim()) { onAdd(columnId, title.trim()); setTitle(""); setIsAdding(false); } };
  if (!isAdding) return (<button onClick={() => setIsAdding(true)} className="text-slate-500 dark:text-slate-400 text-sm text-left mt-2 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors w-full flex items-center gap-1.5 font-medium"><span className="text-base leading-none">+</span> Добавить карточку</button>);
  return (<motion.form onSubmit={handleSubmit} className="mt-2 p-2 bg-white/60 dark:bg-zinc-800/60 backdrop-blur-xl rounded-xl border border-white/80 dark:border-white/10 shadow-sm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}><textarea value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 bg-transparent rounded-lg outline-none focus:ring-1 focus:ring-slate-400 text-sm resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500" placeholder="Введите название..." autoFocus /><div className="flex gap-2 mt-2"><button type="submit" className="bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-700 dark:hover:bg-white transition-colors shadow-sm">Добавить</button><button type="button" onClick={() => setIsAdding(false)} className="text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors">✕</button></div></motion.form>);
}

// --- МОДАЛЬНОЕ ОКНО КАРТОЧКИ ---
function CardModal({ card, telegramUsers, onClose, onUpdate, onArchive, onDeleteTelegramUser }: { card: CardType, telegramUsers: TelegramUser[], onClose: () => void, onUpdate: (id: string, data: Partial<CardType>) => void, onArchive: (id: string) => void, onDeleteTelegramUser: (chatId: string) => void }) {
  const [title, setTitle] = useState(card.title);
  const [comment, setComment] = useState(card.comment || "");
  const [date, setDate] = useState<Date | undefined>(card.due_date ? new Date(card.due_date) : undefined);
  const [time, setTime] = useState(card.due_time || "");
  const [clientName, setClientName] = useState(card.client_name || "");
  const [phoneNumber, setPhoneNumber] = useState(card.phone_number || "");
  const [selectedUsers, setSelectedUsers] = useState<string[]>(card.telegram_ids ? card.telegram_ids.split(',') : []);
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    const formattedDate = date ? date.toISOString().split('T')[0] : null;
    const cleanTelegramIds = selectedUsers.filter(Boolean).join(',');
    onUpdate(card.id, { title, comment, due_date: formattedDate, due_time: time, client_name: clientName, phone_number: phoneNumber, telegram_ids: cleanTelegramIds });
    onClose();
  };

  const handleArchive = () => { onArchive(card.id); onClose(); };
  const handleCopyPhone = () => { if (phoneNumber) { navigator.clipboard.writeText(phoneNumber); setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const toggleUser = (chatId: string) => { setSelectedUsers(prev => prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]); };

  return (
    <motion.div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white/60 dark:bg-zinc-900/80 backdrop-blur-2xl w-full max-w-md rounded-3xl p-6 border border-white/80 dark:border-white/10 shadow-2xl overflow-y-auto max-h-[90vh] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-start mb-6">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-transparent text-xl font-semibold text-slate-800 dark:text-white outline-none w-full focus:border-b focus:border-slate-400" />
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl ml-4 leading-none">&times;</button>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Данные клиента</h3>
          <div className="space-y-3">
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Имя клиента" className="w-full p-3 bg-white/40 dark:bg-zinc-800/50 border border-white/60 dark:border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-slate-400 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
            <div className="relative">
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Номер телефона" className="w-full p-3 pr-12 bg-white/40 dark:bg-zinc-800/50 border border-white/60 dark:border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-slate-400 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
              <button type="button" onClick={handleCopyPhone} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Скопировать номер">{copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}</button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Уведомить в Telegram</h3>
          <div className="flex flex-wrap gap-2 p-3 bg-white/40 dark:bg-zinc-800/50 border border-white/60 dark:border-white/10 rounded-2xl">
            {telegramUsers.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-1">Нет зарегистрированных пользователей. Напишите боту /start.</p>
            ) : (
              telegramUsers.map(user => {
                const color = getUserColor(user.chat_id);
                const isSelected = selectedUsers.includes(user.chat_id);
                return (
                  <div key={user.chat_id} className="flex items-center bg-black/5 dark:bg-white/10 rounded-lg overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => toggleUser(user.chat_id)}
                      style={isSelected ? { backgroundColor: color, color: 'white' } : {}}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${isSelected ? '' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      {!isSelected && <span style={{ backgroundColor: color }} className="w-2 h-2 rounded-full"></span>}
                      {user.name}
                    </button>
                    <button 
                      type="button"
                      onClick={() => onDeleteTelegramUser(user.chat_id)}
                      className="px-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Удалить пользователя"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex flex-col gap-4 items-center bg-white/80 dark:bg-zinc-800/50 p-4 rounded-2xl border border-white/80 dark:border-white/10 shadow-sm">
            <div className="w-full flex justify-center [&_*]:!text-slate-800 dark:[&_*]:!text-slate-200">
              <DayPicker mode="single" selected={date} onSelect={setDate} locale={ru} classNames={{ caption: "flex justify-between items-center py-2", caption_label: "!text-slate-900 dark:!text-white font-bold text-base", nav_button: "!text-red-500 dark:!text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full p-1 transition-colors", head_cell: "!text-slate-700 dark:!text-slate-400 text-xs font-bold w-9 text-center", day: "w-9 h-9 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-center text-sm font-medium", day_selected: "bg-slate-800 dark:bg-slate-100 !text-white dark:!text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 hover:!text-white dark:hover:!text-slate-900 font-bold", day_today: "font-bold !text-red-500 dark:!text-red-400 ring-1 ring-red-500 dark:ring-red-400 rounded-full" } as any} />
            </div>
            <div className="w-full flex items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
              <label className="text-sm text-slate-600 dark:text-slate-300 font-medium">Время:</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-white/80 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-slate-400 font-medium" />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Комментарий</h3>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Напишите что-нибудь..." className="w-full p-3 bg-white/40 dark:bg-zinc-800/50 border border-white/60 dark:border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-slate-400 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-none" rows={4} />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} className="w-full bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 py-3 rounded-2xl font-medium hover:bg-slate-700 dark:hover:bg-white transition-colors shadow-md">Сохранить</button>
          <button onClick={handleArchive} className="bg-slate-200/60 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-2xl font-medium hover:bg-slate-300/60 dark:hover:bg-slate-600/50 transition-colors flex items-center justify-center" title="В архив"><ArchiveIcon size={22} /></button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ArchivePanel({ cards, onClose, onRestore, onClearAll }: { cards: CardType[], onClose: () => void, onRestore: (id: string) => void, onClearAll: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm"></div>
      <motion.div className="relative bg-white/60 dark:bg-zinc-900/80 backdrop-blur-2xl w-full max-w-md h-full p-6 border-l border-white/80 dark:border-white/10 shadow-2xl flex flex-col" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-slate-800 dark:text-white font-semibold text-xl">Архив</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {cards.length === 0 ? (<div className="text-center mt-20 text-slate-500 dark:text-slate-400"><p className="text-5xl mb-4">🗑️</p><p>Архив пуст</p></div>) : (<div className="space-y-3">{cards.map(card => (<motion.div key={card.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} className="bg-white/50 dark:bg-zinc-800/50 p-3 rounded-xl border border-white/80 dark:border-white/10 shadow-sm flex justify-between items-center gap-2"><p className="text-sm text-slate-800 dark:text-slate-100 font-medium truncate flex-1">{card.title}</p><button onClick={() => onRestore(card.id)} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium whitespace-nowrap">Вернуть</button></motion.div>))}</div>)}
        </div>
        {cards.length > 0 && (<div className="pt-4 mt-4 border-t border-slate-200/60 dark:border-white/10"><button onClick={onClearAll} className="w-full bg-red-500/90 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"><TrashIcon size={16} /> Очистить архив</button></div>)}
      </motion.div>
    </motion.div>
  );
}

// --- ГЛАВНАЯ ДОСКА ---
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  
  const [pendingDelete, setPendingDelete] = useState<ColumnType | null>(null);
  const [undoTimer, setUndoTimer] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function fetchData() {
      const { data: cols } = await supabase.from('columns').select('*').order('position');
      const { data: cardsData } = await supabase.from('cards').select('*').order('position');
      const { data: tgUsers } = await supabase.from('telegram_users').select('*');
      setColumns(cols || []);
      setCards(cardsData || []);
      setTelegramUsers(tgUsers || []);
    }
    fetchData();
    const channel = supabase.channel('public:cards:columns').on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => fetchData()).on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, () => fetchData()).on('postgres_changes', { event: '*', schema: 'public', table: 'telegram_users' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') { document.documentElement.classList.add('dark'); setIsDark(true); }
  }, []);
  const toggleTheme = () => { if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false); } else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true); } };
  useEffect(() => { if (undoTimer > 0) { const timer = setTimeout(() => setUndoTimer(prev => prev - 1), 1000); return () => clearTimeout(timer); } else if (pendingDelete) { supabase.from('columns').delete().eq('id', pendingDelete.id).then(); setPendingDelete(null); } }, [undoTimer, pendingDelete]);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 10 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }));
  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (!user) {
    return (<main className="bg-slate-100 h-screen flex flex-col items-center justify-center overflow-hidden relative bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-neutral-900 transition-colors"><div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-slate-300/40 dark:bg-zinc-700/30 rounded-full blur-[120px] pointer-events-none"></div><div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-slate-400/30 dark:bg-neutral-700/30 rounded-full blur-[120px] pointer-events-none"></div><AuthForm /></main>);
  }

  function onDragStart(e: DragStartEvent) { if (e.active.data.current?.type === "Card") setActiveCard(e.active.data.current.card); }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e; const draggedCard = active.data.current?.card as CardType | undefined; setActiveCard(null);
    if (!over) return; const activeId = active.id; const overId = over.id;
    if (overId === 'archive-zone') { if (draggedCard) { handleToggleArchive(draggedCard.id, true); } return; }
    if (activeId === overId) return;
    setCards((prev) => { const activeCard = prev.find((c) => c.id === activeId); if (!activeCard) return prev; const overCard = prev.find((c) => c.id === overId); const newColId = overCard ? overCard.column_id : overId; if (activeCard.column_id === newColId) return prev; supabase.from('cards').update({ column_id: newColId }).eq('id', activeId).then(); return prev.map((c) => (c.id === activeId ? { ...c, column_id: newColId } : c)); });
  }

  async function handleAddCard(column_id: string, title: string) {
    const cardsInColumn = cards.filter(c => c.column_id === column_id && !c.is_archived).length; const newPosition = cardsInColumn + 1;
    const { data, error } = await supabase.from('cards').insert([{ title, column_id, position: newPosition }]).select();
    if (error) console.error("Ошибка создания:", error); if (data) setCards((prev) => [...prev, data[0]]);
  }

  async function handleAddColumn() {
    const title = prompt("Введите название колонки:"); if (title) { const newPosition = columns.length + 1; const { data, error } = await supabase.from('columns').insert([{ title, position: newPosition }]).select(); if (error) console.error("Ошибка создания:", error); if (data) setColumns((prev) => [...prev, data[0]]); }
  }

  function handleDeleteColumn(col: ColumnType) { setColumns((prev) => prev.filter((c) => c.id !== col.id)); setPendingDelete(col); setUndoTimer(15); }
  function handleUndoDelete() { if (pendingDelete) { setColumns((prev) => [...prev, pendingDelete].sort((a, b) => a.position - b.position)); setPendingDelete(null); setUndoTimer(0); } }

  async function handleUpdateCard(id: string, updates: Partial<CardType>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    const { error } = await supabase.from('cards').update(updates).eq('id', id);
    if (error) console.error("Ошибка обновления:", error);

    if (updates.telegram_ids) {
      const chatIds = updates.telegram_ids.split(',').filter(Boolean);
      if (chatIds.length > 0) {
        fetch('/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatIds, cardTitle: updates.title }) }).catch(err => console.error("Telegram API error:", err));
      }
    }
  }

  async function handleToggleArchive(id: string, archive: boolean) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, is_archived: archive } : c)));
    const { error } = await supabase.from('cards').update({ is_archived: archive }).eq('id', id);
    if (error) console.error("Ошибка архивации:", error);
  }

  async function handleClearArchive() {
    if (!confirm("Удалить все карточки из архива безвозвратно?")) return; const idsToDelete = archivedCards.map(c => c.id);
    if (idsToDelete.length === 0) return; setCards(prev => prev.filter(c => !c.is_archived));
    const { error } = await supabase.from('cards').delete().in('id', idsToDelete);
    if (error) { console.error("Ошибка очистки архива:", error); alert("Не удалось очистить архив."); }
  }

  async function handleDeleteTelegramUser(chatId: string) {
    if (!confirm("Удалить этого пользователя из списка уведомлений?")) return;
    setTelegramUsers(prev => prev.filter(u => u.chat_id !== chatId));
    const { error } = await supabase.from('telegram_users').delete().eq('chat_id', chatId);
    if (error) console.error("Ошибка удаления пользователя:", error);
  }

  const visibleCards = cards.filter(c => !c.is_archived);
  const archivedCards = cards.filter(c => c.is_archived);

  return (
    <main className="bg-slate-100 h-screen flex flex-col overflow-hidden relative bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-neutral-900 transition-colors">
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-slate-300/40 dark:bg-zinc-700/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-slate-400/30 dark:bg-neutral-700/30 rounded-full blur-[120px] pointer-events-none"></div>
      <header className="relative z-10 flex items-center justify-between p-4 bg-white/40 dark:bg-white/5 backdrop-blur-2xl border-b border-white/60 dark:border-white/10 shadow-sm">
        <h1 className="text-slate-800 dark:text-white font-semibold text-lg tracking-tight">NOVIKOV PRODUCTION</h1>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 p-2 rounded-xl transition-colors" title="Сменить тему">{isDark ? <SunIcon /> : <MoonIcon />}</button>
          <button onClick={() => setIsArchiveOpen(true)} className="text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 px-3 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium"><ArchiveIcon size={18} /><span className="hidden sm:inline">Архив</span><span className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full text-xs">{archivedCards.length}</span></button>
          <button onClick={handleLogout} className="text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 p-2 rounded-xl transition-colors" title="Выйти"><LogoutIcon /></button>
        </div>
      </header>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveCard(null)} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}>
        <div className="relative z-10 flex-1 flex gap-4 p-6 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <AnimatePresence>
            {columns.map((col) => {
              const colCards = visibleCards.filter((c) => c.column_id === col.id);
              return (
                <motion.div key={col.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="group bg-white/40 dark:bg-white/5 backdrop-blur-2xl w-80 rounded-3xl p-3 flex flex-col max-h-full flex-shrink-0 border border-white/60 dark:border-white/10 shadow-lg">
                  <div className="flex items-center justify-between mb-3 px-3 pt-1">
                    <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wider">{col.title}</h2>
                    <div className="flex items-center gap-1">
                      <span className="bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded-full font-medium">{colCards.length}</span>
                      <button onClick={() => handleDeleteColumn(col)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full p-1 transition-all duration-200" title="Удалить колонку"><TrashIcon size={16} /></button>
                    </div>
                  </div>
                  <SortableContext id={col.id} items={colCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <DroppableContainer id={col.id}>
                      {colCards.map((card) => <Card key={card.id} card={card} telegramUsers={telegramUsers} onOpen={setEditingCard} />)}
                    </DroppableContainer>
                  </SortableContext>
                  <AddCard columnId={col.id} onAdd={handleAddCard} />
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div className="w-72 flex-shrink-0">
            <button onClick={handleAddColumn} className="bg-white/30 dark:bg-white/5 backdrop-blur-xl border border-dashed border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/30 hover:bg-white/50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white font-medium w-full py-3 rounded-3xl flex items-center justify-center gap-2 transition-all shadow-sm">+ Добавить колонку</button>
          </div>
          <DragOverlay>{activeCard && (<div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-2xl p-3 rounded-2xl shadow-2xl w-72 cursor-grabbing border border-white dark:border-white/10 rotate-3"><p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{activeCard.title}</p></div>)}</DragOverlay>
        </div>
        <ArchiveDropZone isDragging={!!activeCard} />
      </DndContext>
      <AnimatePresence>{editingCard && (<CardModal card={editingCard} telegramUsers={telegramUsers} onClose={() => setEditingCard(null)} onUpdate={handleUpdateCard} onArchive={(id) => handleToggleArchive(id, true)} onDeleteTelegramUser={handleDeleteTelegramUser} />)}</AnimatePresence>
      <AnimatePresence>{isArchiveOpen && (<ArchivePanel cards={archivedCards} onClose={() => setIsArchiveOpen(false)} onRestore={(id) => handleToggleArchive(id, false)} onClearAll={handleClearArchive} />)}</AnimatePresence>
      <AnimatePresence>{pendingDelete && (<motion.div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800/80 dark:bg-zinc-100/80 backdrop-blur-xl text-white dark:text-zinc-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 dark:border-black/10" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}><span className="text-sm font-medium">Колонка удалена</span><button onClick={handleUndoDelete} className="text-slate-300 dark:text-slate-700 font-semibold text-sm hover:text-white dark:hover:text-black transition-colors flex items-center gap-1 bg-white/10 dark:bg-black/10 px-3 py-1 rounded-lg">Отменить <span className="text-xs w-5 text-center">({undoTimer})</span></button></motion.div>)}</AnimatePresence>
    </main>
  );
}