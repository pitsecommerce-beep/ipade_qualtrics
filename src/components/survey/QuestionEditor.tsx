'use client';

import { useState } from 'react';
import { GripVertical, Trash2, Copy, Settings, ChevronDown, ChevronUp, Plus, X, ToggleLeft, RefreshCw } from 'lucide-react';
import type { Question, QuestionType, QuestionOption } from '@/types/survey';
import { createId, createQuestion, getQuestionTypeLabel } from '@/lib/survey-utils';

const OPTION_BASED_TYPES: QuestionType[] = [
  'multiple_choice', 'multi_select', 'dropdown', 'rank_order', 'constant_sum', 'image_choice', 'group_rank', 'likert',
];
const TEXT_BASED_TYPES: QuestionType[] = ['text_entry', 'essay'];

const ALL_TYPES: { type: QuestionType; label: string; category: string }[] = [
  { type: 'multiple_choice', label: 'Opcion Multiple', category: 'Basicas' },
  { type: 'multi_select', label: 'Seleccion Multiple', category: 'Basicas' },
  { type: 'text_entry', label: 'Entrada de Texto', category: 'Basicas' },
  { type: 'essay', label: 'Texto Largo', category: 'Basicas' },
  { type: 'dropdown', label: 'Menu Desplegable', category: 'Basicas' },
  { type: 'yes_no', label: 'Si / No', category: 'Basicas' },
  { type: 'likert', label: 'Escala Likert', category: 'Escalas' },
  { type: 'slider', label: 'Deslizador', category: 'Escalas' },
  { type: 'nps', label: 'Net Promoter Score', category: 'Escalas' },
  { type: 'matrix', label: 'Matriz / Tabla', category: 'Avanzadas' },
  { type: 'rank_order', label: 'Ordenar por Rango', category: 'Avanzadas' },
  { type: 'constant_sum', label: 'Suma Constante', category: 'Avanzadas' },
  { type: 'date', label: 'Fecha', category: 'Avanzadas' },
  { type: 'file_upload', label: 'Subir Archivo', category: 'Avanzadas' },
  { type: 'image_choice', label: 'Seleccion con Imagen', category: 'Avanzadas' },
];

interface QuestionEditorProps {
  question: Question;
  index: number;
  onChange: (question: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  allQuestions: Question[];
}

export default function QuestionEditor({
  question, index, onChange, onDelete, onDuplicate, allQuestions
}: QuestionEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogic, setShowLogic] = useState(false);
  const [showTypeChanger, setShowTypeChanger] = useState(false);

  const changeType = (newType: QuestionType) => {
    if (newType === question.type) {
      setShowTypeChanger(false);
      return;
    }

    const defaults = createQuestion(newType);
    const updated: Question = {
      ...defaults,
      id: question.id,
      text: question.text,
      description: question.description,
      required: question.required,
      displayLogic: question.displayLogic,
      randomizeOptions: question.randomizeOptions,
      allowOther: question.allowOther,
    };

    const oldIsOptionBased = OPTION_BASED_TYPES.includes(question.type) || question.type === 'yes_no';
    const newIsOptionBased = OPTION_BASED_TYPES.includes(newType) || newType === 'yes_no';
    if (oldIsOptionBased && newIsOptionBased && question.options) {
      updated.options = question.options;
    }

    const oldIsTextBased = TEXT_BASED_TYPES.includes(question.type);
    const newIsTextBased = TEXT_BASED_TYPES.includes(newType);
    if (oldIsTextBased && newIsTextBased) {
      updated.placeholder = question.placeholder;
      updated.maxLength = question.maxLength;
    }

    if (question.type === 'slider' && newType === 'nps') {
      updated.npsLeftLabel = question.sliderMinLabel;
      updated.npsRightLabel = question.sliderMaxLabel;
    }
    if (question.type === 'nps' && newType === 'slider') {
      updated.sliderMinLabel = question.npsLeftLabel;
      updated.sliderMaxLabel = question.npsRightLabel;
    }

    onChange(updated);
    setShowTypeChanger(false);
  };

  const updateField = <K extends keyof Question>(field: K, value: Question[K]) => {
    onChange({ ...question, [field]: value });
  };

  const addOption = () => {
    const opts = [...(question.options || [])];
    opts.push({ id: createId(), text: `Opción ${opts.length + 1}` });
    updateField('options', opts);
  };

