# Project Structure

## Root Directory

```
xiaohongshu-helper/
├── src/                    # React frontend source
├── src-tauri/             # Rust backend source
├── public/                # Static assets
├── dist/                  # Build output (frontend)
├── .kiro/                 # Kiro AI assistant configuration
├── .agent/                # Agent skills and capabilities
├── node_modules/          # Node dependencies
├── package.json           # Frontend dependencies and scripts
├── pnpm-lock.yaml        # Lockfile for pnpm
├── index.html            # Entry HTML file
└── README.md             # Project documentation
```

## Frontend Structure (`src/`)

```
src/
├── components/           # React components
│   ├── Layout.tsx       # Main app layout with navigation
│   ├── PublishView.tsx  # Content creation interface
│   ├── DraftsList.tsx   # Draft management sidebar
│   ├── PreviewPanel.tsx # Mobile preview component
│   ├── SettingsView.tsx # Settings configuration
│   ├── AssetsView.tsx   # Asset library management
│   ├── TrendsView.tsx   # Trend monitoring
│   ├── UsersView.tsx    # User account management
│   ├── MCPView.tsx      # MCP server controls
│   ├── LoginDialog.tsx  # Login modal
│   ├── AIPolishDialog.tsx        # AI content generation
│   ├── AssetSelectorDialog.tsx   # Image picker
│   └── IOSSwitch.tsx    # Custom switch component
├── assets/              # Static assets (images, icons)
├── App.tsx              # Root component with routing logic
├── App.css              # Global styles
├── main.tsx             # React entry point
├── store.ts             # Zustand state management
├── theme.ts             # MUI theme configuration
└── vite-env.d.ts        # Vite type definitions
```

## Backend Structure (`src-tauri/`)

```
src-tauri/
├── src/                 # Rust source code
│   └── lib.rs          # Main library with Tauri commands
├── browser_data/        # Chrome browser data for automation
├── Cargo.toml          # Rust dependencies
├── Cargo.lock          # Rust lockfile
├── tauri.conf.json     # Tauri configuration (likely)
└── .gitignore          # Rust-specific ignores
```

## Configuration Directories

### `.kiro/` - AI Assistant Configuration
- `steering/` - Guidance documents for AI assistant
  - `product.md` - Product overview
  - `tech.md` - Technology stack
  - `structure.md` - Project organization

### `.agent/` - Agent Skills
- `skills/` - Specialized AI capabilities
  - `frontend-design/` - Frontend design patterns
  - `mui/` - Material-UI component library knowledge
  - `rust-desktop-applications/` - Rust desktop app patterns
  - `zustand/` - Zustand state management patterns

## Key Architectural Patterns

### Frontend Patterns

1. **Component Organization**: Flat structure in `src/components/` with descriptive names
2. **State Management**: Centralized Zustand store in `store.ts` with typed interfaces
3. **Theming**: Single theme file (`theme.ts`) with light/dark mode support
4. **Layout**: Three-panel layout (navigation, content, preview) in `Layout.tsx`

### Backend Patterns

1. **Tauri Commands**: Rust functions exposed to frontend via `#[tauri::command]`
2. **Database**: SQLite for local data persistence (users, drafts, config)
3. **Browser Automation**: headless_chrome for web scraping and login
4. **MCP Server**: Embedded Axum server for AI tool integration

### Communication Flow

```
React Frontend (TypeScript)
    ↕ (invoke/emit)
Tauri IPC Layer
    ↕
Rust Backend (Tauri Commands)
    ↕
SQLite Database / External APIs / Browser Automation
```

## Naming Conventions

- **Components**: PascalCase (e.g., `LoginDialog.tsx`, `PreviewPanel.tsx`)
- **Files**: camelCase for utilities, PascalCase for components
- **Rust**: snake_case for functions and variables
- **Store**: camelCase for state properties and methods
- **CSS**: MUI's sx prop for styling (CSS-in-JS)

## Data Flow

1. **User Actions** → React Components
2. **State Updates** → Zustand Store
3. **Backend Calls** → Tauri `invoke()` commands
4. **Persistence** → SQLite database via Rust
5. **UI Updates** → React re-renders from store changes
