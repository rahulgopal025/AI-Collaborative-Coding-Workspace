import React from 'react';
import { Icon, addCollection } from '@iconify/react';
import { icons } from '@iconify-json/vscode-icons';
import { cn } from '@/lib/utils';

// Register the VS Code Icons collection locally for offline rendering (zero network calls)
addCollection(icons);

const SPECIAL_FOLDERS: Record<string, string> = {
  src: 'folder-type-src',
  source: 'folder-type-src',
  sources: 'folder-type-src',
  public: 'folder-type-public',
  asset: 'folder-type-asset',
  assets: 'folder-type-asset',
  static: 'folder-type-asset',
  component: 'folder-type-component',
  components: 'folder-type-component',
  page: 'folder-type-view',
  pages: 'folder-type-view',
  view: 'folder-type-view',
  views: 'folder-type-view',
  hook: 'folder-type-hook',
  hooks: 'folder-type-hook',
  util: 'folder-type-tools',
  utils: 'folder-type-tools',
  utilities: 'folder-type-tools',
  tool: 'folder-type-tools',
  tools: 'folder-type-tools',
  helper: 'folder-type-helper',
  helpers: 'folder-type-helper',
  service: 'folder-type-services',
  services: 'folder-type-services',
  test: 'folder-type-test',
  tests: 'folder-type-test',
  __tests__: 'folder-type-test',
  __test__: 'folder-type-test',
  spec: 'folder-type-test',
  specs: 'folder-type-test',
  node_modules: 'folder-type-node',
  '.github': 'folder-type-github',
  '.vscode': 'folder-type-vscode',
  '.git': 'folder-type-git',
  api: 'folder-type-api',
  apis: 'folder-type-api',
  app: 'folder-type-app',
  apps: 'folder-type-app',
  server: 'folder-type-server',
  client: 'folder-type-client',
  route: 'folder-type-route',
  routes: 'folder-type-route',
  router: 'folder-type-route',
  controller: 'folder-type-controller',
  controllers: 'folder-type-controller',
  middleware: 'folder-type-middleware',
  middlewares: 'folder-type-middleware',
  model: 'folder-type-model',
  models: 'folder-type-model',
  style: 'folder-type-style',
  styles: 'folder-type-style',
  css: 'folder-type-css',
  image: 'folder-type-images',
  images: 'folder-type-images',
  img: 'folder-type-images',
  imgs: 'folder-type-images',
  font: 'folder-type-fonts',
  fonts: 'folder-type-fonts',
  config: 'folder-type-config',
  configs: 'folder-type-config',
  configuration: 'folder-type-config',
  doc: 'folder-type-docs',
  docs: 'folder-type-docs',
  documentation: 'folder-type-docs',
  dist: 'folder-type-dist',
  build: 'folder-type-dist',
  out: 'folder-type-dist',
  package: 'folder-type-package',
  packages: 'folder-type-package',
  scripts: 'folder-type-script',
  script: 'folder-type-script',
  shared: 'folder-type-shared',
  common: 'folder-type-shared',
  temp: 'folder-type-temp',
  tmp: 'folder-type-temp',
};

