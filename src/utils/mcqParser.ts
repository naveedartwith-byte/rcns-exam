import type { ParsedMCQ, BulkImportSummary } from '../types/question';

/**
 * Normalizes input text by fixing line endings, unicode quotes,
 * en-dashes, tabs, and non-breaking spaces.
 */
export function normalizeMCQText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\t/g, ' ')
    .trim();
}

/**
 * Regex patterns for question detection, options, answer, and explanation.
 */
const QUESTION_HEADER_REGEX = /^(?:(?:Q|Question|Que|Ques)\s*[\.\:\#\-\)]?\s*(\d+)[\.\:\-\)]?|(\d+)[\.\)\:\-\]])\s*(.*)$/i;
const OPTION_A_REGEX = /^(?:(?:\(A\)|\[A\]|A[\.\)\:\-]|Option\s*A[\.\:\-]?)\s*)(.*)$/i;
const OPTION_B_REGEX = /^(?:(?:\(B\)|\[B\]|B[\.\)\:\-]|Option\s*B[\.\:\-]?)\s*)(.*)$/i;
const OPTION_C_REGEX = /^(?:(?:\(C\)|\[C\]|C[\.\)\:\-]|Option\s*C[\.\:\-]?)\s*)(.*)$/i;
const OPTION_D_REGEX = /^(?:(?:\(D\)|\[D\]|D[\.\)\:\-]|Option\s*D[\.\:\-]?)\s*)(.*)$/i;

const ANSWER_REGEX = /^(?:(?:Correct\s*Answer|Answer|Correct\s*Option|Correct|Ans|Key)\s*[\:\-\=\.\)]?\s*(?:Option\s*)?[\(\[]?([A-Da-d])[\)\]]?)(?:[\.\s\:\-\)]*(.*))?$/i;
const EXPLANATION_REGEX = /^(?:(?:Explanation|Rationale|Reason|Exp|Note)\s*[\:\-\=\.]?\s*)(.*)$/i;

/**
 * Normalizes question text for duplicate detection (lowercase, alphanumeric only).
 */
