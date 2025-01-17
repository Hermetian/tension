import { NextResponse } from 'next/server';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequestBody<T>(body: unknown, requiredFields: (keyof T)[]): T {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Invalid request body');
  }

  for (const field of requiredFields) {
    if (!(field in body)) {
      throw new ValidationError(`Missing required field: ${String(field)}`);
    }
  }

  return body as T;
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);
  
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json({ error: message }, { status: 500 });
} 