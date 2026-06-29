import { useState, useCallback, useRef, useEffect } from 'react';
import type { Move } from 'chess.js';
import type { StockfishEval } from './useStockfish';
import type { OpeningCollection } from '@chess-openings/eco.json';

export interface LlmAdvice {
  analysis: string;
  recommendedMove: string;
  explanation: string;
  positionSummary?: string;
  keyIdeas?: string[];
  plan?: string;
  warnings?: string[];
}

interface LlmAnalysisRequest {
  fen: string;
  moveHistory: string[];
  evaluation: StockfishEval | null;
  candidateMoves: { uci: string; san: string; cp: number | null; mate: number | null; depth: number }[];
  lastMove: string | null;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  turn: 'w' | 'b';
  openingName?: string | null;
}

function buildSystemPrompt(): string {
  const L: string[] = [];
  L.push('You are a chess coach and analyst. Your role is to explain the current chess position');
  L.push('to a learner who wants to understand the position better.');
  L.push('');
  L.push('When analyzing a position:');
  L.push('1. **Briefly summarize** the current position (material balance, king safety, pawn structure)');
  L.push('2. **Explain the best move** and why it is recommended - connect the analysis to concrete chess principles');
  L.push('3. **Describe the plan** - what the player should aim for in the next few moves');
  L.push('4. **Point out threats and warnings** - what the opponent is threatening and what to watch out for');
  L.push('5. **Use natural, encouraging language** - you are teaching, not just evaluating');
  L.push('');
  L.push('Your analysis should be:');
  L.push('- Clear and concise - 3-6 short paragraphs');
  L.push('- Insightful - refer to concrete piece positions, not just general advice');
  L.push('- Educational - explain the "why" behind the evaluation');
  L.push('- Well-structured - use the JSON format specified below');
  L.push('');
  L.push('IMPORTANT: Always respond in the EXACT JSON format specified.');
  L.push('Do not include markdown code fences, extra text, or commentary outside the JSON object.');
  return L.join('\n');
}

function buildUserPrompt(request: LlmAnalysisRequest): string {
  const { fen, moveHistory, evaluation, candidateMoves, lastMove, isCheck, isCheckmate, isDraw, turn } = request;
  const turnName = turn === 'w' ? 'White' : 'Black';
  const turnCjk = turn === 'w' ? '\u767d\u65b9' : '\u9ed1\u65b9';

  let candidatesDesc = 'None available (engine still analyzing)';
  if (candidateMoves.length > 0) {
    candidatesDesc = candidateMoves
      .filter(m => m.san)
      .map((m, i) => {
        const evalStr = m.mate !== null
          ? 'Mate in ' + Math.abs(m.mate)
          : m.cp !== null
            ? (m.cp >= 0 ? '+' : '') + m.cp.toFixed(2)
            : '?';
        return '  ' + (i + 1) + '. ' + m.san + ' (' + evalStr + ')';
      })
      .join('\n');
  }

  let evalDesc = 'Even position (0.00)';
  if (evaluation) {
    if (evaluation.mate !== null) {
      evalDesc = evaluation.mate > 0
        ? 'White has a forced mate in ' + Math.abs(evaluation.mate)
        : 'Black has a forced mate in ' + Math.abs(evaluation.mate);
    } else if (evaluation.cp !== null) {
      const absEval = Math.abs(evaluation.cp);
      let evalType = 'equal';
      if (absEval > 3) evalType = 'decisive advantage';
      else if (absEval > 1.5) evalType = 'large advantage';
      else if (absEval > 0.7) evalType = 'clear advantage';
      else if (absEval > 0.3) evalType = 'slight advantage';
      evalDesc = evaluation.cp > 0
        ? 'White is ' + evalType + ' (+' + evaluation.cp.toFixed(2) + ')'
        : 'Black is ' + evalType + ' (' + evaluation.cp.toFixed(2) + ')';
    }
  }

  const historyDesc = moveHistory.length > 0 ? moveHistory.join(', ') : 'Starting position';

  const L: string[] = [];
  L.push('Please analyze this chess position for a learner.');
  L.push('');
  L.push('Position FEN: ' + fen);
  if (request.openingName) {
    L.push('Opening: ' + request.openingName);
  }
  L.push(turnCjk + ' (' + turnName + ') to move.');
  L.push('Last move: ' + (lastMove || 'N/A'));
  L.push('Move history: ' + historyDesc);
  L.push('');
  L.push('Engine evaluation: ' + evalDesc);
  if (isCheck) L.push('The side to move is IN CHECK.');
  if (isCheckmate) L.push('The side to move IS IN CHECKMATE.');
  if (isDraw) L.push('The position is a draw.');
  L.push('');
  L.push('Top candidate moves from Stockfish:');
  L.push(candidatesDesc);
  L.push('');
  L.push('Please provide your analysis as a JSON object with these fields:');
  L.push('1. "analysis": a 2-3 paragraph natural-language analysis of the position (in Chinese)');
  L.push('2. "recommendedMove": the best move in SAN notation (e.g. "Nf3") - or "" if there are no candidates');
  L.push('3. "explanation": a concise 1-2 sentence explanation of why this move is good (in Chinese)');
  L.push('4. "keyIdeas": an array of 2-4 key strategic ideas for this position (in Chinese)');
  L.push('5. "plan": a brief description of the overall plan for ' + turnCjk + ' (in Chinese)');
  L.push('6. "warnings": an array of 1-3 things to watch out for or opponent threats (in Chinese)');
  L.push('');
  L.push('Respond ONLY with the JSON object, no other text.');
  return L.join('\n');
}

