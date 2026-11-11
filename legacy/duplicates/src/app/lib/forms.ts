export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
}
