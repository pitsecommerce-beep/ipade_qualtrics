'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch, Shuffle, Database, StopCircle, X } from 'lucide-react';
import type { FlowElement, Block, EmbeddedDataField, BranchCondition } from '@/types/survey';
import { createFlowElement, createId } from '@/lib/survey-utils';

interface FlowEditorProps {
  flow: FlowElement[];
  blocks: Block[];
  onChange: (flow: FlowElement[]) => void;
}

export default function FlowEditor({ flow, blocks, onChange }: FlowEditorProps) {
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedElements);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedElements(next);
  };

  const addElement = (type: FlowElement['type'], parentIdx?: number) => {
    const element = createFlowElement(type);

    if (type === 'show_block' && blocks.length > 0) {
      const usedBlockIds = flow.filter(f => f.type === 'show_block').map(f => f.blockId);
      const availableBlock = blocks.find(b => !usedBlockIds.includes(b.id));
      element.blockId = availableBlock?.id || blocks[0].id;
    }

    if (type === 'embedded_data') {
      element.embeddedData = [{ name: '', value: '' }];
    }

    if (type === 'branch') {
      element.conditions = [{ operator: 'equals', value: '' }];
      element.children = [];
    }

    if (type === 'randomizer') {
      element.randomizerCount = 1;
      element.randomizerEvenPresent = true;
      element.children = [];
    }

    if (parentIdx !== undefined) {
      const newFlow = [...flow];
      if (!newFlow[parentIdx].children) newFlow[parentIdx].children = [];
      newFlow[parentIdx].children!.push(element);
      onChange(newFlow);
    } else {
      onChange([...flow, element]);
    }
  };

  const removeElement = (idx: number, parentIdx?: number) => {
    if (parentIdx !== undefined) {
      const newFlow = [...flow];
      newFlow[parentIdx].children = newFlow[parentIdx].children?.filter((_, i) => i !== idx);
      onChange(newFlow);
    } else {
      onChange(flow.filter((_, i) => i !== idx));
    }
  };

  const updateElement = (idx: number, updates: Partial<FlowElement>, parentIdx?: number) => {
    const newFlow = [...flow];
    if (parentIdx !== undefined) {
      const children = [...(newFlow[parentIdx].children || [])];
      children[idx] = { ...children[idx], ...updates };
      newFlow[parentIdx] = { ...newFlow[parentIdx], children };
    } else {
      newFlow[idx] = { ...newFlow[idx], ...updates };
    }
    onChange(newFlow);
  };

  const moveElement = (idx: number, direction: 'up' | 'down') => {
    const newFlow = [...flow];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newFlow.length) return;
    [newFlow[idx], newFlow[swapIdx]] = [newFlow[swapIdx], newFlow[idx]];
    onChange(newFlow);
  };

  const renderElement = (element: FlowElement, idx: number, parentIdx?: number, depth: number = 0) => {
    const isExpanded = expandedElements.has(element.id);
    const hasChildren = element.type === 'branch' || element.type === 'randomizer';

    const typeStyles: Record<string, { border: string; bg: string; icon: React.ReactNode; label: string }> = {
      show_block: {
        border: 'border-[#2A5A8C]',
        bg: 'bg-blue-50',
        icon: <div className="w-6 h-6 rounded bg-[#2A5A8C] flex items-center justify-center"><svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></div>,
        label: 'Mostrar Bloque',
      },
      branch: {
        border: 'border-blue-400',
        bg: 'bg-blue-50',
        icon: <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center"><GitBranch size={14} className="text-white" /></div>,
        label: 'Ramificación',
      },
      randomizer: {
        border: 'border-pink-400',
        bg: 'bg-pink-50',
        icon: <div className="w-6 h-6 rounded bg-pink-500 flex items-center justify-center"><Shuffle size={14} className="text-white" /></div>,
        label: 'Aleatorizador',
      },
      embedded_data: {
        border: 'border-purple-400',
        bg: 'bg-purple-50',
        icon: <div className="w-6 h-6 rounded bg-purple-500 flex items-center justify-center"><Database size={14} className="text-white" /></div>,
        label: 'Datos Embebidos',
      },
      end_survey: {
        border: 'border-red-400',
        bg: 'bg-red-50',
        icon: <div className="w-6 h-6 rounded bg-red-500 flex items-center justify-center"><StopCircle size={14} className="text-white" /></div>,
        label: 'Fin de Encuesta',
      },
    };

    const style = typeStyles[element.type] || typeStyles.show_block;

    return (
      <div key={element.id} className="animate-fade-in" style={{ marginLeft: depth * 32 }}>
        {/* Connector */}
        {idx > 0 && <div className="flow-connector" />}

        <div className={`flow-element ${style.border} ${style.bg} border-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasChildren && (
                <button onClick={() => toggleExpand(element.id)} className="text-[#64748B]">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              {style.icon}
              <div>
                <span className="text-sm font-semibold text-[#1A202C]">{style.label}:</span>
                {element.type === 'show_block' && (
                  <select
                    value={element.blockId || ''}
                    onChange={e => updateElement(idx, { blockId: e.target.value }, parentIdx)}
                    className="ml-2 text-sm bg-transparent border-none outline-none text-[#2A5A8C] font-medium cursor-pointer"
                  >
                    {blocks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.questions.length} Preguntas)</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {parentIdx === undefined && idx > 0 && (
                <button onClick={() => moveElement(idx, 'up')} className="p-1 rounded hover:bg-white/50 text-[#64748B] text-xs">&#9650;</button>
              )}
              {parentIdx === undefined && idx < flow.length - 1 && (
                <button onClick={() => moveElement(idx, 'down')} className="p-1 rounded hover:bg-white/50 text-[#64748B] text-xs">&#9660;</button>
              )}
              <button onClick={() => removeElement(idx, parentIdx)} className="p-1.5 rounded hover:bg-white/50 text-red-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Branch conditions */}
          {element.type === 'branch' && isExpanded && (
            <div className="mt-3 space-y-2 pl-9">
              <p className="text-xs font-medium text-[#64748B]">Si:</p>
              {(element.conditions || []).map((cond, ci) => (
                <div key={ci} className="flex items-center gap-2 flex-wrap">
                  {ci > 0 && (
                    <select
                      value={cond.conjunction || 'and'}
                      onChange={e => {
                        const conds = [...(element.conditions || [])];
                        conds[ci] = { ...conds[ci], conjunction: e.target.value as 'and' | 'or' };
                        updateElement(idx, { conditions: conds }, parentIdx);
                      }}
                      className="input-field py-1 text-xs w-14"
                    >
                      <option value="and">Y</option>
                      <option value="or">O</option>
                    </select>
                  )}
                  <input
                    value={cond.embeddedDataField || ''}
                    onChange={e => {
                      const conds = [...(element.conditions || [])];
                      conds[ci] = { ...conds[ci], embeddedDataField: e.target.value };
                      updateElement(idx, { conditions: conds }, parentIdx);
                    }}
                    placeholder="Variable"
                    className="input-field py-1 text-xs w-28"
                  />
                  <select
                    value={cond.operator}
                    onChange={e => {
                      const conds = [...(element.conditions || [])];
                      conds[ci] = { ...conds[ci], operator: e.target.value as BranchCondition['operator'] };
                      updateElement(idx, { conditions: conds }, parentIdx);
                    }}
                    className="input-field py-1 text-xs w-28"
                  >
                    <option value="equals">Es igual a</option>
                    <option value="not_equals">No es igual a</option>
                    <option value="greater_than">Mayor que</option>
                    <option value="less_than">Menor que</option>
                    <option value="contains">Contiene</option>
                  </select>
                  <input
                    value={cond.value}
                    onChange={e => {
                      const conds = [...(element.conditions || [])];
                      conds[ci] = { ...conds[ci], value: e.target.value };
                      updateElement(idx, { conditions: conds }, parentIdx);
                    }}
                    placeholder="Valor"
                    className="input-field py-1 text-xs w-24"
                  />
                  <button
                    onClick={() => {
                      const conds = (element.conditions || []).filter((_, i) => i !== ci);
                      updateElement(idx, { conditions: conds }, parentIdx);
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const conds = [...(element.conditions || [])];
                  conds.push({ operator: 'equals', value: '', conjunction: 'and' });
                  updateElement(idx, { conditions: conds }, parentIdx);
                }}
                className="text-xs text-[#2A5A8C] flex items-center gap-1"
              >
                <Plus size={12} /> Agregar condición
              </button>
            </div>
          )}

          {/* Randomizer settings */}
          {element.type === 'randomizer' && isExpanded && (
            <div className="mt-3 pl-9 space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-xs text-[#64748B]">Presentar aleatoriamente</label>
                <input
                  type="number"
                  min={1}
                  value={element.randomizerCount || 1}
                  onChange={e => updateElement(idx, { randomizerCount: Number(e.target.value) }, parentIdx)}
                  className="input-field py-1 text-xs w-16 text-center"
                />
                <span className="text-xs text-[#64748B]">de los siguientes elementos</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#64748B]">
                <input
                  type="checkbox"
                  checked={element.randomizerEvenPresent ?? true}
                  onChange={e => updateElement(idx, { randomizerEvenPresent: e.target.checked }, parentIdx)}
                  className="rounded border-[#CBD5E1] w-3.5 h-3.5"
                />
                Presentar elementos equitativamente
              </label>
            </div>
          )}

          {/* Embedded data fields */}
          {element.type === 'embedded_data' && (
            <div className="mt-3 pl-9 space-y-2">
              {(element.embeddedData || []).map((field, fi) => (
                <div key={fi} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">{field.name || 'Variable'}</span>
                  <span className="text-xs text-[#64748B]">=</span>
                  <input
                    value={field.name}
                    onChange={e => {
                      const fields = [...(element.embeddedData || [])];
                      fields[fi] = { ...fields[fi], name: e.target.value };
                      updateElement(idx, { embeddedData: fields }, parentIdx);
                    }}
                    placeholder="Nombre"
                    className="input-field py-1 text-xs w-28"
                  />
                  <input
                    value={field.value}
                    onChange={e => {
                      const fields = [...(element.embeddedData || [])];
                      fields[fi] = { ...fields[fi], value: e.target.value };
                      updateElement(idx, { embeddedData: fields }, parentIdx);
                    }}
                    placeholder="Valor"
                    className="input-field py-1 text-xs flex-1"
                  />
                  <button
                    onClick={() => {
                      const fields = (element.embeddedData || []).filter((_, i) => i !== fi);
                      updateElement(idx, { embeddedData: fields }, parentIdx);
                    }}
                    className="text-red-400 hover:text-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const fields = [...(element.embeddedData || [])];
                  fields.push({ name: '', value: '' });
                  updateElement(idx, { embeddedData: fields }, parentIdx);
                }}
                className="text-xs text-purple-600 flex items-center gap-1"
              >
                <Plus size={12} /> Agregar campo
              </button>
            </div>
          )}

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="mt-3 pl-4 border-l-2 border-dashed border-[#CBD5E1]">
              {(element.children || []).map((child, ci) =>
                renderElement(child, ci, idx, 0)
              )}
              <div className="mt-2">
                <AddElementMenu onAdd={(type) => addElement(type, idx)} compact />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia]">Flujo de la Encuesta</h3>
        <span className="text-xs text-[#94A3B8]">Publicado</span>
      </div>

      {flow.map((element, idx) => renderElement(element, idx))}

      <div className="mt-4">
        <AddElementMenu onAdd={(type) => addElement(type)} />
      </div>
    </div>
  );
}

function AddElementMenu({ onAdd, compact }: { onAdd: (type: FlowElement['type']) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);

  const items: { type: FlowElement['type']; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'show_block', label: 'Mostrar Bloque', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>, color: 'text-[#2A5A8C]' },
    { type: 'branch', label: 'Ramificación', icon: <GitBranch size={16} />, color: 'text-blue-500' },
    { type: 'randomizer', label: 'Aleatorizador', icon: <Shuffle size={16} />, color: 'text-pink-500' },
    { type: 'embedded_data', label: 'Datos Embebidos', icon: <Database size={16} />, color: 'text-purple-500' },
    { type: 'end_survey', label: 'Fin de Encuesta', icon: <StopCircle size={16} />, color: 'text-red-500' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-[#2A5A8C] hover:text-[#1B3A5C] transition-colors ${compact ? 'text-xs' : 'text-sm font-medium'}`}
      >
        <Plus size={compact ? 14 : 16} />
        Agregar Elemento
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 w-52 z-20 animate-fade-in">
          {items.map(item => (
            <button
              key={item.type}
              onClick={() => { onAdd(item.type); setOpen(false); }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-[#F8F9FB] flex items-center gap-2"
            >
              <span className={item.color}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
