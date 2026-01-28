import type {
  AgentPartInput,
  FilePartInput,
  SubtaskPartInput,
  TextPartInput,
} from '@opencode-ai/sdk/v2';

export type PartInput = TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput;
