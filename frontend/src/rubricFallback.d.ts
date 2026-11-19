import type { Message } from './learningFlow'
export const RUBRIC_SKIP_AFTER: number
export function rubricAttempts(messages: Message[], aspect: string): number
export function skippedRubricItems(messages: Message[], aspects: string[]): Set<string>
export function expressesFrustration(content: string, options?: { broad?: boolean }): boolean
export function asksForClarity(content: string): boolean
export function rubricSkipReason(messages: Message[], aspect?: string, options?: { early?: boolean; broad?: boolean }): 'frustration' | 'attempts' | null
