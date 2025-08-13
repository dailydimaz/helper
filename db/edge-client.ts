// Edge Runtime compatible database client (simplified for middleware)
// For now, we'll disable database operations in Edge Runtime
export const db = {
  select: () => {
    throw new Error('Database operations not available in Edge Runtime middleware');
  },
  insert: () => {
    throw new Error('Database operations not available in Edge Runtime middleware');
  },
  update: () => {
    throw new Error('Database operations not available in Edge Runtime middleware');
  },
  delete: () => {
    throw new Error('Database operations not available in Edge Runtime middleware');
  },
} as any;