'use client';

import { useState } from 'react';
import { GripVertical, Trash2, Copy, Settings, ChevronDown, ChevronUp, Plus, X, ToggleLeft } from 'lucide-react';
import type { Question, QuestionType, QuestionOption } from '@/types/survey';
import { createId, getQuestionTypeLabel } from '@/lib/survey-utils';

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
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#C4A84D] bg-[#C4A84D]/10 px-2 py-0.5 rounded">
                P{index + 1}
              </span>
              <span className="text-xs text-[#64748B]">
                {getQuestionTypeLabel(question.type)}
              </span>
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
