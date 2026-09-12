/** HTTP values and consumer-owned observation policy; frameworks live in adapters. */
export { Active, type Completion } from './lifecycle.js';
export { problemOf, type Problem } from './problem.js';
export {
  classifyCompletion,
  normalizeMethod,
  type Outcome,
  type Termination,
  type CompletionFacts,
  type Classification,
} from './policy.js';
