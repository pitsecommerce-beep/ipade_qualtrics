'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Plus, Search, LogOut, MoreHorizontal, Pencil, Trash2, Share2, Copy, FolderOpen, Star, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Survey } from '@/types/survey';
import { createDefaultSurvey } from '@/lib/survey-utils';

type SurveyRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  response_count?: number;
  is_shared?: boolean;
};

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [sharedSurveys, setSharedSurveys] = useState<SurveyRow[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'active' | 'closed'>('all');
  const [tab, setTab] = useState<'mine' | 'shared'>('mine');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) loadSurveys();
  }, [user]);

  const loadSurveys = async () => {
    if (!user) return;
    setLoadingSurveys(true);

    const { data: owned, error: ownedErr } = await supabase
      .from('surveys')
      .select('id, title, status, created_at, updated_at, owner_id')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });

    if (ownedErr) {
      console.error('[dashboard] surveys query failed:', ownedErr.message, ownedErr.details, ownedErr.hint);
      toast.error(`Error cargando encuestas: ${ownedErr.message}`);
      setLoadingSurveys(false);
      return;
    }

    const { data: collabs, error: collabsErr } = await supabase
      .from('survey_collaborators')
      .select('survey_id')
      .eq('user_id', user.id);

    if (collabsErr) {
      console.error('[dashboard] collaborators query failed:', collabsErr.message, collabsErr.details, collabsErr.hint);
    }

    if (collabs && collabs.length > 0) {
      const sharedIds = collabs.map(c => c.survey_id);
      const { data: shared } = await supabase
        .from('surveys')
        .select('id, title, status, created_at, updated_at, owner_id')
        .in('id', sharedIds)
        .order('updated_at', { ascending: false });
      setSharedSurveys((shared || []).map(s => ({ ...s, is_shared: true })));
    }

    // Get response counts
    if (owned) {
      const withCounts = await Promise.all(
        owned.map(async (s) => {
          const { count } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true })
            .eq('survey_id', s.id)
            .eq('is_complete', true);
          return { ...s, response_count: count || 0 };
        })
      );
      setSurveys(withCounts);
    }

    setLoadingSurveys(false);
  };

  const createSurvey = async () => {
    if (!user || creating) return;
    setCreating(true);
    const newSurvey = createDefaultSurvey(user.id);

    const { data, error } = await supabase
      .from('surveys')
      .insert(newSurvey)
      .select('id')
      .single();

    if (error) {
      toast.error('Error al crear la encuesta');
      setCreating(false);
      return;
    }

    router.push(`/survey/${data.id}/edit`);
  };

  const deleteSurvey = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta encuesta? Esta acción no se puede deshacer.')) return;

    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) {
      toast.error('Error al eliminar');
      return;
    }
    toast.success('Encuesta eliminada');
    setSurveys(surveys.filter(s => s.id !== id));
    setMenuOpen(null);
  };

  const duplicateSurvey = async (id: string) => {
    if (!user) return;
    const { data: original } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (!original) return;

    const { data, error } = await supabase
      .from('surveys')
      .insert({
        title: `${original.title} (copia)`,
        description: original.description,
        status: 'draft',
        blocks: original.blocks,
        flow: original.flow,
        settings: original.settings,
        owner_id: user.id,
      })
      .select('id')
      .single();

    if (!error && data) {
      toast.success('Encuesta duplicada');
      loadSurveys();
    }
    setMenuOpen(null);
  };

  useEffect(() => {
    const handleClick = () => setMenuOpen(null);
    if (menuOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [menuOpen]);

  const currentList = tab === 'mine' ? surveys : sharedSurveys;
  const filtered = currentList.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || s.status === filter;
    return matchesSearch && matchesFilter;
  });

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-[#1B3A5C] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/IPADE_Business_School_Escudo.png/250px-IPADE_Business_School_Escudo.png"
              alt="IPADE"
              className="h-9 w-auto"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-[#1B3A5C] font-[Georgia] leading-tight">IPADE</h1>
              <p className="text-[10px] text-[#64748B] -mt-0.5">Plataforma de Encuestas</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-[#64748B] hidden md:block">
              {user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-[#64748B] hover:text-[#1B3A5C] transition-colors p-2 rounded-lg hover:bg-[#F0F2F5]"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Title + Create */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#1B3A5C] font-[Georgia]">Proyectos</h2>
            <p className="text-sm text-[#64748B] mt-1">Gestiona tus encuestas y proyectos de investigación</p>
          </div>
          <button onClick={createSurvey} disabled={creating} className="btn-primary">
            {creating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Plus size={18} />
            )}
            Crear Proyecto
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-[#E2E8F0] w-fit">
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'mine' ? 'bg-[#1B3A5C] text-white' : 'text-[#64748B] hover:text-[#1B3A5C]'
            }`}
          >
            <FolderOpen size={16} />
            Mis Proyectos ({surveys.length})
          </button>
          <button
            onClick={() => setTab('shared')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'shared' ? 'bg-[#1B3A5C] text-white' : 'text-[#64748B] hover:text-[#1B3A5C]'
            }`}
          >
            <Users size={16} />
            Compartidos ({sharedSurveys.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proyectos..."
              className="input-field pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'draft', 'active', 'closed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-[#1B3A5C] text-white'
                    : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:border-[#1B3A5C]'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'draft' ? 'Borrador' : f === 'active' ? 'Activo' : 'Cerrado'}
              </button>
            ))}
          </div>
        </div>

        {/* Survey List */}
        {loadingSurveys ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-[#1B3A5C] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-[#E2E8F0]">
            <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={28} className="text-[#94A3B8]" />
            </div>
            <h3 className="text-lg font-semibold text-[#1B3A5C]">
              {search || filter !== 'all' ? 'No se encontraron encuestas' : 'Sin encuestas aún'}
            </h3>
            <p className="text-[#64748B] text-sm mt-1">
              {search || filter !== 'all' ? 'Intenta con otros filtros' : 'Crea tu primera encuesta para comenzar'}
            </p>
            {!search && filter === 'all' && (
              <button onClick={createSurvey} className="btn-gold mt-6">
                <Plus size={18} />
                Crear Mi Primera Encuesta
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Proyecto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider hidden sm:table-cell">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider hidden md:table-cell">Respuestas</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider hidden lg:table-cell">Modificado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((survey, idx) => (
                  <tr
                    key={survey.id}
                    className={`border-b border-[#F1F5F9] hover:bg-[#F8F9FB] cursor-pointer transition-colors ${
                      idx === filtered.length - 1 ? 'border-b-0' : ''
                    }`}
                    onClick={() => router.push(`/survey/${survey.id}/edit`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          survey.status === 'active' ? 'bg-green-50 text-green-600' :
                          survey.status === 'closed' ? 'bg-red-50 text-red-500' :
                          'bg-[#F1F5F9] text-[#64748B]'
                        }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-[#1A202C]">{survey.title}</p>
                          <p className="text-xs text-[#94A3B8] mt-0.5">Encuesta</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <span className={`badge ${
                        survey.status === 'active' ? 'badge-active' :
                        survey.status === 'closed' ? 'badge-closed' :
                        'badge-draft'
                      }`}>
                        {survey.status === 'active' ? 'Activo' :
                         survey.status === 'closed' ? 'Cerrado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#64748B] hidden md:table-cell">
                      {survey.response_count ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-[#64748B] hidden lg:table-cell">
                      {formatDate(survey.updated_at)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpen(menuOpen === survey.id ? null : survey.id)}
                          className="p-1.5 rounded-lg hover:bg-[#F0F2F5] text-[#64748B] transition-colors"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {menuOpen === survey.id && (
                          <div className="absolute right-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 w-48 z-20 animate-fade-in">
                            <button
                              onClick={() => { router.push(`/survey/${survey.id}/edit`); setMenuOpen(null); }}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-[#F8F9FB] flex items-center gap-2"
                            >
                              <Pencil size={14} /> Editar
                            </button>
                            <button
                              onClick={() => duplicateSurvey(survey.id)}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-[#F8F9FB] flex items-center gap-2"
                            >
                              <Copy size={14} /> Duplicar
                            </button>
                            <button
                              onClick={() => { router.push(`/survey/${survey.id}/distribute`); setMenuOpen(null); }}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-[#F8F9FB] flex items-center gap-2"
                            >
                              <Share2 size={14} /> Distribuir
                            </button>
                            <hr className="my-1 border-[#E2E8F0]" />
                            <button
                              onClick={() => deleteSurvey(survey.id)}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
