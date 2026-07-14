'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowLeft, Save, Eye, Play, Square, Settings, LayoutList, GitBranch as FlowIcon, BarChart3, Share2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Survey, Block, Question, QuestionType } from '@/types/survey';
import { createBlock, createQuestion, createId, getQuestionTypeLabel } from '@/lib/survey-utils';
import QuestionEditor from '@/components/survey/QuestionEditor';
import FlowEditor from '@/components/survey/FlowEditor';
import RichTextEditor from '@/components/survey/RichTextEditor';

type Tab = 'builder' | 'flow' | 'settings' | 'preview';

const QUESTION_TYPES: { type: QuestionType; label: string; category: string }[] = [
  { type: 'multiple_choice', label: 'Opción Múltiple', category: 'Básicas' },
  { type: 'multi_select', label: 'Selección Múltiple', category: 'Básicas' },
  { type: 'text_entry', label: 'Entrada de Texto', category: 'Básicas' },
  { type: 'essay', label: 'Texto Largo', category: 'Básicas' },
  { type: 'dropdown', label: 'Menú Desplegable', category: 'Básicas' },
  { type: 'yes_no', label: 'Sí / No', category: 'Básicas' },
  { type: 'likert', label: 'Escala Likert', category: 'Escalas' },
  { type: 'slider', label: 'Deslizador', category: 'Escalas' },
  { type: 'nps', label: 'Net Promoter Score', category: 'Escalas' },
  { type: 'matrix', label: 'Matriz / Tabla', category: 'Avanzadas' },
  { type: 'rank_order', label: 'Ordenar por Rango', category: 'Avanzadas' },
  { type: 'constant_sum', label: 'Suma Constante', category: 'Avanzadas' },
  { type: 'date', label: 'Fecha', category: 'Avanzadas' },
  { type: 'file_upload', label: 'Subir Archivo', category: 'Avanzadas' },
  { type: 'image_choice', label: 'Selección con Imagen', category: 'Avanzadas' },
];

