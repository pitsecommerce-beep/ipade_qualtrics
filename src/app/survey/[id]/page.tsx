import SurveyRedirect from './survey-redirect';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function SurveyPage() {
  return <SurveyRedirect />;
}
