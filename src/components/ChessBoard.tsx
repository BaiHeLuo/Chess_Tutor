import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type * as cg from '@lichess-org/chessground/types';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';

interface ChessBoardProps {
  chess: Chess;
  onMove: (move: Move, fenBefore: string) => void;
  orientation?: 'white' | 'black';
  lastMove?: cg.Key[];
  disabled?: boolean;
}

export interface ChessBoardHandle {
  playUciMove: (uci: string) => boolean;
}

function toDests(chess: Chess): cg.Dests {
  const dests: cg.Dests = new Map();
  const moves = chess.moves({ verbose: true });
  for (const move of moves) {
    const from = move.from as cg.Key;
    const to = move.to as cg.Key;
    if (!dests.has(from)) dests.set(from, []);
    dests.get(from)!.push(to);
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

export const ChessBoard = forwardRef<ChessBoardHandle, ChessBoardProps>(
  function ChessBoard({ chess, onMove, orientation = 'white', lastMove, disabled }, ref) {
    const boardRef = useRef<HTMLDivElement>(null);
    const cgRef = useRef<Api | null>(null);

    useImperativeHandle(ref, () => ({
      playUciMove(uci: string): boolean {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const fenBefore = chess.fen();
        try {
          const move = chess.move({ from, to, promotion: promotion || 'q' });
          if (move) {
            onMove(move, fenBefore);
            cgRef.current?.set({
              fen: chess.fen(),
              turnColor: toColor(chess),
              check: checkColor(chess),
              movable: {
                color: toColor(chess),
                dests: toDests(chess),
              },
              lastMove: [move.from as cg.Key, move.to as cg.Key],
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }), [chess, onMove]);

    useEffect(() => {
      if (!boardRef.current) return;

      const config: Config = {
        fen: chess.fen(),
        orientation,
        turnColor: toColor(chess),
        check: checkColor(chess),
        lastMove: lastMove,
        coordinates: true,
        animation: { enabled: true, duration: 200 },
        movable: {
          free: false,
          color: disabled ? undefined : 'both',
          dests: disabled ? new Map() : toDests(chess),
          events: {
            after: (orig: cg.Key, dest: cg.Key) => {
              const fenBefore = chess.fen();
              try {
                const move = chess.move({ from: orig, to: dest, promotion: 'q' });
                if (move) {
                  onMove(move, fenBefore);
                  cgRef.current?.set({
                    fen: chess.fen(),
                    turnColor: toColor(chess),
                    check: checkColor(chess),
                    movable: {
                      color: toColor(chess),
                      dests: toDests(chess),
                    },
                    lastMove: [move.from as cg.Key, move.to as cg.Key],
                  });
                } else {
                  cgRef.current?.set({ fen: chess.fen() });
                }
              } catch {
                cgRef.current?.set({ fen: chess.fen() });
              }
            },
          },
        },
        highlight: { lastMove: true, check: true },
        draggable: { enabled: true, showGhost: true },
        selectable: { enabled: true },
      };

      const cg = Chessground(boardRef.current, config);
      cgRef.current = cg;

      return () => {
        cg.destroy();
        cgRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncBoard = useCallback(() => {
      if (!cgRef.current) return;
      cgRef.current.set({
        fen: chess.fen(),
        turnColor: toColor(chess),
        check: checkColor(chess),
        movable: {
          color: disabled ? undefined : toColor(chess),
          dests: disabled ? new Map() : toDests(chess),
        },
        lastMove: lastMove,
      });
    }, [chess, disabled, lastMove]);

    useEffect(() => { syncBoard(); }, [syncBoard]);

    useEffect(() => {
      if (cgRef.current) cgRef.current.set({ orientation });
    }, [orientation]);

    return (
      <div className="chess-board-container">
        <div ref={boardRef} className="cg-board-wrap" style={{ width: '560px', height: '560px' }} />
      </div>
    );
  }
);