export default function EditClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('surveyId') || '';

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('builder');
  const [selectedBlockIdx, setSelectedBlockIdx] = useState(0);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && surveyId) loadSurvey();
  }, [user, surveyId]);

  const loadSurvey = async () => {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (error || !data) {
      toast.error('Encuesta no encontrada');
      router.push('/dashboard');
      return;
    }

    setSurvey(data as unknown as Survey);
    setLoading(false);
  };

  const savingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSurvey = useCallback(async (silent = false) => {
    if (!survey || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const { error } = await supabase
      .from('surveys')
      .update({
        title: survey.title,
        description: survey.description,
        status: survey.status,
        blocks: survey.blocks as unknown as Record<string, unknown>[],
        flow: survey.flow as unknown as Record<string, unknown>[],
        settings: survey.settings as unknown as Record<string, unknown>,
      })
      .eq('id', survey.id);

    if (error) {
      if (!silent) toast.error('Error al guardar');
    } else {
      if (!silent) toast.success('Guardado');
      setHasChanges(false);
    }
    savingRef.current = false;
    setSaving(false);
  }, [survey]);

  useEffect(() => {
    if (!hasChanges || !survey) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveSurvey(true);
    }, 2000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [hasChanges, survey, saveSurvey]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const updateSurvey = (updates: Partial<Survey>) => {
    if (!survey) return;
    setSurvey({ ...survey, ...updates });
    setHasChanges(true);
  };

  const addBlock = () => {
    if (!survey) return;
    const newBlock = createBlock(`Bloque ${survey.blocks.length + 1}`);
    updateSurvey({
      blocks: [...survey.blocks, newBlock],
      flow: [...survey.flow, { id: createId(), type: 'show_block', blockId: newBlock.id }],
    });
    setSelectedBlockIdx(survey.blocks.length);
  };

  const deleteBlock = (idx: number) => {
    if (!survey || survey.blocks.length <= 1) return;
    const blockId = survey.blocks[idx].id;
    updateSurvey({
      blocks: survey.blocks.filter((_, i) => i !== idx),
      flow: survey.flow.filter(f => f.blockId !== blockId),
    });
    setSelectedBlockIdx(Math.max(0, idx - 1));
  };

  const updateBlock = (idx: number, updates: Partial<Block>) => {
    if (!survey) return;
    const blocks = [...survey.blocks];
    blocks[idx] = { ...blocks[idx], ...updates };
    updateSurvey({ blocks });
  };

  const addQuestion = (type: QuestionType) => {
    if (!survey) return;
    const question = createQuestion(type);
    const blocks = [...survey.blocks];
    blocks[selectedBlockIdx] = {
      ...blocks[selectedBlockIdx],
      questions: [...blocks[selectedBlockIdx].questions, question],
    };
    updateSurvey({ blocks });
    setShowAddQuestion(false);
  };

  const updateQuestion = (qIdx: number, question: Question) => {
    if (!survey) return;
    const blocks = [...survey.blocks];
    const questions = [...blocks[selectedBlockIdx].questions];
    questions[qIdx] = question;
    blocks[selectedBlockIdx] = { ...blocks[selectedBlockIdx], questions };
    updateSurvey({ blocks });
  };

  const deleteQuestion = (qIdx: number) => {
    if (!survey) return;
    const blocks = [...survey.blocks];
    blocks[selectedBlockIdx] = {
      ...blocks[selectedBlockIdx],
      questions: blocks[selectedBlockIdx].questions.filter((_, i) => i !== qIdx),
    };
    updateSurvey({ blocks });
  };

  const duplicateQuestion = (qIdx: number) => {
    if (!survey) return;
    const blocks = [...survey.blocks];
    const original = blocks[selectedBlockIdx].questions[qIdx];
    const duplicate = { ...original, id: createId() };
    const questions = [...blocks[selectedBlockIdx].questions];
    questions.splice(qIdx + 1, 0, duplicate);
    blocks[selectedBlockIdx] = { ...blocks[selectedBlockIdx], questions };
    updateSurvey({ blocks });
  };

  const toggleStatus = async () => {
    if (!survey) return;
    const newStatus = survey.status === 'active' ? 'closed' : survey.status === 'closed' ? 'draft' : 'active';
    updateSurvey({ status: newStatus });
    const { error } = await supabase.from('surveys').update({ status: newStatus }).eq('id', survey.id);
    if (error) toast.error('Error al cambiar estado');
    else toast.success(newStatus === 'active' ? 'Encuesta activada' : newStatus === 'closed' ? 'Encuesta cerrada' : 'Encuesta en borrador');
  };

  const allQuestions = survey?.blocks.flatMap(b => b.questions) || [];

  if (loading || authLoading || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
      </div>
    );
  }

  const currentBlock = survey.blocks[selectedBlockIdx];

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button onClick={() => router.push('/dashboard')} className="p-2 rounded-lg hover:bg-[#F0F2F5] text-[#64748B] shrink-0">
              <ArrowLeft size={18} />
            </button>
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-7 w-auto shrink-0" />
            <div className="border-l border-[#E2E8F0] pl-3 ml-1 flex-1 min-w-0">
              <input
                value={survey.title}
                onChange={e => updateSurvey({ title: e.target.value })}
                className="text-sm font-semibold text-[#1A202C] bg-transparent border-none outline-none w-full"
              />
            </div>
            <span className={`badge ${survey.status === 'active' ? 'badge-active' : survey.status === 'closed' ? 'badge-closed' : 'badge-draft'}`}>
              {survey.status === 'active' ? 'Activo' : survey.status === 'closed' ? 'Cerrado' : 'Borrador'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => {
              const pathIdx = window.location.pathname.indexOf('/survey/');
              const basePath = pathIdx > 0 ? window.location.pathname.substring(0, pathIdx) : '';
              window.open(`${basePath}/respond?surveyId=${survey.id}`, '_blank');
            }} className="btn-secondary text-xs py-1.5 px-3">
              <Eye size={14} /> Vista Previa
            </button>
            <button onClick={toggleStatus} className={`text-xs py-1.5 px-3 rounded-lg font-medium flex items-center gap-1.5 ${
              survey.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}>
              {survey.status === 'active' ? <><Square size={14} /> Cerrar</> : <><Play size={14} /> Activar</>}
            </button>
            <button onClick={() => saveSurvey(false)} disabled={saving || !hasChanges} className="btn-primary text-xs py-1.5 px-4 disabled:opacity-40">
              {saving ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : <Save size={14} />}
              Guardar
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 flex gap-0 border-t border-[#F1F5F9]">
          {([
            { key: 'builder' as Tab, label: 'Encuesta', icon: <LayoutList size={15} /> },
            { key: 'flow' as Tab, label: 'Flujo', icon: <FlowIcon size={15} /> },
            { key: 'settings' as Tab, label: 'Opciones', icon: <Settings size={15} /> },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#1B3A5C] text-[#1B3A5C]'
                  : 'border-transparent text-[#64748B] hover:text-[#1B3A5C]'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <button
            onClick={() => router.push(`/survey/_/distribute?surveyId=${survey.id}`)}
            className="px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 border-transparent text-[#64748B] hover:text-[#1B3A5C] transition-colors"
          >
            <Share2 size={15} /> Distribuir
          </button>
          <button
            onClick={() => router.push(`/survey/_/results?surveyId=${survey.id}`)}
            className="px-4 py-2.5 text-sm font-medium flex items-center gap-1.5 border-b-2 border-transparent text-[#64748B] hover:text-[#1B3A5C] transition-colors"
          >
            <BarChart3 size={15} /> Resultados
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Builder Tab */}
        {activeTab === 'builder' && (
          <>
            {/* Block Sidebar */}
            <aside className="w-64 bg-white border-r border-[#E2E8F0] flex-shrink-0 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1B3A5C]">Bloques</h3>
                  <button onClick={addBlock} className="p-1 rounded hover:bg-[#F0F2F5] text-[#2A5A8C]" title="Agregar bloque">
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-1">
                  {survey.blocks.map((block, idx) => (
                    <div
                      key={block.id}
                      onClick={() => setSelectedBlockIdx(idx)}
                      className={`group px-3 py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                        selectedBlockIdx === idx
                          ? 'bg-[#1B3A5C] text-white'
                          : 'hover:bg-[#F0F2F5] text-[#1A202C]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{block.name}</p>
                        <p className={`text-xs mt-0.5 ${selectedBlockIdx === idx ? 'text-white/60' : 'text-[#94A3B8]'}`}>
                          {block.type === 'welcome' ? 'Página de inicio' : `${block.questions.length} pregunta${block.questions.length !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      {survey.blocks.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteBlock(idx); }}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                            selectedBlockIdx === idx ? 'hover:bg-white/20 text-white/60' : 'hover:bg-red-50 text-red-400'
                          }`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto py-6 px-6">
                {currentBlock.type === 'welcome' ? (
                  <>
                    {/* Welcome Block Editor */}
                    <div className="mb-6">
                      <input
                        value={currentBlock.name}
                        onChange={e => updateBlock(selectedBlockIdx, { name: e.target.value })}
                        className="text-xl font-bold text-[#1B3A5C] bg-transparent border-none outline-none font-[Georgia] w-full"
                      />
                    </div>

                    {/* Logo Toggle */}
                    <div className="card mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png"
                            alt="IPADE"
                            className="h-12 w-auto"
                          />
                          <div>
                            <p className="text-sm font-semibold text-[#1B3A5C]">Logo IPADE Business School</p>
                            <p className="text-xs text-[#94A3B8]">Se mostrará al inicio de la encuesta</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentBlock.showLogo !== false}
                            onChange={e => updateBlock(selectedBlockIdx, { showLogo: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-[#E2E8F0] peer-checked:bg-[#1B3A5C] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
                        </label>
                      </div>
                    </div>

                    {/* Rich Text Content */}
                    <div className="card">
                      <label className="block text-sm font-semibold text-[#1B3A5C] mb-3">Mensaje de Bienvenida e Instrucciones</label>
                      <RichTextEditor
                        value={currentBlock.welcomeContent || ''}
                        onChange={html => updateBlock(selectedBlockIdx, { welcomeContent: html })}
                        placeholder="Escribe el mensaje de bienvenida e instrucciones para los encuestados..."
                      />
                    </div>

                    {/* Preview */}
                    <div className="mt-8">
                      <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Vista previa</p>
                      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-[#0F2440] to-[#1B3A5C] px-8 py-8 text-white">
                          {currentBlock.showLogo !== false && (
                            <div className="flex items-center gap-3 mb-4">
                              <img
                                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png"
                                alt="IPADE"
                                className="h-10 w-auto"
                              />
                              <span className="text-sm font-medium text-white/70">IPADE Business School</span>
                            </div>
                          )}
                          <h2 className="text-2xl font-bold font-[Georgia]">{survey.title}</h2>
                          {survey.description && <p className="text-sm text-white/80 mt-1">{survey.description}</p>}
                        </div>
                        <div className="px-8 py-6">
                          <div
                            className="prose prose-sm max-w-none text-[#1A202C]"
                            dangerouslySetInnerHTML={{ __html: currentBlock.welcomeContent || '<p class="text-[#94A3B8]">El mensaje de bienvenida aparecerá aquí...</p>' }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Standard Block Editor */}
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex-1">
                        <input
                          value={currentBlock.name}
                          onChange={e => updateBlock(selectedBlockIdx, { name: e.target.value })}
                          className="text-xl font-bold text-[#1B3A5C] bg-transparent border-none outline-none font-[Georgia] w-full"
                        />
                        <input
                          value={currentBlock.description || ''}
                          onChange={e => updateBlock(selectedBlockIdx, { description: e.target.value })}
                          placeholder="Descripción del bloque (opcional)"
                          className="text-sm text-[#64748B] bg-transparent border-none outline-none w-full mt-1 placeholder:text-[#CBD5E1]"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#64748B] bg-[#F8F9FB] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
                        <input
                          type="checkbox"
                          checked={currentBlock.randomizeQuestions || false}
                          onChange={e => updateBlock(selectedBlockIdx, { randomizeQuestions: e.target.checked })}
                          className="rounded border-[#CBD5E1] w-3.5 h-3.5"
                        />
                        Aleatorizar preguntas
                      </label>
                    </div>

                    {/* Questions */}
                    <div className="space-y-4">
                      {currentBlock.questions.map((question, qIdx) => (
                        <QuestionEditor
                          key={question.id}
                          question={question}
                          index={qIdx}
                          onChange={(q) => updateQuestion(qIdx, q)}
                          onDelete={() => deleteQuestion(qIdx)}
                          onDuplicate={() => duplicateQuestion(qIdx)}
                          allQuestions={allQuestions}
                        />
                      ))}
                    </div>

                    {/* Add Question */}
                    <div className="mt-6 relative">
                      <button
                        onClick={() => setShowAddQuestion(!showAddQuestion)}
                        className="btn-secondary w-full justify-center py-3 border-dashed border-2"
                      >
                        <Plus size={18} /> Agregar Pregunta
                      </button>

                      {showAddQuestion && (
                        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-[#E2E8F0] p-4 z-20 animate-fade-in">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-[#1B3A5C]">Tipo de Pregunta</h4>
                            <button onClick={() => setShowAddQuestion(false)} className="text-[#94A3B8] hover:text-[#64748B]">
                              <span className="text-lg">&times;</span>
                            </button>
                          </div>
                          {['Básicas', 'Escalas', 'Avanzadas'].map(category => (
                            <div key={category} className="mb-3">
                              <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2">{category}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {QUESTION_TYPES.filter(q => q.category === category).map(qt => (
                                  <button
                                    key={qt.type}
                                    onClick={() => addQuestion(qt.type)}
                                    className="text-left px-3 py-2 rounded-lg hover:bg-[#F0F2F5] text-sm text-[#1A202C] transition-colors border border-transparent hover:border-[#E2E8F0]"
                                  >
                                    {qt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </main>
          </>
        )}

        {/* Flow Tab */}
        {activeTab === 'flow' && (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto py-6 px-6">
              <FlowEditor
                flow={survey.flow}
                blocks={survey.blocks}
                onChange={(flow) => updateSurvey({ flow })}
              />
            </div>
          </main>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto py-6 px-6 space-y-6">
              <div className="card">
                <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia] mb-4">Configuración General</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Título de la Encuesta</label>
                    <input value={survey.title} onChange={e => updateSurvey({ title: e.target.value })} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Descripción</label>
                    <textarea value={survey.description || ''} onChange={e => updateSurvey({ description: e.target.value })} className="input-field" rows={3} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Idioma</label>
                    <select value={survey.settings.language} onChange={e => updateSurvey({ settings: { ...survey.settings, language: e.target.value } })} className="input-field">
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia] mb-4">Recopilación de Datos</h3>
                <div className="space-y-3">
                  {[
                    { key: 'collectIp' as const, label: 'Recopilar dirección IP del encuestado' },
                    { key: 'collectGeoLocation' as const, label: 'Recopilar ubicación geográfica' },
                    { key: 'allowMultipleResponses' as const, label: 'Permitir múltiples respuestas del mismo dispositivo' },
                    { key: 'showProgressBar' as const, label: 'Mostrar barra de progreso' },
                    { key: 'showQuestionNumbers' as const, label: 'Mostrar números de pregunta' },
                    { key: 'requireAllQuestions' as const, label: 'Requerir todas las preguntas' },
                  ].map(setting => (
                    <label key={setting.key} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#F8F9FB] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={survey.settings[setting.key] as boolean}
                        onChange={e => updateSurvey({ settings: { ...survey.settings, [setting.key]: e.target.checked } })}
                        className="rounded border-[#CBD5E1] w-4 h-4"
                      />
                      <span className="text-sm">{setting.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia] mb-4">Mensajes</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Mensaje de agradecimiento</label>
                    <textarea
                      value={survey.settings.thankYouMessage}
                      onChange={e => updateSurvey({ settings: { ...survey.settings, thankYouMessage: e.target.value } })}
                      className="input-field" rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Mensaje de encuesta cerrada</label>
                    <textarea
                      value={survey.settings.closedMessage}
                      onChange={e => updateSurvey({ settings: { ...survey.settings, closedMessage: e.target.value } })}
                      className="input-field" rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia] mb-4">Seguridad</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Fecha de expiración (opcional)</label>
                    <input
                      type="datetime-local"
                      value={survey.settings.expiresAt || ''}
                      onChange={e => updateSurvey({ settings: { ...survey.settings, expiresAt: e.target.value } })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Máximo de respuestas (opcional)</label>
                    <input
                      type="number"
                      value={survey.settings.maxResponses || ''}
                      onChange={e => updateSurvey({ settings: { ...survey.settings, maxResponses: Number(e.target.value) || undefined } })}
                      className="input-field w-32"
                      placeholder="Sin límite"
                    />
                  </div>
                  <label className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#F8F9FB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={survey.settings.passwordProtected || false}
                      onChange={e => updateSurvey({ settings: { ...survey.settings, passwordProtected: e.target.checked } })}
                      className="rounded border-[#CBD5E1] w-4 h-4"
                    />
                    <span className="text-sm">Proteger con contraseña</span>
                  </label>
                  {survey.settings.passwordProtected && (
                    <input
                      type="text"
                      value={survey.settings.password || ''}
                      onChange={e => updateSurvey({ settings: { ...survey.settings, password: e.target.value } })}
                      className="input-field"
                      placeholder="Contraseña de acceso"
                    />
                  )}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
