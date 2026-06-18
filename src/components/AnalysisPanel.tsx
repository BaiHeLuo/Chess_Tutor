import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { MoveRecord } from './MoveHistory';
import type { AnalysisResult, CandidateMove, LineStep } from '../hooks/useStockfish';
import { qualityLabels } from './MoveHistory';

interface AnalysisPanelProps {
  currentMove: Move | null;
  currentRecord: MoveRecord | null;
  isEvaluating: boolean;
  onAnalyze: () => void;
  engineReady: boolean;
  liveAnalysis: AnalysisResult | null;
  currentFen: string;
  onClickCandidate: (uci: string) => void;
  isLatestPosition: boolean;
  isAnalyzingLine: boolean;
  lineSteps: LineStep[];
  lineTotalSteps: number;
  onStartLine: () => void;
  onStopLine: () => void;
}

const pieceNames: Record<string, string> = {
  p: '兵', n: '马', b: '象', r: '车', q: '后', k: '王',
};

function PieceIcon({ piece, color }: { piece: string; color?: 'w' | 'b' }) {
  const fill = color === 'b' ? '#333' : '#fff';
  const stroke = color === 'b' ? '#999' : '#333';
  const size = 20;

  const icons: Record<string, React.ReactNode> = {
    k: (
      <svg width={size} height={size} viewBox="0 0 45 45">
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 11.63V6M20 8h5" />
          <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
          <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" />
          <path d="M11 37c6.5 3 15.5 3 22 0" fill="none" />
          <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" fill="none" />
        </g>
      </svg>
    ),
    q: (
      <svg width={size} height={size} viewBox="0 0 45 45">
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 12a2 2 0 11-4 0 2 2 0 114 0zM24.5 7.5a2 2 0 11-4 0 2 2 0 114 0zM41 12a2 2 0 11-4 0 2 2 0 114 0zM16 8.5a2 2 0 11-4 0 2 2 0 114 0zM33 9a2 2 0 11-4 0 2 2 0 114 0z" />
          <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15L14 11V25L7 14l2 12zM9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
          <path d="M11 38.5a35 35 1 0023 0" fill="none" />
          <path d="M11 29a35 35 1 0123 0M12.5 31.5h20M11.5 34.5a35 35 1 0022 0M10.5 37.5a35 35 1 0024 0" fill="none" />
        </g>
      </svg>
    ),
    r: (
      <svg width={size} height={size} viewBox="0 0 45 45">
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" />
          <path d="M34 14l-3 3H14l-3-3" />
          <path d="M31 17v12.5H14V17" />
          <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
          <path d="M11 14h23" fill="none" />
        </g>
      </svg>
    ),
    b: (
      <svg width={size} height={size} viewBox="0 0 45 45">
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <g fill={fill}>
            <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
            <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
            <path d="M25 8a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0z" />
          </g>
          <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" fill="none" />
        </g>
      </svg>
    ),
    n: (
      <svg width={size} height={size} viewBox="0 0 45 45">
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" />
          <path d="M9.5 25.5a.5.5 0 11-1 0 .5.5 0 111 0z" fill={stroke} stroke={stroke} />
          <path d="M15 15.5a.5 1.5 30 11-.866-.5.5 1.5 30 11.866.5z" fill={stroke} stroke={stroke} />
        </g>
      </svg>
    ),
    p: (
      <svg width={size} height={size} viewBox="0 0 45 45">
        <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03C15.41 27.09 11 31.58 11 39.5H34c0-7.92-4.41-12.41-7.41-13.47C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  };

  return <span className="piece-icon">{icons[piece] || null}</span>;
}

function SanNotation({ san, color }: { san: string; color?: 'w' | 'b' }) {
  if (!san) return <span>{san}</span>;

  if (san === 'O-O' || san === 'O-O-O') {
    return <span className="san-text">{san}</span>;
  }

  const match = san.match(/^([KQRBNP]?)([a-h1-8]?)(x?)([a-h][1-8])(=?[QRBNP]?)([+#]?)$/);
  if (!match) return <span className="san-text">{san}</span>;

  const [, pieceChar, from, capture, to, promotion, check] = match;
  const piece = (pieceChar || 'p').toLowerCase();

  return (
    <span className="san-with-icon">
      <PieceIcon piece={piece} color={color} />
      {from && <span className="san-from">{from}</span>}
      {capture && <span className="san-capture">×</span>}
      <span className="san-to">{to}</span>
      {promotion && (
        <span className="san-promotion">
          =<PieceIcon piece={promotion.replace('=', '').toLowerCase()} color={color} />
        </span>
      )}
      {check && <span className="san-check">{check}</span>}
    </span>
  );
}

function describeMove(move: Move): string {
  const piece = pieceNames[move.piece] || move.piece;
  const captured = move.captured ? ` 吃了${pieceNames[move.captured] || move.captured}` : '';
  const check = move.san.includes('+') ? ' 将军' : '';
  const checkmate = move.san.includes('#') ? ' 将杀！' : '';
  const castling = move.san === 'O-O' ? ' 王翼易位' : move.san === 'O-O-O' ? ' 后翼易位' : '';
  if (castling) return `${piece}${castling}`;
  return `${piece} ${move.from} → ${move.to}${captured}${check}${checkmate}`.trim();
}

function formatEval(c: CandidateMove): string;
function formatEval(c: { cp: number | null; mate: number | null }): string;
function formatEval(c: { cp: number | null; mate: number | null }): string {
  if (c.mate !== null) {
    return `#${Math.abs(c.mate)}`;
  }
  if (c.cp === null) return '?';
  const sign = c.cp >= 0 ? '+' : '';
  return `${sign}${c.cp.toFixed(3)}`;
}


export function AnalysisPanel({
  currentMove,
  currentRecord,
  isEvaluating,
  onAnalyze,
  engineReady,
  liveAnalysis,
  currentFen,
  onClickCandidate,
  isLatestPosition,
  isAnalyzingLine,
  lineSteps,
  lineTotalSteps,
  onStartLine,
  onStopLine,
}: AnalysisPanelProps) {

  // Build candidate list with SAN notation
  const buildCandidates = (candidates: CandidateMove[], fen: string) => {
    return candidates.map(c => ({
      ...c,
      san: c.san || (() => {
        try {
          const tmp = new Chess(fen);
          const m = tmp.move({ from: c.uci.slice(0,2), to: c.uci.slice(2,4), promotion: c.uci.length > 4 ? c.uci[4] : 'q' });
          return m ? m.san : c.uci;
        } catch { return c.uci; }
      })(),
    }));
  };

  // Determine which candidates to show and whether they're clickable
  const isViewingLatest = !currentMove || isLatestPosition;
  const candidatesToShow = isViewingLatest
    ? (liveAnalysis?.candidates ?? [])
    : (currentRecord?.engineCandidates ?? []);
  const candidatesFen = isViewingLatest
    ? (liveAnalysis?.positionFen ?? currentFen)
    : currentFen;
  const enrichedCandidates = buildCandidates(candidatesToShow, candidatesFen);
  const sideToMove = (isViewingLatest ? (liveAnalysis?.positionFen ?? currentFen) : currentFen).split(' ')[1] === 'w' ? '白' : '黑';
  const canClick = isViewingLatest && !isEvaluating;

  if (!currentMove) {
    return (
      <div className="analysis-panel">
        <h3>走法分析</h3>
        <div className="analysis-empty">
          <p>走一步棋后，这里会显示详细表述</p>
          <p className="hint">引擎会推荐最佳走法，并评价你的走法质量</p>
        </div>

        {enrichedCandidates.length > 0 && (
          <div className="analysis-candidates">
            <div className="candidates-title">
              引擎推荐走法 ({sideToMove}方):
            </div>
            {enrichedCandidates.slice(0, 3).map((c, i) => (
              <div
                key={i}
                className={`candidate-row ${canClick ? 'clickable' : ''} ${i === 0 ? 'best' : ''}`}
                onClick={canClick ? () => onClickCandidate(c.uci) : undefined}
                title={canClick ? '点击自动走这一步' : undefined}
              >
                <span className="candidate-rank">#{i + 1}</span>
                <span className="candidate-move">
                  <SanNotation san={c.san || c.uci} color={sideToMove === '白' ? 'w' : 'b'} />
                </span>
                <span className="candidate-eval">{formatEval(c)}</span>
                {i === 0 && <span className="candidate-tag best-tag">最佳</span>}
                {canClick && <span className="candidate-play">▶</span>}
              </div>
            ))}
          </div>
        )}

        {isEvaluating && !isAnalyzingLine && (
          <div className="analyzing-indicator">引擎分析中...</div>
        )}

        {isAnalyzingLine && (
          <div className="analyzing-indicator line-progress">
            多步分析中... ({lineSteps.length}/{lineTotalSteps})
          </div>
        )}

        {(isAnalyzingLine || lineSteps.length > 0) && (
          <div className="line-analysis-section">
            <div className="line-analysis-title">最佳线路 ({lineSteps.length}步):</div>
            <div className="line-steps-list">
              {lineSteps.map((step, i) => (
                <div key={i} className={`line-step ${i % 2 === 0 ? 'white-step' : 'black-step'}`}>
                  <span className="line-step-num">{i + 1}.</span>
                  <span className="line-step-san">{step.san}</span>
                  <span className="line-step-eval">
                    {step.mate !== null
                      ? `#${Math.abs(step.mate)}`
                      : step.cp !== null
                        ? `${step.cp >= 0 ? '+' : ''}${step.cp.toFixed(2)}`
                        : '?'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="analysis-buttons">
          <button
            className="analyze-btn"
            onClick={onAnalyze}
            disabled={!engineReady || isEvaluating}
          >
            {isEvaluating && !isAnalyzingLine ? '分析中...' : '重新分析当前局面'}
          </button>
          {isAnalyzingLine ? (
            <button className="analyze-btn line-btn" onClick={onStopLine}>
              停止分析
            </button>
          ) : (
            <button
              className="analyze-btn line-btn"
              onClick={onStartLine}
              disabled={!engineReady || isEvaluating}
            >
              多步分析 (10步)
            </button>
          )}
        </div>
      </div>
    );
  }

  const quality = currentRecord?.quality || '';
  const qInfo = qualityLabels[quality];

  return (
    <div className="analysis-panel">
      <h3>走法分析</h3>

      <div className="analysis-move-info">
        <div className="analysis-move-san">
          <SanNotation san={currentMove.san} color={currentMove.color} />
        </div>
        <div className="analysis-move-desc">{describeMove(currentMove)}</div>
      </div>

      {quality && qInfo && (
        <div className="analysis-quality" style={{ backgroundColor: qInfo.color }}>
          {quality === 'best' ? '★ ' : ''}{qInfo.label}
          {quality !== 'best' && enrichedCandidates.length > 0 && (
            <span className="quality-hint">
              引擎推荐: <SanNotation san={enrichedCandidates[0].san || enrichedCandidates[0].uci} color={sideToMove === '白' ? 'w' : 'b'} />
            </span>
          )}
        </div>
      )}
      {!quality && (
        <div className="analysis-quality" style={{ backgroundColor: '#666', opacity: 0.7 }}>
          评估中...
        </div>
      )}

      {enrichedCandidates.length > 0 && (
        <div className="analysis-candidates">
          <div className="candidates-title">
            {isViewingLatest
              ? <>引擎推荐走法 ({sideToMove}方):</>
              : <>这步时的引擎推荐 ({sideToMove}方):</>
            }
          </div>
          {enrichedCandidates.slice(0, 3).map((c, i) => {
            const userMoveUci = currentMove.from + currentMove.to + (currentMove.promotion || '');
            const isUserMove = !isViewingLatest && c.uci === userMoveUci;
            return (
              <div
                key={i}
                className={`candidate-row ${canClick ? 'clickable' : ''} ${i === 0 ? 'best' : ''} ${isUserMove ? 'user-move' : ''}`}
                onClick={canClick ? () => onClickCandidate(c.uci) : undefined}
                title={canClick ? '点击自动走这一步' : undefined}
              >
                <span className="candidate-rank">#{i + 1}</span>
                <span className="candidate-move">
                  <SanNotation san={c.san || c.uci} color={sideToMove === '白' ? 'w' : 'b'} />
                </span>
                <span className="candidate-eval">{formatEval(c)}</span>
                {isUserMove && <span className="candidate-tag">你走的</span>}
                {i === 0 && !isUserMove && <span className="candidate-tag best-tag">最佳</span>}
                {canClick && <span className="candidate-play">▶</span>}
              </div>
            );
          })}
        </div>
      )}

      {enrichedCandidates.length > 0 && enrichedCandidates[0].pv.length > 1 && (
        <div className="analysis-best-line">
          <span className="best-line-label">引擎推荐后续:</span>
          <span className="best-line-moves">{enrichedCandidates[0].pv.slice(0, 6).join(' ')}</span>
        </div>
      )}

      {isEvaluating && !isAnalyzingLine && (
        <div className="analyzing-indicator">引擎分析中...</div>
      )}

      {isAnalyzingLine && (
        <div className="analyzing-indicator line-progress">
          多步分析中... ({lineSteps.length}/{lineTotalSteps})
        </div>
      )}

      {(isAnalyzingLine || lineSteps.length > 0) && (
        <div className="line-analysis-section">
          <div className="line-analysis-title">最佳线路 ({lineSteps.length}步):</div>
          <div className="line-steps-list">
            {lineSteps.map((step, i) => (
              <div key={i} className={`line-step ${i % 2 === 0 ? 'white-step' : 'black-step'}`}>
                <span className="line-step-num">{i + 1}.</span>
                <span className="line-step-san">{step.san}</span>
                <span className="line-step-eval">
                  {step.mate !== null
                    ? `#${Math.abs(step.mate)}`
                    : step.cp !== null
                      ? `${step.cp >= 0 ? '+' : ''}${step.cp.toFixed(2)}`
                      : '?'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analysis-buttons">
        <button
          className="analyze-btn"
          onClick={onAnalyze}
          disabled={!engineReady || isEvaluating}
        >
          {isEvaluating && !isAnalyzingLine ? '分析中...' : '重新分析当前局面'}
        </button>
        {isAnalyzingLine ? (
          <button className="analyze-btn line-btn" onClick={onStopLine}>
            停止分析
          </button>
        ) : (
          <button
            className="analyze-btn line-btn"
            onClick={onStartLine}
            disabled={!engineReady || isEvaluating}
          >
            多步分析 (10步)
          </button>
        )}
      </div>
    </div>
  );
}
