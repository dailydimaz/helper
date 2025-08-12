import { NextRequest } from 'next/server';
import { toRes } from '../response';
import { ZodSchema } from 'zod';

export async function reqValidate(req: NextRequest, schema: ZodSchema) {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (error: any) {
    if (error.errors) {
      const formattedErrors: Record<string, string> = {};
      error.errors.forEach((err: any) => {
        formattedErrors[err.path[0]] = err.message;
      });
      return { success: false, response: toRes({ errors: formattedErrors, status: 400 }) };
    }
    return { success: false, response: toRes({ message: "Invalid request", status: 400 }) };
  }
}

export function parsePaginate(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '10', 10)));
  const countOnly = searchParams.get('countOnly') === 'true';
  
  return { page, perPage, countOnly };
}