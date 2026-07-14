'use client';

import { useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const buttons: { command: string; icon: React.ReactNode; title: string; val?: string }[] = [
    { command: 'bold', icon: <Bold size={15} />, title: 'Negrita' },
    { command: 'italic', icon: <Italic size={15} />, title: 'Cursiva' },
    { command: 'underline', icon: <Underline size={15} />, title: 'Subrayado' },
    { command: 'insertUnorderedList', icon: <List size={15} />, title: 'Lista' },
    { command: 'insertOrderedList', icon: <ListOrdered size={15} />, title: 'Lista Numerada' },
    { command: 'justifyLeft', icon: <AlignLeft size={15} />, title: 'Alinear Izquierda' },
    { command: 'justifyCenter', icon: <AlignCenter size={15} />, title: 'Centrar' },
    { command: 'justifyRight', icon: <AlignRight size={15} />, title: 'Alinear Derecha' },
  ];

  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#E2E8F0] bg-[#F8F9FB]">
        <select
          onChange={e => {
            if (e.target.value) exec('formatBlock', e.target.value);
          }}
          className="text-xs bg-transparent border border-[#E2E8F0] rounded px-1.5 py-1 mr-1 text-[#64748B] cursor-pointer"
          defaultValue=""
        >
          <option value="" disabled>Formato</option>
          <option value="p">Normal</option>
          <option value="h2">Encabezado</option>
          <option value="h3">Subencabezado</option>
        </select>
        {buttons.map((btn, i) => (
          <button
            key={btn.command + i}
            type="button"
            onMouseDown={e => { e.preventDefault(); exec(btn.command, btn.val); }}
            className="p-1.5 rounded hover:bg-[#E2E8F0] text-[#64748B] hover:text-[#1B3A5C] transition-colors"
            title={btn.title}
          >
            {btn.icon}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        data-placeholder={placeholder || 'Escribe el mensaje de bienvenida...'}
        className="min-h-[160px] px-4 py-3 text-sm text-[#1A202C] outline-none prose prose-sm max-w-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-[#CBD5E1]"
      />
    </div>
  );
}
