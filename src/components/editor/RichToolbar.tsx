"use client";

import { useEffect, useRef, useState } from "react";

// TECH-DEBT: document.execCommand is deprecated. Switch to Selection API or a rich text library.
const COLORS = [
  { name: "优雅黑", hex: "#111111" },
  { name: "活力橙", hex: "#f97316" },
  { name: "克莱因蓝", hex: "#2563eb" },
  { name: "灵动紫", hex: "#8b5cf6" },
  { name: "薄荷绿", hex: "#10b981" },
  { name: "高级灰", hex: "#6b7280" },
];

export default function RichToolbar() {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0
      ) {
        setVisible(false);
        return;
      }

      const range = selection.getRangeAt(0);
      let container = range.commonAncestorContainer;
      if (container.nodeType === 3) container = container.parentNode!;

      const editable = (container as Element).closest?.("[contenteditable]");
      if (!editable) {
        setVisible(false);
        return;
      }

      const rect = range.getBoundingClientRect();
      setPosition({
        top: Math.max(8, rect.top - 48),
        left: Math.max(8, Math.min(window.innerWidth - 180, rect.left + rect.width / 2 - 80)),
      });
      setVisible(true);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-lg px-1 py-1 flex items-center gap-0.5"
      style={{ top: position.top, left: position.left }}
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => document.execCommand("bold")}
        className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700"
        title="加粗"
      >
        B
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => document.execCommand("italic")}
        className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center italic font-serif text-gray-700"
        title="斜体"
      >
        I
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => document.execCommand("underline")}
        className="w-8 h-8 rounded hover:bg-gray-100 flex items-center justify-center underline text-gray-700"
        title="下划线"
      >
        U
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      {COLORS.map((c) => (
        <button
          key={c.hex}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => document.execCommand("foreColor", false, c.hex)}
          className="w-5 h-5 rounded-full border border-gray-200 hover:scale-110 transition-transform"
          style={{ backgroundColor: c.hex }}
          title={c.name}
        />
      ))}
    </div>
  );
}
