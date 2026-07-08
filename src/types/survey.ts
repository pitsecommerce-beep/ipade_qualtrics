export type QuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'text_entry'
  | 'essay'
  | 'slider'
  | 'rank_order'
  | 'matrix'
  | 'likert'
  | 'dropdown'
  | 'yes_no'
  | 'date'
  | 'file_upload'
  | 'nps'
  | 'constant_sum'
  | 'side_by_side'
  | 'image_choice'
  | 'group_rank';

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
  value?: number;
}

export interface MatrixRow {
  id: string;
  text: string;
}

export interface MatrixColumn {
  id: string;
  text: string;
  value?: number;
}

export interface DisplayLogicCondition {
  questionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_answered' | 'is_not_answered';
  value: string;
  conjunction?: 'and' | 'or';
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  description?: string;
  required: boolean;
  options?: QuestionOption[];
  matrixRows?: MatrixRow[];
  matrixColumns?: MatrixColumn[];
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderMinLabel?: string;
  sliderMaxLabel?: string;
  maxLength?: number;
  placeholder?: string;
  displayLogic?: DisplayLogicCondition[];
  validation?: {
    type: 'number' | 'email' | 'url' | 'regex' | 'min_chars' | 'max_chars';
    value: string;
    message?: string;
  };
  piping?: {
    sourceQuestionId: string;
    format: string;
  };
  randomizeOptions?: boolean;
  allowOther?: boolean;
  npsLeftLabel?: string;
  npsRightLabel?: string;
  constantSumTotal?: number;
}

export interface Block {
  id: string;
  name: string;
  description?: string;
  questions: Question[];
  randomizeQuestions?: boolean;
}

export interface EmbeddedDataField {
  name: string;
  value: string;
}

export interface BranchCondition {
  embeddedDataField?: string;
  questionId?: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string;
  conjunction?: 'and' | 'or';
}

export interface FlowElement {
  id: string;
  type: 'show_block' | 'branch' | 'randomizer' | 'embedded_data' | 'end_survey' | 'web_service';
  blockId?: string;
  conditions?: BranchCondition[];
  children?: FlowElement[];
  embeddedData?: EmbeddedDataField[];
  randomizerCount?: number;
  randomizerEvenPresent?: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'closed';
  blocks: Block[];
  flow: FlowElement[];
  settings: SurveySettings;
  created_at: string;
  updated_at: string;
  owner_id: string;
  response_count?: number;
}

export interface SurveySettings {
  collectIp: boolean;
  collectGeoLocation: boolean;
  allowMultipleResponses: boolean;
  showProgressBar: boolean;
  showQuestionNumbers: boolean;
  requireAllQuestions: boolean;
  thankYouMessage: string;
  closedMessage: string;
  customCss?: string;
  language: string;
  expiresAt?: string;
  maxResponses?: number;
  passwordProtected?: boolean;
  password?: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  respondent_ip?: string;
  started_at: string;
  completed_at?: string;
  answers: Record<string, ResponseAnswer>;
  embedded_data?: Record<string, string>;
  metadata?: {
    userAgent?: string;
    language?: string;
    screenSize?: string;
  };
}

export interface ResponseAnswer {
  questionId: string;
  questionType: QuestionType;
  value: string | string[] | number | Record<string, string | number>;
}

export interface SurveyCollaborator {
  id: string;
  survey_id: string;
  user_id: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  created_at: string;
}

export interface SurveyDistribution {
  id: string;
  survey_id: string;
  type: 'anonymous_link' | 'email' | 'qr_code' | 'embed';
  name: string;
  link?: string;
  created_at: string;
  stats?: {
    sent: number;
    opened: number;
    completed: number;
  };
}
