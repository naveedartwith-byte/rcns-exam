/**
 * Deterministic Pseudo-Random Question Shuffling for Anti-Cheating
 * Royal College of Nursing Swat (RCNS) Examination System
 *
 * Provides mathematically uniform, reproducible question shuffling:
 * - Each student receives a unique permutation of questions.
 * - Neighboring candidates in the same hall see completely different question sequences.
 * - Reproducible: A student who refreshes or resumes their exam sees the exact same order.
 * - Zero database overhead: Derived deterministically from (studentUid + examId) or restored from draft.
 */

/**
 * Converts any string into a 32-bit unsigned integer hash.
 */
export function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash >>> 0;
}

/**
 * Fast, 32-bit seedable pseudo-random number generator (Mulberry32).
 * Returns floats uniformly distributed in [0, 1).
 */
export function createMulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Performs a deterministic Fisher-Yates shuffle using a seeded PRNG.
 * Does not mutate the input array.
 */
export function shuffleArrayWithSeed<T>(array: T[], seedStr: string): T[] {
  if (!array || array.length <= 1) {
    return Array.isArray(array) ? [...array] : [];
  }

  const result = [...array];
  const seed = hashStringToSeed(seedStr);
  const prng = createMulberry32(seed);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

/**
 * Reorders a questions array to match a previously saved question ID order.
 * If new questions were added after the save, they are appended to the end.
 */
export function orderQuestionsBySavedOrder<T extends { id?: string }>(
  questions: T[],
  savedOrder: string[]
): T[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  if (!Array.isArray(savedOrder) || savedOrder.length === 0) return [...questions];

  const map = new Map<string, T>();
  questions.forEach((q, idx) => {
    const key = q.id || `q-${idx + 1}`;
    map.set(key, q);
  });

  const ordered: T[] = [];
  savedOrder.forEach((id) => {
    const match = map.get(id);
    if (match) {
      ordered.push(match);
      map.delete(id);
    }
  });

  // Append any questions not present in savedOrder
  map.forEach((q) => ordered.push(q));

  return ordered;
}

/**
 * Prepares candidate questions for an active exam session:
 * 1. Attaches canonical `originalIndex` to every question so grading can accurately map responses.
 * 2. If `shuffleEnabled` is false, returns original sequence.
 * 3. If `savedOrder` is present (from prior resume/draft), restores that exact candidate sequence.
 * 4. Otherwise, generates a deterministic anti-cheating permutation unique to (studentId + examId).
 */
export function prepareStudentQuestions<T extends { id?: string; order?: number; originalIndex?: number }>(
  questions: T[],
  examId: string,
  studentId: string,
  savedOrder?: string[],
  shuffleEnabled: boolean = true
): T[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  // Step 1: Ensure each question has its true original master index preserved
  const taggedQuestions = questions.map((q, idx) => ({
    ...q,
    id: q.id || `q-${idx + 1}`,
    originalIndex: q.originalIndex !== undefined ? q.originalIndex : idx,
  }));

  // Step 2: If shuffle is explicitly disabled by instructor, return master order
  if (shuffleEnabled === false) {
    return taggedQuestions;
  }

  // Step 3: If candidate already has an active session saved order, preserve it
  if (Array.isArray(savedOrder) && savedOrder.length > 0) {
    const reordered = orderQuestionsBySavedOrder(taggedQuestions, savedOrder);
    if (reordered.length === taggedQuestions.length) {
      return reordered;
    }
  }

  // Step 4: Deterministic anti-cheating permutation for this specific student + exam
  const seedKey = `${studentId}_${examId}_rcns_shuffle`;
  return shuffleArrayWithSeed(taggedQuestions, seedKey);
}
