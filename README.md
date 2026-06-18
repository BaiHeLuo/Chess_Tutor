# Chess Learning Assistant / 国际象棋学习助手

一个基于 Web 的国际象棋学习工具，集成 Stockfish 引擎实时分析，帮助你理解局面、评估走法质量。

A web-based chess learning tool with real-time Stockfish engine analysis, helping you understand positions and evaluate move quality.

## 功能特性 / Features

- **交互式棋盘** — 点击走棋，支持悔棋、翻转棋盘、新局
- **实时评估条 (EvalBar)** — 直观显示当前局面优劣势（白方视角）
- **走法质量分析** — 六级评价：最佳 / 极佳 / 好棋 / 不精确 / 错误 / 败着
- **引擎推荐走法** — 显示 Top 3 候选走法，点击可自动执行
- **多步分析 (Line Analysis)** — 一键计算最佳线路（10 步深度推演）
- **走法历史回溯** — 点击任意历史走法查看当时的引擎评估
- **棋局保存/加载** — 导出/导入 `.chess` 格式文件

- **Interactive Board** — Click to move, with undo, flip board, and new game
- **Live Eval Bar** — Visual advantage indicator (white's perspective)
- **Move Quality Analysis** — Six-tier evaluation: Best / Excellent / Good / Inaccuracy / Mistake / Blunder
- **Engine Recommendations** — Top 3 candidate moves, click to play
- **Line Analysis** — One-click best-line computation (10-move deep rollout)
- **Move History Replay** — Click any historical move to see engine evaluation at that point
- **Save/Load Games** — Export/import `.chess` format files

## 技术栈 / Tech Stack

| 组件 / Component | 技术 / Technology |
|---|---|
| 前端框架 / Framework | React 18 + TypeScript |
| 构建工具 / Build Tool | Vite 6 |
| 棋盘 UI / Board UI | [@lichess-org/chessground](https://github.com/lichess-org/chessground) |
| 棋局逻辑 / Chess Logic | [chess.js](https://github.com/jhlywa/chess.js) |
| 引擎 / Engine | Stockfish (WASM, via Web Worker) |

## 快速开始 / Getting Started

```bash
# 安装依赖 / Install dependencies
npm install

# 启动开发服务器 / Start dev server
npm run dev

# 构建生产版本 / Build for production
npm run build
```

> **注意 / Note:** Stockfish WASM 需要 [COOP/COEP headers](https://web.dev/coop-coep/) 才能使用 SharedArrayBuffer。Vite 开发服务器已在 `vite.config.ts` 中配置。
>
> Stockfish WASM requires [COOP/COEP headers](https://web.dev/coop-coep/) for SharedArrayBuffer support. Already configured in `vite.config.ts` for the Vite dev server.

## 后续计划 / Roadmap

1. **自由摆放棋子** — 支持自定义局面编辑，方便分析特定棋局
2. **LLM 辅助分析** — 接入大语言模型，提供自然语言局面解读与教学指导
3. **更多教学功能** — 开局训练、残局练习、战术题库等

1. **Free Piece Placement** — Custom position editor for analyzing specific positions
2. **LLM-Assisted Analysis** — Integrate large language models for natural-language position explanation and coaching
3. **More Learning Features** — Opening trainer, endgame practice, tactical puzzle database, and more

## 许可证 / License

MIT
