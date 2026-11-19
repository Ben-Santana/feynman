import type { Message } from './learningFlow'
export const RUBRIC_SKIP_AFTER: number
export function rubricAttempts(messages: Message[], aspect: string): number
export function skippedRubricItems(messages: Message[], aspects: string[]): Set<string>
export function expressesFrustration(content: string): boolean
export function asksForClarity(content: string): boolean
export function admitsNotKnowing(content: string): boolean
export function rubricSkipReason(messages: Message[], aspect?: string, options?: { aware?: boolean }): 'frustration' | 'attempts' | 'unsure' | null
