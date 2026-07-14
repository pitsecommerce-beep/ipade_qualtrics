'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Download, RefreshCw, Users, Clock, CheckCircle, Trash2, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Survey, SurveyResponse, QuestionType } from '@/types/survey';

export default function ResultsClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('surveyId') || '';

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && surveyId) loadData();
  }, [user, surveyId]);

  const loadData = async () => {
    setLoading(true);
    const [surveyRes, responsesRes] = await Promise.all([
      supabase.from('surveys').select('*').eq('id', surveyId).single(),
      supabase.from('survey_responses').select('*').eq('survey_id', surveyId).order('started_at', { ascending: false }),
    ]);

    if (surveyRes.data) setSurvey(surveyRes.data as unknown as Survey);
    if (responsesRes.data) setResponses(responsesRes.data as unknown as SurveyResponse[]);
    setLoading(false);
  };

  const deleteResponse = async (responseId: string) => {
    setDeletingId(responseId);
    setConfirmDeleteId(null);
    const { error } = await supabase.from('survey_responses').delete().eq('id', responseId);
    if (error) {
      toast.error('Error al eliminar la respuesta. Verifica los permisos en Supabase.');
    } else {
      setResponses(prev => prev.filter(r => r.id !== responseId));
      toast.success('Respuesta eliminada');
    }
    setDeletingId(null);
  };

  const exportCSV = () => {
    if (!survey || responses.length === 0) return;

    const allQuestions = survey.blocks.flatMap(b => b.questions);

    const collectEmbeddedFields = (elements: typeof survey.flow): string[] => {
      const names: string[] = [];
      for (const el of elements) {
        if (el.type === 'embedded_data' && el.embeddedData) {
          for (const f of el.embeddedData) {
            if (f.name && !names.includes(f.name)) names.push(f.name);
          }
        }
        if (el.children) names.push(...collectEmbeddedFields(el.children).filter(n => !names.includes(n)));
      }
      return names;
    };
    const embeddedFieldNames = collectEmbeddedFields(survey.flow);

    const headers = [
      'ID Respuesta', 'IP', 'Inicio', 'Completado', 'Estado',
      ...embeddedFieldNames.map(n => `[Variable] ${n}`),
      ...allQuestions.map(q => q.text || q.id),
    ];

    const rows = responses.map(r => {
      const row: string[] = [
        r.id,
        r.respondent_ip || '',
        r.started_at,
        r.completed_at || '',
        r.completed_at ? 'Completa' : 'Parcial',
      ];
      for (const fieldName of embeddedFieldNames) {
        row.push(r.embedded_data?.[fieldName] || '');
      }
      for (const q of allQuestions) {
        const answer = r.answers[q.id];
        if (!answer) {
          row.push('');
        } else if (typeof answer.value === 'string' || typeof answer.value === 'number') {
          row.push(String(answer.value));
        } else if (Array.isArray(answer.value)) {
          row.push(answer.value.join('; '));
        } else {
          row.push(JSON.stringify(answer.value));
        }
      }
      return row;
    });

    const quoteCsvField = (v: string) => `"${v.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`;
    const csv = [headers.map(quoteCsvField).join(','), ...rows.map(r => r.map(quoteCsvField).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey.title}_respuestas.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getQuestionSummary = (questionId: string, type: QuestionType) => {
    const vals = responses.map(r => r.answers[questionId]?.value).filter(Boolean);
    if (vals.length === 0) return null;

    if (['multiple_choice', 'yes_no', 'likert', 'dropdown'].includes(type)) {
      const counts: Record<string, number> = {};
      for (const v of vals) {
        const key = String(v);
        counts[key] = (counts[key] || 0) + 1;
      }
      return { type: 'distribution' as const, counts, total: vals.length };
    }

    if (type === 'multi_select') {
      const counts: Record<string, number> = {};
      for (const v of vals) {
        if (Array.isArray(v)) {
          for (const item of v) {
            counts[item] = (counts[item] || 0) + 1;
          }
        }
      }
      return { type: 'distribution' as const, counts, total: vals.length };
    }

    if (type === 'nps') {
      const numbers = vals.filter(v => typeof v === 'number') as number[];
      const detractors = numbers.filter(n => n <= 6).length;
      const passives = numbers.filter(n => n >= 7 && n <= 8).length;
      const promoters = numbers.filter(n => n >= 9).length;
      const npsScore = Math.round(((promoters - detractors) / numbers.length) * 100);
      return { type: 'nps' as const, detractors, passives, promoters, score: npsScore, total: numbers.length };
    }

    if (type === 'slider') {
      const numbers = vals.filter(v => typeof v === 'number') as number[];
      const avg = numbers.reduce((s, n) => s + n, 0) / numbers.length;
      return { type: 'average' as const, average: avg, min: Math.min(...numbers), max: Math.max(...numbers), total: numbers.length };
    }

    if (['text_entry', 'essay'].includes(type)) {
      return { type: 'text' as const, values: vals as string[], total: vals.length };
    }

    return { type: 'raw' as const, values: vals, total: vals.length };
  };

  if (loading || authLoading || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
      </div>
    );
  }

  const completedResponses = responses.filter(r => r.completed_at);
  const partialResponses = responses.filter(r => !r.completed_at);
  const completedCount = completedResponses.length;
  const allQuestions = survey.blocks.flatMap(b => b.questions);

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/survey/_/edit?surveyId=${surveyId}`)} className="p-2 rounded-lg hover:bg-[#F0F2F5] text-[#64748B]">
              <ArrowLeft size={18} />
            </button>
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-[#1B3A5C] border-l border-[#E2E8F0] pl-3 ml-1">{survey.title} — Resultados</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="btn-secondary text-xs py-1.5 px-3">
              <RefreshCw size={14} /> Actualizar
            </button>
            <button onClick={exportCSV} disabled={responses.length === 0} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40">
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Users size={22} className="text-[#2A5A8C]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1B3A5C]">{completedCount}</p>
              <p className="text-sm text-[#64748B]">Completas{partialResponses.length > 0 && ` · ${partialResponses.length} parcial${partialResponses.length > 1 ? 'es' : ''}`}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1B3A5C]">{allQuestions.length}</p>
              <p className="text-sm text-[#64748B]">Preguntas</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
              <Clock size={22} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#1B3A5C]">
                {completedCount > 0 ? new Date(responses[0].completed_at!).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—'}
              </p>
              <p className="text-sm text-[#64748B]">Última respuesta</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-[#E2E8F0] w-fit">
          <button onClick={() => setView('summary')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'summary' ? 'bg-[#1B3A5C] text-white' : 'text-[#64748B]'}`}>
            Resumen
          </button>
          <button onClick={() => setView('individual')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${view === 'individual' ? 'bg-[#1B3A5C] text-white' : 'text-[#64748B]'}`}>
            Respuestas Individuales
          </button>
        </div>

        {completedCount === 0 ? (
          <div className="card text-center py-16">
            <Users size={48} className="text-[#CBD5E1] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#1B3A5C]">Sin respuestas aún</h3>
            <p className="text-sm text-[#64748B] mt-1">Comparte tu encuesta para comenzar a recopilar datos</p>
          </div>
        ) : view === 'summary' ? (
          <div className="space-y-6">
            {allQuestions.map((q, qi) => {
              const summary = getQuestionSummary(q.id, q.type);
              if (!summary) return null;

              return (
                <div key={q.id} className="card">
                  <div className="flex items-start gap-2 mb-4">
                    <span className="text-sm font-semibold text-[#C4A84D]">P{qi + 1}</span>
                    <div>
                      <p className="font-medium text-[#1A202C]">{q.text}</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">{summary.total} respuestas</p>
                    </div>
                  </div>

                  {summary.type === 'distribution' && (
                    <div className="space-y-2">
                      {Object.entries(summary.counts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([label, count]) => {
                          const pct = Math.round((count / summary.total) * 100);
                          return (
                            <div key={label}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-[#1A202C]">{label}</span>
                                <span className="text-[#64748B]">{count} ({pct}%)</span>
                              </div>
                              <div className="h-6 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className="h-full bg-[#1B3A5C] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {summary.type === 'nps' && (
                    <div>
                      <div className="text-center mb-4">
                        <p className="text-4xl font-bold text-[#1B3A5C]">{summary.score}</p>
                        <p className="text-sm text-[#64748B]">NPS Score</p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div className="p-3 rounded-lg bg-red-50">
                          <p className="font-semibold text-red-700">{summary.detractors}</p>
                          <p className="text-red-600 text-xs">Detractores (0-6)</p>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-50">
                          <p className="font-semibold text-yellow-700">{summary.passives}</p>
                          <p className="text-yellow-600 text-xs">Pasivos (7-8)</p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-50">
                          <p className="font-semibold text-green-700">{summary.promoters}</p>
                          <p className="text-green-600 text-xs">Promotores (9-10)</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {summary.type === 'average' && (
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-[#1B3A5C]">{summary.average.toFixed(1)}</p>
                        <p className="text-xs text-[#64748B]">Promedio</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-[#64748B]">{summary.min}</p>
                        <p className="text-xs text-[#94A3B8]">Mínimo</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-[#64748B]">{summary.max}</p>
                        <p className="text-xs text-[#94A3B8]">Máximo</p>
                      </div>
                    </div>
                  )}

                  {summary.type === 'text' && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {summary.values.slice(0, 20).map((v, i) => (
                        <div key={i} className="p-3 bg-[#F8F9FB] rounded-lg text-sm text-[#1A202C]">
                          {v}
                        </div>
                      ))}
                      {summary.values.length > 20 && (
                        <p className="text-xs text-[#94A3B8] text-center">y {summary.values.length - 20} más...</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((resp, ri) => (
              <details key={resp.id} className="card group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white text-xs font-semibold">
                      {ri + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1A202C] flex items-center gap-2">
                        Respuesta #{ri + 1}
                        {!resp.completed_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Parcial</span>}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {resp.respondent_ip && `IP: ${resp.respondent_ip} · `}
                        {resp.completed_at ? new Date(resp.completed_at).toLocaleString('es-MX') : `Iniciada ${new Date(resp.started_at).toLocaleString('es-MX')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmDeleteId(resp.id); }}
                      disabled={deletingId === resp.id}
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
                      title="Eliminar respuesta"
                    >
                      {deletingId === resp.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                    <ChevronDown className="w-4 h-4 text-[#94A3B8] group-open:rotate-180 transition-transform" />
                  </div>
                </summary>
                <div className="mt-4 pt-4 border-t border-[#F1F5F9] space-y-3">
                  {allQuestions.map(q => {
                    const answer = resp.answers[q.id];
                    return (
                      <div key={q.id} className="flex gap-2">
                        <p className="text-sm text-[#64748B] font-medium min-w-0 flex-1">{q.text}</p>
                        <p className="text-sm text-[#1A202C] font-medium text-right max-w-[50%]">
                          {!answer ? <span className="text-[#CBD5E1]">—</span> :
                           typeof answer.value === 'string' ? answer.value :
                           typeof answer.value === 'number' ? answer.value :
                           Array.isArray(answer.value) ? answer.value.join(', ') :
                           JSON.stringify(answer.value)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1A202C]">Eliminar respuesta</h3>
                <p className="text-sm text-[#64748B]">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary text-sm py-2 px-4">
                Cancelar
              </button>
              <button
                onClick={() => deleteResponse(confirmDeleteId)}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
