import { tool as baseTool } from '@opencode-ai/plugin/tool';
import type * as z from 'zod/v4';
import { PluginContext } from '~/context';
import type { Tool, ToolOptions, ToolSet } from './types';

const tool: typeof baseTool = (input) => {
  const ctx = PluginContext.capture();

  // Wrap the execute function to run within the captured context
  const originalExecute = input.execute;
  input.execute = (...args) => ctx.run(() => originalExecute(...args));

  return baseTool(input);
};
tool.schema = baseTool.schema;

export type ElishaToolOptions<Args extends z.ZodRawShape> = {
  id: string;
  config:
    | ToolOptions<Args>
    | ((self: ElishaTool<Args>) => ToolOptions<Args> | Promise<ToolOptions<Args>>);
};

export type ElishaTool<Args extends z.ZodRawShape> = Omit<ElishaToolOptions<Args>, 'config'> & {
  setup: () => Promise<Tool<Args>>;
};

export const defineTool = <Args extends z.ZodRawShape>({
  config: toolConfig,
  ...inputs
}: ElishaToolOptions<Args>) => {
  return {
    ...inputs,
    async setup() {
      if (typeof toolConfig === 'function') {
        toolConfig = await toolConfig(this);
      }
      return tool(toolConfig);
    },
  };
};

export type ElishaToolSetOptions = {
  id: string;
  config: ToolSet | ((self: ElishaToolSet) => ToolSet | Promise<ToolSet>);
};

export type ElishaToolSet = Omit<ElishaToolSetOptions, 'config'> & {
  setup: () => Promise<ToolSet>;
};

export const defineToolSet = ({ config: toolSetConfig, ...inputs }: ElishaToolSetOptions) => {
  return {
    ...inputs,
    async setup() {
      if (typeof toolSetConfig === 'function') {
        toolSetConfig = await toolSetConfig(this);
      }
      return toolSetConfig;
    },
  };
};
