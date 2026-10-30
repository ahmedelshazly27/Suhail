"use client";
// Generic kanban: columns of cards with drag and drop (mouse, touch and keyboard). Used for tickets and applications.
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

export type Col<T> = { id: string; title: string; dot?: React.ReactNode; items: T[] };
type Props<T extends { id: string }> = {
  cols: Col<T>[];
  render: (item: T, dragging?: boolean) => React.ReactNode;
  onMove: (id: string, toCol: string, index: number, before: T | null, after: T | null) => void;
  footer?: (col: Col<T>) => React.ReactNode;
  label: string;
};

function Card<T extends { id: string }>({ item, render }: { item: T; render: (i: T, d?: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  // The card inside is the focusable button; the wrapper only carries the drag handlers and instructions.
  const { role: _r, tabIndex: _t, "aria-roledescription": _d, ...a11y } = attributes; void _r; void _t; void _d;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }} {...a11y} {...listeners}>
      {render(item)}
    </div>
  );
}

function Column<T extends { id: string }>({ col, render, footer }: { col: Col<T>; render: Props<T>["render"]; footer?: Props<T>["footer"] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "col:" + col.id });
  return (
    <section className="bcol" aria-label={col.title}>
      <div className="bcol-h">{col.dot}<span>{col.title}</span><span className="n">{col.items.length}</span></div>
      <SortableContext id={col.id} items={col.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`bcol-body${isOver ? " over" : ""}`}>
          {col.items.map((i) => <Card key={i.id} item={i} render={render} />)}
        </div>
      </SortableContext>
      {footer?.(col)}
    </section>
  );
}

export function Board<T extends { id: string }>({ cols: initial, render, onMove, footer, label }: Props<T>) {
  const [cols, setCols] = useState(initial);
  const [src, setSrc] = useState(initial);
  const [active, setActive] = useState<T | null>(null);
  if (src !== initial) { setSrc(initial); setCols(initial); } // new data from the server
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const colOf = (id: string) => (id.startsWith("col:") ? cols.find((c) => c.id === id.slice(4)) : cols.find((c) => c.items.some((i) => i.id === id)));

  const onStart = (e: DragStartEvent) => setActive(colOf(String(e.active.id))?.items.find((i) => i.id === e.active.id) ?? null);
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    if (!e.over) return;
    const from = colOf(String(e.active.id)), to = colOf(String(e.over.id));
    if (!from || !to) return;
    const item = from.items.find((i) => i.id === e.active.id)!;
    const rest = to.items.filter((i) => i.id !== item.id);
    let index = String(e.over.id).startsWith("col:") ? rest.length : rest.findIndex((i) => i.id === e.over!.id);
    if (index < 0) index = rest.length;
    const next = [...rest.slice(0, index), item, ...rest.slice(index)];
    setCols((cs) => cs.map((c) => (c.id === to.id ? { ...c, items: next } : c.id === from.id ? { ...c, items: c.items.filter((i) => i.id !== item.id) } : c)));
    onMove(item.id, to.id, index, next[index - 1] ?? null, next[index + 1] ?? null);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}
      accessibility={{ screenReaderInstructions: { draggable: "Press space to pick up a card, arrow keys to move it, space again to drop it, or escape to cancel." } }}>
      <div className="board" role="group" aria-label={label} tabIndex={0}>{/* focusable so keyboards can scroll it even when empty */}
        {cols.map((c) => <Column key={c.id} col={c} render={render} footer={footer} />)}
      </div>
      <DragOverlay>{active ? <div className="dragging-wrap">{render(active, true)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

/** Fractional sort key between two neighbours, so a move updates one row. */
export const between = (a?: number | null, b?: number | null) => (a == null && b == null ? 1000 : a == null ? (b as number) - 1000 : b == null ? a + 1000 : (a + b) / 2);
