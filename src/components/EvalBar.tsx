import type { StockfishEval } from '../hooks/useStockfish';

interface EvalBarProps {
  evaluation: StockfishEval | null;
  orientation?: 'white' | 'black';
}

export function EvalBar({ evaluation, orientation = 'white' }: EvalBarProps) {
  // Calculate the percentage for the white side
  // cp is in pawns, + is white advantage, - is black advantage
  // Clamp to range [-10, +10] for display
  const getWhitePercentage = (): number => {
    if (!evaluation) return 50;
    if (evaluation.mate !== null) {
      // Positive mate = white is mating, negative = black is mating
      return evaluation.mate > 0 ? 95 : 5;
    }
    if (evaluation.cp === null) return 50;

    // Sigmoid-like mapping for smoother display
    const cp = evaluation.cp;
    const normalized = 50 + 50 * (2 / (1 + Math.exp(-0.7 * cp)) - 1);
    return Math.max(5, Math.min(95, normalized));
  };

  const whitePct = getWhitePercentage();
  const blackPct = 100 - whitePct;

  const getEvalText = (): string => {
    if (!evaluation) return '0.0';
    if (evaluation.mate !== null) {
      return `M${Math.abs(evaluation.mate)}`;
    }
    if (evaluation.cp === null) return '0.0';
    const sign = evaluation.cp >= 0 ? '+' : '';
    return `${sign}${evaluation.cp.toFixed(3)}`;
  };

  const isWhiteOnBottom = orientation === 'white';

  return (
    <div className="eval-bar-container">
      <div className="eval-bar">
        <div
          className="eval-bar-black"
          style={{ height: isWhiteOnBottom ? `${blackPct}%` : `${whitePct}%` }}
        />
        <div
          className="eval-bar-white"
          style={{ height: isWhiteOnBottom ? `${whitePct}%` : `${blackPct}%` }}
        />
        <div className="eval-bar-text">
          {getEvalText()}
        </div>
      </div>
    </div>
  );
}
