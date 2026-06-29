import { useRef, useCallback, useState, useEffect } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import type * as cg from '@lichess-org/chessground/types';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import type { TrainerOpening, TrainStep, TrainStatus } from '../hooks/useOpeningTrainer';
import { getOpeningNameCn } from '../data/openingNamesCn';

interface OpeningPracticeProps {
  opening: TrainerOpening;
  steps: TrainStep[];
  currentStepIndex: number;
  status: TrainStatus;
  onPlayerMove: (move: Move) => Promise<{ isCorrect: boolean; correctMoves: string[] }>;
  onFinish: () => void;
  onBack: () => void;
  engineCandidates: { san: string; cp: number | null; mate: number | null }[];
}

function toDests(chess: Chess): cg.Dests {
  const dests: cg.Dests = new Map();
  const moves = chess.moves({ verbose: true });
  for (const m of moves) {
    if (!dests.has(m.from as cg.Key)) dests.set(m.from as cg.Key, []);
    dests.get(m.from as cg.Key)!.push(m.to as cg.Key);
  }
  return dests;
}

function toColor(chess: Chess): cg.Color {
  return chess.turn() === 'w' ? 'white' : 'black';
}

function checkColor(chess: Chess): cg.Color | undefined {
  if (chess.inCheck()) return toColor(chess);
  return undefined;
}

