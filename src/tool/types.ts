import type { tool } from '@opencode-ai/plugin';
import type * as z from 'zod';

export type ToolOptions<Args extends z.ZodRawShape> = Parameters<typeof tool<Args>>[0];

export type Tool<Args extends z.ZodRawShape> = ReturnType<typeof tool<Args>>;

export type ToolSet = Record<string, Tool<z.ZodRawShape>>;
