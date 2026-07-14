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

interface DragInfo {
  elementId: string;
  parentId: string | null; // id of the parent container, or null if top-level
}

interface DropTarget {
  type: 'between' | 'into-container';
  parentId: string | null; // null = top-level list, string = inside a container
  index: number; // insertion index
}

export default function FlowEditor({ flow, blocks, onChange }: FlowEditorProps) {
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<DropTarget | null>(null);
  const dragCounterRef = useRef<Map<string, number>>(new Map());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedElements);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedElements(next);
  };

  const addElement = (type: FlowElement['type'], parentId?: string) => {
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

    if (parentId !== undefined) {
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

  const findElementById = (elements: FlowElement[], id: string | null | undefined): FlowElement | null => {
    if (!id) return null;
    for (const el of elements) {
      if (el.id === id) return el;
      if (el.children) {
        const found = findElementById(el.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const findParentId = (elements: FlowElement[], targetId: string, currentParentId: string | null = null): string | null | undefined => {
    for (const el of elements) {
      if (el.id === targetId) return currentParentId;
      if (el.children) {
        const found = findParentId(el.children, targetId, el.id);
        if (found !== undefined) return found;
      }
    }
    return undefined; // not found
  };

  const removeElement = (idx: number, parentId?: string) => {
    if (parentId !== undefined) {
      const newFlow = structuredClone(flow);
      const parent = findElementById(newFlow, parentId);
      if (parent && parent.children) {
        parent.children = parent.children.filter((_, i) => i !== idx);
      }
      onChange(newFlow);
    } else {
      onChange(flow.filter((_, i) => i !== idx));
    }
  };

  const updateElement = (idx: number, updates: Partial<FlowElement>, parentId?: string) => {
    const newFlow = structuredClone(flow);
    if (parentId !== undefined) {
      const parent = findElementById(newFlow, parentId);
      if (parent && parent.children) {
        parent.children[idx] = { ...parent.children[idx], ...updates };
      }
    } else {
      newFlow[idx] = { ...newFlow[idx], ...updates };
    }
    onChange(newFlow);
  };

  // Check if an element is a descendant of (or is) another element
  const isDescendantOf = (elements: FlowElement[], childId: string, ancestorId: string): boolean => {
    if (childId === ancestorId) return true;
    const ancestor = findElementById(elements, ancestorId);
    if (!ancestor || !ancestor.children) return false;
    for (const child of ancestor.children) {
      if (isDescendantOf([child], childId, child.id)) return true;
      if (child.id === childId) return true;
    }
    return false;
  };

  const handleDrop = useCallback((target: DropTarget) => {
    if (!dragInfo) return;

    const newFlow = structuredClone(flow);
    const draggedId = dragInfo.elementId;

    // Prevent dropping a container into itself or its children
    if (target.parentId && isDescendantOf(flow, target.parentId, draggedId)) {
      return;
    }

    // 1. Remove the element from its current position
    let draggedElement: FlowElement | null = null;

    if (dragInfo.parentId === null) {
      const idx = newFlow.findIndex(el => el.id === draggedId);
      if (idx !== -1) {
        draggedElement = newFlow.splice(idx, 1)[0];
      }
    } else {
      const parent = findElementById(newFlow, dragInfo.parentId);
      if (parent && parent.children) {
        const idx = parent.children.findIndex(el => el.id === draggedId);
        if (idx !== -1) {
          draggedElement = parent.children.splice(idx, 1)[0];
        }
      }
    }

    if (!draggedElement) return;

    // 2. Insert at the target position
    if (target.type === 'into-container') {
      // Drop into a container's children
      const container = findElementById(newFlow, target.parentId);
      if (container) {
        if (!container.children) container.children = [];
        container.children.push(draggedElement);
        // Auto-expand the container
        setExpandedElements(prev => {
          const next = new Set(prev);
          next.add(container.id);
          return next;
        });
      }
    } else {
      // Drop between elements
      if (target.parentId === null) {
        // Top-level insertion
        newFlow.splice(target.index, 0, draggedElement);
      } else {
        const parent = findElementById(newFlow, target.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.splice(target.index, 0, draggedElement);
        }
      }
    }

    onChange(newFlow);
  }, [dragInfo, flow, onChange]);

  const handleDragStart = (e: React.DragEvent, elementId: string, parentId: string | null) => {
    e.stopPropagation();
    setDragInfo({ elementId, parentId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', elementId);
    // Set drag image opacity via a timeout so it applies after the snapshot
    const target = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.style.opacity = '0.4';
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDragInfo(null);
    setActiveDropTarget(null);
    dragCounterRef.current.clear();
  };

  const dropTargetKey = (target: DropTarget) =>
    `${target.type}:${target.parentId ?? 'root'}:${target.index}`;

  const isActiveTarget = (target: DropTarget) => {
    if (!activeDropTarget) return false;
    return dropTargetKey(activeDropTarget) === dropTargetKey(target);
  };

  // Drop zone between elements
  const renderDropZone = (parentId: string | null, index: number) => {
    const target: DropTarget = { type: 'between', parentId, index };
    const key = dropTargetKey(target);
    const isActive = isActiveTarget(target);

    return (
      <div
        key={`dz-${key}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const count = (dragCounterRef.current.get(key) || 0) + 1;
          dragCounterRef.current.set(key, count);
          if (count === 1) setActiveDropTarget(target);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          const count = (dragCounterRef.current.get(key) || 0) - 1;
          dragCounterRef.current.set(key, count);
          if (count <= 0) {
            dragCounterRef.current.set(key, 0);
            if (isActiveTarget(target)) setActiveDropTarget(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounterRef.current.set(key, 0);
          handleDrop(target);
          setActiveDropTarget(null);
          setDragInfo(null);
        }}
        style={{
          height: isActive ? 4 : 12,
          margin: isActive ? '4px 0' : '0',
          transition: 'all 150ms ease',
          borderRadius: 2,
          background: isActive ? '#2A5A8C' : 'transparent',
          position: 'relative',
        }}
      >
        {/* Invisible wider hit area */}
        <div style={{
          position: 'absolute',
          top: -6,
          bottom: -6,
          left: 0,
          right: 0,
        }} />
      </div>
    );
  };

  // Container drop overlay (for dropping INTO a container)
  const containerDropProps = (containerId: string) => {
    const target: DropTarget = { type: 'into-container', parentId: containerId, index: -1 };
    const key = dropTargetKey(target);

    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        const count = (dragCounterRef.current.get(key) || 0) + 1;
        dragCounterRef.current.set(key, count);
        if (count === 1) setActiveDropTarget(target);
      },
      onDragLeave: (e: React.DragEvent) => {
        const count = (dragCounterRef.current.get(key) || 0) - 1;
        dragCounterRef.current.set(key, count);
        if (count <= 0) {
          dragCounterRef.current.set(key, 0);
          if (isActiveTarget(target)) setActiveDropTarget(null);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current.set(key, 0);
        handleDrop(target);
        setActiveDropTarget(null);
        setDragInfo(null);
      },
    };
  };

  const isContainerDropActive = (containerId: string) => {
    if (!activeDropTarget) return false;
    return activeDropTarget.type === 'into-container' && activeDropTarget.parentId === containerId;
  };

  const renderElement = (element: FlowElement, idx: number, parentId: string | null = null, isChild: boolean = false) => {
    const isExpanded = expandedElements.has(element.id);
    const hasChildren = element.type === 'branch' || element.type === 'randomizer';
    const isDragged = dragInfo?.elementId === element.id;

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

    const containerActive = hasChildren && isContainerDropActive(element.id);

    return (
      <div
        key={element.id}
        className="animate-fade-in"
        style={{ opacity: isDragged ? 0.4 : 1, transition: 'opacity 150ms ease' }}
      >
        {/* Connector line between elements */}
        {idx > 0 && <div className="flow-connector" />}

        <div
          className={`flow-element ${style.border} ${style.bg} border-2`}
          style={{
            outline: containerActive ? '2px dashed #2A5A8C' : 'none',
            outlineOffset: 2,
            background: containerActive ? 'rgba(42, 90, 140, 0.06)' : undefined,
            transition: 'outline 150ms ease, background 150ms ease',
          }}
          {...(hasChildren ? containerDropProps(element.id) : {})}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Drag handle */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, element.id, parentId)}
                onDragEnd={handleDragEnd}
                className="flex items-center justify-center cursor-grab active:cursor-grabbing text-[#94A3B8] hover:text-[#64748B] select-none"
                title="Arrastrar para reordenar"
                style={{ touchAction: 'none' }}
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
                    onChange={e => updateElement(idx, { blockId: e.target.value }, parentId ?? undefined)}
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
              <button onClick={() => removeElement(idx, parentId ?? undefined)} className="p-1.5 rounded hover:bg-white/50 text-red-400 hover:text-red-600">
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
                        updateElement(idx, { conditions: conds }, parentId ?? undefined);
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
                      updateElement(idx, { conditions: conds }, parentId ?? undefined);
                    }}
                    placeholder="Variable"
                    className="input-field py-1 text-xs w-28"
                  />
                  <select
                    value={cond.operator}
                    onChange={e => {
                      const conds = [...(element.conditions || [])];
                      conds[ci] = { ...conds[ci], operator: e.target.value as BranchCondition['operator'] };
                      updateElement(idx, { conditions: conds }, parentId ?? undefined);
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
                      updateElement(idx, { conditions: conds }, parentId ?? undefined);
                    }}
                    placeholder="Valor"
                    className="input-field py-1 text-xs w-24"
                  />
                  <button
                    onClick={() => {
                      const conds = (element.conditions || []).filter((_, i) => i !== ci);
                      updateElement(idx, { conditions: conds }, parentId ?? undefined);
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
                  updateElement(idx, { conditions: conds }, parentId ?? undefined);
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
                  onChange={e => updateElement(idx, { randomizerCount: Number(e.target.value) }, parentId ?? undefined)}
                  className="input-field py-1 text-xs w-16 text-center"
                />
                <span className="text-xs text-[#64748B]">de los siguientes elementos</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#64748B]">
                <input
                  type="checkbox"
                  checked={element.randomizerEvenPresent ?? true}
                  onChange={e => updateElement(idx, { randomizerEvenPresent: e.target.checked }, parentId ?? undefined)}
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
                        updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
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
                          updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
                        }}
                        className="rounded border-[#CBD5E1] w-3.5 h-3.5 accent-purple-600"
                      />
                      Aleatorizar
                    </label>
                    <button
                      onClick={() => {
                        const fields = (element.embeddedData || []).filter((_, i) => i !== fi);
                        updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {field.randomize ? (
                    <div className="space-y-1.5 pl-2">
                      <p className="text-[10px] text-purple-500">Se asignará aleatoriamente un valor a cada encuestado. Usar como: <code className="bg-purple-100 px-1 rounded">${`\${e://Field/${field.name || '...'}}`}</code></p>
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
                              updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
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
                                updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
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
                          updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
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
                          updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
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
                  updateElement(idx, { embeddedData: fields }, parentId ?? undefined);
                }}
                className="text-xs text-purple-600 flex items-center gap-1"
              >
                <Plus size={12} /> Agregar campo
              </button>
            </div>
          )}

          {/* Children */}
          {hasChildren && isExpanded && (
            <div
              className="mt-3 pl-4 border-l-2 border-dashed border-[#CBD5E1]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drop zone before first child */}
              {dragInfo && renderDropZone(element.id, 0)}

              {(element.children || []).map((child, ci) => (
                <div key={child.id}>
                  {renderElement(child, ci, element.id, true)}
                  {/* Drop zone after each child */}
                  {dragInfo && renderDropZone(element.id, ci + 1)}
                </div>
              ))}

              {/* Empty container drop message */}
              {(!element.children || element.children.length === 0) && !dragInfo && (
                <p className="text-xs text-[#94A3B8] italic py-2">
                  Arrastre elementos aquí o use el botón de abajo
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

      {/* Drop zone before first top-level element */}
      {dragInfo && renderDropZone(null, 0)}

      {flow.map((element, idx) => (
        <div key={element.id}>
          {renderElement(element, idx)}
          {/* Drop zone after each top-level element */}
          {dragInfo && renderDropZone(null, idx + 1)}
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
