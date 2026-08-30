import { Student } from "../types";

// Fast normalization cache to avoid repeated regex & string operations
const normalizationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 2000;

/**
 * Normalizes Arabic text for flexible, error-tolerant searching:
 * - Strips all Arabic Tashkeel / Harakat diacritics (Fatha, Damma, Kasra, Shadda, Sukun, Tanween, etc.)
 * - Strips Tatweel (ـ)
 * - Normalizes all forms of Alif (أ, إ, آ, ٱ) -> ا
 * - Normalizes Taa Marbuta (ة) -> ه
 * - Normalizes Alif Maqsura (ى) and Hamza on Yaa (ئ) -> ي
 * - Normalizes Waw with Hamza (ؤ) -> و
 * - Normalizes Arabic-Indic digits (٠-٩) -> (0-9)
 * - Normalizes compound prefixes like "عبد " / "عبد"
 * - Converts to lowercase and trims excess whitespace
 */
export function normalizeArabicText(input?: string | number | null): string {
  if (input === undefined || input === null) return "";
  const rawKey = String(input);
  if (normalizationCache.has(rawKey)) {
    return normalizationCache.get(rawKey)!;
  }

  let text = rawKey.trim().toLowerCase();

  // 1. Convert Arabic-Indic Digits to standard 0-9
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  for (let i = 0; i < 10; i++) {
    if (text.includes(arabicDigits[i])) {
      text = text.split(arabicDigits[i]).join(String(i));
    }
  }

  // 2. Remove Tashkeel (Harakat) and Tatweel
  text = text.replace(/[\u064B-\u065F\u0670\u0640]/g, "");

  // 3. Normalize Alifs
  text = text.replace(/[أإآٱ]/g, "ا");

  // 4. Normalize Taa Marbuta to Haa
  text = text.replace(/ة/g, "ه");

  // 5. Normalize Alif Maqsura & Hamza-on-Nabrah/Yaa to Yaa
  text = text.replace(/[ىئ]/g, "ي");

  // 6. Normalize Waw with Hamza
  text = text.replace(/ؤ/g, "و");

  // 7. Remove floating Hamza (ء)
  text = text.replace(/ء/g, "");

  // 8. Normalize compound names (e.g., "عبد الله" <-> "عبدالله", "عبد الرحمن" <-> "عبدالرحمن")
  text = text.replace(/\bعبد\s+/g, "عبد");
  text = text.replace(/\bابو\s+/g, "ابو");
  text = text.replace(/\bام\s+/g, "ام");

  // 9. Clean extra symbols and collapse multiple spaces
  text = text.replace(/[^\w\u0600-\u06FF\s]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  // Prevent memory unbounded growth
  if (normalizationCache.size >= MAX_CACHE_SIZE) {
    normalizationCache.clear();
  }
  normalizationCache.set(rawKey, text);

  return text;
}

/**
 * Calculates Levenshtein Distance between two normalized short strings
 * to tolerate single-letter typographical mistakes.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export interface SearchMatchResult {
  match: boolean;
  score: number;
}

/**
 * Smart Multi-Token & Fuzzy Matcher for a student record:
 * - Matches first name + last name omitting middle names (e.g., "أحمد علي" matches "أحمد محمد محمود علي حسن")
 * - Handles grammatical, spelling, and hamza/tashkeel differences seamlessly
 * - Matches barcode, phone numbers, and group details
 * - Calculates a ranking score so the most relevant matches appear at the top
 */
export function matchStudentSearch(student: Student, rawQuery: string): SearchMatchResult {
  if (!rawQuery || !rawQuery.trim()) {
    return { match: true, score: 0 };
  }

  const normalizedQuery = normalizeArabicText(rawQuery);
  if (!normalizedQuery) {
    return { match: true, score: 0 };
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  if (queryTokens.length === 0) {
    return { match: true, score: 0 };
  }

  // Normalize student target fields
  const normName = normalizeArabicText(student.name);
  const normBarcode = normalizeArabicText(student.barcode);
  const normPhone = normalizeArabicText(student.phone);
  const normParentPhone = normalizeArabicText(student.parentPhone);
  const normGrade = normalizeArabicText(student.groupGrade);
  const normDays = normalizeArabicText(student.groupDays);

  const nameTokens = normName.split(" ").filter(Boolean);

  // Exact full barcode / phone match -> Top Priority Score
  if (normBarcode === normalizedQuery || normPhone === normalizedQuery || normParentPhone === normalizedQuery) {
    return { match: true, score: 2000 };
  }

  // Exact full name match
  if (normName === normalizedQuery) {
    return { match: true, score: 1500 };
  }

  // Direct substring in name or barcode
  if (normBarcode.includes(normalizedQuery)) {
    return { match: true, score: 1200 };
  }

  let totalScore = 0;
  let allTokensMatched = true;
  let lastMatchedTokenIndex = -1;
  let isSequential = true;

  // Check each query token against student data
  for (const qToken of queryTokens) {
    let tokenMatched = false;
    let tokenScore = 0;

    // 1. Check student name tokens
    for (let i = 0; i < nameTokens.length; i++) {
      const nToken = nameTokens[i];

      // Exact word match
      if (nToken === qToken) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 100);
        if (i > lastMatchedTokenIndex) {
          lastMatchedTokenIndex = i;
        } else {
          isSequential = false;
        }
        break;
      }

      // Word starts with token (prefix)
      if (nToken.startsWith(qToken)) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 75);
        if (i > lastMatchedTokenIndex) {
          lastMatchedTokenIndex = i;
        } else {
          isSequential = false;
        }
        break;
      }

      // Substring match
      if (nToken.includes(qToken)) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 50);
        if (i > lastMatchedTokenIndex) {
          lastMatchedTokenIndex = i;
        } else {
          isSequential = false;
        }
        break;
      }

      // Strip "ال" prefix from either word
      const strippedNToken = nToken.startsWith("ال") ? nToken.slice(2) : nToken;
      const strippedQToken = qToken.startsWith("ال") ? qToken.slice(2) : qToken;
      if (strippedNToken === strippedQToken || strippedNToken.startsWith(strippedQToken)) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 80);
        if (i > lastMatchedTokenIndex) {
          lastMatchedTokenIndex = i;
        } else {
          isSequential = false;
        }
        break;
      }

      // Typo tolerance (Levenshtein distance <= 1 for tokens of length >= 4)
      if (qToken.length >= 4 && nToken.length >= 4) {
        const dist = levenshteinDistance(qToken, nToken);
        if (dist <= 1) {
          tokenMatched = true;
          tokenScore = Math.max(tokenScore, 60);
          if (i > lastMatchedTokenIndex) {
            lastMatchedTokenIndex = i;
          } else {
            isSequential = false;
          }
          break;
        }
      }
    }

    // 2. Check barcode or phones if not matched in name
    if (!tokenMatched) {
      if (normBarcode.includes(qToken)) {
        tokenMatched = true;
        tokenScore = 90;
      } else if (normPhone.includes(qToken) || normParentPhone.includes(qToken)) {
        tokenMatched = true;
        tokenScore = 85;
      } else if (normGrade.includes(qToken) || normDays.includes(qToken)) {
        tokenMatched = true;
        tokenScore = 40;
      }
    }

    if (!tokenMatched) {
      allTokensMatched = false;
      break;
    }

    totalScore += tokenScore;
  }

  if (!allTokensMatched) {
    return { match: false, score: 0 };
  }

  // Bonus for sequential name matching (e.g. First name then Last name)
  if (isSequential && queryTokens.length > 1) {
    totalScore += 80;
  }

  // Bonus for first name match (first query token matching first name token)
  if (nameTokens.length > 0 && queryTokens.length > 0) {
    if (nameTokens[0].startsWith(queryTokens[0]) || nameTokens[0] === queryTokens[0]) {
      totalScore += 50;
    }
  }

  return { match: true, score: totalScore };
}

/**
 * Filters and ranks a list of students using smart fuzzy Arabic multi-token search.
 */
export function filterAndRankStudents(students: Student[], query: string): Student[] {
  if (!query || !query.trim()) {
    return students;
  }

  const results: { student: Student; score: number }[] = [];

  for (const s of students) {
    const { match, score } = matchStudentSearch(s, query);
    if (match) {
      results.push({ student: s, score });
    }
  }

  // Sort by highest relevance score first
  results.sort((a, b) => b.score - a.score);

  return results.map((r) => r.student);
}
