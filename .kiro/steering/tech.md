# Technology Stack

## Architecture

**Tauri v2** desktop application with React frontend and Rust backend.

## Frontend Stack

- **Framework**: React 18.3 with TypeScript 5.6
- **Build Tool**: Vite 6.0
- **UI Library**: Material-UI (MUI) v7.3
  - Emotion for styling (@emotion/react, @emotion/styled)
  - Custom theme with light/dark mode support
- **Icons**: 
  - @mui/icons-material
  - lucide-react
- **State Management**: Zustand 5.0
- **Language**: TypeScript (strict mode)

## Backend Stack (Rust)

- **Framework**: Tauri 2.x
- **Runtime**: Tokio (async runtime with full features)
- **Web Scraping**: 
  - headless_chrome (browser automation)
  - scraper (HTML parsing)
- **HTTP Client**: reqwest with JSON support
- **Database**: SQLite via sqlx with macros and chrono support
- **Web Server**: Axum 0.8 (for MCP server)
- **MCP Integration**: rmcp 0.8.5 with server, macros, and SSE transport
- **Serialization**: serde + serde_json
- **Utilities**:
  - chrono (date/time)
  - base64 encoding
  - anyhow (error handling)
  - directories/dirs (path management)
  - lazy_static (static initialization)

## Tauri Plugins

- tauri-plugin-opener
- tauri-plugin-sql
- tauri-plugin-shell
- tauri-plugin-fs
- tauri-plugin-dialog
- window-vibrancy (native window effects)

## Common Commands

### Development
```bash
# Start development server (frontend + Tauri)
pnpm tauri dev

# Start frontend only
pnpm dev
```

### Building
```bash
# Build TypeScript and frontend
pnpm build

# Build Tauri application (creates distributable)
pnpm tauri build
```

### Preview
```bash
# Preview production build
pnpm preview
```

### Rust Backend
```bash
# Build Rust backend only
cd src-tauri
cargo build

# Run Rust tests
cargo test

# Check for errors without building
cargo check
```

## Package Manager

**pnpm** - Fast, disk space efficient package manager (lockfile: pnpm-lock.yaml)

## Development Environment

- **Recommended IDE**: VS Code
- **Extensions**: 
  - Tauri extension
  - rust-analyzer
- **Node Version**: Modern LTS (18+)
- **Rust**: Latest stable toolchain