export function normalizeForDuplicateCheck(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Flags duplicate question texts within a batch of parsed questions.
 */
export function detectDuplicates(questions: ParsedMCQ[]): ParsedMCQ[] {
  const seenTexts = new Map<string, number[]>();

  questions.forEach((q: ParsedMCQ, index: number) => {
    const norm = normalizeForDuplicateCheck(q.questionText);
    if (!norm) return;
    if (!seenTexts.has(norm)) {
      seenTexts.set(norm, []);
    }
    seenTexts.get(norm)!.push(index);
  });

  return questions.map((q: ParsedMCQ, index: number): ParsedMCQ => {
    const norm = normalizeForDuplicateCheck(q.questionText);
    const indices = norm ? seenTexts.get(norm) : undefined;
    const isDuplicate = Boolean(indices && indices.length > 1 && indices[0] !== index);

    const warnings = [...(q.warnings || [])];
    if (isDuplicate && !warnings.includes('Duplicate question prompt detected in this batch.')) {
      warnings.push('Duplicate question prompt detected in this batch.');
    }

    return {
      ...q,
      isDuplicate,
      warnings,
    };
  });
}

/**
 * Validates a single ParsedMCQ object.
 * Checks for presence of question text, 4 options, and a valid correct answer ('A', 'B', 'C', 'D').
 */
export function validateParsedMCQ(q: ParsedMCQ): ParsedMCQ {
  const errors: string[] = [];
  const warnings: string[] = [...(q.warnings || [])];

  // 1. Question text validation
  if (!q.questionText || q.questionText.trim().length === 0) {
    errors.push('Question text is missing.');
  } else if (q.questionText.trim().length < 5) {
    warnings.push('Question text is very short.');
  }

  // 2. Options validation
  if (!q.optionA || q.optionA.trim().length === 0) {
    errors.push('Option A is missing.');
  }
  if (!q.optionB || q.optionB.trim().length === 0) {
    errors.push('Option B is missing.');
  }
  if (!q.optionC || q.optionC.trim().length === 0) {
    errors.push('Option C is missing.');
  }
  if (!q.optionD || q.optionD.trim().length === 0) {
    errors.push('Option D is missing.');
  }

  // Check for duplicate options within the same question
  const nonBlankOptions = [q.optionA, q.optionB, q.optionC, q.optionD]
    .map((o) => (o || '').trim().toLowerCase())
    .filter(Boolean);
  const uniqueOptions = new Set(nonBlankOptions);
  if (nonBlankOptions.length === 4 && uniqueOptions.size < 4) {
    warnings.push('Contains duplicate option choices.');
  }

  // 3. Correct Answer validation
  const validAnswers = ['A', 'B', 'C', 'D'];
  const ansUpper = (q.correctAnswer || '').trim().toUpperCase();
  if (!ansUpper) {
    errors.push('Correct answer is missing.');
  } else if (!validAnswers.includes(ansUpper)) {
    errors.push(`Invalid correct answer "${q.correctAnswer}". Must be A, B, C, or D.`);
  }

  // 4. Duplicate Question Warning
  if (q.isDuplicate) {
    warnings.push('Duplicate question prompt detected in this batch.');
  }

  return {
    ...q,
    correctAnswer: validAnswers.includes(ansUpper) ? (ansUpper as 'A' | 'B' | 'C' | 'D') : '',
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

/**
 * Parses raw text containing one or many MCQs into structured ParsedMCQ objects.
 */
export function parseMCQText(rawText: string): BulkImportSummary {
  const normalized = normalizeMCQText(rawText);
  if (!normalized) {
    return {
      totalDetected: 0,
      validCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      parsedQuestions: [],
    };
  }

  const lines = normalized.split('\n');
  const rawBlocks: string[][] = [];
  let currentBlock: string[] = [];

  // 1. Group into question blocks
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      // Empty line - if current block has content and next line looks like a question header, split
      if (currentBlock.length > 0) {
        let nextNonEmpty = '';
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim()) {
            nextNonEmpty = lines[j].trim();
            break;
          }
        }
        if (nextNonEmpty && QUESTION_HEADER_REGEX.test(nextNonEmpty)) {
          rawBlocks.push(currentBlock);
          currentBlock = [];
        }
      }
      continue;
    }

    // Check if line is a new question header
    if (QUESTION_HEADER_REGEX.test(line) && currentBlock.length > 0) {
      const hasOptions = currentBlock.some((l) =>
        OPTION_A_REGEX.test(l) || OPTION_B_REGEX.test(l) || ANSWER_REGEX.test(l)
      );
      if (hasOptions) {
        rawBlocks.push(currentBlock);
        currentBlock = [];
      }
    }

    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    rawBlocks.push(currentBlock);
  }

  // If no blocks were created, treat whole text as 1 block
  if (rawBlocks.length === 0 && lines.some((l) => l.trim())) {
    rawBlocks.push(lines.filter((l) => l.trim()));
  }

  // 2. Parse each block into a ParsedMCQ
  const parsedQuestions: ParsedMCQ[] = rawBlocks.map((block: string[], index: number) => {
    return parseSingleBlock(block, index + 1);
  });

  // 3. Post-parsing: detect duplicates and finalize validation
  const withDuplicates: ParsedMCQ[] = detectDuplicates(parsedQuestions);
  const validatedQuestions: ParsedMCQ[] = withDuplicates.map((q: ParsedMCQ) => validateParsedMCQ(q));

  const validCount = validatedQuestions.filter((q: ParsedMCQ) => q.isValid).length;
  const errorCount = validatedQuestions.filter((q: ParsedMCQ) => !q.isValid).length;
  const duplicateCount = validatedQuestions.filter((q: ParsedMCQ) => Boolean(q.isDuplicate)).length;

  return {
    totalDetected: validatedQuestions.length,
    validCount,
    errorCount,
    duplicateCount,
    parsedQuestions: validatedQuestions,
  };
}

/**
 * Parses a single block of lines into a ParsedMCQ
 */
