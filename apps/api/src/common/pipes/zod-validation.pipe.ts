import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/** Valide le corps/les paramètres d'une requête avec un schéma Zod partagé. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation échouée',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}