export function OpeningPractice({ opening, steps, currentStepIndex, status, onPlayerMove, onFinish, onBack, engineCandidates }: OpeningPracticeProps) {
  const boardElRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const chessRef = useRef(new Chess());
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong' | 'complete' | 'info'; message: string } | null>(null);
  const [isPlayerTurn, setIsPlayerTurn] = useState(false);
  const [correctMoves, setCorrectMoves] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);

  // Initialize the chess position from opening
  useEffect(() => {
    const chess = new Chess(opening.fen);
    chessRef.current = chess;
    // Only enable if it's the player's turn (white's turn for openings where white is to move)
    const isWhiteTurn = chess.turn() === 'w';
    setIsPlayerTurn(isWhiteTurn);
    setFeedback({ type: 'info', message: isWhiteTurn ? '请走出谱着中的正确走法' : '请等待对手走棋...' });
    setCorrectMoves([]);
    setShowHint(false);
  }, [opening]);

  // Sync board when steps change (e.g. after replay)
  useEffect(() => {
    if (!cgRef.current) return;
    const chess = chessRef.current;
    cgRef.current.set({
      fen: chess.fen(),
      turnColor: toColor(chess),
      check: checkColor(chess),
      movable: {
        color: isPlayerTurn ? toColor(chess) : undefined,
        dests: isPlayerTurn ? toDests(chess) : new Map(),
      },
    });
  });

  // Check if game is complete
  const currentStep = currentStepIndex > 0 && currentStepIndex <= steps.length ? steps[currentStepIndex - 1] : null;
  const isComplete = currentStep?.isComplete || status === 'finished';

  // Play a book move (opponent's response)
  const playBookResponse = useCallback(() => {
    const chess = chessRef.current;
    const ply = chess.history().length;
    const bookMoves = parseSanMoves(opening.moves);
    if (ply < bookMoves.length) {
      try {
        chess.move(bookMoves[ply]);
      } catch {}
    }
    if (cgRef.current) {
      cgRef.current.set({
        fen: chess.fen(),
        turnColor: toColor(chess),
        check: checkColor(chess),
        movable: {
          color: toColor(chess),
          dests: toDests(chess),
        },
      });
    }
    setIsPlayerTurn(true);
    setShowHint(false);
  }, [opening]);

  // Initialize Chessground
  useEffect(() => {
    if (!boardElRef.current) return;
    const chess = chessRef.current;
    const config: Config = {
      fen: chess.fen(),
      orientation: 'white',
      turnColor: toColor(chess),
      check: checkColor(chess),
      coordinates: true,
      animation: { enabled: true, duration: 200 },
      movable: {
        free: false,
        color: toColor(chess),
        dests: toDests(chess),
        events: {
          after: async (orig: cg.Key, dest: cg.Key) => {
            const fenBefore = chess.fen();
            try {
              const move = chess.move({ from: orig, to: dest, promotion: 'q' });
              if (!move) return;
              const result = await onPlayerMove(move);
              setCorrectMoves(result.correctMoves);

              if (result.isCorrect) {
                setFeedback({ type: 'correct', message: '正确！' });
                // Advance: has next book move? Play it as opponent response
                const nextBook = parseSanMoves(opening.moves);
                const ply = chess.history().length;
                if (ply >= nextBook.length) {
                  setFeedback({ type: 'complete', message: '你已完成了该开局的学习！' });
                  setIsPlayerTurn(false);
                  onFinish();
                } else {
                  // Opponent plays book response after a short delay
                  setIsPlayerTurn(false);
                  setTimeout(() => {
                    playBookResponse();
                  }, 300);
                }
              } else {
                // Wrong move — show feedback
                const correctSan = result.correctMoves.length > 0 ? result.correctMoves[0] : 'N/A';
                setFeedback({
                  type: 'wrong',
                  message: '不正确。谱着正确走法是 ' + correctSan, 
                });
                // Undo the wrong move
                chess.undo();
                if (cgRef.current) {
                  cgRef.current.set({ fen: fenBefore, turnColor: toColor(chess), movable: { color: toColor(chess), dests: toDests(chess) } });
                }
              }
            } catch {}
          },
        },
      },
      highlight: { lastMove: true, check: true },
      draggable: { enabled: true, showGhost: true },
      selectable: { enabled: true },
    };
    const cg = Chessground(boardElRef.current, config);
    cgRef.current = cg;
    return () => { cg.destroy(); cgRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feedback color
  const feedbackBg = feedback?.type === 'correct' ? 'var(--success)' : feedback?.type === 'wrong' ? 'var(--danger)' : feedback?.type === 'complete' ? '#6c5ce7' : '#4a9eff';

  return (
    <div className="sub-page opening-practice">
      <div className="sub-page-header">
        <button className="back-btn" onClick={onBack}>&larr; 返回</button>
        <div className="practice-header-info">
          <h2>{opening.name}{getOpeningNameCn(opening.name) ? " / " + getOpeningNameCn(opening.name) : ""}</h2>
          <span className="practice-eco-badge">{opening.eco}</span>
        </div>
      </div>

      <div className="practice-layout">
        <div>
          <div ref={boardElRef} className="cg-board-wrap practice-board" />
          <div className="practice-feedback-bar" style={{ backgroundColor: feedbackBg }}>
            {feedback?.message || '加载中...'}
          </div>
        </div>

        <div className="practice-sidebar">
          <div className="practice-info-card">
            <div className="practice-info-title">开局信息</div>
            <div className="practice-info-row"><span>名称</span><span>{opening.name}{getOpeningNameCn(opening.name) ? " / " + getOpeningNameCn(opening.name) : ""}</span></div>
            <div className="practice-info-row"><span>ECO</span><span>{opening.eco}</span></div>
            <div className="practice-info-row"><span>步数</span><span>{currentStepIndex}/{parseSanMoves(opening.moves).length}</span></div>
          </div>

          <div className="practice-actions">
            <button
              className="practice-hint-btn"
              onClick={() => setShowHint(!showHint)}
            >
              {showHint ? '隐藏提示' : '显示提示（正确走法）'}
            </button>
          </div>

          {showHint && correctMoves.length > 0 && (
            <div className="practice-hint">
              <div className="practice-hint-title">建议走法：</div>
              {correctMoves.map((m, i) => <div key={i} className="practice-hint-move">{m}</div>)}
            </div>
          )}

          {engineCandidates.length > 0 && (
            <div className="practice-engine-info">
              <div className="practice-engine-title">引擎评价</div>
              {engineCandidates.slice(0, 3).map((c, i) => (
                <div key={i} className="practice-engine-row">
                  <span>{c.san}</span>
                  <span className="practice-engine-eval">
                    {c.mate !== null ? '#' + Math.abs(c.mate) : c.cp !== null ? (c.cp >= 0 ? '+' : '') + c.cp.toFixed(2) : '?'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="practice-move-list">
            <div className="move-list-title">走法记录</div>
            {steps.map((step, i) => (
              <div key={i} className={'practice-move-item ' + (step.isCorrect ? 'correct' : 'wrong')} >
                <span className="move-num">{i + 1}.</span>
                <span className="move-san">{step.playerMove}</span>
                <span className="move-tag">{step.isCorrect ? '正确' : '偏离'}</span>
              </div>
            ))}
            {steps.length === 0 && <div className="no-moves">还没有走棋</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: parse SAN moves from moves string like '1. e4 c5 2. Nf3 d6'
function parseSanMoves(movesStr: string): string[] {
  return movesStr
    .split(/\d+\.\s*/)
    .filter(s => s.trim().length > 0)
    .flatMap(s => s.trim().split(/\s+/));
}