function parseSingleBlock(block: string[], orderIndex: number): ParsedMCQ {
  let questionText = '';
  let optionA = '';
  let optionB = '';
  let optionC = '';
  let optionD = '';
  let correctAnswer: 'A' | 'B' | 'C' | 'D' | '' = '';
  let explanation = '';

  type ParseState = 'question' | 'optA' | 'optB' | 'optC' | 'optD' | 'explanation';
  let state: ParseState = 'question';

  for (let i = 0; i < block.length; i++) {
    const rawLine = block[i].trim();
    if (!rawLine) continue;

    // Check for inline options (e.g., A) Foo B) Bar C) Baz D) Qux on one line)
    if (
      OPTION_A_REGEX.test(rawLine) &&
      (rawLine.includes(' B)') || rawLine.includes(' B.') || rawLine.includes(' (B)'))
    ) {
      const inlineParsed = parseInlineOptions(rawLine);
      if (inlineParsed.optionA) optionA = inlineParsed.optionA;
      if (inlineParsed.optionB) optionB = inlineParsed.optionB;
      if (inlineParsed.optionC) optionC = inlineParsed.optionC;
      if (inlineParsed.optionD) optionD = inlineParsed.optionD;
      state = 'optD';
      continue;
    }

    // Check for Answer line
    const answerMatch = rawLine.match(ANSWER_REGEX);
    if (answerMatch) {
      const ansChar = answerMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      correctAnswer = ansChar;
      if (answerMatch[2] && !explanation) {
        explanation = answerMatch[2].trim();
      }
      continue;
    }

    // Check for Explanation line
    const explanationMatch = rawLine.match(EXPLANATION_REGEX);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
      state = 'explanation';
      continue;
    }

    // Check Option A
    const optAMatch = rawLine.match(OPTION_A_REGEX);
    if (optAMatch) {
      optionA = optAMatch[1].trim();
      state = 'optA';
      continue;
    }

    // Check Option B
    const optBMatch = rawLine.match(OPTION_B_REGEX);
    if (optBMatch) {
      optionB = optBMatch[1].trim();
      state = 'optB';
      continue;
    }

    // Check Option C
    const optCMatch = rawLine.match(OPTION_C_REGEX);
    if (optCMatch) {
      optionC = optCMatch[1].trim();
      state = 'optC';
      continue;
    }

    // Check Option D
    const optDMatch = rawLine.match(OPTION_D_REGEX);
    if (optDMatch) {
      optionD = optDMatch[1].trim();
      state = 'optD';
      continue;
    }

    // Accumulation according to state
    if (state === 'question') {
      let cleaned = rawLine;
      if (i === 0) {
        const headerMatch = rawLine.match(QUESTION_HEADER_REGEX);
        if (headerMatch && headerMatch[3] !== undefined) {
          cleaned = headerMatch[3].trim();
        } else if (headerMatch && headerMatch[1] !== undefined) {
          cleaned = rawLine.replace(/^(?:(?:Q|Question|Que|Ques)\s*[\.\:\#\-\)]?\s*\d+|\d+[\.\)\:\-\]])\s*/i, '').trim();
        }
      }
      questionText = questionText ? `${questionText} ${cleaned}` : cleaned;
    } else if (state === 'optA') {
      optionA = optionA ? `${optionA} ${rawLine}` : rawLine;
    } else if (state === 'optB') {
      optionB = optionB ? `${optionB} ${rawLine}` : rawLine;
    } else if (state === 'optC') {
      optionC = optionC ? `${optionC} ${rawLine}` : rawLine;
    } else if (state === 'optD') {
      optionD = optionD ? `${optionD} ${rawLine}` : rawLine;
    } else if (state === 'explanation') {
      explanation = explanation ? `${explanation} ${rawLine}` : rawLine;
    }
  }

  const parsed: ParsedMCQ = {
    id: `parsed-q-${Date.now()}-${orderIndex}-${Math.random().toString(36).substring(2, 6)}`,
    order: orderIndex,
    questionText: questionText.trim(),
    optionA: optionA.trim(),
    optionB: optionB.trim(),
    optionC: optionC.trim(),
    optionD: optionD.trim(),
    correctAnswer,
    explanation: explanation.trim() || undefined,
    marks: 2,
    errors: [],
    warnings: [],
    isValid: true,
  };

  return parsed;
}

/**
 * Parses inline options on a single line
 */
function parseInlineOptions(line: string): {
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
} {
  const result: { optionA?: string; optionB?: string; optionC?: string; optionD?: string } = {};

  const regex = /(?:^|\s)(?:\(?([A-D])[\.\)]|\bOption\s+([A-D])[\.\:\-])\s+/gi;
  const matches: { letter: string; index: number; length: number }[] = [];
  let m;
  while ((m = regex.exec(line)) !== null) {
    const letter = (m[1] || m[2]).toUpperCase();
    matches.push({ letter, index: m.index, length: m[0].length });
  }

  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k];
    const start = cur.index + cur.length;
    const end = k + 1 < matches.length ? matches[k + 1].index : line.length;
    const text = line.substring(start, end).trim();

    if (cur.letter === 'A') result.optionA = text;
    if (cur.letter === 'B') result.optionB = text;
    if (cur.letter === 'C') result.optionC = text;
    if (cur.letter === 'D') result.optionD = text;
  }

  return result;
}

/**
 * Standard MCQ Template for download
 */
export const SAMPLE_MCQ_TEMPLATE = `1. What is the normal adult resting blood pressure baseline?
A) 120/80 mmHg
B) 140/90 mmHg
C) 90/60 mmHg
D) 160/100 mmHg
Answer: A
Explanation: 120/80 mmHg is the standard optimal baseline for healthy adults.

2. Which organ in the human body is primarily responsible for producing insulin?
A) Liver
B) Pancreas
C) Kidney
D) Spleen
Answer: B
Explanation: The beta cells of the Islets of Langerhans in the pancreas secrete insulin.

3. In standard medical triage, which color tag indicates an immediate life-threatening emergency?
A) Green
B) Yellow
C) Red
D) Black
Answer: C
Explanation: Red triage tags represent immediate priority requiring immediate intervention.

4. What is the primary route of transmission for pulmonary tuberculosis?
A) Blood transfusion
B) Airborne droplet nuclei
C) Contaminated water
D) Direct skin contact
Answer: B
Explanation: Mycobacterium tuberculosis is spread through airborne droplets when infected individuals cough or sneeze.
`;
