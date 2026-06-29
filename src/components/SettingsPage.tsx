interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  return (
    <div className="sub-page">
      <div className="sub-page-header">
        <button className="back-btn" onClick={onBack}>&larr; 返回</button>
        <h2>设置</h2>
      </div>
      <div className="settings-placeholder">
        <p>设置功能开发中...</p>
        <p className="hint">后续将支持引擎深度、分析速度、界面主题等配置</p>
      </div>
    </div>
  );
}