  const updateOption = (idx: number, text: string) => {
    const opts = [...(question.options || [])];
    opts[idx] = { ...opts[idx], text };
    updateField('options', opts);
  };

  const removeOption = (idx: number) => {
    const opts = (question.options || []).filter((_, i) => i !== idx);
    updateField('options', opts);
  };

  const addMatrixRow = () => {
    const rows = [...(question.matrixRows || [])];
    rows.push({ id: createId(), text: `Fila ${rows.length + 1}` });
    updateField('matrixRows', rows);
  };

  const addMatrixCol = () => {
    const cols = [...(question.matrixColumns || [])];
    cols.push({ id: createId(), text: `Columna ${cols.length + 1}`, value: cols.length + 1 });
    updateField('matrixColumns', cols);
  };

  const hasOptions = ['multiple_choice', 'multi_select', 'dropdown', 'rank_order', 'constant_sum', 'image_choice', 'group_rank', 'yes_no', 'likert'].includes(question.type);
  const hasMatrix = question.type === 'matrix';
  const hasSlider = question.type === 'slider';

  return (
    <div className="question-card animate-fade-in group">
      <div className="flex items-start gap-3">
        <div className="drag-handle mt-1 cursor-grab">
          <GripVertical size={18} className="text-[#94A3B8]" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 relative">
              <span className="text-xs font-semibold text-[#C4A84D] bg-[#C4A84D]/10 px-2 py-0.5 rounded">
                P{index + 1}
              </span>
              <button
                onClick={() => setShowTypeChanger(!showTypeChanger)}
                className="text-xs text-[#64748B] hover:text-[#1B3A5C] flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#F0F2F5] transition-colors"
              >
                {getQuestionTypeLabel(question.type)}
                <ChevronDown size={12} />
              </button>
              {showTypeChanger && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowTypeChanger(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 w-56 z-40 animate-fade-in max-h-72 overflow-y-auto">
                    {(['Basicas', 'Escalas', 'Avanzadas'] as const).map(cat => (
                      <div key={cat}>
                        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase px-3 pt-2 pb-1">{cat}</p>
                        {ALL_TYPES.filter(t => t.category === cat).map(t => (
                          <button
                            key={t.type}
                            onClick={() => changeType(t.type)}
                            className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between ${
                              t.type === question.type
                                ? 'bg-[#1B3A5C]/5 text-[#1B3A5C] font-medium'
                                : 'text-[#1A202C] hover:bg-[#F8F9FB]'
                            }`}
                          >
                            {t.label}
                            {t.type === question.type && <span className="text-[10px] text-[#2A5A8C]">actual</span>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onDuplicate} className="p-1.5 rounded hover:bg-[#F0F2F5] text-[#64748B]" title="Duplicar">
                <Copy size={14} />
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded hover:bg-[#F0F2F5] text-[#64748B]" title="Ajustes">
                <Settings size={14} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600" title="Eliminar">
                <Trash2 size={14} />
              </button>
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded hover:bg-[#F0F2F5] text-[#64748B]">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* Question Text */}
          <textarea
            value={question.text}
            onChange={e => updateField('text', e.target.value)}
            placeholder="Escribe tu pregunta aquí..."
            className="w-full text-base font-medium text-[#1A202C] bg-transparent border-none outline-none resize-none placeholder:text-[#94A3B8]"
            rows={2}
          />

          {/* Description */}
          <input
            value={question.description || ''}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Descripción opcional..."
            className="w-full text-sm text-[#64748B] bg-transparent border-none outline-none mt-1 placeholder:text-[#CBD5E1]"
          />

          {expanded && (
            <div className="mt-4 space-y-3">
              {/* Options for choice-based questions */}
              {hasOptions && (
                <div className="space-y-2">
                  {(question.options || []).map((opt, oidx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-${question.type === 'multi_select' ? 'sm border-2' : 'full border-2'} border-[#CBD5E1] flex-shrink-0`} />
                      <input
                        value={opt.text}
                        onChange={e => updateOption(oidx, e.target.value)}
                        className="flex-1 text-sm bg-transparent border-b border-transparent hover:border-[#E2E8F0] focus:border-[#1B3A5C] outline-none py-1 transition-colors"
                      />
                      {(question.options || []).length > 2 && (
                        <button onClick={() => removeOption(oidx)} className="text-[#CBD5E1] hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addOption} className="text-sm text-[#2A5A8C] hover:text-[#1B3A5C] flex items-center gap-1 mt-2">
                    <Plus size={14} /> Agregar opción
                  </button>
                  {question.type !== 'yes_no' && (
                    <label className="flex items-center gap-2 text-sm text-[#64748B] mt-2">
                      <input
                        type="checkbox"
                        checked={question.allowOther || false}
                        onChange={e => updateField('allowOther', e.target.checked)}
                        className="rounded border-[#CBD5E1]"
                      />
                      Permitir &quot;Otro&quot;
                    </label>
                  )}
                </div>
              )}

              {/* Matrix */}
              {hasMatrix && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-[#64748B] mb-2">Filas</p>
                    {(question.matrixRows || []).map((row, ridx) => (
                      <div key={row.id} className="flex items-center gap-2 mb-1">
                        <input
                          value={row.text}
                          onChange={e => {
                            const rows = [...(question.matrixRows || [])];
                            rows[ridx] = { ...rows[ridx], text: e.target.value };
                            updateField('matrixRows', rows);
                          }}
                          className="flex-1 text-sm input-field py-1.5"
                        />
                        <button
                          onClick={() => updateField('matrixRows', (question.matrixRows || []).filter((_, i) => i !== ridx))}
                          className="text-[#CBD5E1] hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={addMatrixRow} className="text-sm text-[#2A5A8C] flex items-center gap-1 mt-1">
                      <Plus size={14} /> Agregar fila
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#64748B] mb-2">Columnas</p>
                    {(question.matrixColumns || []).map((col, cidx) => (
                      <div key={col.id} className="flex items-center gap-2 mb-1">
                        <input
                          value={col.text}
                          onChange={e => {
                            const cols = [...(question.matrixColumns || [])];
                            cols[cidx] = { ...cols[cidx], text: e.target.value };
                            updateField('matrixColumns', cols);
                          }}
                          className="flex-1 text-sm input-field py-1.5"
                        />
                        <button
                          onClick={() => updateField('matrixColumns', (question.matrixColumns || []).filter((_, i) => i !== cidx))}
                          className="text-[#CBD5E1] hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button onClick={addMatrixCol} className="text-sm text-[#2A5A8C] flex items-center gap-1 mt-1">
                      <Plus size={14} /> Agregar columna
                    </button>
                  </div>
                </div>
              )}

              {/* Slider */}
              {hasSlider && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Mínimo</label>
                    <input type="number" value={question.sliderMin ?? 0} onChange={e => updateField('sliderMin', Number(e.target.value))} className="input-field py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Máximo</label>
                    <input type="number" value={question.sliderMax ?? 100} onChange={e => updateField('sliderMax', Number(e.target.value))} className="input-field py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Paso</label>
                    <input type="number" value={question.sliderStep ?? 1} onChange={e => updateField('sliderStep', Number(e.target.value))} className="input-field py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Etiqueta izquierda</label>
                    <input value={question.sliderMinLabel || ''} onChange={e => updateField('sliderMinLabel', e.target.value)} className="input-field py-1.5 text-sm" placeholder="Mín" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Etiqueta derecha</label>
                    <input value={question.sliderMaxLabel || ''} onChange={e => updateField('sliderMaxLabel', e.target.value)} className="input-field py-1.5 text-sm" placeholder="Máx" />
                  </div>
                </div>
              )}

              {/* NPS */}
              {question.type === 'nps' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Etiqueta izquierda</label>
                    <input value={question.npsLeftLabel || ''} onChange={e => updateField('npsLeftLabel', e.target.value)} className="input-field py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Etiqueta derecha</label>
                    <input value={question.npsRightLabel || ''} onChange={e => updateField('npsRightLabel', e.target.value)} className="input-field py-1.5 text-sm" />
                  </div>
                </div>
              )}

              {/* Text entry */}
              {(question.type === 'text_entry' || question.type === 'essay') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Placeholder</label>
                    <input value={question.placeholder || ''} onChange={e => updateField('placeholder', e.target.value)} className="input-field py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[#64748B] block mb-1">Máx. caracteres</label>
                    <input type="number" value={question.maxLength || ''} onChange={e => updateField('maxLength', Number(e.target.value) || undefined)} className="input-field py-1.5 text-sm" />
                  </div>
                </div>
              )}

              {/* Constant Sum */}
              {question.type === 'constant_sum' && (
                <div>
                  <label className="text-xs text-[#64748B] block mb-1">Total requerido</label>
                  <input type="number" value={question.constantSumTotal || 100} onChange={e => updateField('constantSumTotal', Number(e.target.value))} className="input-field py-1.5 text-sm w-32" />
                </div>
              )}
            </div>
          )}

          {/* Settings panel */}
          {showSettings && (
            <div className="mt-4 p-4 bg-[#F8F9FB] rounded-lg border border-[#E2E8F0] animate-fade-in space-y-3">
              <h4 className="text-sm font-semibold text-[#1B3A5C]">Ajustes de Pregunta</h4>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={e => updateField('required', e.target.checked)}
                  className="rounded border-[#CBD5E1]"
                />
                Respuesta obligatoria
              </label>

              {hasOptions && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={question.randomizeOptions || false}
                    onChange={e => updateField('randomizeOptions', e.target.checked)}
                    className="rounded border-[#CBD5E1]"
                  />
                  Aleatorizar opciones
                </label>
              )}

              {/* Display Logic */}
              <div className="pt-2 border-t border-[#E2E8F0]">
                <button
                  onClick={() => setShowLogic(!showLogic)}
                  className="text-sm text-[#2A5A8C] font-medium flex items-center gap-1"
                >
                  <ToggleLeft size={14} />
                  {showLogic ? 'Ocultar' : 'Configurar'} Lógica de Visualización
                </button>

                {showLogic && (
                  <div className="mt-3 space-y-2">
                    {(question.displayLogic || []).map((cond, ci) => (
                      <div key={ci} className="flex items-center gap-2 flex-wrap">
                        {ci > 0 && (
                          <select
                            value={cond.conjunction || 'and'}
                            onChange={e => {
                              const logic = [...(question.displayLogic || [])];
                              logic[ci] = { ...logic[ci], conjunction: e.target.value as 'and' | 'or' };
                              updateField('displayLogic', logic);
                            }}
                            className="input-field py-1 text-xs w-16"
                          >
                            <option value="and">Y</option>
                            <option value="or">O</option>
                          </select>
                        )}
                        <select
                          value={cond.questionId}
                          onChange={e => {
                            const logic = [...(question.displayLogic || [])];
                            logic[ci] = { ...logic[ci], questionId: e.target.value };
                            updateField('displayLogic', logic);
                          }}
                          className="input-field py-1 text-xs flex-1"
                        >
                          <option value="">Seleccionar pregunta</option>
                          {allQuestions.filter(q => q.id !== question.id).map(q => (
                            <option key={q.id} value={q.id}>{q.text || 'Sin texto'}</option>
                          ))}
                        </select>
                        <select
                          value={cond.operator}
                          onChange={e => {
                            const logic = [...(question.displayLogic || [])];
                            logic[ci] = { ...logic[ci], operator: e.target.value as typeof cond.operator };
                            updateField('displayLogic', logic);
                          }}
                          className="input-field py-1 text-xs w-28"
                        >
                          <option value="equals">Es igual a</option>
                          <option value="not_equals">No es igual a</option>
                          <option value="contains">Contiene</option>
                          <option value="is_answered">Fue respondida</option>
                          <option value="is_not_answered">No fue respondida</option>
                        </select>
                        {!['is_answered', 'is_not_answered'].includes(cond.operator) && (
                          <input
                            value={cond.value}
                            onChange={e => {
                              const logic = [...(question.displayLogic || [])];
                              logic[ci] = { ...logic[ci], value: e.target.value };
                              updateField('displayLogic', logic);
                            }}
                            className="input-field py-1 text-xs w-32"
                            placeholder="Valor"
                          />
                        )}
                        <button
                          onClick={() => {
                            const logic = (question.displayLogic || []).filter((_, i) => i !== ci);
                            updateField('displayLogic', logic.length ? logic : undefined);
                          }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const logic = [...(question.displayLogic || [])];
                        logic.push({ questionId: '', operator: 'equals', value: '', conjunction: 'and' });
                        updateField('displayLogic', logic);
                      }}
                      className="text-xs text-[#2A5A8C] flex items-center gap-1"
                    >
                      <Plus size={12} /> Agregar condición
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Required indicator */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F1F5F9]">
            <label className="flex items-center gap-2 text-xs text-[#64748B]">
              <input
                type="checkbox"
                checked={question.required}
                onChange={e => updateField('required', e.target.checked)}
                className="rounded border-[#CBD5E1] w-3.5 h-3.5"
              />
              Obligatoria
            </label>
            <span className="text-[10px] text-[#CBD5E1]">{question.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
