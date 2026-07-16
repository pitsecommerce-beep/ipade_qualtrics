'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Link2, QrCode, Mail, Copy, Check, UserPlus, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Survey, SurveyCollaborator } from '@/types/survey';

export default function DistributeClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = searchParams.get('surveyId') || '';

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [collaborators, setCollaborators] = useState<SurveyCollaborator[]>([]);
  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [newCollabRole, setNewCollabRole] = useState<'viewer' | 'editor'>('viewer');
  const [addingCollab, setAddingCollab] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'qr' | 'embed' | 'collaborate'>('link');

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && surveyId) loadData();
  }, [user, surveyId]);

  const loadData = async () => {
    const [surveyRes, collabRes] = await Promise.all([
      supabase.from('surveys').select('*').eq('id', surveyId).single(),
      supabase.from('survey_collaborators').select('*').eq('survey_id', surveyId),
    ]);
    if (surveyRes.data) setSurvey(surveyRes.data as unknown as Survey);
    if (collabRes.data) setCollaborators(collabRes.data as unknown as SurveyCollaborator[]);
    setLoading(false);
  };

  const surveyUrl = (() => {
    if (typeof window === 'undefined') return '';
    const pathIdx = window.location.pathname.indexOf('/survey/');
    const basePath = pathIdx > 0 ? window.location.pathname.substring(0, pathIdx) : '';
    return `${window.location.origin}${basePath}/respond?surveyId=${surveyId}`;
  })();

  const copyLink = () => {
    navigator.clipboard.writeText(surveyUrl);
    setCopied(true);
    toast.success('Enlace copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const addCollaborator = async () => {
    if (!newCollabEmail || addingCollab) return;
    setAddingCollab(true);

    let existingUser: { id: string } | null = null;
    try {
      const res = await fetch('/api/lookup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newCollabEmail.trim().toLowerCase() }),
      });
      if (res.ok) {
        existingUser = await res.json();
      }
    } catch {}

    if (!existingUser) {
      toast.error('Usuario no encontrado. Debe tener una cuenta.');
      setAddingCollab(false);
      return;
    }

    const { error } = await supabase
      .from('survey_collaborators')
      .insert({
        survey_id: surveyId,
        user_id: existingUser.id,
        email: newCollabEmail,
        role: newCollabRole,
      });

    if (error) {
      toast.error(error.code === '23505' ? 'Este usuario ya es colaborador' : 'Error al agregar');
    } else {
      toast.success('Colaborador agregado');
      setNewCollabEmail('');
      loadData();
    }
    setAddingCollab(false);
  };

  const removeCollaborator = async (id: string) => {
    await supabase.from('survey_collaborators').delete().eq('id', id);
    setCollaborators(collaborators.filter(c => c.id !== id));
    toast.success('Colaborador eliminado');
  };

  const embedCode = `<iframe src="${surveyUrl}" width="100%" height="700" frameborder="0" style="border: none; border-radius: 12px;"></iframe>`;

  if (loading || authLoading || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <button onClick={() => router.push(`/survey/_/edit?surveyId=${surveyId}`)} className="p-2 rounded-lg hover:bg-[#F0F2F5] text-[#64748B]">
            <ArrowLeft size={18} />
          </button>
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png" alt="IPADE" className="h-7 w-auto" />
          <span className="text-sm font-semibold text-[#1B3A5C] border-l border-[#E2E8F0] pl-3 ml-1">{survey.title} — Distribución</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {survey.status !== 'active' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 mb-6 text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            La encuesta debe estar <strong className="mx-1">Activa</strong> para recibir respuestas.
            <button
              onClick={async () => {
                await supabase.from('surveys').update({ status: 'active' }).eq('id', surveyId);
                setSurvey({ ...survey, status: 'active' });
                toast.success('Encuesta activada');
              }}
              className="ml-auto btn-primary text-xs py-1 px-3"
            >
              Activar
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-[#E2E8F0]">
          {[
            { key: 'link' as const, label: 'Enlace', icon: <Link2 size={15} /> },
            { key: 'qr' as const, label: 'Código QR', icon: <QrCode size={15} /> },
            { key: 'embed' as const, label: 'Embeber', icon: <ExternalLink size={15} /> },
            { key: 'collaborate' as const, label: 'Colaboradores', icon: <UserPlus size={15} /> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.key ? 'bg-[#1B3A5C] text-white' : 'text-[#64748B] hover:text-[#1B3A5C]'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Anonymous Link */}
        {activeTab === 'link' && (
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia]">Enlace Anónimo</h3>
            <p className="text-sm text-[#64748B]">Comparte este enlace con los encuestados. No se requiere inicio de sesión para responder.</p>
            <div className="flex gap-2">
              <input value={surveyUrl} readOnly className="input-field text-sm flex-1 bg-[#F8F9FB]" />
              <button onClick={copyLink} className="btn-primary flex-shrink-0">
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <a href={surveyUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#2A5A8C] hover:underline inline-flex items-center gap-1">
              <ExternalLink size={14} /> Abrir encuesta en nueva pestaña
            </a>
          </div>
        )}

        {/* QR Code */}
        {activeTab === 'qr' && (
          <div className="card space-y-4 text-center">
            <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia]">Código QR</h3>
            <p className="text-sm text-[#64748B]">Los encuestados pueden escanear este código con su dispositivo móvil.</p>
            <div className="inline-block p-6 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(surveyUrl)}&color=1B3A5C`}
                alt="QR Code"
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs text-[#94A3B8]">{surveyUrl}</p>
          </div>
        )}

        {/* Embed */}
        {activeTab === 'embed' && (
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia]">Embeber en Sitio Web</h3>
            <p className="text-sm text-[#64748B]">Copia este código HTML para embeber la encuesta en cualquier página web.</p>
            <div className="relative">
              <pre className="bg-[#0F2440] text-white text-sm p-4 rounded-lg overflow-x-auto">
                <code>{embedCode}</code>
              </pre>
              <button
                onClick={() => { navigator.clipboard.writeText(embedCode); toast.success('Código copiado'); }}
                className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 text-white"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Collaborators */}
        {activeTab === 'collaborate' && (
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-[#1B3A5C] font-[Georgia]">Colaboradores</h3>
            <p className="text-sm text-[#64748B]">Comparte el acceso al proyecto con otros usuarios.</p>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
              <input
                type="email"
                value={newCollabEmail}
                onChange={e => setNewCollabEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                style={{
                  flex: '1 1 0%',
                  minWidth: 0,
                  padding: '0.625rem 0.875rem',
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  background: '#fff',
                  color: '#1A202C',
                  outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = '#1B3A5C'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,92,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none'; }}
              />
              <select
                value={newCollabRole}
                onChange={e => setNewCollabRole(e.target.value as 'viewer' | 'editor')}
                className="input-field"
                style={{ width: '8rem', flexShrink: 0 }}
              >
                <option value="viewer">Visor</option>
                <option value="editor">Editor</option>
              </select>
              <button onClick={addCollaborator} disabled={addingCollab} className="btn-primary" style={{ flexShrink: 0 }}>
                <UserPlus size={16} /> Agregar
              </button>
            </div>

            {collaborators.length > 0 ? (
              <div className="space-y-2 mt-4">
                {collaborators.map(collab => (
                  <div key={collab.id} className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FB]">
                    <div>
                      <p className="text-sm font-medium text-[#1A202C]">{collab.email}</p>
                      <p className="text-xs text-[#94A3B8]">
                        {collab.role === 'editor' ? 'Editor' : collab.role === 'admin' ? 'Admin' : 'Visor'}
                        {' · '}Desde {new Date(collab.created_at).toLocaleDateString('es-MX')}
                      </p>
                    </div>
                    <button onClick={() => removeCollaborator(collab.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#94A3B8] py-4 text-center">No hay colaboradores aún</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
