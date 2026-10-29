/**
 * Supported execution languages.
 */

const SUPPORTED_LANGUAGES = {
  java: { id: "java", name: "Java", extension: "java" },
  c: { id: "c", name: "C", extension: "c" },
  cpp: { id: "cpp", name: "C++", extension: "cpp" },
  python3: { id: "python3", name: "Python", extension: "py" },
  javascript: { id: "javascript", name: "JavaScript", extension: "js" },
  typescript: { id: "typescript", name: "TypeScript", extension: "ts" },
  go: { id: "go", name: "Go", extension: "go" },
  rust: { id: "rust", name: "Rust", extension: "rs" },
  php: { id: "php", name: "PHP", extension: "php" },
  ruby: { id: "ruby", name: "Ruby", extension: "rb" },
  swift: { id: "swift", name: "Swift", extension: "swift" },
  csharp: { id: "csharp", name: "C#", extension: "cs" },
};

function normalizeLanguage(lang) {
  if (!lang || typeof lang !== 'string') return null;
  const l = lang.trim().toLowerCase();
  if (l === 'python' || l === 'py') return 'python3';
  if (l === 'c++') return 'cpp';
  if (l === 'c#') return 'csharp';
  if (l === 'js' || l === 'mjs') return 'javascript';
  if (l === 'ts') return 'typescript';
  if (SUPPORTED_LANGUAGES[l]) return l;
  return null;
}

function getSupportedLanguages() {
  return Object.values(SUPPORTED_LANGUAGES).map(lang => ({
    id: lang.id,
    name: lang.name || (lang.id.charAt(0).toUpperCase() + lang.id.slice(1)),
    extension: lang.extension,
  }));
}

function getLanguageByExtension(extension) {
  if (!extension) return null;
  const ext = extension.replace(".", "").toLowerCase();
  
  // Custom mappings for common variations
  if (ext === "py") return "python3";
  if (ext === "js" || ext === "mjs") return "javascript";
  if (ext === "ts") return "typescript";
  if (ext === "cpp" || ext === "cc" || ext === "cxx") return "cpp";
  
  const found = Object.values(SUPPORTED_LANGUAGES).find(l => l.extension === ext);
  return found ? found.id : null;
}

module.exports = {
  SUPPORTED_LANGUAGES,
  getSupportedLanguages,
  getLanguageByExtension,
  normalizeLanguage
};
