"use client";
import React, { useState, useEffect } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, useDroppable, MeasuringStrategy,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import "react-day-picker/dist/style.css";
import { supabase } from "@/lib/supabaseClient";

type CardType = { 
  id: string; 
  title: string; 
  column_id: string; 
  due_date?: string | null; 
  due_time?: string | null; 
  comment?: string | null;
  is_archived?: boolean;
};
type ColumnType = { id: string; title: string; position: number };

// --- Компонент Карточки ---
function Card({ card, onOpen }: { card: CardType, onOpen: (card: CardType) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id, data: { type: "Card", card },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <motion.div
      ref={setNodeRef} 
      {...attributes} 
      {...listeners} 
      // ДОБАВЛЕН ИНЛАЙН-СТИЛЬ touchAction: 'none'
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "none" }} 
      layout
      initial={{ opacity: 0, scale: 0.8, y: 10 }} 
      animate={{ opacity: isDragging ? 0.4 : 1, scale: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }} 
      whileHover={{ y: -2 }}
      onClick={() => onOpen(card)}
      // ДОБАВЛЕН КЛАСС select-none, чтобы телефон не выделял текст
      className={`bg-white/50 backdrop-blur-xl p-3 rounded-2xl mb-3 cursor-pointer active:cursor-grabbing border border-white/80 shadow-sm hover:bg-white/80 transition-colors select-none touch-none`}
    >
      <p className="text-sm text-slate-800 font-medium mb-1">{card.title}</p>
      <div className="flex gap-2 mt-2 text-xs text-slate-500">
        {card.due_date && (
          <span className="bg-black/5 px-2 py-1 rounded-md flex items-center gap-1">
            📅 {new Date(card.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} {card.due_time || ''}
          </span>
        )}
        {card.comment && <span className="bg-black/5 px-2 py-1 rounded-md flex items-center gap-1">💬</span>}
      </div>
    </motion.div>
  );
}

function DroppableContainer({ id, children }: { id: string, children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 min-h-[50px] overflow-y-auto pr-1 scroller">{children}</div>;
}

// --- Иконка Архива для перетаскивания (используем обычный CSS) ---
function ArchiveDropZone({ isDragging }: { isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'archive-zone' });
  
  return (
    <div
      ref={setNodeRef}
      className={`fixed bottom-6 right-6 z-[70] w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-2 transition-all duration-300 ${
        isDragging ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-50 pointer-events-none'
      } ${
        isOver ? 'bg-red-500 border-red-300 scale-110' : 'bg-slate-800/80 backdrop-blur-xl border-white/20'
      }`}
    >
      <span className="text-4xl pointer-events-none">🗄️</span>
    </div>
  );
}

function AddCard({ columnId, onAdd }: { columnId: string, onAdd: (colId: string, title: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) { onAdd(columnId, title.trim()); setTitle(""); setIsAdding(false); }
  };

  if (!isAdding) {
    return (
      <button onClick={() => setIsAdding(true)} className="text-slate-500 text-sm text-left mt-2 px-3 py-2 hover:bg-black/5 rounded-xl transition-colors w-full flex items-center gap-1.5 font-medium">
        <span className="text-base leading-none">+</span> Добавить карточку
      </button>
    );
  }

  return (
    <motion.form onSubmit={handleSubmit} className="mt-2 p-2 bg-white/60 backdrop-blur-xl rounded-xl border border-white/80 shadow-sm"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
      <textarea value={title} onChange={(e) => setTitle(e.target.value)} 
        className="w-full p-2 bg-transparent rounded-lg outline-none focus:ring-1 focus:ring-blue-400 text-sm resize-none text-slate-800 placeholder-slate-400" 
        placeholder="Введите название..." autoFocus />
      <div className="flex gap-2 mt-2">
        <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">Добавить</button>
        <button type="button" onClick={() => setIsAdding(false)} className="text-slate-500 px-3 py-1.5 rounded-lg text-sm hover:bg-black/5 transition-colors">✕</button>
      </div>
    </motion.form>
  );
}

