interface HomeScreenProps {
  onNavigate: (page: 'analysis' | 'setup' | 'settings' | 'opening_browser') => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <div className="home-screen">
      <div className="home-content">
        <h1 className="home-title">国际象棋学习助手</h1>
        <p className="home-subtitle">Chess Learning Assistant</p>

        <div className="home-options">
          <button className="home-option" onClick={() => onNavigate('analysis')}>
            <span className="home-option-icon">&#9816;</span>
            <span className="home-option-label">对局分析</span>
            <span className="home-option-desc">在棋盘上走棋，引擎实时分析</span>
          </button>

          <button className="home-option" onClick={() => onNavigate('setup')}>
            <span className="home-option-icon">&#9819;</span>
            <span className="home-option-label">摆放棋局</span>
            <span className="home-option-desc">自定义棋子位置，分析任意局面</span>
          </button>

          <button className="home-option" onClick={() => onNavigate('opening_browser')}>
            <span className="home-option-icon">&#9820;</span>
            <span className="home-option-label">开局学习</span>
            <span className="home-option-desc">选择开局，交互式学习谱着走法</span>
          </button>

          <button className="home-option" onClick={() => onNavigate('settings')}>
            <span className="home-option-icon">&#9881;</span>
            <span className="home-option-label">设置</span>
            <span className="home-option-desc">引擎参数与界面配置</span>
          </button>
        </div>
      </div>
    </div>
  );
}
