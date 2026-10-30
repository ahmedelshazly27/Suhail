"use client";
// One rich-text editor for descriptions, comments, notes, project docs and the newsletter.
// "/" opens block commands, "@" mentions a teammate (stored as a mention node with their profile id).
import { Extension, type Editor as TEditor, type JSONContent, type Range } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { PluginKey } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { useState } from "react";

export type Doc = JSONContent;
type Person = { id: string; name: string };
type Item = { id: string; label: string; run?: (e: TEditor, r: Range) => void };
type Menu = { items: Item[]; index: number; rect: DOMRect | null; pick: (i: Item) => void } | null;

const SLASH: Item[] = [
  { id: "h2", label: "Heading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run() },
  { id: "h3", label: "Subheading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run() },
  { id: "todo", label: "Checklist", run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { id: "ul", label: "Bulleted list", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { id: "ol", label: "Numbered list", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { id: "quote", label: "Quote", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { id: "rule", label: "Divider", run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { id: "ticket", label: "Embed ticket (SUH-…)", run: (e, r) => e.chain().focus().deleteRange(r).insertContent("SUH-").run() },
  { id: "file", label: "Link a file", run: (e, r) => { const u = prompt("SharePoint or OneDrive link"); if (u) e.chain().focus().deleteRange(r).insertContent({ type: "text", text: u, marks: [{ type: "link", attrs: { href: u } }] }).run(); } },
];

/** A suggestion menu whose state lives in React; Tiptap only reports query, position and keys. */
function menuExtension(name: string, char: string, getItems: (q: string) => Item[], setMenu: (m: Menu) => void, onPick: (e: TEditor, r: Range, i: Item) => void) {
  return Extension.create({
    name,
    addProseMirrorPlugins() {
      let state: { items: Item[]; index: number; props: SuggestionProps<Item> } | null = null;
      const show = () => state && setMenu({ items: state.items, index: state.index, rect: state.props.clientRect?.() ?? null, pick: (i) => state && state.props.command(i) });
      return [Suggestion<Item>({
        editor: this.editor, char, allowSpaces: false, pluginKey: new PluginKey(name),
        items: ({ query }) => getItems(query),
        command: ({ editor, range, props }) => onPick(editor, range, props),
        render: () => ({
          onStart: (p) => { state = { items: p.items, index: 0, props: p }; show(); },
          onUpdate: (p) => { state = { items: p.items, index: 0, props: p }; show(); },
          onKeyDown: ({ event }) => {
            if (!state || !state.items.length) return false;
            if (event.key === "ArrowDown") { state.index = (state.index + 1) % state.items.length; show(); return true; }
            if (event.key === "ArrowUp") { state.index = (state.index + state.items.length - 1) % state.items.length; show(); return true; }
            if (event.key === "Enter") { state.props.command(state.items[state.index]); return true; }
            if (event.key === "Escape") { setMenu(null); state = null; return true; }
            return false;
          },
          onExit: () => { state = null; setMenu(null); },
        }),
      })];
    },
  });
}

type Props = { value?: Doc | null; onChange?: (d: Doc) => void; onSubmit?: (d: Doc, clear: () => void) => void; people?: Person[]; placeholder?: string; dir?: "ltr" | "rtl"; minimal?: boolean; label?: string; autofocus?: boolean };

export function Editor({ value, onChange, onSubmit, people = [], placeholder, dir, minimal, label, autofocus }: Props) {
  const [menu, setMenu] = useState<Menu>(null);
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autofocus ? "end" : false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      TaskList, TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Mention.configure({ HTMLAttributes: { class: "mention" }, renderText: ({ node }) => "@" + node.attrs.label, renderHTML: ({ node }) => ["span", { class: "mention", "data-id": node.attrs.id }, "@" + node.attrs.label], suggestion: { char: "\u0000" } }),
      menuExtension("mentionMenu", "@", (q) => people.filter((p) => p.name.toLowerCase().startsWith(q.toLowerCase())).slice(0, 6).map((p) => ({ id: p.id, label: p.name })), setMenu,
        (e, r, i) => e.chain().focus().deleteRange(r).insertContent([{ type: "mention", attrs: { id: i.id, label: i.label } }, { type: "text", text: " " }]).run()),
      ...(minimal ? [] : [menuExtension("slashMenu", "/", (q) => SLASH.filter((s) => s.label.toLowerCase().includes(q.toLowerCase())), setMenu, (e, r, i) => i.run?.(e, r))]),
    ],
    content: value ?? undefined,
    editorProps: {
      attributes: { class: "rt", ...(dir ? { dir } : {}), ...(label ? { "aria-label": label } : {}), role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  });
  return (
    <div className="editor" style={{ position: "relative" }} onKeyDown={(e) => { if (onSubmit && editor && e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(editor.getJSON(), () => editor.commands.clearContent()); } }}>
      <EditorContent editor={editor} />
      {menu && menu.items.length ? (
        <div className="slash" role="listbox" style={{ position: "fixed", top: (menu.rect?.bottom ?? 0) + 6, insetInlineStart: document.dir === "rtl" ? innerWidth - (menu.rect?.right ?? 0) : menu.rect?.left ?? 0 }}>
          {menu.items.map((i, n) => <button key={i.id} type="button" role="option" aria-selected={n === menu.index} onMouseDown={(e) => { e.preventDefault(); menu.pick(i); }}>{i.label}</button>)}
        </div>
      ) : null}
      {onSubmit ? <div style={{ display: "flex", justifyContent: "flex-end", marginTop: ".5rem" }}><button type="button" className="b quiet" onClick={() => editor && onSubmit(editor.getJSON(), () => editor.commands.clearContent())}>Send <span className="k">⌘↵</span></button></div> : null}
    </div>
  );
}

/** Read-only rendering of a stored document. */
export function RichText({ doc, dir }: { doc: Doc | null | undefined; dir?: "ltr" | "rtl" }) {
  const editor = useEditor({ immediatelyRender: false, editable: false, extensions: [StarterKit.configure({ link: false }), Link, TaskList, TaskItem, Mention.configure({ HTMLAttributes: { class: "mention" }, renderText: ({ node }) => "@" + node.attrs.label, renderHTML: ({ node }) => ["span", { class: "mention" }, "@" + node.attrs.label], suggestion: { char: "\u0000" } })], content: doc ?? undefined, editorProps: { attributes: { class: "rt", ...(dir ? { dir } : {}) } } });
  return <EditorContent editor={editor} />;
}
