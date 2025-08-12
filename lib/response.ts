import { NextResponse } from 'next/server';

export function toRes(data: {
  message?: string;
  status?: number;
  data?: any;
  errors?: any;
  total?: number;
}) {
  if (!data.status) data.status = 200;
  return NextResponse.json(data, { status: data.status });
}