# Agent Guidelines

## Build Commands
- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production (runs TypeScript compiler + Vite build)
- `npm run lint` - Run ESLint on all files
- `npm run preview` - Preview production build locally
- `tsc` - Type check TypeScript without emitting files

## Testing
No test framework is currently configured. Add Vitest or Jest to add testing capabilities.

## Code Style

### Import Style
- Use absolute imports with `@/` alias for src directory: `import { Button } from "@/components/ui/button"`
- Single quotes preferred: `import { StrictMode } from 'react'`
- Import React components directly: `import * as React from "react"`

### Formatting
- No semicolons at end of statements
- Arrow functions for components: `function App() { return ... }` or `const App = () => { return ... }`
- 2-space indentation

### TypeScript
- Strict mode enabled
- No unused locals or parameters allowed
- `noFallthroughCasesInSwitch` enabled
- `noUncheckedSideEffectImports` enabled
- Use type annotations for component props: `React.ComponentProps<"button"> & VariantProps<...>`
- Type imports: `import { cn } from "@/lib/utils"`
- For built-in types: `import { type ClassValue } from "clsx"`

### Naming Conventions
- Components: PascalCase (`Button`, `App`)
- Functions: camelCase (`cn`, `buttonVariants`)
- Utilities: lowercase, descriptive names
- CSS classes: kebab-case via Tailwind utility classes

### React
- Use React 19 with React Compiler enabled
- JSX transform: `react-jsx`
- Functional components only
- Use `StrictMode` wrapper in main.tsx
- Component exports: `export default App` or named exports `export { Button, buttonVariants }`

### Styling
- Tailwind CSS v4 with @theme inline
- Shadcn UI components (new-york style)
- Use `cn()` utility for class merging: `import { cn } from "@/lib/utils"`
- Class Variance Authority for component variants: `import { cva, type VariantProps }`
- CSS variables for theming (defined in src/index.css)
- Dark mode support via `.dark` class

### Component Structure
- Shadcn UI components in `src/components/ui/`
- Utility functions in `src/lib/`
- Use `data-*` attributes for component state: `data-slot`, `data-variant`, `data-size`
- destructure props with spread: `...props`

### Error Handling
- Let TypeScript strict mode catch type errors
- ESLint configured with TypeScript, React Hooks, and React Refresh rules

### File Organization
```
src/
  components/
    ui/          # Shadcn UI components
  lib/          # Utility functions (cn, etc.)
  assets/       # Static assets
  App.tsx       # Main app component
  main.tsx      # Application entry point
  index.css     # Global styles with Tailwind
```

## ESLint
- Configured for TypeScript and React
- Runs on all `.ts` and `.tsx` files
- Ignores `dist/` directory
- Run `npm run lint` before committing

## TypeScript Config
- Target: ES2022
- Module: ESNext
- Paths: `@/*` -> `./src/*`
- Strict mode enabled
- Verbosity: High (noUnusedLocals, noUnusedParameters)

## Dependencies
- React 19 with React Compiler
- Shadcn UI (Radix UI primitives)
- Tailwind CSS v4
- Lucide React for icons
- Vite as build tool
