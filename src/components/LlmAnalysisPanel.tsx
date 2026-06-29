import { useState } from 'react';
import type { LlmAdvice } from '../hooks/useLlmAnalysis';

interface LlmAnalysisPanelProps {
  advice: LlmAdvice | null;
  isLoading: boolean;
  error: string | null;
  onAskAi: () => void;
  onClear: () => void;
  isLatestPosition: boolean;
  hasMoves: boolean;
}

export function LlmAnalysisPanel({ advice, isLoading, error, onAskAi, onClear, isLatestPosition, hasMoves }: LlmAnalysisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="llm-analysis-panel">
      <div className="llm-panel-header">
        <h3>
          <span className="llm-icon">&#129302;</span>
          AI 辅助分析
        </h3>
        {advice && (
          <div className="llm-header-actions">
            <button
              className="llm-toggle-btn"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? '收起' : '展开'}
            >
              {isExpanded ? '收起' : '展开'}
            </button>
            <button className="llm-clear-btn" onClick={onClear} title="清除分析">
              &times;
            </button>
          </div>
        )}
      </div>

      {!advice && !isLoading && !error && (
        <div className="llm-empty">
          <p>询问 AI 分析当前局面</p>
          <p className="llm-hint">AI 会结合 Stockfish 引擎分析你的局势，并给出走法建议</p>
          <button
            className="ask-ai-btn"
            onClick={onAskAi}
            disabled={!isLatestPosition || !hasMoves}
          >
            &#129302; 询问 AI
          </button>
          {!isLatestPosition && (
            <p className="llm-warning">请回到最新走法以分析当前局面</p>
          )}
          {!hasMoves && (
            <p className="llm-warning">请在棋盘上走棋后再来询问 AI</p>
          )}
        </div>
      )}

      {isLoading && (
        <div className="llm-loading">
          <div className="llm-spinner"></div>
          <p>AI 正在分析，请稍候...</p>
          <p className="llm-hint">正在结合 Stockfish 评估结果生成分析</p>
        </div>
      )}

      {error && (
        <div className="llm-error">
          <p className="llm-error-title">分析失败</p>
          <p className="llm-error-msg">{error}</p>
          <button className="ask-ai-btn" onClick={onAskAi}>
            重试
          </button>
        </div>
      )}

      {advice && isExpanded && (
        <div className="llm-advice-content">
          {/* Analysis text */}
          <div className="llm-section">
            <div className="llm-section-title">&#128220; 局面分析</div>
            <div className="llm-analysis-text">{advice.analysis}</div>
          </div>

          {/* Recommended move */}
          {advice.recommendedMove && advice.explanation && (
            <div className="llm-section llm-recommendation">
              <div className="llm-section-title">&#9889; 推荐走法</div>
              <div className="llm-rec-move">
                <span className="llm-rec-san">{advice.recommendedMove}</span>
              </div>
              <div className="llm-rec-explanation">{advice.explanation}</div>
            </div>
          )}

          {/* Key ideas */}
          {advice.keyIdeas && advice.keyIdeas.length > 0 && (
            <div className="llm-section">
              <div className="llm-section-title">&#128161; 关键思路</div>
              <ul className="llm-list">
                {advice.keyIdeas.map((idea, i) => (
                  <li key={i}>{idea}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan */}
          {advice.plan && (
            <div className="llm-section">
              <div className="llm-section-title">&#128270; 后续计划</div>
              <p className="llm-plan-text">{advice.plan}</p>
            </div>
          )}

          {/* Warnings */}
          {advice.warnings && advice.warnings.length > 0 && (
            <div className="llm-section llm-warnings-section">
              <div className="llm-section-title">&#9888;&#65039; 注意</div>
              <ul className="llm-list llm-warning-list">
                {advice.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-ask button */}
          <div className="llm-footer">
            <button className="ask-ai-btn ask-again-btn" onClick={onAskAi}>
              &#129302; 重新询问 AI
            </button>
          </div>
        </div>
      )}

      {advice && !isExpanded && (
        <div className="llm-collapsed">
          <p className="llm-collapsed-summary">
            {advice.recommendedMove && (
              <span className="llm-collapsed-rec">推荐: <strong>{advice.recommendedMove}</strong></span>
            )}
            <span className="llm-collapsed-analysis">
              {advice.explanation || advice.analysis.slice(0, 60) + '...'}
            </span>
          </p>
          <button className="ask-ai-btn ask-again-btn" onClick={onAskAi}>
            &#129302; 重新分析
          </button>
        </div>
      )}
    </div>
  );
}