const SPECIAL_FILENAMES: Record<string, string> = {
  'package.json': 'file-type-npm',
  'package-lock.json': 'file-type-npm',
  'pnpm-lock.yaml': 'file-type-pnpm',
  'yarn.lock': 'file-type-yarn',
  'tsconfig.json': 'file-type-tsconfig',
  'tsconfig.app.json': 'file-type-tsconfig',
  'tsconfig.node.json': 'file-type-tsconfig',
  'tsconfig.spec.json': 'file-type-tsconfig',
  'jsconfig.json': 'file-type-jsconfig',
  'vite.config.js': 'file-type-vite',
  'vite.config.ts': 'file-type-vite',
  'vite.config.mjs': 'file-type-vite',
  'vite.config.cjs': 'file-type-vite',
  'vitest.config.js': 'file-type-vitest',
  'vitest.config.ts': 'file-type-vitest',
  'eslint.config.js': 'file-type-eslint',
  'eslint.config.mjs': 'file-type-eslint',
  'eslint.config.cjs': 'file-type-eslint',
  '.eslintrc': 'file-type-eslint',
  '.eslintrc.js': 'file-type-eslint',
  '.eslintrc.json': 'file-type-eslint',
  '.eslintrc.cjs': 'file-type-eslint',
  '.eslintrc.yml': 'file-type-eslint',
  '.eslintrc.yaml': 'file-type-eslint',
  'dockerfile': 'file-type-docker',
  'docker-compose.yml': 'file-type-docker2',
  'docker-compose.yaml': 'file-type-docker2',
  'docker-compose.override.yml': 'file-type-docker2',
  '.dockerignore': 'file-type-docker',
  '.gitignore': 'file-type-git',
  '.gitattributes': 'file-type-git',
  '.gitmodules': 'file-type-git',
  '.env': 'file-type-dotenv',
  '.env.local': 'file-type-dotenv',
  '.env.development': 'file-type-dotenv',
  '.env.production': 'file-type-dotenv',
  '.env.test': 'file-type-dotenv',
  '.env.staging': 'file-type-dotenv',
  '.env.example': 'file-type-dotenv',
  '.env.sample': 'file-type-dotenv',
  'readme.md': 'file-type-readme',
  'readme': 'file-type-readme',
  'license': 'file-type-license',
  'license.md': 'file-type-license',
  'licence': 'file-type-license',
  'licence.md': 'file-type-license',
  'makefile': 'file-type-gnu',
  'gnumakefile': 'file-type-gnu',
  '.prettierrc': 'file-type-prettier',
  '.prettierrc.json': 'file-type-prettier',
  '.prettierrc.js': 'file-type-prettier',
  '.prettierrc.cjs': 'file-type-prettier',
  'prettier.config.js': 'file-type-prettier',
  'prettier.config.cjs': 'file-type-prettier',
  'tailwind.config.js': 'file-type-tailwind',
  'tailwind.config.ts': 'file-type-tailwind',
  'tailwind.config.cjs': 'file-type-tailwind',
  'postcss.config.js': 'file-type-postcss',
  'postcss.config.cjs': 'file-type-postcss',
  'postcss.config.mjs': 'file-type-postcss',
  'next.config.js': 'file-type-next',
  'next.config.mjs': 'file-type-next',
  'next.config.ts': 'file-type-next',
  'components.json': 'file-type-json',
  'webpack.config.js': 'file-type-webpack',
  'webpack.config.ts': 'file-type-webpack',
  'rollup.config.js': 'file-type-rollup',
  'rollup.config.ts': 'file-type-rollup',
  'babel.config.js': 'file-type-babel2',
  'babel.config.json': 'file-type-babel2',
  '.babelrc': 'file-type-babel2',
  '.editorconfig': 'file-type-editorconfig',
  'cargo.toml': 'file-type-cargo',
  'cargo.lock': 'file-type-cargo',
  'composer.json': 'file-type-composer',
  'composer.lock': 'file-type-composer',
};

