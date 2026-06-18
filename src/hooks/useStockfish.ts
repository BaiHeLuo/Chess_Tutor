import { useEffect, useRef, useState, useCallback } from 'react';
import { Chess } from 'chess.js';

export interface CandidateMove {
  uci: string;
  san?: string;
  pv: string[];
  cp: number | null;
  mate: number | null;
  depth: number;
}

export interface StockfishEval {
  cp: number | null;
  mate: number | null;
  depth: number;
  bestMove: string;
  pv: string[];
  isReady: boolean;
}

export interface AnalysisResult {
  candidates: CandidateMove[];
  bestEval: StockfishEval;
  positionFen: string;
}

export interface LineStep {
  san: string;
  uci: string;
  cp: number | null;
  mate: number | null;
  depth: number;
  fenBefore: string;
  fenAfter: string;
}

export interface StockfishAPI {
  isReady: boolean;
  liveEval: StockfishEval | null;
  analysis: AnalysisResult | null;
  isEvaluating: boolean;
  analyze: (fen: string, depth?: number, multiPv?: number) => void;
  analyzeLine: (fen: string, steps: number, depth?: number) => void;
  isAnalyzingLine: boolean;
  lineSteps: LineStep[];
  lineTotalSteps: number;
  stopLine: () => void;
  stop: () => void;
}

