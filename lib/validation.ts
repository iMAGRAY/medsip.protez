import { logger } from './logger'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ValidationRule<T = any> {
  name: string
  message: string
  validate: (value: T) => boolean
  severity?: 'error' | 'warning'
}

export class Validator<T = any> {
  private rules: ValidationRule<T>[] = []

  addRule(rule: ValidationRule<T>): this {
    this.rules.push(rule)
    return this
  }

  required(message: string = 'This field is required'): this {
    return this.addRule({
      name: 'required',
      message,
      validate: (value) => value !== null && value !== undefined && value !== ''
    })
  }

  string(message: string = 'Must be a string'): this {
    return this.addRule({
      name: 'string',
      message,
      validate: (value) => typeof value === 'string'
    })
  }

  number(message: string = 'Must be a number'): this {
    return this.addRule({
      name: 'number',
      message,
      validate: (value) => typeof value === 'number' && !isNaN(value)
    })
  }

  email(message: string = 'Must be a valid email'): this {
    return this.addRule({
      name: 'email',
      message,
      validate: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return typeof value === 'string' && emailRegex.test(value)
      }
    })
  }

  url(message: string = 'Must be a valid URL'): this {
    return this.addRule({
      name: 'url',
      message,
      validate: (value) => {
        try {
          if (typeof value !== 'string') return false
          new URL(value)
          return true
        } catch {
          return false
        }
      }
    })
  }

  minLength(min: number, message?: string): this {
    return this.addRule({
      name: 'minLength',
      message: message || `Must be at least ${min} characters`,
      validate: (value) => typeof value === 'string' && value.length >= min
    })
  }

  maxLength(max: number, message?: string): this {
    return this.addRule({
      name: 'maxLength',
      message: message || `Must be no more than ${max} characters`,
      validate: (value) => typeof value === 'string' && value.length <= max
    })
  }

  min(min: number, message?: string): this {
    return this.addRule({
      name: 'min',
      message: message || `Must be at least ${min}`,
      validate: (value) => typeof value === 'number' && value >= min
    })
  }

  max(max: number, message?: string): this {
    return this.addRule({
      name: 'max',
      message: message || `Must be no more than ${max}`,
      validate: (value) => typeof value === 'number' && value <= max
    })
  }

  pattern(regex: RegExp, message: string): this {
    return this.addRule({
      name: 'pattern',
      message,
      validate: (value) => typeof value === 'string' && regex.test(value)
    })
  }

  custom(name: string, validate: (value: T) => boolean, message: string, severity: 'error' | 'warning' = 'error'): this {
    return this.addRule({
      name,
      message,
      validate,
      severity
    })
  }

  validate(value: T): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    for (const rule of this.rules) {
      try {
        if (!rule.validate(value)) {
          if (rule.severity === 'warning') {
            warnings.push(rule.message)
          } else {
            errors.push(rule.message)
          }
        }
      } catch (error) {
        logger.error('Validation rule error', error, 'VALIDATION')
        errors.push(`Validation error in rule: ${rule.name}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

// Predefined validators for common use cases
export const validators = {
  product: {
    name: new Validator<string>()
      .required('Product name is required')
      .string('Product name must be a string')
      .minLength(2, 'Product name must be at least 2 characters')
      .maxLength(255, 'Product name must be no more than 255 characters'),

    description: new Validator<string>()
      .string('Description must be a string')
      .maxLength(2000, 'Description must be no more than 2000 characters'),

    price: new Validator<number>()
      .number('Price must be a number')
      .min(0, 'Price must be positive'),

    weight: new Validator<string>()
      .string('Weight must be a string')
      .pattern(/^\d+(\.\d+)?\s*(g|kg|lb|oz)$/i, 'Weight must be in format "123.45 kg"'),

    batteryLife: new Validator<string>()
      .string('Battery life must be a string')
      .pattern(/^\d+(\.\d+)?\s*(hours?|h|days?|d)$/i, 'Battery life must be in format "12 hours" or "2 days"'),

    warranty: new Validator<string>()
      .string('Warranty must be a string')
      .pattern(/^\d+\s*(years?|y|months?|m)$/i, 'Warranty must be in format "2 years" or "6 months"')
  },

  manufacturer: {
    name: new Validator<string>()
      .required('Manufacturer name is required')
      .string('Manufacturer name must be a string')
      .minLength(2, 'Manufacturer name must be at least 2 characters')
      .maxLength(100, 'Manufacturer name must be no more than 100 characters'),

    website: new Validator<string>()
      .url('Website must be a valid URL'),

    foundedYear: new Validator<number>()
      .number('Founded year must be a number')
      .min(1800, 'Founded year must be after 1800')
      .max(new Date().getFullYear(), 'Founded year cannot be in the future')
  },

  user: {
    email: new Validator<string>()
      .required('Email is required')
      .email('Must be a valid email address'),

    password: new Validator<string>()
      .required('Password is required')
      .minLength(8, 'Password must be at least 8 characters')
      .pattern(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
      .pattern(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
      .pattern(/(?=.*\d)/, 'Password must contain at least one number')
      .pattern(/(?=.*[!@#$%^&*])/, 'Password must contain at least one special character')
  },

  database: {
    id: new Validator<number>()
      .required('ID is required')
      .number('ID must be a number')
      .min(1, 'ID must be positive'),

    slug: new Validator<string>()
      .required('Slug is required')
      .string('Slug must be a string')
      .pattern(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .minLength(2, 'Slug must be at least 2 characters')
      .maxLength(100, 'Slug must be no more than 100 characters')
  }
}

// Validation middleware for API routes
export function validateRequest<T>(data: T, validator: Validator<T>): ValidationResult {
  const result = validator.validate(data)

  if (!result.isValid) {
    logger.warn('Request validation failed', { errors: result.errors, warnings: result.warnings })
  }

  return result
}

// Bulk validation for arrays
export function validateArray<T>(items: T[], validator: Validator<T>): {
  isValid: boolean
  results: ValidationResult[]
  errors: Array<{ index: number; errors: string[] }>
} {
  const results = items.map(item => validator.validate(item))
  const errors = results
    .map((result, index) => ({ index, errors: result.errors }))
    .filter(item => item.errors.length > 0)

  return {
    isValid: errors.length === 0,
    results,
    errors
  }
}