const EXT_ICONS: Record<string, string> = {
  // JavaScript & TypeScript
  js: 'file-type-js-official',
  mjs: 'file-type-js-official',
  cjs: 'file-type-js-official',
  jsx: 'file-type-reactjs',
  ts: 'file-type-typescript-official',
  'd.ts': 'file-type-typescriptdef-official',
  tsx: 'file-type-reactts',
  // Python
  py: 'file-type-python',
  pyw: 'file-type-python',
  ipynb: 'file-type-python',
  // Java
  java: 'file-type-java',
  jar: 'file-type-java',
  class: 'file-type-java',
  // C / C++
  c: 'file-type-c',
  h: 'file-type-cheader',
  cpp: 'file-type-cpp',
  cc: 'file-type-cpp',
  cxx: 'file-type-cpp',
  hpp: 'file-type-cppheader',
  hh: 'file-type-cppheader',
  hxx: 'file-type-cppheader',
  cs: 'file-type-csharp',
  // HTML & CSS
  html: 'file-type-html',
  htm: 'file-type-html',
  css: 'file-type-css',
  scss: 'file-type-scss',
  sass: 'file-type-sass',
  less: 'file-type-less',
  // Data & Docs
  json: 'file-type-json',
  jsonc: 'file-type-json',
  json5: 'file-type-json',
  md: 'file-type-markdown',
  markdown: 'file-type-markdown',
  mdx: 'file-type-mdx',
  // Other Programming Languages
  go: 'file-type-go',
  rs: 'file-type-rust',
  php: 'file-type-php',
  rb: 'file-type-ruby',
  erb: 'file-type-ruby',
  swift: 'file-type-swift',
  kt: 'file-type-kotlin',
  kts: 'file-type-kotlin',
  sql: 'file-type-sql',
  // Shell
  sh: 'file-type-shell',
  bash: 'file-type-shell',
  zsh: 'file-type-shell',
  fish: 'file-type-shell',
  ps1: 'file-type-powershell',
  psm1: 'file-type-powershell',
  psd1: 'file-type-powershell',
  bat: 'file-type-bat',
  cmd: 'file-type-bat',
  // Modern web frameworks & schemas
  vue: 'file-type-vue',
  svelte: 'file-type-svelte',
  astro: 'file-type-astro',
  graphql: 'file-type-graphql',
  gql: 'file-type-graphql',
  prisma: 'file-type-prisma',
  dart: 'file-type-dartlang',
  lua: 'file-type-lua',
  r: 'file-type-r',
  // Images
  png: 'file-type-image',
  jpg: 'file-type-image',
  jpeg: 'file-type-image',
  gif: 'file-type-image',
  webp: 'file-type-image',
  ico: 'file-type-image',
  bmp: 'file-type-image',
  svg: 'file-type-svg',
  // Fonts
  ttf: 'file-type-font',
  otf: 'file-type-font',
  woff: 'file-type-font',
  woff2: 'file-type-font',
  eot: 'file-type-font',
  // Formats
  xml: 'file-type-xml',
  yaml: 'file-type-yaml',
  yml: 'file-type-yaml',
  toml: 'file-type-toml',
  pdf: 'file-type-pdf',
  // Archives
  zip: 'file-type-zip',
  tar: 'file-type-zip',
  gz: 'file-type-zip',
  '7z': 'file-type-zip',
  rar: 'file-type-zip',
  // Databases
  db: 'file-type-sqlite',
  sqlite: 'file-type-sqlite',
  sqlite3: 'file-type-sqlite',
  // Config & text
  ini: 'file-type-config',
  conf: 'file-type-config',
  cfg: 'file-type-config',
  txt: 'file-type-text',
  log: 'file-type-text',
  // Media
  mp3: 'file-type-audio',
  wav: 'file-type-audio',
  mp4: 'file-type-video',
  webm: 'file-type-video',
};

/**
 * Resolves the VS Code icon identifier for a given file or folder.
 */
export function getFileIconIdentifier(name: string, type: 'file' | 'folder', isOpen?: boolean): string {
  const lowerName = name.toLowerCase().trim();

  if (type === 'folder') {
    const specialFolder = SPECIAL_FOLDERS[lowerName];
    if (specialFolder) {
      return isOpen ? `${specialFolder}-opened` : specialFolder;
    }
    return isOpen ? 'default-folder-opened' : 'default-folder';
  }

  // 1. Check exact filename match
  if (SPECIAL_FILENAMES[lowerName]) {
    return SPECIAL_FILENAMES[lowerName];
  }

  // 2. Check compound extensions (e.g. .d.ts)
  if (lowerName.endsWith('.d.ts')) {
    return EXT_ICONS['d.ts'];
  }

  // 3. Check regular extensions
  const dotIndex = lowerName.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = lowerName.slice(dotIndex + 1);
    if (EXT_ICONS[ext]) {
      return EXT_ICONS[ext];
    }
  }

  return 'default-file';
}

export interface FileIconProps {
  name: string;
  type: 'file' | 'folder';
  isOpen?: boolean;
  useMaterialIcons?: boolean;
  className?: string;
}

export const FileIconComponent: React.FC<FileIconProps> = ({
  name,
  type,
  isOpen = false,
  className,
}) => {
  const iconId = getFileIconIdentifier(name, type, isOpen);

  return (
    <Icon
      icon={`vscode-icons:${iconId}`}
      className={cn('h-4 w-4 shrink-0 inline-block align-middle select-none pointer-events-none', className)}
      width={16}
      height={16}
    />
  );
};