export function useStockfish(): StockfishAPI {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [liveEval, setLiveEval] = useState<StockfishEval | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAnalyzingLine, setIsAnalyzingLine] = useState(false);
  const [lineSteps, setLineSteps] = useState<LineStep[]>([]);

  // Internal search state
  const searchPhaseRef = useRef<'multipv' | 'singlepv'>('multipv');
  const searchFenRef = useRef('');
  const candidatesRef = useRef<Map<number, CandidateMove>>(new Map());
  const bestEvalRef = useRef<StockfishEval | null>(null);
  const bestDepthRef = useRef(0);
  const requestedDepthRef = useRef(16);
  const requestedMultiPvRef = useRef(3);
  const searchIdRef = useRef(0);
  const hasActiveSearchRef = useRef(false);  // Whether a search is currently running
  const skipBestmoveRef = useRef(false);  // Skip stale bestmove from 'stop' command
  const isLineModeRef = useRef(false);
  const lineChessRef = useRef<Chess | null>(null);
  const lineStepsRef = useRef<LineStep[]>([]);
  const lineTotalRef = useRef(10);
  const lineDepthRef = useRef(16);

  // Convert cp/mate from side-to-move perspective to white's perspective
  // Stockfish always reports from the side-to-move's perspective
  const toWhitePerspective = (cp: number | null, mate: number | null): { cp: number | null; mate: number | null } => {
    const isBlackToMove = searchFenRef.current.split(' ')[1] === 'b';
    if (!isBlackToMove) return { cp, mate };
    return {
      cp: cp !== null ? -cp : null,
      mate: mate !== null ? -mate : null,
    };
  };

  useEffect(() => {
    const worker = new Worker('/stockfish/stockfish.js');
    workerRef.current = worker;

    worker.onerror = (e) => {
      console.error('Stockfish worker error:', e.message);
    };

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : '';

      if (line === 'uciok') {
        worker.postMessage('isready');
      } else if (line === 'readyok') {
        setIsReady(true);
      } else if (line.startsWith('info') && line.includes('score')) {
        const depthMatch = line.match(/\bdepth (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvMatch = line.match(/pv ((?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+)/);
        const multiPvMatch = line.match(/multipv (\d+)/);

        if (!depthMatch) return;

        const depth = parseInt(depthMatch[1]);
        const cp = cpMatch ? parseInt(cpMatch[1]) / 100 : null;
        const mate = mateMatch ? parseInt(mateMatch[1]) : null;
        const pv = pvMatch ? pvMatch[1].trim().split(/\s+/).filter(m => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)) : [];
        const pvIndex = multiPvMatch ? parseInt(multiPvMatch[1]) : 1;

        if (searchPhaseRef.current === 'multipv') {
          // Convert to white's perspective for display
          const w = toWhitePerspective(cp, mate);
          const candidate: CandidateMove = { uci: pv[0] || '', pv, cp: w.cp, mate: w.mate, depth };
          const existing = candidatesRef.current.get(pvIndex);
          if (!existing || depth >= existing.depth) {
            candidatesRef.current.set(pvIndex, candidate);
          }
          // Also update live eval from multipv 1
          if (pvIndex === 1 && depth >= bestDepthRef.current) {
            bestDepthRef.current = depth;
            setLiveEval({ cp: w.cp, mate: w.mate, depth, bestMove: pv[0] || '', pv, isReady: true });
          }
        } else {
          // SinglePV phase: track best eval (also in white's perspective)
          if (depth >= bestDepthRef.current) {
            bestDepthRef.current = depth;
            const w = toWhitePerspective(cp, mate);
            const evalData: StockfishEval = { cp: w.cp, mate: w.mate, depth, bestMove: pv[0] || '', pv, isReady: true };
            bestEvalRef.current = evalData;
            setLiveEval(evalData);
          }
        }
      } else if (line.startsWith('bestmove')) {
        hasActiveSearchRef.current = false;

        // Skip stale bestmove triggered by 'stop' in analyze()/analyzeLine()
        if (skipBestmoveRef.current) {
          console.log('[Stockfish] Skipping stale bestmove');
          skipBestmoveRef.current = false;
          return;
        }

        if (isLineModeRef.current) {
          // Line analysis: get best move and chain next step
          try {
            const sortedCandidates = Array.from(candidatesRef.current.entries())
              .sort(([a], [b]) => a - b)
              .map(([, c]) => c);
            const best = sortedCandidates[0];
            if (!best || !best.uci) throw new Error('no best move');
      
            const chess = lineChessRef.current;
            if (!chess) throw new Error('no chess board');
      
            const fenBefore = chess.fen();
            const uci = best.uci;
            const moveObj = chess.move({
              from: uci.slice(0, 2),
              to: uci.slice(2, 4),
              promotion: uci.length > 4 ? uci[4] : undefined,
            });
            if (!moveObj) throw new Error('invalid move: ' + uci);
      
            const fenAfter = chess.fen();
            const step: LineStep = {
              san: moveObj.san, uci: best.uci,
              cp: best.cp, mate: best.mate, depth: best.depth,
              fenBefore, fenAfter,
            };
            const steps = [...lineStepsRef.current, step];
            lineStepsRef.current = steps;
            setLineSteps(steps);
      
            if (steps.length >= lineTotalRef.current || chess.isGameOver()) {
              setIsAnalyzingLine(false);
              setIsEvaluating(false);
              isLineModeRef.current = false;
            } else {
              candidatesRef.current = new Map();
              bestDepthRef.current = 0;
              searchFenRef.current = fenAfter;
              searchPhaseRef.current = 'multipv';
              hasActiveSearchRef.current = true;
              worker.postMessage(`setoption name MultiPV value 1`);
              worker.postMessage('ucinewgame');
              worker.postMessage(`position fen ${fenAfter}`);
              worker.postMessage(`go depth ${lineDepthRef.current}`);
            }
          } catch (err) {
            console.error('[LineAnalysis] Error:', err);
            setIsAnalyzingLine(false);
            setIsEvaluating(false);
            isLineModeRef.current = false;
          }
        } else if (searchPhaseRef.current === 'multipv') {
          // MultiPV search done, start SinglePV search for accurate best eval
          console.log('[Stockfish] MultiPV done, starting SinglePV');
          searchPhaseRef.current = 'singlepv';
          hasActiveSearchRef.current = true;  // singlepv search is starting
          candidatesRef.current = new Map(candidatesRef.current); // snapshot candidates
          bestDepthRef.current = 0;
          worker.postMessage('setoption name MultiPV value 1');
          worker.postMessage('ucinewgame');
          worker.postMessage(`position fen ${searchFenRef.current}`);
          worker.postMessage(`go depth ${requestedDepthRef.current + 2}`); // slightly deeper
        } else {
          // SinglePV done: finalize analysis
          const sortedCandidates = Array.from(candidatesRef.current.entries())
            .sort(([a], [b]) => a - b)
            .map(([, c]) => c);

          const finalBestEval = bestEvalRef.current || {
            cp: sortedCandidates[0]?.cp ?? null,
            mate: sortedCandidates[0]?.mate ?? null,
            depth: bestDepthRef.current,
            bestMove: sortedCandidates[0]?.uci ?? '',
            pv: sortedCandidates[0]?.pv ?? [],
            isReady: true,
          };

          console.log('[Stockfish] Analysis complete:', sortedCandidates.length, 'candidates');
          setAnalysis({
            candidates: sortedCandidates,
            bestEval: finalBestEval,
            positionFen: searchFenRef.current,
          });

          setIsEvaluating(false);
          candidatesRef.current = new Map();
          bestEvalRef.current = null;
          bestDepthRef.current = 0;
        }
      }
    };

    const initTimer = setTimeout(() => {
      worker.postMessage('uci');
    }, 500);

    return () => {
      clearTimeout(initTimer);
      try { worker.postMessage('quit'); } catch { /* ignore */ }
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const analyze = useCallback((fen: string, depth: number = 18, multiPv: number = 3) => {
    const worker = workerRef.current;
    if (!worker || !isReady) return;

    setIsEvaluating(true);
    setAnalysis(null);
    setLineSteps([]);
    isLineModeRef.current = false;
    candidatesRef.current = new Map();
    bestEvalRef.current = null;
    bestDepthRef.current = 0;
    searchFenRef.current = fen;
    requestedDepthRef.current = depth;
    requestedMultiPvRef.current = multiPv;

    // Phase 1: MultiPV search for top N candidates
    searchPhaseRef.current = 'multipv';
    searchIdRef.current += 1;
    // Only skip bestmove if there's an active search that will respond to 'stop'
    if (hasActiveSearchRef.current) {
      skipBestmoveRef.current = true;
    }
    hasActiveSearchRef.current = true;
    worker.postMessage('stop');
    worker.postMessage(`setoption name MultiPV value ${multiPv}`);
    worker.postMessage('ucinewgame');
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  }, [isReady]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop');
    setIsEvaluating(false);
    isLineModeRef.current = false;
    if (hasActiveSearchRef.current) {
      skipBestmoveRef.current = true;
    }
    setIsAnalyzingLine(false);
  }, []);

  const analyzeLine = useCallback((fen: string, steps: number = 10, depth: number = 16) => {
    const worker = workerRef.current;
    if (!worker || !isReady) return;

    setIsAnalyzingLine(true);
    setIsEvaluating(true);
    setLineSteps([]);
    lineStepsRef.current = [];
    lineTotalRef.current = steps;
    lineDepthRef.current = depth;
    isLineModeRef.current = true;

    // Create a temporary chess board for chaining moves
    lineChessRef.current = new Chess(fen);

    candidatesRef.current = new Map();
    bestDepthRef.current = 0;
    searchFenRef.current = fen;
    searchPhaseRef.current = 'multipv';
    if (hasActiveSearchRef.current) {
      skipBestmoveRef.current = true;
    }
    hasActiveSearchRef.current = true;

    worker.postMessage('stop');
    worker.postMessage(`setoption name MultiPV value 1`);
    worker.postMessage('ucinewgame');
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
  }, [isReady]);

  const stopLine = useCallback(() => {
    isLineModeRef.current = false;
    if (hasActiveSearchRef.current) {
      skipBestmoveRef.current = true;
    }
    setIsAnalyzingLine(false);
    setIsEvaluating(false);
    workerRef.current?.postMessage('stop');
  }, []);

  return { isReady, liveEval, analysis, isEvaluating, analyze, analyzeLine, isAnalyzingLine, lineSteps, lineTotalSteps: lineTotalRef.current, stopLine, stop };
}