export function useLlmAnalysis() {
  const [advice, setAdvice] = useState<LlmAdvice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openingBookRef = useRef<OpeningCollection | null>(null);
  const openingBookLoadingRef = useRef(false);

  // Load opening book once
  useEffect(() => {
    if (openingBookRef.current || openingBookLoadingRef.current) return;
    openingBookLoadingRef.current = true;
    import('@chess-openings/eco.json').then(mod => {
      return mod.openingBook();
    }).then(book => {
      openingBookRef.current = book ?? null;
      openingBookLoadingRef.current = false;
      console.log('[LlmAnalysis] Opening book loaded:', book ? Object.keys(book).length : 0, 'positions');
    }).catch(err => {
      console.error('[LlmAnalysis] Failed to load opening book:', err);
      openingBookLoadingRef.current = false;
    });
  }, []);

  // Lookup opening name from FEN
  const getOpeningName = useCallback(async (fen: string): Promise<string | null> => {
    const book = openingBookRef.current;
    if (!book) return null;
    try {
      const { findOpening, getPositionBook } = await import('@chess-openings/eco.json');
      const posBook = getPositionBook(book);
      const opening = findOpening(book, fen, posBook);
      return opening?.name ?? null;
    } catch {
      return null;
    }
  }, []);
  const requestAnalysis = useCallback(async (
    fen: string,
    moveHistory: Move[],
    evaluation: StockfishEval | null,
    candidateMoves: { uci: string; san: string; cp: number | null; mate: number | null; depth: number }[],
    lastMoveSan: string | null,
    isCheck: boolean,
    isCheckmate: boolean,
    isDraw: boolean,
    turn: 'w' | 'b',
  ) => {
    setIsLoading(true);
    setError(null);
    setAdvice(null);

    try {
      const request: LlmAnalysisRequest = {
        fen,
        moveHistory: moveHistory.map(m => m.san),
        evaluation,
        candidateMoves,
        lastMove: lastMoveSan,
        isCheck,
        isCheckmate,
        isDraw,
        turn,
      };

      // Look up opening name from FEN
      if (openingBookRef.current) {
        try {
          const { findOpening, getPositionBook } = await import('@chess-openings/eco.json');
          const posBook = getPositionBook(openingBookRef.current);
          const opening = findOpening(openingBookRef.current, fen, posBook);
          if (opening?.name) {
            request.openingName = opening.name;
          }
        } catch {}
      }

      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(request);
      console.log('[LlmAnalysis] Sending request to API...');

      const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer sk-B2Hogy4c1JkDw4XYqRaLuAfrpm22JZRIVn1aloFuBNVvD1G0' },
        body: JSON.stringify({
          model: 'agnes-2.0-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('API error (' + response.status + '): ' + errorText);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from API');

      console.log('[LlmAnalysis] Received response');
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonStr) as LlmAdvice;
      if (!parsed.analysis) throw new Error('Response missing required "analysis" field');

      parsed.recommendedMove = parsed.recommendedMove || '';
      parsed.explanation = parsed.explanation || '';
      parsed.keyIdeas = parsed.keyIdeas || [];
      parsed.plan = parsed.plan || '';
      parsed.warnings = parsed.warnings || [];
      setAdvice(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[LlmAnalysis] Error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAdvice = useCallback(() => {
    setAdvice(null);
    setError(null);
  }, []);

  return { advice, isLoading, error, requestAnalysis, clearAdvice, getOpeningName };
}
