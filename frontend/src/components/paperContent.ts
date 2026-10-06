import type { Paper } from './PaperReview'

export function paperParts(paper: Paper) {
  if (paper.problem && paper.steps?.length && paper.conclusion) return { problem: paper.problem, steps: paper.steps, conclusion: paper.conclusion }
  const problem = paper.markdown.match(/## Problem\s*\n([\s\S]*?)(?=\n## My proposed solution)/)?.[1]?.trim() || ''
  const steps = [...paper.markdown.matchAll(/### Step \d+\s*\n([\s\S]*?)(?=\n### Step \d+|\n## Final answer)/g)].map(m => m[1].trim())
  const conclusion = paper.markdown.match(/## Final answer\s*\n([\s\S]*)/)?.[1]?.trim() || ''
  return { problem, steps, conclusion }
}
