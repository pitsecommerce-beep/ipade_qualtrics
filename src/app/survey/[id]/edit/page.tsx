import EditClient from './edit-client';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function SurveyEditPage() {
  return <EditClient />;
}
