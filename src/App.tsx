import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type * as cg from '@lichess-org/chessground/types';
import { ChessBoard, type ChessBoardHandle } from './components/ChessBoard';
import { EvalBar } from './components/EvalBar';
import { MoveHistory } from './components/MoveHistory';
import type { MoveRecord } from './components/MoveHistory';
import { AnalysisPanel } from './components/AnalysisPanel';
import { useStockfish } from './hooks/useStockfish';
import type { CandidateMove, StockfishEval, LineStep } from './hooks/useStockfish';
import './App.css';

function App() {
  const chessRef = useRef(new Chess());
  const boardRef = useRef<ChessBoardHandle>(null);
  const [moveRecords, setMoveRecords] = useState<MoveRecord[]>([]);
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<cg.Key[]>([]);
  const [, forceUpdate] = useState(0);

  const stockfish = useStockfish();

  const currentAnalysisRef = useRef<ReturnType<typeof useStockfish>['analysis']>(null);
  const pendingEvalBeforeRef = useRef<StockfishEval | null>(null);
  const pendingMoveColorRef = useRef<'w' | 'b'>('w');

  useEffect(() => {
    if (stockfish.analysis && !stockfish.isEvaluating) {
      currentAnalysisRef.current = stockfish.analysis;

      if (pendingEvalBeforeRef.current) {
        const evalBefore = pendingEvalBeforeRef.current;
        const evalAfter = stockfish.analysis.bestEval;

        // Both evals are in white's perspective (+ means white advantage)
        // Convert to mover's perspective for quality calculation
        const wasWhiteMove = pendingMoveColorRef.current === 'w';

        let quality = '';
        if (evalBefore.cp !== null && evalAfter.cp !== null) {
          const beforeValue = wasWhiteMove ? evalBefore.cp : -evalBefore.cp;
          const afterValue = wasWhiteMove ? evalAfter.cp : -evalAfter.cp;
          const loss = beforeValue - afterValue;

          if (loss <= 0.05) quality = 'best';
          else if (loss <= 0.15) quality = 'excellent';
          else if (loss <= 0.4) quality = 'good';
          else if (loss <= 0.8) quality = 'inaccuracy';
          else if (loss <= 1.5) quality = 'mistake';
          else quality = 'blunder';
        } else if (evalBefore.mate !== null || evalAfter.mate !== null) {
          if (evalBefore.mate !== null && evalBefore.mate > 0 && evalAfter.mate !== null && evalAfter.mate < 0) {
            quality = 'best';
          } else if (evalBefore.cp !== null && evalBefore.cp > 3 && evalAfter.mate !== null) {
            quality = evalAfter.mate < 0 ? 'best' : 'blunder';
          } else {
            quality = 'good';
          }
        }

        setMoveRecords(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], quality };
          return updated;
        });

        pendingEvalBeforeRef.current = null;
      }
    }
  }, [stockfish.analysis, stockfish.isEvaluating]);

  useEffect(() => {
    if (stockfish.isReady && moveRecords.length === 0) {
      stockfish.analyze(chessRef.current.fen(), 18, 3);
    }
  }, [stockfish.isReady]);

  const uciToSan = useCallback((uci: string, fen: string): string => {
    try {
      const chess = new Chess(fen);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = chess.move({ from, to, promotion: promotion || 'q' });
      return move ? move.san : uci;
    } catch {
      return uci;
    }
  }, []);

  const handleMove = useCallback((move: Move, fenBefore: string) => {
    const evalBefore = currentAnalysisRef.current?.bestEval ?? null;
    const engineCandidates = currentAnalysisRef.current?.candidates ?? [];

    pendingEvalBeforeRef.current = evalBefore;
    pendingMoveColorRef.current = move.color;

    const candidatesWithSan: CandidateMove[] = engineCandidates.map(c => ({
      ...c,
      san: uciToSan(c.uci, fenBefore),
    }));

    const record: MoveRecord = {
      move,
      quality: '',
      engineCandidates: candidatesWithSan,
    };

    setMoveRecords(prev => [...prev, record]);
    setSelectedMoveIndex(prev => (prev === null ? 0 : prev + 1));
    setLastMove([move.from as cg.Key, move.to as cg.Key]);
    currentAnalysisRef.current = null;
    forceUpdate(n => n + 1);

    stockfish.analyze(chessRef.current.fen(), 18, 3);
  }, [stockfish, uciToSan]);

  const handleClickCandidate = useCallback((uci: string) => {
    if (!boardRef.current) return;
    boardRef.current.playUciMove(uci);
  }, []);

  const handleUndo = useCallback(() => {
    const move = chessRef.current.undo();
    if (move) {
      setMoveRecords(prev => prev.slice(0, -1));
      setSelectedMoveIndex(prev => prev === null ? null : Math.max(0, prev - 1));
      pendingEvalBeforeRef.current = null;
      const history = chessRef.current.history({ verbose: true });
      if (history.length > 0) {
        const lastMv = history[history.length - 1];
        setLastMove([lastMv.from as cg.Key, lastMv.to as cg.Key]);
      } else {
        setLastMove([]);
      }
      stockfish.analyze(chessRef.current.fen(), 18, 3);
      forceUpdate(n => n + 1);
    }
  }, [stockfish]);

  const handleReset = useCallback(() => {
    chessRef.current.reset();
    setMoveRecords([]);
    setSelectedMoveIndex(null);
    setLastMove([]);
    currentAnalysisRef.current = null;
    pendingEvalBeforeRef.current = null;
    stockfish.analyze(chessRef.current.fen(), 18, 3);
    forceUpdate(n => n + 1);
  }, [stockfish]);

  const handleFlipBoard = useCallback(() => {
    setOrientation(prev => prev === 'white' ? 'black' : 'white');
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!stockfish.isReady) return;
    stockfish.analyze(chessRef.current.fen(), 18, 3);
  }, [stockfish]);

  const handleStartLine = useCallback(() => {
    if (!stockfish.isReady) return;
    stockfish.analyzeLine(chessRef.current.fen(), 10, 16);
  }, [stockfish]);

  const handleStopLine = useCallback(() => {
    stockfish.stopLine();
  }, [stockfish]);

  const handleSelectMove = useCallback((index: number) => {
    setSelectedMoveIndex(index);
    const tempChess = new Chess();
    for (let i = 0; i <= index && i < moveRecords.length; i++) {
      tempChess.move(moveRecords[i].move.san);
    }
    const history = tempChess.history({ verbose: true });
    if (history.length > 0) {
      const mv = history[history.length - 1];
      setLastMove([mv.from as cg.Key, mv.to as cg.Key]);
    }
  }, [moveRecords]);

  const handleSave = useCallback(() => {
    const defaultName = '\u68CB\u5C40_' + new Date().toLocaleDateString('zh-CN');
    const name = prompt('\u8BF7\u8F93\u5165\u68CB\u5C40\u540D\u79F0\uFF1A', defaultName);
    if (!name) return;

    const chess = chessRef.current;
    const pgn = chess.pgn();
    const fen = chess.fen();
    const data = JSON.stringify({
      version: 1,
      name,
      date: new Date().toISOString(),
      fen,
      pgn,
      moves: moveRecords.map(r => ({
        san: r.move.san,
        uci: r.move.from + r.move.to + (r.move.promotion || ''),
        quality: r.quality,
      })),
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.replace(/[<>:"/\\|?*]/g, '_') + '.chess';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [moveRecords]);

  const handleLoad = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.chess';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const newChess = new Chess();
          newChess.reset();
          if (data.pgn) {
            newChess.loadPgn(data.pgn);
          }

          const history = newChess.history({ verbose: true });
          const records: MoveRecord[] = [];
          for (const mv of history) {
            records.push({ move: mv, quality: '', engineCandidates: [] });
          }

          chessRef.current = newChess;
          setMoveRecords(records);
          setSelectedMoveIndex(records.length > 0 ? records.length - 1 : null);
          if (history.length > 0) {
            const last = history[history.length - 1];
            setLastMove([last.from as cg.Key, last.to as cg.Key]);
          } else {
            setLastMove([]);
          }

          currentAnalysisRef.current = null;
          pendingEvalBeforeRef.current = null;
          stockfish.analyze(chessRef.current.fen(), 18, 3);
          forceUpdate(n => n + 1);
        } catch (err) {
          alert('\u6587\u4EF6\u683C\u5F0F\u9519\u8BEF\uFF0C\u65E0\u6CD5\u52A0\u8F7D\u68CB\u5C40');
          console.error(err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [stockfish]);

  const currentRecord = selectedMoveIndex !== null ? moveRecords[selectedMoveIndex] : null;
  const currentFen = chessRef.current.fen();
  const isLatestPosition = selectedMoveIndex === null || selectedMoveIndex === moveRecords.length - 1;

  const getGameStatus = (): string => {
    const chess = chessRef.current;
    if (chess.isCheckmate()) return chess.turn() === 'w' ? '\u9ED1\u65B9\u83B7\u80DC (\u5C06\u6740)' : '\u767D\u65B9\u83B7\u80DC (\u5C06\u6740)';
    if (chess.isDraw()) return '\u548C\u68CB';
    if (chess.isStalemate()) return '\u903C\u548C';
    if (chess.isThreefoldRepetition()) return '\u4E09\u6B21\u91CD\u590D\u5C40\u9762\u548C\u68CB';
    if (chess.isInsufficientMaterial()) return '\u5B50\u529B\u4E0D\u8DB3\u548C\u68CB';
    if (chess.inCheck()) return `${chess.turn() === 'w' ? '\u767D\u65B9' : '\u9ED1\u65B9'}\u88AB\u5C06\u519B\uFF01`;
    return `${chess.turn() === 'w' ? '\u767D\u65B9' : '\u9ED1\u65B9'}\u8D70\u68CB`;
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{'\u56FD\u9645\u8C61\u68CB\u5B66\u4E60\u52A9\u624B'}</h1>
        <div className="engine-status">
          <span className={`status-dot ${stockfish.isReady ? 'ready' : 'loading'}`} />
          {stockfish.isReady ? 'Stockfish \u5F15\u64CE\u5C31\u7EEA' : '\u5F15\u64CE\u52A0\u8F7D\u4E2D...'}
        </div>
      </header>

      <main className="app-main">
        <div className="board-section">
          <div className="board-with-eval">
            <EvalBar evaluation={stockfish.liveEval} orientation={orientation} />
            <ChessBoard
              ref={boardRef}
              chess={chessRef.current}
              onMove={handleMove}
              orientation={orientation}
              lastMove={lastMove}
            />
          </div>
          <div className="game-status">{getGameStatus()}</div>
          <div className="controls">
            <button onClick={handleUndo} disabled={moveRecords.length === 0}>{'\u6094\u68CB'}</button>
            <button onClick={handleFlipBoard}>{'\u7FFB\u8F6C\u68CB\u76D8'}</button>
            <button onClick={handleReset}>{'\u65B0\u5C40'}</button>
            <button onClick={handleSave} className="btn-save">{'\u4FDD\u5B58\u68CB\u5C40'}</button>
            <button onClick={handleLoad} className="btn-load">{'\u52A0\u8F7D\u68CB\u5C40'}</button>
          </div>
        </div>

        <div className="side-panel">
          <AnalysisPanel
            currentMove={currentRecord?.move ?? null}
            currentRecord={currentRecord ?? null}
            isEvaluating={stockfish.isEvaluating}
            onAnalyze={handleAnalyze}
            engineReady={stockfish.isReady}
            liveAnalysis={stockfish.analysis}
            currentFen={currentFen}
            onClickCandidate={handleClickCandidate}
            isLatestPosition={isLatestPosition}
            isAnalyzingLine={stockfish.isAnalyzingLine}
            lineSteps={stockfish.lineSteps}
            lineTotalSteps={stockfish.lineTotalSteps}
            onStartLine={handleStartLine}
            onStopLine={handleStopLine}
          />
          <MoveHistory
            moves={moveRecords}
            selectedIndex={selectedMoveIndex}
            onSelectMove={handleSelectMove}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
