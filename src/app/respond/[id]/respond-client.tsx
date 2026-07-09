'use client';

import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import type { Survey, Block, Question, ResponseAnswer, FlowElement } from '@/types/survey';
import { shuffleArray, processPipedText, evaluateDisplayLogic, evaluateCondition } from '@/lib/survey-utils';

export default function RespondClient() {
  const params = useParams();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ResponseAnswer>>({});
  const [embeddedData, setEmbeddedData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSurvey();
  }, [surveyId]);

  const loadSurvey = async () => {
    const { data, error: fetchError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (fetchError || !data) {
      setError('Encuesta no encontrada.');
      setLoading(false);
      return;
    }

    const s = data as unknown as Survey;

    if (s.status !== 'active') {
      setError(s.settings.closedMessage || 'Esta encuesta ya no está disponible.');
      setLoading(false);
      return;
    }

    if (s.settings.expiresAt && new Date(s.settings.expiresAt) < new Date()) {
      setError('Esta encuesta ha expirado.');
      setLoading(false);
      return;
    }

    // Process flow to determine block order and embedded data
    const processedFlow = processFlow(s.flow, s.blocks);
    setEmbeddedData(processedFlow.embeddedData);

    setSurvey(s);
    setLoading(false);

    // Start response record
    const { data: resp } = await supabase
      .from('survey_responses')
      .insert({
        survey_id: surveyId,
        respondent_ip: null, // will be set server-side
        started_at: new Date().toISOString(),
        metadata: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenSize: `${screen.width}x${screen.height}`,
        },
      })
      .select('id')
      .single();

    if (resp) setResponseId(resp.id);

    // Fetch respondent IP
    try {
      const publicResp = await fetch('https://api.ipify.org?format=json');
      const publicData = await publicResp.json();
      const ip = publicData.ip;
      if (ip && ip !== 'unknown' && resp) {
        await supabase
          .from('survey_responses')
          .update({ respondent_ip: ip })
          .eq('id', resp.id);
      }
    } catch {}
  };

  const processFlow = (flow: FlowElement[], blocks: Block[]) => {
    const embData: Record<string, string> = {};
    const orderedBlockIds: string[] = [];

    for (const element of flow) {
      if (element.type === 'embedded_data' && element.embeddedData) {
        for (const field of element.embeddedData) {
          const processedValue = processPipedText(field.value, answers, embData);
          embData[field.name] = processedValue;
        }
      }
      if (element.type === 'show_block' && element.blockId) {
        orderedBlockIds.push(element.blockId);
      }
      if (element.type === 'randomizer' && element.children) {
        const shuffled = shuffleArray(element.children);
        const count = element.randomizerCount || shuffled.length;
        for (const child of shuffled.slice(0, count)) {
          if (child.type === 'embedded_data' && child.embeddedData) {
            for (const field of child.embeddedData) {
              embData[field.name] = processPipedText(field.value, answers, embData);
            }
          }
          if (child.type === 'show_block' && child.blockId) {
            orderedBlockIds.push(child.blockId);
          }
        }
      }
      if (element.type === 'branch' && element.conditions && element.children) {
        const conditionsMet = element.conditions.every(c =>
          evaluateCondition(c, answers, embData)
        );
        if (conditionsMet) {
          for (const child of element.children) {
            if (child.type === 'embedded_data' && child.embeddedData) {
              for (const field of child.embeddedData) {
                embData[field.name] = processPipedText(field.value, answers, embData);
              }
            }
            if (child.type === 'show_block' && child.blockId) {
              orderedBlockIds.push(child.blockId);
            }
          }
        }
      }
    }

    return { orderedBlockIds, embeddedData: embData };
  };

  const orderedBlocks = useMemo(() => {
    if (!survey) return [];
    const result = processFlow(survey.flow, survey.blocks);
    const blocks: Block[] = [];
    for (const bid of result.orderedBlockIds) {
      const block = survey.blocks.find(b => b.id === bid);
      if (block) {
        let questions = [...block.questions];
        if (block.randomizeQuestions) {
          questions = shuffleArray(questions);
        }
        questions = questions.map(q => {
          if (q.randomizeOptions && q.options) {
            return { ...q, options: shuffleArray(q.options) };
          }
          return q;
        });
        blocks.push({ ...block, questions });
      }
    }
    // If no blocks from flow, show all
    if (blocks.length === 0) {
      return survey.blocks;
    }
    return blocks;
  }, [survey, answers]);

  const visibleQuestions = useMemo(() => {
    if (!orderedBlocks[currentPageIdx]) return [];
    return orderedBlocks[currentPageIdx].questions.filter(q => {
      if (!q.displayLogic || q.displayLogic.length === 0) return true;
      return evaluateDisplayLogic(q.displayLogic, answers);
    });
  }, [orderedBlocks, currentPageIdx, answers]);

  const totalPages = orderedBlocks.length;
  const progress = totalPages > 0 ? ((currentPageIdx + 1) / totalPages) * 100 : 0;

  const setAnswer = (questionId: string, question: Question, value: ResponseAnswer['value']) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, questionType: question.type, value },
    }));
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const validatePage = (): boolean => {
    const errors: Record<string, string> = {};
    for (const q of visibleQuestions) {
      if (q.required || survey?.settings.requireAllQuestions) {
        const answer = answers[q.id];
        if (!answer || answer.value === '' || answer.value === undefined ||
            (Array.isArray(answer.value) && answer.value.length === 0)) {
          errors[q.id] = 'Esta pregunta es obligatoria';
        }
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validatePage()) return;
    if (currentPageIdx < totalPages - 1) {
      setCurrentPageIdx(currentPageIdx + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentPageIdx > 0) {
      setCurrentPageIdx(currentPageIdx - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    if (!validatePage() || !responseId || submitting) return;
    setSubmitting(true);

    const { error: submitError } = await supabase
      .from('survey_responses')
      .update({
        answers: answers as unknown as Record<string, unknown>,
        embedded_data: embeddedData,
        completed_at: new Date().toISOString(),
        is_complete: true,
      })
      .eq('id', responseId);

    if (submitError) {
      setValidationErrors({ _form: 'Error al enviar. Intenta de nuevo.' });
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
  };

  // Password check
  if (survey?.settings.passwordProtected && !passwordVerified) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 max-w-sm w-full text-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-12 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#1B3A5C] font-[Georgia] mb-2">Encuesta Protegida</h2>
          <p className="text-sm text-[#64748B] mb-4">Ingresa la contraseña para acceder</p>
          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            className="input-field mb-3"
            placeholder="Contraseña"
            onKeyDown={e => {
              if (e.key === 'Enter' && passwordInput === survey.settings.password) setPasswordVerified(true);
            }}
          />
          {passwordInput && passwordInput !== survey.settings.password && (
            <p className="text-xs text-red-500 mb-2">Contraseña incorrecta</p>
          )}
          <button
            onClick={() => { if (passwordInput === survey.settings.password) setPasswordVerified(true); }}
            className="btn-primary w-full justify-center"
          >
            Acceder
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 max-w-md text-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-12 mx-auto mb-4" />
          <p className="text-[#64748B]">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 max-w-md text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-10 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[#1B3A5C] font-[Georgia]">
            {survey?.settings.thankYouMessage || '¡Gracias por completar la encuesta!'}
          </h2>
          <p className="text-sm text-[#64748B] mt-2">Tus respuestas han sido registradas.</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const currentBlock = orderedBlocks[currentPageIdx];
  if (!currentBlock) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Header */}
      <header className="gradient-bg text-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-8 w-auto" />
            <span className="text-sm font-medium text-white/70">IPADE Business School</span>
          </div>
          <h1 className="text-2xl font-bold font-[Georgia]">{survey.title}</h1>
          {survey.description && <p className="text-sm text-white/80 mt-1">{processPipedText(survey.description, answers, embeddedData)}</p>}
        </div>
        {survey.settings.showProgressBar && (
          <div className="h-1 bg-white/20">
            <div className="h-full bg-[#C4A84D] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Block title */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#1B3A5C]">{currentBlock.name}</h2>
          {currentBlock.description && <p className="text-sm text-[#64748B] mt-1">{currentBlock.description}</p>}
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {visibleQuestions.map((question, qIdx) => (
            <QuestionRenderer
              key={question.id}
              question={question}
              index={survey.settings.showQuestionNumbers ? qIdx + 1 : undefined}
              answer={answers[question.id]}
              onAnswer={(value) => setAnswer(question.id, question, value)}
              error={validationErrors[question.id]}
              answers={answers}
              embeddedData={embeddedData}
            />
          ))}
        </div>

        {validationErrors._form && (
          <div className="mt-4 bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
            {validationErrors._form}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#E2E8F0]">
          <button
            onClick={handlePrev}
            disabled={currentPageIdx === 0}
            className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-[#94A3B8]">
            {currentPageIdx + 1} de {totalPages}
          </span>
          {currentPageIdx === totalPages - 1 ? (
            <button onClick={handleSubmit} disabled={submitting} className="btn-gold">
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0F2440] border-t-transparent" />
              ) : null}
              Enviar Respuestas
            </button>
          ) : (
            <button onClick={handleNext} className="btn-primary">
              Siguiente
            </button>
          )}
        </div>
      </main>

      <footer className="text-center py-6 text-xs text-[#94A3B8]">
        Plataforma de Encuestas IPADE Business School
      </footer>
    </div>
  );
}

function QuestionRenderer({
  question, index, answer, onAnswer, error, answers, embeddedData
}: {
  question: Question;
  index?: number;
  answer?: ResponseAnswer;
  onAnswer: (value: ResponseAnswer['value']) => void;
  error?: string;
  answers: Record<string, ResponseAnswer>;
  embeddedData: Record<string, string>;
}) {
  const processedText = processPipedText(question.text, answers, embeddedData);
  const processedDesc = question.description ? processPipedText(question.description, answers, embeddedData) : undefined;
  const val = answer?.value;

  return (
    <div className={`bg-white rounded-xl border p-6 transition-all ${error ? 'border-red-300 shadow-red-100' : 'border-[#E2E8F0]'} shadow-sm`}>
      <div className="mb-4">
        <div className="flex items-start gap-2">
          {index !== undefined && <span className="text-sm font-semibold text-[#C4A84D]">{index}.</span>}
          <div>
            <p className="text-base font-medium text-[#1A202C]">
              {processedText}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </p>
            {processedDesc && <p className="text-sm text-[#64748B] mt-1">{processedDesc}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Multiple Choice */}
        {question.type === 'multiple_choice' && (
          <div className="space-y-2">
            {(question.options || []).map(opt => (
              <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                val === opt.text ? 'border-[#1B3A5C] bg-[#1B3A5C]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
              }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  val === opt.text ? 'border-[#1B3A5C]' : 'border-[#CBD5E1]'
                }`}>
                  {val === opt.text && <div className="w-2 h-2 rounded-full bg-[#1B3A5C]" />}
                </div>
                <span className="text-sm">{opt.text}</span>
              </label>
            ))}
            {question.allowOther && (
              <div className="flex items-center gap-3 p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-4 h-4 rounded-full border-2 ${typeof val === 'string' && val && !(question.options || []).find(o => o.text === val) ? 'border-[#1B3A5C]' : 'border-[#CBD5E1]'}`}>
                    {typeof val === 'string' && val && !(question.options || []).find(o => o.text === val) && <div className="w-2 h-2 rounded-full bg-[#1B3A5C] m-auto" />}
                  </div>
                  <span className="text-sm">Otro:</span>
                </label>
                <input
                  className="input-field py-1.5 text-sm flex-1"
                  placeholder="Especifica..."
                  onChange={e => onAnswer(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Multi Select */}
        {question.type === 'multi_select' && (
          <div className="space-y-2">
            {(question.options || []).map(opt => {
              const selected = Array.isArray(val) && val.includes(opt.text);
              return (
                <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selected ? 'border-[#1B3A5C] bg-[#1B3A5C]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                }`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      const current = (Array.isArray(val) ? val : []) as string[];
                      onAnswer(selected ? current.filter(v => v !== opt.text) : [...current, opt.text]);
                    }}
                    className="rounded border-[#CBD5E1] w-4 h-4"
                  />
                  <span className="text-sm">{opt.text}</span>
                </label>
              );
            })}
          </div>
        )}

        {/* Text Entry */}
        {question.type === 'text_entry' && (
          <input
            type="text"
            value={(val as string) || ''}
            onChange={e => onAnswer(e.target.value)}
            className="input-field"
            placeholder={question.placeholder}
            maxLength={question.maxLength}
          />
        )}

        {/* Essay */}
        {question.type === 'essay' && (
          <textarea
            value={(val as string) || ''}
            onChange={e => onAnswer(e.target.value)}
            className="input-field"
            placeholder={question.placeholder}
            rows={4}
            maxLength={question.maxLength}
          />
        )}

        {/* Dropdown */}
        {question.type === 'dropdown' && (
          <select
            value={(val as string) || ''}
            onChange={e => onAnswer(e.target.value)}
            className="input-field"
          >
            <option value="">Seleccionar...</option>
            {(question.options || []).map(opt => (
              <option key={opt.id} value={opt.text}>{opt.text}</option>
            ))}
          </select>
        )}

        {/* Yes/No */}
        {question.type === 'yes_no' && (
          <div className="flex gap-3">
            {(question.options || [{ id: '1', text: 'Sí' }, { id: '2', text: 'No' }]).map(opt => (
              <button
                key={opt.id}
                onClick={() => onAnswer(opt.text)}
                className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
                  val === opt.text
                    ? 'border-[#1B3A5C] bg-[#1B3A5C] text-white'
                    : 'border-[#E2E8F0] hover:border-[#1B3A5C] text-[#1A202C]'
                }`}
              >
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {/* Likert */}
        {question.type === 'likert' && (
          <div className="space-y-2">
            {(question.options || []).map(opt => (
              <label key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                val === opt.text ? 'border-[#1B3A5C] bg-[#1B3A5C]/5' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
              }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  val === opt.text ? 'border-[#1B3A5C]' : 'border-[#CBD5E1]'
                }`}>
                  {val === opt.text && <div className="w-2 h-2 rounded-full bg-[#1B3A5C]" />}
                </div>
                <span className="text-sm">{opt.text}</span>
              </label>
            ))}
          </div>
        )}

        {/* Slider */}
        {question.type === 'slider' && (
          <div className="px-2">
            <input
              type="range"
              min={question.sliderMin ?? 0}
              max={question.sliderMax ?? 100}
              step={question.sliderStep ?? 1}
              value={(val as number) ?? question.sliderMin ?? 0}
              onChange={e => onAnswer(Number(e.target.value))}
              className="w-full accent-[#1B3A5C]"
            />
            <div className="flex justify-between text-xs text-[#64748B] mt-1">
              <span>{question.sliderMinLabel || question.sliderMin || 0}</span>
              <span className="font-semibold text-[#1B3A5C] text-base">{(val as number) ?? question.sliderMin ?? 0}</span>
              <span>{question.sliderMaxLabel || question.sliderMax || 100}</span>
            </div>
          </div>
        )}

        {/* NPS */}
        {question.type === 'nps' && (
          <div>
            <div className="flex gap-1.5 justify-center flex-wrap">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => onAnswer(i)}
                  className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                    val === i
                      ? 'bg-[#1B3A5C] text-white shadow-lg'
                      : i <= 6
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      : i <= 8
                      ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-[#64748B] mt-2 px-1">
              <span>{question.npsLeftLabel || 'Nada probable'}</span>
              <span>{question.npsRightLabel || 'Extremadamente probable'}</span>
            </div>
          </div>
        )}

        {/* Matrix */}
        {question.type === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 text-[#64748B] font-medium"></th>
                  {(question.matrixColumns || []).map(col => (
                    <th key={col.id} className="text-center py-2 px-2 text-[#64748B] font-medium text-xs">{col.text}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(question.matrixRows || []).map(row => (
                  <tr key={row.id} className="border-t border-[#F1F5F9]">
                    <td className="py-3 pr-4 text-[#1A202C]">{row.text}</td>
                    {(question.matrixColumns || []).map(col => {
                      const matrixVal = val as Record<string, string | number> | undefined;
                      const isSelected = matrixVal?.[row.id] === col.text;
                      return (
                        <td key={col.id} className="text-center py-3 px-2">
                          <button
                            onClick={() => {
                              const current = (matrixVal || {}) as Record<string, string>;
                              onAnswer({ ...current, [row.id]: col.text });
                            }}
                            className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center ${
                              isSelected ? 'border-[#1B3A5C]' : 'border-[#CBD5E1]'
                            }`}
                          >
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#1B3A5C]" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rank Order */}
        {question.type === 'rank_order' && (
          <div className="space-y-2">
            <p className="text-xs text-[#94A3B8] mb-2">Arrastra para ordenar o usa los números</p>
            {(question.options || []).map((opt, oidx) => {
              const ranking = (Array.isArray(val) ? val : []) as string[];
              const position = ranking.indexOf(opt.text) + 1;
              return (
                <div key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-white">
                  <select
                    value={position || ''}
                    onChange={e => {
                      const pos = Number(e.target.value);
                      let current = [...ranking];
                      current = current.filter(v => v !== opt.text);
                      if (pos > 0) current.splice(pos - 1, 0, opt.text);
                      onAnswer(current);
                    }}
                    className="input-field py-1 text-xs w-14 text-center"
                  >
                    <option value="">-</option>
                    {(question.options || []).map((_, i) => (
                      <option key={i} value={i + 1}>{i + 1}</option>
                    ))}
                  </select>
                  <span className="text-sm">{opt.text}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Constant Sum */}
        {question.type === 'constant_sum' && (
          <div className="space-y-3">
            {(question.options || []).map(opt => {
              const sums = (val || {}) as Record<string, number>;
              return (
                <div key={opt.id} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{opt.text}</span>
                  <input
                    type="number"
                    min={0}
                    value={sums[opt.id] ?? 0}
                    onChange={e => onAnswer({ ...sums, [opt.id]: Number(e.target.value) })}
                    className="input-field py-1.5 text-sm w-24 text-center"
                  />
                </div>
              );
            })}
            <div className="text-right text-sm">
              <span className="text-[#64748B]">Total: </span>
              <span className={`font-semibold ${
                Object.values((val || {}) as Record<string, number>).reduce((s, v) => s + (v || 0), 0) === (question.constantSumTotal || 100)
                  ? 'text-green-600' : 'text-[#1A202C]'
              }`}>
                {Object.values((val || {}) as Record<string, number>).reduce((s, v) => s + (v || 0), 0)}
              </span>
              <span className="text-[#94A3B8]"> / {question.constantSumTotal || 100}</span>
            </div>
          </div>
        )}

        {/* Date */}
        {question.type === 'date' && (
          <input
            type="date"
            value={(val as string) || ''}
            onChange={e => onAnswer(e.target.value)}
            className="input-field"
          />
        )}

        {/* File Upload placeholder */}
        {question.type === 'file_upload' && (
          <div className="border-2 border-dashed border-[#E2E8F0] rounded-lg p-8 text-center">
            <svg className="w-10 h-10 text-[#94A3B8] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-[#64748B]">Funcionalidad de carga en desarrollo</p>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
