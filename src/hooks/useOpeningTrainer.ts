import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { OpeningCollection, Opening } from '@chess-openings/eco.json';
import type { StockfishEval } from './useStockfish';

export interface TrainerOpening {
  eco: string;
  name: string;
  moves: string; // SAN notation, e.g. '1. e4 c5 2. Nf3'
  fen: string;
}

export interface TrainStep {
  moveNumber: number; // ply number (0 = starting position)
  playerMove: string | null;  // SAN of what the player played, null if at start
  correctMove: string | null; // SAN of book move, null if no book move
  isCorrect: boolean; // true if player followed the book
  fen: string;
  evalAfter: StockfishEval | null; // engine eval after this step
  isGameOver: boolean;
  isComplete: boolean; // true when all book moves exhausted
}

export type TrainStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'finished';

export function useOpeningTrainer() {
  const [status, setStatus] = useState<TrainStatus>('idle');
  const [currentOpening, setCurrentOpening] = useState<TrainerOpening | null>(null);
  const [steps, setSteps] = useState<TrainStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [engineCandidates, setEngineCandidates] = useState<{ san: string; cp: number | null; mate: number | null }[]>([]);

  const chessRef = useRef(new Chess());
  const openingBookRef = useRef<OpeningCollection | null>(null);
  const openingTreeRef = useRef<Opening[]>([]); // all book moves from this position
  const bookMovesQueueRef = useRef<string[]>([]); // expected move sequence (SAN)
  const playerMoveCountRef = useRef(0);
  const currentStepRef = useRef(0);

  // Load opening book on mount
  useEffect(() => {
    let cancelled = false;
    import('@chess-openings/eco.json').then(mod => {
      if (cancelled) return;
      return mod.openingBook();
    }).then(book => {
      if (cancelled) return;
      openingBookRef.current = book as OpeningCollection | null;
      console.log('[OpeningTrainer] Book loaded:', Object.keys(book as OpeningCollection).length, 'openings');
      setStatus('ready');
    }).catch(err => {
      console.error('[OpeningTrainer] Failed to load book:', err);
    });
    return () => { cancelled = true; };
  }, []);

  const getBookMovesFromFen = useCallback(async (fen: string): Promise<string[]> => {
    const book = openingBookRef.current;
    if (!book) return [];
    try {
      // First try: getFromTos to find next positions
      const { getFromTos } = await import('@chess-openings/eco.json');
      const { next } = await getFromTos(fen, book);
      if (next.length > 0) {
        // Extract the first move from each next opening's moves string
        const currentPly = chessRef.current.history().length;
        const moves: string[] = [];
        for (const opening of next) {
          const allMoves = parseSanMoves(opening.moves);
          if (currentPly < allMoves.length) {
            moves.push(allMoves[currentPly]);
          }
        }
        return [...new Set(moves)]; // deduplicate
      }

      // Fallback: findOpening + parse moves of current opening
      const { findOpening, getPositionBook } = await import('@chess-openings/eco.json');
      const posBook = getPositionBook(book);
      const current = findOpening(book, fen, posBook);
      if (current) {
        const allMoves = parseSanMoves(current.moves);
        const currentPly = chessRef.current.history().length;
        if (currentPly < allMoves.length) {
          return [allMoves[currentPly]];
        }
      }
      return [];
    } catch (err) {
      console.error('[OpeningTrainer] getBookMoves error:', err);
      return [];
    }
  }, []);


  const startOpening = useCallback(async (opening: TrainerOpening) => {
    const chess = new Chess(opening.fen);
    chessRef.current = chess;
    setCurrentOpening(opening);
    setSteps([]);
    setCurrentStepIndex(0);
    setEngineCandidates([]);
    playerMoveCountRef.current = 0;
    currentStepRef.current = 0;

    // Parse book moves but only for reference, don't replay them
    // The opening.fen already represents the position after these moves
    const bookMoves = parseSanMoves(opening.moves);
    bookMovesQueueRef.current = bookMoves;

    // Build initial steps showing the book moves that led to this position
    const initialSteps: TrainStep[] = [];
    let walkChess = new Chess();
    for (let i = 0; i < bookMoves.length; i++) {
      const move = walkChess.move(bookMoves[i]);
      initialSteps.push({
        moveNumber: i + 1,
        playerMove: bookMoves[i],
        correctMove: bookMoves[i],
        isCorrect: true,
        fen: walkChess.fen(),
        evalAfter: null,
        isGameOver: false,
        isComplete: false,
      });
    }

    setSteps(initialSteps);
    setCurrentStepIndex(bookMoves.length);
    currentStepRef.current = bookMoves.length;
    playerMoveCountRef.current = bookMoves.length;
    setStatus('playing');
  }, []);

  const handlePlayerMove = useCallback(async (move: Move): Promise<{ isCorrect: boolean; correctMoves: string[] }> => {
    const chess = chessRef.current;
    const bookMoves = await getBookMovesFromFen(chess.fen());
    const playerSan = move.san;
    const playerIsCorrect = bookMoves.includes(playerSan);
    const isComplete = bookMoves.length === 0;

    chess.move(move);
    const newFen = chess.fen();
    playerMoveCountRef.current += 1;

    const step: TrainStep = {
      moveNumber: currentStepRef.current + 1,
      playerMove: playerSan,
      correctMove: bookMoves.length > 0 ? bookMoves[0] : null,
      isCorrect: playerIsCorrect,
      fen: newFen,
      evalAfter: null,
      isGameOver: chess.isGameOver(),
      isComplete,
    };

    const newIdx = currentStepRef.current + 1;
    currentStepRef.current = newIdx;

    setSteps(prev => [...prev, step]);
    setCurrentStepIndex(newIdx);
    setEngineCandidates([]);

    return { isCorrect: playerIsCorrect, correctMoves: bookMoves };
  }, [getBookMovesFromFen]);

  const finishTraining = useCallback(() => {
    setStatus('finished');
  }, []);

  const resetTraining = useCallback(() => {
    chessRef.current = new Chess();
    setCurrentOpening(null);
    setSteps([]);
    setCurrentStepIndex(0);
    setEngineCandidates([]);
    playerMoveCountRef.current = 0;
    currentStepRef.current = 0;
    openingTreeRef.current = [];
    bookMovesQueueRef.current = [];
    setStatus('ready');
  }, []);

  return {
    status, setStatus,
    currentOpening,
    steps, currentStepIndex,
    engineCandidates, setEngineCandidates,
    chessRef, openingBookRef,
    startOpening, handlePlayerMove, finishTraining, resetTraining, getBookMovesFromFen,
  };
}

function parseSanMoves(movesStr: string): string[] {
  return movesStr
    .split(/\d+\.\s*/)
    .filter(s => s.trim().length > 0)
    .flatMap(s => s.trim().split(/\s+/));
}
