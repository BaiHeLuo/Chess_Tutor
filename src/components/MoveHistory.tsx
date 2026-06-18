import type { Move } from 'chess.js';
import type { CandidateMove } from '../hooks/useStockfish';

export interface MoveRecord {
  move: Move;
  quality: string;       // 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | ''
  engineCandidates: CandidateMove[]; // engine's top 3 recommended moves for this position
}

interface MoveHistoryProps {
  moves: MoveRecord[];
  selectedIndex: number | null;
  onSelectMove: (index: number) => void;
}

const qualityLabels: Record<string, { label: string; color: string }> = {
  best: { label: '最佳', color: '#759bde' },
  excellent: { label: '极好', color: '#5a9a5a' },
  good: { label: '好棋', color: '#6aaa6a' },
  inaccuracy: { label: '不精确', color: '#f0c040' },
  mistake: { label: '失误', color: '#e08030' },
  blunder: { label: '严重失误', color: '#c03030' },
};

export function MoveHistory({ moves, selectedIndex, onSelectMove }: MoveHistoryProps) {
  const movePairs: { number: number; white: MoveRecord; black?: MoveRecord }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="move-history">
      <h3>走法记录</h3>
      <div className="move-list">
        {movePairs.map((pair) => (
          <div key={pair.number} className="move-pair">
            <span className="move-number">{pair.number}.</span>
            <span
              className={`move-item ${selectedIndex === (pair.number - 1) * 2 ? 'selected' : ''}`}
              onClick={() => onSelectMove((pair.number - 1) * 2)}
            >
              {pair.white.move.san}
              {renderQualityBadge(pair.white.quality)}
            </span>
            {pair.black && (
              <span
                className={`move-item ${selectedIndex === (pair.number - 1) * 2 + 1 ? 'selected' : ''}`}
                onClick={() => onSelectMove((pair.number - 1) * 2 + 1)}
              >
                {pair.black.move.san}
                {renderQualityBadge(pair.black.quality)}
              </span>
            )}
          </div>
        ))}
        {moves.length === 0 && (
          <div className="no-moves">还没有走棋记录</div>
        )}
      </div>
    </div>
  );
}

function renderQualityBadge(quality: string) {
  if (!quality) return null;
  const info = qualityLabels[quality];
  if (!info) return null;
  return (
    <span
      className="quality-badge"
      style={{ backgroundColor: info.color }}
      title={info.label}
    >
      {info.label}
    </span>
  );
}

export { qualityLabels };
