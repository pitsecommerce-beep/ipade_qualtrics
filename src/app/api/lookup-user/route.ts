import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const trimmed = email.trim().toLowerCase();

  const { data } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', trimmed)
    .single();

  if (data) {
    return NextResponse.json({ id: data.id, email: data.email });
  }

  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUser = authData?.users?.find(
    u => u.email?.toLowerCase() === trimmed
  );

  if (authUser) {
    return NextResponse.json({ id: authUser.id, email: authUser.email });
  }

  return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
}