// --- МОДАЛЬНОЕ ОКНО КАРТОЧКИ ---
function CardModal({ card, onClose, onUpdate, onArchive }: { card: CardType, onClose: () => void, onUpdate: (id: string, data: Partial<CardType>) => void, onArchive: (id: string) => void }) {
  const [title, setTitle] = useState(card.title);
  const [comment, setComment] = useState(card.comment || "");
  const [date, setDate] = useState<Date | undefined>(card.due_date ? new Date(card.due_date) : undefined);
  const [time, setTime] = useState(card.due_time || "");

  const handleSave = () => {
    const formattedDate = date ? date.toISOString().split('T')[0] : null;
    onUpdate(card.id, { title, comment, due_date: formattedDate, due_time: time });
    onClose();
  };

  const handleArchive = () => { onArchive(card.id); onClose(); };

  return (
    <motion.div className="fixed inset-0 bg-black/20 backdrop-blur-md z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="bg-white/60 backdrop-blur-2xl w-full max-w-md rounded-3xl p-6 border border-white/80 shadow-2xl overflow-y-auto max-h-[90vh] scroller"
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }} onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-start mb-6">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xl font-semibold text-slate-800 outline-none w-full focus:border-b focus:border-blue-400" />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl ml-4 leading-none">&times;</button>
        </div>

        <div className="mb-6">
          <div className="flex flex-col gap-4 items-center bg-white/80 p-4 rounded-2xl border border-white/80 shadow-sm">
            <div className="w-full flex justify-center [&_*]:!text-slate-800">
                            <DayPicker 
                mode="single" 
                selected={date} 
                onSelect={setDate} 
                locale={ru}
                classNames={{
                  caption: "flex justify-between items-center py-2", 
                  caption_label: "!text-slate-900 font-bold text-base",
                  nav_button: "!text-blue-600 hover:bg-blue-50 rounded-full p-1 transition-colors",
                  head_cell: "!text-slate-700 text-xs font-bold w-9 text-center",
                  day: "w-9 h-9 hover:bg-slate-100 rounded-full transition-colors text-center text-sm font-medium",
                  day_selected: "bg-blue-600 !text-white hover:bg-blue-600 hover:!text-white font-bold",
                  day_today: "font-bold !text-blue-600 ring-1 ring-blue-600 rounded-full",
                } as any} 
              />
            </div>
            <div className="w-full flex items-center justify-center gap-3 border-t border-slate-100 pt-4">
              <label className="text-sm text-slate-600 font-medium">Время:</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-blue-400 font-medium" />
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Комментарий</h3>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Напишите что-нибудь..."
            className="w-full p-3 bg-white/40 border border-white/60 rounded-2xl outline-none focus:ring-1 focus:ring-blue-400 text-sm text-slate-800 placeholder-slate-400 resize-none" rows={4} />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} className="w-full bg-blue-600 text-white py-3 rounded-2xl font-medium hover:bg-blue-700 transition-colors shadow-md">Сохранить</button>
          <button onClick={handleArchive} className="bg-slate-200/60 text-slate-600 px-4 py-3 rounded-2xl font-medium hover:bg-slate-300/60 transition-colors flex items-center gap-2" title="В архив">
            🗄️
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- ПАНЕЛЬ АРХИВА ---
function ArchivePanel({ cards, onClose, onRestore }: { cards: CardType[], onClose: () => void, onRestore: (id: string) => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
      <motion.div 
        className="relative bg-white/60 backdrop-blur-2xl w-full max-w-md h-full p-6 border-l border-white/80 shadow-2xl overflow-y-auto scroller"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-slate-800 font-semibold text-xl">Архив</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        
        {cards.length === 0 ? (
          <div className="text-center mt-20 text-slate-500">
            <p className="text-5xl mb-4">🗑️</p>
            <p>Архив пуст</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map(card => (
              <motion.div key={card.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
                className="bg-white/50 p-3 rounded-xl border border-white/80 shadow-sm flex justify-between items-center gap-2">
                <p className="text-sm text-slate-800 font-medium truncate flex-1">{card.title}</p>
                <button onClick={() => onRestore(card.id)} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors font-medium whitespace-nowrap">
                  Вернуть
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// --- ГЛАВНАЯ ДОСКА ---
export default function Home() {
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  
  const [pendingDelete, setPendingDelete] = useState<ColumnType | null>(null);
  const [undoTimer, setUndoTimer] = useState(0);

  useEffect(() => {
    async function fetchData() {
      const { data: cols } = await supabase.from('columns').select('*').order('position');
      const { data: cardsData } = await supabase.from('cards').select('*').order('position');
      setColumns(cols || []);
      setCards(cardsData || []);
    }
    fetchData();

    const channel = supabase
      .channel('public:cards:columns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (undoTimer > 0) {
      const timer = setTimeout(() => setUndoTimer(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (pendingDelete) {
      supabase.from('columns').delete().eq('id', pendingDelete.id).then();
      setPendingDelete(null);
    }
  }, [undoTimer, pendingDelete]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 }, // Задержка 250мс для перетаскивания
    })
  );

  function onDragStart(e: DragStartEvent) { 
    if (e.active.data.current?.type === "Card") setActiveCard(e.active.data.current.card); 
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const draggedCard = active.data.current?.card as CardType | undefined;
    setActiveCard(null);
    
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (overId === 'archive-zone') {
      if (draggedCard) {
        handleToggleArchive(draggedCard.id, true);
      }
      return;
    }

    if (activeId === overId) return;

    setCards((prev) => {
      const activeCard = prev.find((c) => c.id === activeId);
      if (!activeCard) return prev;
      const overCard = prev.find((c) => c.id === overId);
      const newColId = overCard ? overCard.column_id : overId;
      if (activeCard.column_id === newColId) return prev;

      supabase.from('cards').update({ column_id: newColId }).eq('id', activeId).then();
      return prev.map((c) => (c.id === activeId ? { ...c, column_id: newColId } : c));
    });
  }

  async function handleAddCard(column_id: string, title: string) {
    const cardsInColumn = cards.filter(c => c.column_id === column_id && !c.is_archived).length;
    const newPosition = cardsInColumn + 1;
    const { data, error } = await supabase.from('cards').insert([{ title, column_id, position: newPosition }]).select();
    if (error) console.error("Ошибка создания:", error);
    if (data) setCards((prev) => [...prev, data[0]]);
  }

  async function handleAddColumn() {
    const title = prompt("Введите название колонки:");
    if (title) {
      const newPosition = columns.length + 1;
      const { data, error } = await supabase.from('columns').insert([{ title, position: newPosition }]).select();
      if (error) console.error("Ошибка создания:", error);
      if (data) setColumns((prev) => [...prev, data[0]]);
    }
  }

  function handleDeleteColumn(col: ColumnType) {
    setColumns((prev) => prev.filter((c) => c.id !== col.id));
    setPendingDelete(col);
    setUndoTimer(15);
  }

  function handleUndoDelete() {
    if (pendingDelete) {
      setColumns((prev) => [...prev, pendingDelete].sort((a, b) => a.position - b.position));
      setPendingDelete(null);
      setUndoTimer(0);
    }
  }

  async function handleUpdateCard(id: string, updates: Partial<CardType>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    const { error } = await supabase.from('cards').update(updates).eq('id', id);
    if (error) console.error("Ошибка обновления:", error);
  }

  async function handleToggleArchive(id: string, archive: boolean) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, is_archived: archive } : c)));
    const { error } = await supabase.from('cards').update({ is_archived: archive }).eq('id', id);
    if (error) console.error("Ошибка архивации:", error);
  }

  const visibleCards = cards.filter(c => !c.is_archived);
  const archivedCards = cards.filter(c => c.is_archived);

  return (
    <main className="bg-slate-100 h-screen flex flex-col overflow-hidden relative bg-gradient-to-br from-sky-100 via-purple-50 to-pink-100">
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-300/40 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-300/40 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="relative z-10 flex items-center justify-between p-4 bg-white/40 backdrop-blur-2xl border-b border-white/60 shadow-sm">
        <h1 className="text-slate-800 font-semibold text-lg tracking-tight">Моя Доска</h1>
        <button onClick={() => setIsArchiveOpen(true)} className="text-slate-600 hover:bg-black/5 px-3 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium">
          🗄️ Архив <span className="bg-black/5 px-1.5 py-0.5 rounded-full text-xs">{archivedCards.length}</span>
        </button>
      </header>

      {/* ИЗМЕНЕНО: DndContext вынесен наружу, чтобы зона архива не была внутри скролл-контейнера */}
      <DndContext 
        sensors={sensors} 
        onDragStart={onDragStart} 
        onDragEnd={onDragEnd}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <div className="relative z-10 flex-1 flex gap-4 p-6 overflow-x-auto scroller">
          <AnimatePresence>
            {columns.map((col) => {
              const colCards = visibleCards.filter((c) => c.column_id === col.id);
              return (
                <motion.div key={col.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className="group bg-white/40 backdrop-blur-2xl w-80 rounded-3xl p-3 flex flex-col max-h-full flex-shrink-0 border border-white/60 shadow-lg">
                  
                  <div className="flex items-center justify-between mb-3 px-3 pt-1">
                    <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">{col.title}</h2>
                    <div className="flex items-center gap-1">
                      <span className="bg-black/5 text-slate-600 text-xs px-2 py-1 rounded-full font-medium">{colCards.length}</span>
                      <button 
                        onClick={() => handleDeleteColumn(col)} 
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1 transition-all duration-200"
                        title="Удалить колонку"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <SortableContext id={col.id} items={colCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <DroppableContainer id={col.id}>
                      {colCards.map((card) => <Card key={card.id} card={card} onOpen={setEditingCard} />)}
                    </DroppableContainer>
                  </SortableContext>
                  
                  <AddCard columnId={col.id} onAdd={handleAddCard} />
                </motion.div>
              );
            })}
          </AnimatePresence>

          <div className="w-72 flex-shrink-0">
            <button onClick={handleAddColumn} className="bg-white/30 backdrop-blur-xl border border-dashed border-slate-300 hover:border-slate-400 hover:bg-white/50 text-slate-600 hover:text-slate-800 font-medium w-full py-3 rounded-3xl flex items-center justify-center gap-2 transition-all shadow-sm">
              + Добавить колонку
            </button>
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="bg-white/80 backdrop-blur-2xl p-3 rounded-2xl shadow-2xl w-72 cursor-grabbing border border-white rotate-3">
                <p className="text-sm text-slate-800 font-medium">{activeCard.title}</p>
              </div>
            )}
          </DragOverlay>
        </div>

        {/* Зона сброса для архива (теперь вне скролл-зоны) */}
        <ArchiveDropZone isDragging={!!activeCard} />
      </DndContext>

      <AnimatePresence>
        {editingCard && (
          <CardModal card={editingCard} onClose={() => setEditingCard(null)} onUpdate={handleUpdateCard} onArchive={(id) => handleToggleArchive(id, true)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isArchiveOpen && (
          <ArchivePanel cards={archivedCards} onClose={() => setIsArchiveOpen(false)} onRestore={(id) => handleToggleArchive(id, false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div 
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-800/80 backdrop-blur-xl text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10"
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <span className="text-sm font-medium">Колонка удалена</span>
            <button 
              onClick={handleUndoDelete} 
              className="text-blue-300 font-semibold text-sm hover:text-blue-200 transition-colors flex items-center gap-1 bg-white/10 px-3 py-1 rounded-lg"
            >
              Отменить <span className="text-xs w-5 text-center">({undoTimer})</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}