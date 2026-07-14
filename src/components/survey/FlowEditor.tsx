'use client';

import { useState, useCallback, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch, Shuffle, Database, StopCircle, X, GripVertical } from 'lucide-react';
import type { FlowElement, Block, EmbeddedDataField, BranchCondition } from '@/types/survey';
import { createFlowElement, createId } from '@/lib/survey-utils';

interface FlowEditorProps {
  flow: FlowElement[];
  blocks: Block[];
  onChange: (flow: FlowElement[]) => void;
}

export default function FlowEditor({ flow, blocks, onChange }: FlowEditorProps) {
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedElements);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedElements(next);
  };

  const findElementById = (elements: FlowElement[], id: string): FlowElement | null => {
    for (const el of elements) {
      if (el.id === id) return el;
      if (el.children) {
        const found = findElementById(el.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const removeFromTree = (elements: FlowElement[], id: string): { tree: FlowElement[]; removed: FlowElement | null } => {
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].id === id) {
        const removed = elements[i];
        return { tree: [...elements.slice(0, i), ...elements.slice(i + 1)], removed };
      }
      if (elements[i].children) {
        const result = removeFromTree(elements[i].children!, id);
        if (result.removed) {
          const updated = [...elements];
          updated[i] = { ...updated[i], children: result.tree };
          return { tree: updated, removed: result.removed };
        }
      }
    }
    return { tree: elements, removed: null };
  };

  const isDescendantOf = (ancestorId: string, childId: string): boolean => {
    const ancestor = findElementById(flow, ancestorId);
    if (!ancestor || !ancestor.children) return false;
    for (const child of ancestor.children) {
      if (child.id === childId) return true;
      if (child.children && isDescendantOf(child.id, childId)) return true;
    }
    return false;
  };

  const addElement = (type: FlowElement['type'], parentId?: string) => {
    const element = createFlowElement(type);

    if (type === 'show_block' && blocks.length > 0) {
      const getAllUsedBlockIds = (elements: FlowElement[]): string[] => {
        const ids: string[] = [];
        for (const el of elements) {
          if (el.type === 'show_block' && el.blockId) ids.push(el.blockId);
          if (el.children) ids.push(...getAllUsedBlockIds(el.children));
        }
        return ids;
      };
      const usedBlockIds = getAllUsedBlockIds(flow);
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

    if (parentId) {
      const newFlow = structuredClone(flow);
      const parent = findElementById(newFlow, parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(element);
      }
      onChange(newFlow);
    } else {
      onChange([...flow, element]);
    }
  };

  const removeElementById = (id: string) => {
    const { tree } = removeFromTree(flow, id);
    onChange(tree);
  };

  const updateElementById = (id: string, updates: Partial<FlowElement>) => {
    const update = (elements: FlowElement[]): FlowElement[] =>
      elements.map(el => {
        if (el.id === id) return { ...el, ...updates };
        if (el.children) return { ...el, children: update(el.children) };
        return el;
      });
    onChange(update(flow));
  };

  // --- Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    requestAnimationFrame(() => {
      (e.target as HTMLElement).closest('[data-flow-element]')?.classList.add('opacity-40');
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    document.querySelectorAll('[data-flow-element].opacity-40').forEach(el => el.classList.remove('opacity-40'));
    setDraggedId(null);
    setDropTargetKey(null);
  };

  const handleDropBetween = (parentId: string | null, index: number) => {
    if (!draggedId) return;
    if (parentId && (draggedId === parentId || isDescendantOf(draggedId, parentId))) return;

    const { tree, removed } = removeFromTree(flow, draggedId);
    if (!removed) return;

    if (parentId === null) {
      const newFlow = [...tree];
      newFlow.splice(index, 0, removed);
      onChange(newFlow);
    } else {
      const newFlow = structuredClone(tree);
      const parent = findElementById(newFlow, parentId);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.splice(index, 0, removed);
        onChange(newFlow);
      }
    }
    setDraggedId(null);
    setDropTargetKey(null);
  };

  const handleDropIntoContainer = (containerId: string) => {
    if (!draggedId || draggedId === containerId) return;
    if (isDescendantOf(draggedId, containerId)) return;

    const { tree, removed } = removeFromTree(flow, draggedId);
    if (!removed) return;

    const newFlow = structuredClone(tree);
    const container = findElementById(newFlow, containerId);
    if (container) {
      if (!container.children) container.children = [];
      container.children.push(removed);
      onChange(newFlow);
      setExpandedElements(prev => new Set(prev).add(containerId));
    }
    setDraggedId(null);
    setDropTargetKey(null);
  };

  const makeDropZoneProps = (key: string, onDrop: () => void) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' as const; },
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDropTargetKey(key); },
    onDragLeave: (e: React.DragEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const { clientX, clientY } = e;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        if (dropTargetKey === key) setDropTargetKey(null);
      }
    },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); onDrop(); },
  });

  const DropZone = ({ parentId, index }: { parentId: string | null; index: number }) => {
    const key = `between:${parentId ?? 'root'}:${index}`;
    const active = dropTargetKey === key && draggedId !== null;
    return (
      <div
        {...makeDropZoneProps(key, () => handleDropBetween(parentId, index))}
        className="relative"
        style={{ height: active ? 6 : 16, transition: 'height 150ms ease' }}
      >
        {active && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-[#2A5A8C] rounded-full" />
        )}
        <div className="absolute inset-x-0 -top-2 -bottom-2" />
      </div>
    );
  };

  const typeConfig: Record<string, { border: string; bg: string; icon: React.ReactNode; label: string }> = {
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
      label: 'Ramificacion',
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

  const renderElement = (element: FlowElement, parentId: string | null = null) => {
    const isExpanded = expandedElements.has(element.id);
    const hasChildren = element.type === 'branch' || element.type === 'randomizer';
    const style = typeConfig[element.type] || typeConfig.show_block;
    const containerKey = `container:${element.id}`;
    const containerActive = dropTargetKey === containerKey && draggedId !== null && draggedId !== element.id;

    return (
      <div
        key={element.id}
        data-flow-element={element.id}
        className="animate-fade-in"
      >
        <div
          className={`flow-element ${style.border} ${style.bg} border-2 transition-all`}
          style={{
            outline: containerActive ? '2px dashed #2A5A8C' : 'none',
            outlineOffset: 2,
            background: containerActive ? 'rgba(42, 90, 140, 0.06)' : undefined,
          }}
          {...(hasChildren ? makeDropZoneProps(containerKey, () => handleDropIntoContainer(element.id)) : {})}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, element.id)}
                onDragEnd={handleDragEnd}
                className="flex items-center justify-center cursor-grab active:cursor-grabbing text-[#94A3B8] hover:text-[#64748B] p-1 -ml-1"
              >
                <GripVertical size={16} />
              </div>

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
                    onChange={e => updateElementById(element.id, { blockId: e.target.value })}
                    className="ml-2 text-sm bg-transparent border-none outline-none text-[#2A5A8C] font-medium cursor-pointer"
                  >
                    {blocks.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.questions.length} Preguntas)</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <button onClick={() => removeElementById(element.id)} className="p-1.5 rounded hover:bg-white/50 text-red-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
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
                        updateElementById(element.id, { conditions: conds });
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
                      updateElementById(element.id, { conditions: conds });
                    }}
                    placeholder="Variable"
                    className="input-field py-1 text-xs w-28"
                  />
                  <select
                    value={cond.operator}
                    onChange={e => {
                      const conds = [...(element.conditions || [])];
                      conds[ci] = { ...conds[ci], operator: e.target.value as BranchCondition['operator'] };
                      updateElementById(element.id, { conditions: conds });
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
                      updateElementById(element.id, { conditions: conds });
                    }}
                    placeholder="Valor"
                    className="input-field py-1 text-xs w-24"
                  />
                  <button
                    onClick={() => {
                      const conds = (element.conditions || []).filter((_, i) => i !== ci);
                      updateElementById(element.id, { conditions: conds });
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
                  updateElementById(element.id, { conditions: conds });
                }}
                className="text-xs text-[#2A5A8C] flex items-center gap-1"
              >
                <Plus size={12} /> Agregar condicion
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
                  onChange={e => updateElementById(element.id, { randomizerCount: Number(e.target.value) })}
                  className="input-field py-1 text-xs w-16 text-center"
                />
                <span className="text-xs text-[#64748B]">de los siguientes elementos</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#64748B]">
                <input
                  type="checkbox"
                  checked={element.randomizerEvenPresent ?? true}
                  onChange={e => updateElementById(element.id, { randomizerEvenPresent: e.target.checked })}
                  className="rounded border-[#CBD5E1] w-3.5 h-3.5"
                />
                Presentar elementos equitativamente
              </label>
            </div>
          )}

          {/* Embedded data fields */}
          {element.type === 'embedded_data' && (
            <div className="mt-3 pl-9 space-y-3">
              {(element.embeddedData || []).map((field, fi) => (
                <div key={fi} className="space-y-2 p-2 rounded-lg bg-white/60 border border-purple-200">
                  <div className="flex items-center gap-2">
                    <input
                      value={field.name}
                      onChange={e => {
                        const fields = [...(element.embeddedData || [])];
                        fields[fi] = { ...fields[fi], name: e.target.value };
                        updateElementById(element.id, { embeddedData: fields });
                      }}
                      placeholder="Nombre de variable (ej: Tariffs)"
                      className="input-field py-1 text-xs flex-1"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-purple-600 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.randomize ?? false}
                        onChange={e => {
                          const fields = [...(element.embeddedData || [])];
                          const updated = { ...fields[fi], randomize: e.target.checked };
                          if (e.target.checked && (!updated.values || updated.values.length === 0)) {
                            updated.values = [updated.value || '', ''];
                          }
                          fields[fi] = updated;
                          updateElementById(element.id, { embeddedData: fields });
                        }}
                        className="rounded border-[#CBD5E1] w-3.5 h-3.5 accent-purple-600"
                      />
                      Aleatorizar
                    </label>
                    <button
                      onClick={() => {
                        const fields = (element.embeddedData || []).filter((_, i) => i !== fi);
                        updateElementById(element.id, { embeddedData: fields });
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {field.randomize ? (
                    <div className="space-y-1.5 pl-2">
                      <p className="text-[10px] text-purple-500">Se asignara aleatoriamente un valor a cada encuestado. Usar como: <code className="bg-purple-100 px-1 rounded">${`\${e://Field/${field.name || '...'}}`}</code></p>
                      {(field.values || []).map((val, vi) => (
                        <div key={vi} className="flex items-center gap-2">
                          <span className="text-[10px] text-[#94A3B8] w-12 shrink-0">Valor {vi + 1}</span>
                          <input
                            value={val}
                            onChange={e => {
                              const fields = [...(element.embeddedData || [])];
                              const vals = [...(fields[fi].values || [])];
                              vals[vi] = e.target.value;
                              fields[fi] = { ...fields[fi], values: vals };
                              updateElementById(element.id, { embeddedData: fields });
                            }}
                            placeholder={`Valor posible ${vi + 1}`}
                            className="input-field py-1 text-xs flex-1"
                          />
                          {(field.values || []).length > 2 && (
                            <button
                              onClick={() => {
                                const fields = [...(element.embeddedData || [])];
                                const vals = (fields[fi].values || []).filter((_, i) => i !== vi);
                                fields[fi] = { ...fields[fi], values: vals };
                                updateElementById(element.id, { embeddedData: fields });
                              }}
                              className="text-red-400 hover:text-red-600"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const fields = [...(element.embeddedData || [])];
                          const vals = [...(fields[fi].values || []), ''];
                          fields[fi] = { ...fields[fi], values: vals };
                          updateElementById(element.id, { embeddedData: fields });
                        }}
                        className="text-[10px] text-purple-500 flex items-center gap-1 mt-1"
                      >
                        <Plus size={10} /> Agregar valor
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pl-2">
                      <span className="text-[10px] text-[#94A3B8]">Valor:</span>
                      <input
                        value={field.value}
                        onChange={e => {
                          const fields = [...(element.embeddedData || [])];
                          fields[fi] = { ...fields[fi], value: e.target.value };
                          updateElementById(element.id, { embeddedData: fields });
                        }}
                        placeholder="Valor fijo"
                        className="input-field py-1 text-xs flex-1"
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  const fields = [...(element.embeddedData || [])];
                  fields.push({ name: '', value: '' });
                  updateElementById(element.id, { embeddedData: fields });
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
              <DropZone parentId={element.id} index={0} />

              {(element.children || []).map((child, ci) => (
                <div key={child.id}>
                  {renderElement(child, element.id)}
                  <DropZone parentId={element.id} index={ci + 1} />
                </div>
              ))}

              {(!element.children || element.children.length === 0) && !draggedId && (
                <p className="text-xs text-[#94A3B8] italic py-2">
                  Arrastre elementos aqui o use el boton de abajo
                </p>
              )}

              <div className="mt-2">
                <AddElementMenu onAdd={(type) => addElement(type, element.id)} compact />
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

      <DropZone parentId={null} index={0} />

      {flow.map((element, idx) => (
        <div key={element.id}>
          {renderElement(element)}
          <DropZone parentId={null} index={idx + 1} />
        </div>
      ))}

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
    { type: 'branch', label: 'Ramificacion', icon: <GitBranch size={16} />, color: 'text-blue-500' },
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
