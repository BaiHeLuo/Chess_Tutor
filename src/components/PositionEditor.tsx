import { useEffect, useRef, useCallback, useState } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Config } from '@lichess-org/chessground/config';
import type * as cg from '@lichess-org/chessground/types';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import { PIECE_IMG } from './pieceImages';

const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const BLACK_PIECES: string[] = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const WHITE_PIECES: string[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'];

interface PositionEditorProps {
  onBack: () => void;
  onComplete: (fen: string) => void;
}

// Parse a FEN piece placement string into a map of square -> piece
function fenToPieces(fen: string): Map<string, cg.Piece> {
  const pieces: Map<string, cg.Piece> = new Map();
  const rows = fen.split(' ')[0].split('/');
  for (let rank = 8; rank >= 1; rank--) {
    const row = rows[8 - rank];
    let file = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        file += parseInt(ch);
      } else {
        const color: cg.Color = ch === ch.toUpperCase() ? 'white' : 'black';
        const role = charToRole(ch.toLowerCase());
        if (role) {
          const square = String.fromCharCode(97 + file) + rank;
          pieces.set(square, { role, color });
        }
        file++;
      }
    }
  }
  return pieces;
}

function charToRole(ch: string): cg.Role | undefined {
  switch (ch) {
    case 'k': return 'king';
    case 'q': return 'queen';
    case 'r': return 'rook';
    case 'b': return 'bishop';
    case 'n': return 'knight';
    case 'p': return 'pawn';
    default: return undefined;
  }
}

function roleToChar(role: cg.Role): string {
  switch (role) {
    case 'king': return 'k';
    case 'queen': return 'q';
    case 'rook': return 'r';
    case 'bishop': return 'b';
    case 'knight': return 'n';
    case 'pawn': return 'p';
  }
}

