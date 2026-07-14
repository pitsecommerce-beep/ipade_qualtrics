import { nanoid } from 'nanoid';
import type { Block, Question, QuestionType, FlowElement, QuestionOption, Survey, EmbeddedDataField } from '@/types/survey';

export function createId(): string {
  return nanoid(12);
}

export function createQuestion(type: QuestionType, overrides?: Partial<Question>): Question {
  const base: Question = {
    id: createId(),
    type,
    text: '',
    required: false,
    ...overrides,
  };

  switch (type) {
    case 'multiple_choice':
    case 'multi_select':
    case 'dropdown':
    case 'image_choice':
      base.options = [
        { id: createId(), text: 'Opción 1' },
        { id: createId(), text: 'Opción 2' },
        { id: createId(), text: 'Opción 3' },
      ];
      break;
    case 'yes_no':
      base.options = [
        { id: createId(), text: 'Sí' },
        { id: createId(), text: 'No' },
      ];
      break;
    case 'likert':
      base.options = [
        { id: createId(), text: 'Totalmente en desacuerdo', value: 1 },
        { id: createId(), text: 'En desacuerdo', value: 2 },
        { id: createId(), text: 'Neutral', value: 3 },
        { id: createId(), text: 'De acuerdo', value: 4 },
        { id: createId(), text: 'Totalmente de acuerdo', value: 5 },
      ];
      break;
    case 'nps':
      base.npsLeftLabel = 'Nada probable';
      base.npsRightLabel = 'Extremadamente probable';
      break;
    case 'slider':
      base.sliderMin = 0;
      base.sliderMax = 100;
      base.sliderStep = 1;
      break;
    case 'matrix':
      base.matrixRows = [
        { id: createId(), text: 'Fila 1' },
        { id: createId(), text: 'Fila 2' },
      ];
      base.matrixColumns = [
        { id: createId(), text: 'Columna 1', value: 1 },
        { id: createId(), text: 'Columna 2', value: 2 },
        { id: createId(), text: 'Columna 3', value: 3 },
      ];
      break;
    case 'rank_order':
    case 'group_rank':
      base.options = [
        { id: createId(), text: 'Elemento 1' },
        { id: createId(), text: 'Elemento 2' },
        { id: createId(), text: 'Elemento 3' },
      ];
      break;
    case 'constant_sum':
      base.options = [
        { id: createId(), text: 'Categoría 1' },
        { id: createId(), text: 'Categoría 2' },
        { id: createId(), text: 'Categoría 3' },
      ];
      base.constantSumTotal = 100;
      break;
    case 'text_entry':
      base.maxLength = 250;
      base.placeholder = 'Escribe tu respuesta...';
      break;
    case 'essay':
      base.maxLength = 5000;
      base.placeholder = 'Escribe tu respuesta detallada...';
      break;
  }

  return base;
}

export function createBlock(name?: string): Block {
  return {
    id: createId(),
    name: name || 'Nuevo Bloque',
    questions: [],
  };
}

export function createFlowElement(type: FlowElement['type'], overrides?: Partial<FlowElement>): FlowElement {
  return {
    id: createId(),
    type,
    ...overrides,
  };
}

export function createEmbeddedDataField(name: string = '', value: string = ''): EmbeddedDataField {
  return { name, value };
}

export function getQuestionTypeLabel(type: QuestionType): string {
  const labels: Record<QuestionType, string> = {
    multiple_choice: 'Opción Múltiple',
    multi_select: 'Selección Múltiple',
    text_entry: 'Entrada de Texto',
    essay: 'Texto Largo',
    slider: 'Deslizador',
    rank_order: 'Ordenar por Rango',
    matrix: 'Matriz / Tabla',
    likert: 'Escala Likert',
    dropdown: 'Menú Desplegable',
    yes_no: 'Sí / No',
    date: 'Fecha',
    file_upload: 'Subir Archivo',
    nps: 'Net Promoter Score',
    constant_sum: 'Suma Constante',
    side_by_side: 'Lado a Lado',
    image_choice: 'Selección con Imagen',
    group_rank: 'Agrupar y Ordenar',
  };
  return labels[type] || type;
}

export function getQuestionTypeIcon(type: QuestionType): string {
  const icons: Record<QuestionType, string> = {
    multiple_choice: 'circle-dot',
    multi_select: 'check-square',
    text_entry: 'type',
    essay: 'align-left',
    slider: 'sliders-horizontal',
    rank_order: 'list-ordered',
    matrix: 'grid-3x3',
    likert: 'star',
    dropdown: 'chevron-down',
    yes_no: 'toggle-left',
    date: 'calendar',
    file_upload: 'upload',
    nps: 'gauge',
    constant_sum: 'calculator',
    side_by_side: 'columns-2',
    image_choice: 'image',
    group_rank: 'layers',
  };
  return icons[type] || 'help-circle';
}

