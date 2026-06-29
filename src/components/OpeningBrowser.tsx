import { useState, useEffect, useCallback } from 'react';
import type { TrainerOpening } from '../hooks/useOpeningTrainer';
import { getOpeningNameCn } from '../data/openingNamesCn';

// Category metadata
const ECO_CATEGORIES = [
  { code: 'A', name: 'Flank Openings', desc: '1.c4, 1.Nf3, 1.b3, 1.g3 etc.', color: '#4a9eff' },
  { code: 'B', name: 'Semi-Open Games', desc: '1.e4 responses other than 1...e5', color: '#6c5ce7' },
  { code: 'C', name: 'Open Games', desc: '1.e4 e5', color: '#e17055' },
  { code: 'D', name: 'Closed & Semi-Closed', desc: '1.d4 d5 and 1.d4 Nf6 2.c4', color: '#00b894' },
  { code: 'E', name: 'Indian Defenses', desc: '1.d4 Nf6 (non-2.c4 lines)', color: '#fdcb6e' },
];

interface OpeningBrowserProps {
  onSelect: (opening: TrainerOpening) => void;
  onBack: () => void;
}

interface GroupedOpening {
  name: string;
  eco: string;
  moves: string;
  fen: string;
  count: number;
}

export function OpeningBrowser({ onSelect, onBack }: OpeningBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openings, setOpenings] = useState<GroupedOpening[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedEco, setExpandedEco] = useState<string | null>(null);

  // Load openings by category
  const loadCategory = useCallback(async (category: string) => {
    setIsLoading(true);
    setSelectedCategory(category);
    setSearch('');
    try {
      const { openingBook } = await import('@chess-openings/eco.json');
      const book = await openingBook();

      // Group by ECO root name
      const grouped = new Map<string, { name: string; eco: string; moves: string; fen: string; count: number }>();
      for (const [fen, opening] of Object.entries(book)) {
        if (opening.eco.startsWith(category) && opening.isEcoRoot) {
          const key = opening.eco + ' ' + opening.name;
          if (!grouped.has(key)) {
            grouped.set(key, {
              name: opening.name,
              eco: opening.eco,
              moves: opening.moves,
              fen: fen.includes(' ') ? fen : fen + ' w - - 0 1',
              count: 1,
            });
          }
        }
      }
      setOpenings(Array.from(grouped.values()).sort((a, b) => a.eco.localeCompare(b.eco)));
    } catch (err) {
      console.error('Failed to load openings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter by search
  const filtered = search.trim()
    ? openings.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase()) ||
        o.eco.toLowerCase().includes(search.toLowerCase())
      )
    : openings;

  if (!selectedCategory) {
    return (
      <div className="opening-browser">
        <div className="sub-page-header">
          <button className="back-btn" onClick={onBack}>&larr; 返回</button>
          <h2>开局学习</h2>
        </div>
        <p className="browser-intro">选择一个开局类别开始学习</p>
        <div className="eco-categories">
          {ECO_CATEGORIES.map(cat => (
            <button
              key={cat.code}
              className="eco-category-card"
              style={{ borderColor: cat.color }}
              onClick={() => loadCategory(cat.code)}
            >
              <span className="eco-category-code" style={{ color: cat.color }}>{cat.code}</span>
              <span className="eco-category-name">{cat.name}</span>
              <span className="eco-category-desc">{cat.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="opening-browser">
      <div className="sub-page-header">
        <button className="back-btn" onClick={() => { setSelectedCategory(null); setOpenings([]); }}>&larr; 返回</button>
        <h2>开局: {ECO_CATEGORIES.find(c => c.code === selectedCategory)?.name}</h2>
      </div>

      <input
        className="search-input"
        type="text"
        placeholder="搜索开局名称或ECO编码..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {isLoading && <div className="browser-loading">加载中...</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="browser-empty">
          <p>没有找到匹配的开局</p>
        </div>
      )}

      <div className="opening-list">
        {filtered.map(op => (
          <div key={op.eco} className="opening-card-wrapper">
            <div
              className="opening-card"
              onClick={() => onSelect({
                eco: op.eco,
                name: op.name,
                moves: op.moves,
                fen: op.fen,
              })}
            >
              <span className="opening-card-eco">{op.eco}</span>
              <div className="opening-card-info">
                <span className="opening-card-name">{op.name}{getOpeningNameCn(op.name) && <span className="opening-card-name-cn"> / {getOpeningNameCn(op.name)}</span>}</span>
                <span className="opening-card-moves">{op.moves}</span>
              </div>
              <span className="opening-card-arrow">&rarr;</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}