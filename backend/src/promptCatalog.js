// Editable prompt metadata and required template variables. Descriptions follow runtime call sites in chat.js and frontend entry points.
export const promptCatalog = [
  {
    "id": "chat.classroomRole",
    "group": "Chat",
    "title": "Classroom student role",
    "variables": [],
    "subgroup": "Conversation setup",
    "description": "Inserted into every generated classmate reply, scenario, and paper-generation call to control how the AI behaves as the learner’s student."
  },
  {
    "id": "chat.context",
    "group": "Chat",
    "title": "Shared chat context",
    "variables": [
      "learningTypeLabel",
      "level",
      "curriculum"
    ],
    "subgroup": "Conversation setup",
    "description": "Inserted into classmate, evaluator, and Quantitative Analyze report calls to supply the active learning type, level, topic, and learner’s rubric checklist."
  },
  {
    "id": "chat.response",
    "group": "Chat",
    "title": "Student response template",
    "variables": [
      "context",
      "classroomRole",
      "paperInstructions",
      "scenarioInstructions",
      "followUp"
    ],
    "subgroup": "Conversation setup",
    "description": "The classmate’s system prompt when generating a reply, opening a scenario, or creating papers. Combines role, context, task instructions, and any unresolved assessment focus."
  },
  {
    "id": "chat.evaluator",
    "group": "Chat",
    "title": "Independent evaluator",
    "variables": [
      "context",
      "levelRubric",
      "levelHelp",
      "quantitativeTask",
      "stageEvidence"
    ],
    "subgroup": "Assessment & reports",
    "description": "Sent to a separate model after learner replies to assess checklist items and the level task. Quantitative Analyze waits for paper grades and a subsequent explanation before evaluating."
  },
  {
    "id": "chat.secondAssessment",
    "group": "Chat",
    "title": "Second evaluation check",
    "variables": [
      "evaluatorSystem"
    ],
    "subgroup": "Assessment & reports",
    "description": "Sent to a second evaluator when the first assessment passes or reports a correct result with flawed reasoning. Reuses the same evidence and evaluator instructions; disagreements prevent completion."
  },
  {
    "id": "chat.finalReport",
    "group": "Chat",
    "title": "Final learning report",
    "variables": [
      "context"
    ],
    "subgroup": "Assessment & reports",
    "description": "Sent to a separate report-writing model after Quantitative Analyze evaluates the paper review and follow-up explanation. Produces the learning summary even when the assessment is incomplete."
  },
  {
    "id": "chat.rubric.remember",
    "group": "Chat",
    "title": "Rubric · Remember",
    "variables": [],
    "subgroup": "Level rubrics",
    "description": "Inserted into the evaluator’s system prompt during Remember for every learning type to define the level’s recall requirements."
  },
  {
    "id": "chat.rubric.understand",
    "group": "Chat",
    "title": "Rubric · Understand",
    "variables": [],
    "subgroup": "Level rubrics",
    "description": "Inserted into the evaluator’s system prompt during Understand for every learning type to judge the learner’s own-word explanations."
  },
  {
    "id": "chat.rubric.apply",
    "group": "Chat",
    "title": "Rubric · Apply",
    "variables": [],
    "subgroup": "Level rubrics",
    "description": "Inserted into the evaluator’s system prompt during Quantitative Apply as the general application rubric, alongside Quantitative Tasks · Apply and the learner’s checklist."
  },
  {
    "id": "chat.rubric.analyze",
    "group": "Chat",
    "title": "Rubric · Analyze",
    "variables": [],
    "subgroup": "Level rubrics",
    "description": "Inserted into the evaluator’s system prompt during Quantitative Analyze after paper grading and explanation, to assess the worked-solution review against the full conversation."
  },
  {
    "id": "chat.openingRemember",
    "group": "Chat",
    "title": "Opening remember",
    "variables": [
      "topic"
    ],
    "subgroup": "Session openings",
    "description": "Returned directly by the API when starting Remember with an empty transcript, including playground tests; no model runs. Regular session openings use separate frontend text."
  },
  {
    "id": "chat.openingOther",
    "group": "Chat",
    "title": "Opening other",
    "variables": [
      "topic"
    ],
    "subgroup": "Session openings",
    "description": "Returned directly by the API for empty-transcript Understand and Quantitative Apply tests; no model runs. Regular sessions use frontend openings; other Apply types generate scenarios."
  },
  {
    "id": "chat.submitPapers",
    "group": "Chat",
    "title": "Submit papers",
    "variables": [],
    "subgroup": "Paper review",
    "description": "Inserted into the classmate’s system prompt when Quantitative Analyze has no papers yet, including new tests and retries. Generates the three worked exercises displayed in the paper-review UI."
  },
  {
    "id": "chat.discussPapers",
    "group": "Chat",
    "title": "Discuss papers",
    "variables": [],
    "subgroup": "Paper review",
    "description": "Inserted into classmate calls only when Quantitative Analyze already has papers but no submitted review. The normal UI waits for grading, then uses a fixed question and a report instead."
  },
  {
    "id": "chat.reviewPass",
    "group": "Chat",
    "title": "Review pass",
    "variables": [],
    "subgroup": "Paper review",
    "description": "Returned directly after a Quantitative Analyze review with no marked steps. Asks how the learner checked the papers; evaluation waits for their next reply."
  },
  {
    "id": "chat.reviewFail",
    "group": "Chat",
    "title": "Review fail",
    "variables": [],
    "subgroup": "Paper review",
    "description": "Returned directly after a Quantitative Analyze review with any marked steps. Requests error explanations and corrections; evaluation waits for the learner’s next reply."
  },
  {
    "id": "chat.openScenario",
    "group": "Chat",
    "title": "Open scenario",
    "variables": [
      "scenario"
    ],
    "subgroup": "Scenario discussions",
    "description": "Inserted into the classmate’s first Apply or Analyze model call for a non-quantitative learning type. Wraps that profile’s scenario instructions to create the opening assessment situation."
  },
  {
    "id": "chat.continueScenario",
    "group": "Chat",
    "title": "Continue scenario",
    "variables": [
      "task"
    ],
    "subgroup": "Scenario discussions",
    "description": "Inserted into later classmate calls during non-quantitative Apply or Analyze when evaluation is incomplete. Includes the profile’s task requirements to continue the existing scenario."
  },
  {
    "id": "chat.followUpFocus",
    "group": "Chat",
    "title": "Follow up focus",
    "variables": [
      "focus",
      "instruction"
    ],
    "subgroup": "Follow-up questions",
    "description": "Inserted into the classmate’s next generated reply after an incomplete evaluation. Combines the evaluator’s question focus, or first unresolved item, with missing/flawed follow-up guidance."
  },
  {
    "id": "chat.focusMissing",
    "group": "Chat",
    "title": "Focus missing",
    "variables": [],
    "subgroup": "Follow-up questions",
    "description": "Inserted into the classmate’s follow-up instructions when the first unresolved assessment item is missing or needs clarification, to ask for the evidence needed to continue."
  },
  {
    "id": "chat.focusFlawed",
    "group": "Chat",
    "title": "Focus flawed",
    "variables": [],
    "subgroup": "Follow-up questions",
    "description": "Inserted into the classmate’s follow-up instructions when the first unresolved assessment item has flawed reasoning, to ask the learner to reconsider that point."
  },
  {
    "id": "chat.stageEvidence",
    "group": "Chat",
    "title": "Stage evidence",
    "variables": [],
    "subgroup": "Assessment & reports",
    "description": "Inserted into evaluator calls for all levels except Quantitative Analyze to restrict credit to the current stage’s learner evidence. Regular sessions also send only that stage’s transcript."
  },
  {
    "id": "chat.beginSession",
    "group": "Chat",
    "title": "Begin session",
    "variables": [],
    "subgroup": "Session openings",
    "description": "Prepended as a synthetic user message to the transcript sent to the classmate model, including paper and scenario generation. It is not shown as a chat message or sent to the evaluator."
  },
  {
    "id": "chat.retryQuestion",
    "group": "Chat",
    "title": "Retry question",
    "variables": [
      "previousQuestion"
    ],
    "subgroup": "Response retries",
    "description": "Appended to a second classmate call when its generated reply exactly repeats the latest assistant message, ignoring case and surrounding whitespace. Supplies that previous message to avoid repeating it."
  },
  {
    "id": "chat.retryPaper",
    "group": "Chat",
    "title": "Retry paper",
    "variables": [],
    "subgroup": "Response retries",
    "description": "Appended to up to two additional paper-generation calls when Quantitative Analyze returns incomplete or oversized worked papers. Requests a replacement set of three exercises."
  },
  {
    "id": "rubric.generate",
    "group": "Rubric creation",
    "title": "Rubric generation",
    "variables": [
      "curriculumContext",
      "writingGuidance",
      "learningTypeGuidance",
      "grounding"
    ],
    "subgroup": "Generation & extraction",
    "description": "Sent to the rubric-generation model when session setup requests AI criteria for chosen concepts and target levels. Returns editable checklists through each target, using uploaded files when supplied."
  },
  {
    "id": "rubric.generateLevel",
    "group": "Rubric creation",
    "title": "Playground checklist generation",
    "variables": [
      "curriculumContext",
      "writingGuidance",
      "learningTypeGuidance",
      "level"
    ],
    "subgroup": "Generation & extraction",
    "description": "Sent to the rubric-generation model by Generate items or Regenerate items in the chat playground. Returns only the selected concept’s selected-level checklist for editing before a test."
  },
  {
    "id": "rubric.extractConcepts",
    "group": "Rubric creation",
    "title": "Extract concepts and rubrics",
    "variables": [
      "curriculumContext",
      "writingGuidance",
      "learningTypeGuidance"
    ],
    "subgroup": "Generation & extraction",
    "description": "The system prompt for the /api/concepts file-extraction endpoint, generating concept names and all four level checklists. The current frontend does not call this endpoint."
  },
  {
    "id": "rubric.suggestConcepts",
    "group": "Rubric creation",
    "title": "Suggest concept names",
    "variables": [
      "curriculumContext",
      "learningTypeGuidance"
    ],
    "subgroup": "Generation & extraction",
    "description": "The system prompt sent when Autofill concepts from files calls /api/concept-suggestions. Generates topic names to append to session setup, without generating their rubrics."
  },
  {
    "id": "rubric.curriculumContext",
    "group": "Rubric creation",
    "title": "Shared curriculum context",
    "variables": [],
    "subgroup": "Shared guidance",
    "description": "Inserted into all concept-suggestion, file-extraction, session-rubric, and playground-checklist model calls to explain how source topics map to separate concept chats and levels."
  },
  {
    "id": "rubric.writingGuidance",
    "group": "Rubric creation",
    "title": "Checklist writing guidance",
    "variables": [],
    "subgroup": "Shared guidance",
    "description": "Inserted into session-rubric generation, file extraction, and playground-checklist system prompts to control the generated checklist items. Concept-name suggestion calls do not use it."
  },
  {
    "id": "rubric.groundInFiles",
    "group": "Rubric creation",
    "title": "Ground in files",
    "variables": [],
    "subgroup": "Source grounding",
    "description": "Inserted into the session rubric-generation system prompt only when uploaded files accompany the chosen concepts. Directs the model to use those files as the criteria’s source."
  },
  {
    "id": "rubric.groundInKnowledge",
    "group": "Rubric creation",
    "title": "Ground in knowledge",
    "variables": [],
    "subgroup": "Source grounding",
    "description": "Inserted into the session rubric-generation system prompt when no files accompany the chosen concepts. Directs the model to derive criteria from subject knowledge."
  },
  {
    "id": "rubric.extractRequest",
    "group": "Rubric creation",
    "title": "Extract request",
    "variables": [],
    "subgroup": "File requests",
    "description": "Sent as user-message text alongside the uploaded file in /api/concepts extraction calls. The current frontend does not call this endpoint."
  },
  {
    "id": "rubric.suggestRequest",
    "group": "Rubric creation",
    "title": "Suggest request",
    "variables": [],
    "subgroup": "File requests",
    "description": "Sent as user-message text alongside uploaded files when Autofill concepts from files requests topic suggestions. The separate system prompt controls how the names are generated."
  },
  {
    "id": "profile.theoretical.rubricGuidance",
    "group": "Learning types",
    "title": "Theoretical · Rubric guidance",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into concept-suggestion, file-extraction, session-rubric, and playground-checklist model calls when Theoretical is selected, to adapt generated content to conceptual reasoning."
  },
  {
    "id": "profile.theoretical.help.remember",
    "group": "Learning types",
    "title": "Theoretical · Help · Remember",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into the evaluator’s system prompt during Theoretical Remember as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.theoretical.help.understand",
    "group": "Learning types",
    "title": "Theoretical · Help · Understand",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into the evaluator’s system prompt during Theoretical Understand as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.theoretical.help.apply",
    "group": "Learning types",
    "title": "Theoretical · Help · Apply",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into the evaluator’s system prompt during Theoretical Apply as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.theoretical.help.analyze",
    "group": "Learning types",
    "title": "Theoretical · Help · Analyze",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into the evaluator’s system prompt during Theoretical Analyze as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.theoretical.tasks.apply",
    "group": "Learning types",
    "title": "Theoretical · Tasks · Apply",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Used as the evaluator’s level rubric during Theoretical Apply after learner replies. Also inserted into classmate calls when an incomplete assessment continues that scenario."
  },
  {
    "id": "profile.theoretical.tasks.analyze",
    "group": "Learning types",
    "title": "Theoretical · Tasks · Analyze",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Used as the evaluator’s level rubric during Theoretical Analyze after learner replies. Also inserted into classmate calls when an incomplete assessment continues that scenario."
  },
  {
    "id": "profile.theoretical.scenarios.apply",
    "group": "Learning types",
    "title": "Theoretical · Scenarios · Apply",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into the classmate’s system prompt when Theoretical Apply starts with an empty transcript, in a session or playground test, to generate that level’s assessment scenario."
  },
  {
    "id": "profile.theoretical.scenarios.analyze",
    "group": "Learning types",
    "title": "Theoretical · Scenarios · Analyze",
    "variables": [],
    "subgroup": "Theoretical / Conceptual",
    "description": "Inserted into the classmate’s system prompt when Theoretical Analyze starts with an empty transcript, in a session or playground test, to generate that level’s assessment scenario."
  },
  {
    "id": "profile.quantitative.rubricGuidance",
    "group": "Learning types",
    "title": "Quantitative · Rubric guidance",
    "variables": [],
    "subgroup": "Quantitative / Problem-Solving",
    "description": "Inserted into concept-suggestion, file-extraction, session-rubric, and playground-checklist model calls when Quantitative is selected, to adapt generated content to problem-solving."
  },
  {
    "id": "profile.quantitative.help.remember",
    "group": "Learning types",
    "title": "Quantitative · Help · Remember",
    "variables": [],
    "subgroup": "Quantitative / Problem-Solving",
    "description": "Inserted into the evaluator’s system prompt during Quantitative Remember as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.quantitative.help.understand",
    "group": "Learning types",
    "title": "Quantitative · Help · Understand",
    "variables": [],
    "subgroup": "Quantitative / Problem-Solving",
    "description": "Inserted into the evaluator’s system prompt during Quantitative Understand as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.quantitative.help.apply",
    "group": "Learning types",
    "title": "Quantitative · Help · Apply",
    "variables": [],
    "subgroup": "Quantitative / Problem-Solving",
    "description": "Inserted into the evaluator’s system prompt during Quantitative Apply as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.quantitative.help.analyze",
    "group": "Learning types",
    "title": "Quantitative · Help · Analyze",
    "variables": [],
    "subgroup": "Quantitative / Problem-Solving",
    "description": "Inserted into the evaluator’s system prompt during Quantitative Analyze as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.quantitative.tasks.apply",
    "group": "Learning types",
    "title": "Quantitative · Tasks · Apply",
    "variables": [],
    "subgroup": "Quantitative / Problem-Solving",
    "description": "Added to the evaluator’s system prompt only during Quantitative Apply, alongside the general Apply rubric, to assess the learner’s method selection, execution, and interpretation."
  },
  {
    "id": "profile.experimental.rubricGuidance",
    "group": "Learning types",
    "title": "Experimental · Rubric guidance",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into concept-suggestion, file-extraction, session-rubric, and playground-checklist model calls when Experimental is selected, to adapt generated content to experimental evidence."
  },
  {
    "id": "profile.experimental.help.remember",
    "group": "Learning types",
    "title": "Experimental · Help · Remember",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into the evaluator’s system prompt during Experimental Remember as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.experimental.help.understand",
    "group": "Learning types",
    "title": "Experimental · Help · Understand",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into the evaluator’s system prompt during Experimental Understand as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.experimental.help.apply",
    "group": "Learning types",
    "title": "Experimental · Help · Apply",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into the evaluator’s system prompt during Experimental Apply as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.experimental.help.analyze",
    "group": "Learning types",
    "title": "Experimental · Help · Analyze",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into the evaluator’s system prompt during Experimental Analyze as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.experimental.tasks.apply",
    "group": "Learning types",
    "title": "Experimental · Tasks · Apply",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Used as the evaluator’s level rubric during Experimental Apply after learner replies. Also inserted into classmate calls when an incomplete assessment continues that scenario."
  },
  {
    "id": "profile.experimental.tasks.analyze",
    "group": "Learning types",
    "title": "Experimental · Tasks · Analyze",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Used as the evaluator’s level rubric during Experimental Analyze after learner replies. Also inserted into classmate calls when an incomplete assessment continues that scenario."
  },
  {
    "id": "profile.experimental.scenarios.apply",
    "group": "Learning types",
    "title": "Experimental · Scenarios · Apply",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into the classmate’s system prompt when Experimental Apply starts with an empty transcript, in a session or playground test, to generate that level’s assessment scenario."
  },
  {
    "id": "profile.experimental.scenarios.analyze",
    "group": "Learning types",
    "title": "Experimental · Scenarios · Analyze",
    "variables": [],
    "subgroup": "Experimental / Lab-Based",
    "description": "Inserted into the classmate’s system prompt when Experimental Analyze starts with an empty transcript, in a session or playground test, to generate that level’s assessment scenario."
  },
  {
    "id": "profile.design.rubricGuidance",
    "group": "Learning types",
    "title": "Design · Rubric guidance",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into concept-suggestion, file-extraction, session-rubric, and playground-checklist model calls when Design is selected, to adapt generated content to design decisions."
  },
  {
    "id": "profile.design.help.remember",
    "group": "Learning types",
    "title": "Design · Help · Remember",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into the evaluator’s system prompt during Design Remember as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.design.help.understand",
    "group": "Learning types",
    "title": "Design · Help · Understand",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into the evaluator’s system prompt during Design Understand as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.design.help.apply",
    "group": "Learning types",
    "title": "Design · Help · Apply",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into the evaluator’s system prompt during Design Apply as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.design.help.analyze",
    "group": "Learning types",
    "title": "Design · Help · Analyze",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into the evaluator’s system prompt during Design Analyze as the learning-type framework for judging that level alongside its rubric and checklist."
  },
  {
    "id": "profile.design.tasks.apply",
    "group": "Learning types",
    "title": "Design · Tasks · Apply",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Used as the evaluator’s level rubric during Design Apply after learner replies. Also inserted into classmate calls when an incomplete assessment continues that scenario."
  },
  {
    "id": "profile.design.tasks.analyze",
    "group": "Learning types",
    "title": "Design · Tasks · Analyze",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Used as the evaluator’s level rubric during Design Analyze after learner replies. Also inserted into classmate calls when an incomplete assessment continues that scenario."
  },
  {
    "id": "profile.design.scenarios.apply",
    "group": "Learning types",
    "title": "Design · Scenarios · Apply",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into the classmate’s system prompt when Design Apply starts with an empty transcript, in a session or playground test, to generate that level’s assessment scenario."
  },
  {
    "id": "profile.design.scenarios.analyze",
    "group": "Learning types",
    "title": "Design · Scenarios · Analyze",
    "variables": [],
    "subgroup": "Design / Project-Based",
    "description": "Inserted into the classmate’s system prompt when Design Analyze starts with an empty transcript, in a session or playground test, to generate that level’s assessment scenario."
  }
];