export function processPipedText(text: string, answers: Record<string, { value: string | string[] | number | Record<string, string | number> }>, embeddedData?: Record<string, string>): string {
  let processed = text;

  const pipedPattern = /\$\{q:([^}]+)\}/g;
  processed = processed.replace(pipedPattern, (_, questionId) => {
    const answer = answers[questionId];
    if (!answer) return '[Sin respuesta]';
    if (typeof answer.value === 'string') return answer.value;
    if (typeof answer.value === 'number') return answer.value.toString();
    if (Array.isArray(answer.value)) return answer.value.join(', ');
    return JSON.stringify(answer.value);
  });

  // ${e://Field/fieldName} — Qualtrics-style embedded data reference (must run before the simpler ${e:fieldName} pattern)
  const qualtricsEmbeddedPattern = /\$\{e:\/\/Field\/([^}]+)\}/g;
  processed = processed.replace(qualtricsEmbeddedPattern, (_, fieldName) => {
    return embeddedData?.[fieldName] || `[${fieldName}]`;
  });

  // ${e:fieldName} — simple embedded data reference
  const embeddedPattern = /\$\{e:([^}]+)\}/g;
  processed = processed.replace(embeddedPattern, (_, fieldName) => {
    return embeddedData?.[fieldName] || `[${fieldName}]`;
  });

  const randomPattern = /\$\{random:([^}]+)\}/g;
  processed = processed.replace(randomPattern, (_, optionsStr) => {
    const options = optionsStr.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });

  return processed;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function evaluateCondition(
  condition: { operator: string; value: string; questionId?: string; embeddedDataField?: string },
  answers: Record<string, { value: string | string[] | number | Record<string, string | number> }>,
  embeddedData?: Record<string, string>
): boolean {
  let actualValue: string;

  if (condition.questionId) {
    const answer = answers[condition.questionId];
    if (!answer) return condition.operator === 'is_not_answered';
    if (condition.operator === 'is_answered') return true;
    actualValue = typeof answer.value === 'string' ? answer.value :
                  typeof answer.value === 'number' ? answer.value.toString() :
                  Array.isArray(answer.value) ? answer.value.join(',') :
                  JSON.stringify(answer.value);
  } else if (condition.embeddedDataField) {
    actualValue = embeddedData?.[condition.embeddedDataField] || '';
  } else {
    return false;
  }

  switch (condition.operator) {
    case 'equals': return actualValue === condition.value;
    case 'not_equals': return actualValue !== condition.value;
    case 'contains': return actualValue.includes(condition.value);
    case 'greater_than': return parseFloat(actualValue) > parseFloat(condition.value);
    case 'less_than': return parseFloat(actualValue) < parseFloat(condition.value);
    default: return false;
  }
}

export function evaluateDisplayLogic(
  conditions: Array<{ operator: string; value: string; questionId: string; conjunction?: string }>,
  answers: Record<string, { value: string | string[] | number | Record<string, string | number> }>
): boolean {
  if (!conditions || conditions.length === 0) return true;

  let result = evaluateCondition(conditions[0], answers);

  for (let i = 1; i < conditions.length; i++) {
    const condResult = evaluateCondition(conditions[i], answers);
    if (conditions[i].conjunction === 'or') {
      result = result || condResult;
    } else {
      result = result && condResult;
    }
  }

  return result;
}

export function createDefaultSurvey(ownerId: string): Omit<Survey, 'id' | 'created_at' | 'updated_at'> {
  const welcomeBlock: Block = {
    ...createBlock('Bienvenida'),
    type: 'welcome',
    showLogo: true,
    welcomeContent: '<p>Bienvenido/a a esta encuesta. Tu participación es muy importante para nosotros.</p><p>Por favor, responde con honestidad. Tus respuestas serán tratadas de manera confidencial.</p>',
  };
  const mainBlock = createBlock('Preguntas Principales');

  return {
    title: 'Nueva Encuesta',
    description: '',
    status: 'draft',
    blocks: [welcomeBlock, mainBlock],
    flow: [
      createFlowElement('show_block', { blockId: welcomeBlock.id }),
      createFlowElement('show_block', { blockId: mainBlock.id }),
    ],
    settings: {
      collectIp: true,
      collectGeoLocation: false,
      allowMultipleResponses: false,
      showProgressBar: true,
      showQuestionNumbers: true,
      requireAllQuestions: false,
      thankYouMessage: '¡Gracias por completar la encuesta!',
      closedMessage: 'Esta encuesta ya no está disponible.',
      language: 'es',
    },
    owner_id: ownerId,
  };
}
