// Shared by rubric setup and the backend. Criteria follow the four learning tables.
export const learningTypes = {
  theoretical: {
    label: 'Theoretical / Conceptual',
    description: 'Understand concepts, mechanisms, relationships, and phenomena.',
    criteria: {
      remember: ['Defines {topic} accurately.', 'Identifies associated terminology, components, and principles.'],
      understand: ['Explains {topic} accurately in their own words.', 'Explains its purpose or significance.', 'Describes relationships with related concepts.'],
      apply: ['Uses {topic} to explain a given situation.', 'Makes a reasonable prediction using the concept.', 'Applies the concept beyond memorized wording.'],
      analyze: ['Explains interactions between concepts relevant to {topic}.', 'Identifies the underlying cause or mechanism of an outcome.', 'Explains how a changed condition affects the outcome.', 'Identifies and explains misconceptions or incorrect interpretations.'],
    },
    help: { remember: 'Define concepts and identify relevant terminology.', understand: 'Explain meaning, significance, and relationships.', apply: 'Explain a situation and make a reasoned prediction.', analyze: 'Examine mechanisms, interactions, changed conditions, and misconceptions.' },
    tasks: {
      apply: 'The learner must explain the supplied situation using the concept and justify a reasonable prediction, rather than reciting a definition. Do not require calculations or a worked numerical solution.',
      analyze: 'Use an interactive scenario discussion. Require reasoning about relationships, underlying mechanisms, changed conditions, and misconceptions as specified by the checklist. Do not require paper grading, Pass/Fail verdicts, or correction of numbered solution steps.',
    },
    scenarios: {
      apply: 'Introduce a concrete, self-contained situation and a possible changed condition relevant to the concept. Give observable facts only. Ask one question inviting the learner to explain the situation and make a prediction with reasoning. Do not explain the mechanism or provide the prediction.',
      analyze: 'Introduce a self-contained conceptual scenario with interacting factors, a changed condition, and an explicitly tentative interpretation to investigate. Do not identify which interpretation is mistaken or reveal the mechanism. Ask one question about the relationships or reasoning; explore changed conditions and misconceptions in later questions.',
    },
  },
  quantitative: {
    label: 'Quantitative / Problem-Solving',
    description: 'Select methods, perform calculations, and reason through solutions.',
    criteria: {
      remember: ['Recalls relevant equations, algorithms, definitions, or procedures for {topic}.', 'Identifies relevant variables, quantities, and parameters.'],
      understand: ['Explains what a method, equation, or procedure for {topic} represents.', 'Explains when the method is appropriate.', 'Explains the meaning of important variables or steps.'],
      apply: ['Selects an appropriate method for a problem using {topic}.', 'Correctly applies the method.', 'Performs the necessary calculations or procedures.', 'Interprets the answer in the context of the problem.'],
      analyze: ['Explains the reasoning behind solution steps using {topic}.', 'Identifies assumptions or conditions underlying the method.', 'Identifies and explains errors or inconsistencies in a solution.', 'Compares possible approaches when relevant.', 'Explains why a result is reasonable or unreasonable.', 'Explains how changed conditions affect the solution.'],
    },
    help: { remember: 'Recall formulas, methods, definitions, and variables.', understand: 'Explain what a method means and when to use it.', apply: 'Select a method, solve a problem, and interpret the result.', analyze: 'Grade worked solutions and justify reasoning, assumptions, errors, and corrections.' },
    tasks: { apply: 'Require appropriate method selection, correct execution, and interpretation in context. A correct final answer with flawed reasoning is flawed; a correct answer with insufficient reasoning needs clarification.' },
    scenarios: {},
  },
  experimental: {
    label: 'Experimental / Lab-Based',
    description: 'Connect theory to measurements, observations, and experimental evidence.',
    criteria: {
      remember: ['Identifies scientific principles relevant to {topic}.', 'Identifies relevant variables, measurements, equipment, and terminology.', 'Recalls relevant experimental procedures or methods.'],
      understand: ['Explains the purpose of an experiment investigating {topic}.', 'Explains how the procedure relates to the investigated concept.', 'Explains what the measured variables represent.'],
      apply: ['Uses theory about {topic} to make a prediction.', 'Applies an appropriate procedure or method to interpret simulated measurements.', 'Connects observed measurements to the theoretical concept.'],
      analyze: ['Identifies meaningful patterns or relationships in data about {topic}.', 'Compares observations with theoretical predictions.', 'Identifies discrepancies between expected and observed results.', 'Provides plausible explanations for discrepancies.', 'Uses experimental evidence to support conclusions.', 'Distinguishes supported conclusions from speculation.'],
    },
    help: { remember: 'Recall principles, equipment, variables, and procedures.', understand: 'Connect the experiment and measurements to theory.', apply: 'Predict an outcome and interpret simulated measurements.', analyze: 'Compare data with theory, explain discrepancies, and support conclusions with evidence.' },
    tasks: {
      apply: 'Require a theory-based prediction, an appropriate method for interpreting the supplied simulated measurements, and a connection between those measurements and theory. Do not require conducting a physical experiment or uploading real measurements.',
      analyze: 'Use an interactive discussion of simulated experimental evidence. Require patterns, comparison with theoretical predictions, discrepancies and plausible explanations, evidence-supported conclusions, and distinction from speculation as specified by the checklist. Do not require paper grading or correction of worked solutions.',
    },
    scenarios: {
      apply: 'Introduce a clearly labeled Simulated experiment with its purpose, setup, procedure, measured variables, units, and a small plausible simulated dataset. Give enough conditions to make a theory-based prediction and interpret the measurements. Ask one question inviting a prediction with reasoning. Do not supply theoretical formulas, an expected answer, or the interpretation. Later ask the learner to connect the measurements to their prediction.',
      analyze: 'Introduce a clearly labeled Simulated experiment with its purpose, setup, procedure, measured variables, units, and a small plausible simulated dataset containing a meaningful pattern and a discrepancy to investigate. Give sufficient conditions to derive theoretical predictions, but do not state the theory, identify the discrepancy, or explain it. Ask one question about what the learner notices, then explore comparisons, explanations, and evidence in later questions.',
    },
  },
  design: {
    label: 'Design / Project-Based',
    description: 'Make technical decisions, compare alternatives, and explain tradeoffs.',
    criteria: {
      remember: ['Identifies principles, components, techniques, and terminology relevant to {topic}.', 'Identifies relevant requirements and constraints.'],
      understand: ['Explains how principles relevant to {topic} affect a design.', 'Explains the significance of requirements and constraints.', 'Explains relationships between design choices and system behavior.'],
      apply: ['Uses principles relevant to {topic} to make a design decision.', 'Applies appropriate techniques or methods to the design.', 'Justifies the decision using requirements or technical principles.'],
      analyze: ['Identifies tradeoffs between possible design choices involving {topic}.', 'Compares alternative approaches.', 'Analyzes potential failure modes or limitations.', 'Explains consequences of a design decision.', 'Explains how changed requirements or constraints affect the design.', 'Defends or revises a decision using evidence or reasoning.'],
    },
    help: { remember: 'Identify principles, components, requirements, and constraints.', understand: 'Explain how principles and constraints affect system behavior.', apply: 'Make and justify a concrete design decision.', analyze: 'Compare alternatives and tradeoffs, assess consequences, and defend or revise a decision.' },
    tasks: {
      apply: 'Require a concrete design decision using relevant principles and methods, justified against supplied requirements or technical principles. Multiple defensible decisions can pass. Do not require a single preferred answer or a numerical worked solution.',
      analyze: 'Use an interactive design discussion. Require comparisons, tradeoffs, failure modes or limitations, consequences, effects of changed constraints, and a defended or revised decision as specified by the checklist. Judge the reasoning against requirements, not a single preferred answer. Do not require paper grading or identifying erroneous numbered solution steps.',
    },
    scenarios: {
      apply: 'Introduce a self-contained design problem with concrete requirements, constraints, and at least two plausible candidate approaches. Candidate approaches are assessment material, not answer choices with a correct winner. State their relevant properties without recommending one or explaining tradeoffs. Ask one question inviting a concrete design decision justified by requirements and principles.',
      analyze: 'Introduce a self-contained design problem with requirements, constraints, at least two viable alternatives, and a possible change in a requirement or constraint. Provide enough technical properties to reason about tradeoffs without explaining them or recommending a winner. Ask one question comparing the alternatives, then explore failure modes, consequences, changed constraints, and a defended or revised decision.',
    },
  },
};

export const learningTypeIds = Object.keys(learningTypes);

export function resolveLearningType(value) {
  if (value === undefined) return 'quantitative';
  if (typeof value !== 'string' || !Object.hasOwn(learningTypes, value)) throw new Error('Choose a valid learning type.');
  return value;
}

// Explicit null is an unchosen new draft. Missing fields belong to older sessions.
export function restoreLearningType(value, started = false) {
  if (value === null && !started) return null;
  return learningTypeIds.includes(value) ? value : 'quantitative';
}

export function needsScenarioOpening(level, learningType) {
  return learningType !== 'quantitative' && (level === 'apply' || level === 'analyze');
}

export function rubricGuidance(learningType) {
  const profile = learningTypes[resolveLearningType(learningType)];
  return `Learning type: ${profile.label}. Goal: ${profile.description} Follow these learning-level requirements, adapting them to the named concept: ${JSON.stringify(profile.criteria)}. Replace {topic} with the actual topic. Preserve distinct requirements rather than merging them into compound checklist items. ${learningType === 'quantitative' || learningType === undefined ? 'Analyze uses classroom paper review and solution reasoning.' : 'Analyze is an interactive scenario discussion, never a paper-grading exercise.'}`;
}