// Convert Chessground pieces map to FEN piece placement string
function piecesToFen(pieces: Map<string, cg.Piece>): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const square = String.fromCharCode(97 + file) + rank;
      const piece = pieces.get(square);
      if (piece) {
        if (empty > 0) { row += empty; empty = 0; }
        const ch = roleToChar(piece.role);
        row += piece.color === 'white' ? ch.toUpperCase() : ch;
      } else {
        empty++;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

// Get piece key from drag data (e.g. "bK" -> { color: 'black', role: 'king' })
function parsePieceKey(key: string): { color: cg.Color; role: cg.Role } | null {
  if (key.length !== 2) return null;
  const color: cg.Color = key[0] === 'w' ? 'white' : 'black';
  const role = charToRole(key[1].toLowerCase());
  if (!role) return null;
  return { color, role };
}

export function PositionEditor({ onBack, onComplete }: PositionEditorProps) {
  const boardElRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const piecesRef = useRef<Map<string, cg.Piece>>(new Map());
  const [showTurnDialog, setShowTurnDialog] = useState(false);

  // Build current FEN from pieces
  const buildFen = useCallback((turn: 'w' | 'b') => {
    const placement = piecesToFen(piecesRef.current);
    return `${placement} ${turn} - - 0 1`;
  }, []);

  // Update the board display
  const syncBoard = useCallback(() => {
    if (!cgRef.current) return;
    cgRef.current.set({
      fen: buildFen('w'),
    });
  }, [buildFen]);

  // Initialize Chessground in editor mode
  useEffect(() => {
    if (!boardElRef.current) return;

    const config: Config = {
      fen: EMPTY_FEN,
      orientation: 'white',
      coordinates: true,
      movable: {
        free: true,
        color: 'both',
        dests: new Map(),
        events: {
          after: (orig: cg.Key, dest: cg.Key) => {
            // Move piece in our map
            const piece = piecesRef.current.get(orig);
            if (piece) {
              piecesRef.current.delete(orig);
              // If dest is a valid square, place piece there
              if (dest) {
                piecesRef.current.set(dest, piece);
              }
              // If dest is somehow invalid (dragged off), piece is removed
            }
            syncBoard();
          },
        },
      },
      draggable: {
        enabled: true,
        showGhost: true,
        deleteOnDropOff: true, // Remove piece if dropped outside board
      },
      selectable: { enabled: true },
      highlight: { lastMove: false, check: false },
      animation: { enabled: false },
    };

    const cg = Chessground(boardElRef.current, config);
    cgRef.current = cg;

    return () => {
      cg.destroy();
      cgRef.current = null;
    };
  }, [syncBoard]);

  // Handle drop from piece tray
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pieceKey = e.dataTransfer.getData('text/plain');
    const parsed = parsePieceKey(pieceKey);
    if (!parsed || !boardElRef.current) return;

    // Calculate which square was dropped on
    const rect = boardElRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const squareSize = rect.width / 8;

    const file = Math.floor(x / squareSize);
    // Board is oriented white at bottom, so rank 1 is at the bottom (high y)
    const rank = 8 - Math.floor(y / squareSize);

    if (file < 0 || file > 7 || rank < 1 || rank > 8) return;

    const square = String.fromCharCode(97 + file) + rank;
    piecesRef.current.set(square, { role: parsed.role, color: parsed.color });
    syncBoard();
  }, [syncBoard]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Clear the board
  const handleClear = useCallback(() => {
    piecesRef.current = new Map();
    syncBoard();
  }, [syncBoard]);

  // Load from .chess file
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
          if (data.fen) {
            const pieces = fenToPieces(data.fen);
            piecesRef.current = pieces;
            syncBoard();
          }
        } catch {
          alert('文件格式错误，无法加载棋局');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [syncBoard]);

  // Save as .chess file
  const handleSave = useCallback(() => {
    const fen = buildFen('w');
    const name = prompt('请输入棋局名称：', '自定义局面_' + new Date().toLocaleDateString('zh-CN'));
    if (!name) return;

    const data = JSON.stringify({
      version: 1,
      name,
      date: new Date().toISOString(),
      fen,
      pgn: '',
      moves: [],
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
  }, [buildFen]);

  // Validate and show turn selection dialog
  const handleDone = useCallback(() => {
    const pieces = piecesRef.current;

    // Count kings
    let whiteKings = 0;
    let blackKings = 0;
    let pawnOnBackRank = false;

    pieces.forEach((piece, square) => {
      if (piece.role === 'king') {
        if (piece.color === 'white') whiteKings++;
        else blackKings++;
      }
      if (piece.role === 'pawn') {
        const rank = parseInt(square[1]);
        if (rank === 1 || rank === 8) pawnOnBackRank = true;
      }
    });

    if (whiteKings !== 1) {
      alert('白方必须有且仅有一个王（当前: ' + whiteKings + ' 个）');
      return;
    }
    if (blackKings !== 1) {
      alert('黑方必须有且仅有一个王（当前: ' + blackKings + ' 个）');
      return;
    }
    if (pawnOnBackRank) {
      alert('兵不能放在第 1 行或第 8 行');
      return;
    }

    setShowTurnDialog(true);
  }, []);

  // Confirm turn and enter analysis
  const confirmTurn = useCallback((turn: 'w' | 'b') => {
    setShowTurnDialog(false);
    const fen = buildFen(turn);
    onComplete(fen);
  }, [buildFen, onComplete]);

  return (
    <div className="sub-page">
      <div className="sub-page-header">
        <button className="back-btn" onClick={onBack}>&larr; 返回</button>
        <h2>摆放棋局</h2>
      </div>

      <div className="position-editor">
        {/* Black pieces tray (top) */}
        <div className="piece-tray black-tray">
          {BLACK_PIECES.map(key => (
            <div
              key={key}
              className="piece-tray-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', key);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <img src={PIECE_IMG[key]} alt={key} draggable={false} />
            </div>
          ))}
        </div>

        {/* Board with drop handling */}
        <div
          className="editor-board-wrap"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div ref={boardElRef} className="cg-board-wrap editor-board" />
        </div>

        {/* White pieces tray (bottom) */}
        <div className="piece-tray white-tray">
          {WHITE_PIECES.map(key => (
            <div
              key={key}
              className="piece-tray-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', key);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <img src={PIECE_IMG[key]} alt={key} draggable={false} />
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="editor-buttons">
          <button className="editor-btn" onClick={handleClear}>清空棋盘</button>
          <button className="editor-btn" onClick={handleLoad}>加载棋局</button>
          <button className="editor-btn" onClick={handleSave}>保存棋局</button>
          <button className="editor-btn primary" onClick={handleDone}>完成</button>
        </div>
      </div>

      {/* Turn selection dialog */}
      {showTurnDialog && (
        <div className="dialog-overlay" onClick={() => setShowTurnDialog(false)}>
          <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
            <h3>选择先手方</h3>
            <div className="dialog-buttons">
              <button className="dialog-btn white-btn" onClick={() => confirmTurn('w')}>
                &#9812; 白方先走
              </button>
              <button className="dialog-btn black-btn" onClick={() => confirmTurn('b')}>
                &#9818; 黑方先走
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
