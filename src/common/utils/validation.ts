import { ValidationError } from 'class-validator';

export type ValidationErrorDetail = {
  field: string;
  errors: string[];
};

export function formatValidationErrors(
  errors: ValidationError[],
): ValidationErrorDetail[] {
  return errors.map((error) => {
    const constraints = error.constraints
      ? Object.values(error.constraints)
      : [];
    return {
      field: error.property,
      errors: constraints,
    };
  });
}
