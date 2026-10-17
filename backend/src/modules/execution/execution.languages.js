/**
 * Supported execution languages.
 */

const SUPPORTED_LANGUAGES = {
  java: { id: "java", extension: "java" },
  c: { id: "c", extension: "c" },
  cpp: { id: "cpp", extension: "cpp" },
  python3: { id: "python3", extension: "py" },
  javascript: { id: "javascript", extension: "js" },
  typescript: { id: "typescript", extension: "ts" },
  go: { id: "go", extension: "go" },
  rust: { id: "rust", extension: "rs" },
  php: { id: "php", extension: "php" },
  ruby: { id: "ruby", extension: "rb" },
  swift: { id: "swift", extension: "swift" },
  csharp: { id: "csharp", extension: "cs" },
};

function getSupportedLanguages() {
  return Object.values(SUPPORTED_LANGUAGES).map(lang => ({
    id: lang.id,
    name: lang.id.charAt(0).toUpperCase() + lang.id.slice(1)
  }));
}

function getLanguageByExtension(extension) {
  const ext = extension.replace(".", "").toLowerCase();
  
  // Custom mappings for common variations
  if (ext === "py") return "python3";
  if (ext === "js" || ext === "mjs") return "javascript";
  if (ext === "ts") return "typescript";
  if (ext === "cpp" || ext === "cc" || ext === "cxx") return "cpp";
  
  const found = Object.values(SUPPORTED_LANGUAGES).find(l => l.extension === ext);
  return found ? found.id : null;
}

module.exports = { SUPPORTED_LANGUAGES, getSupportedLanguages, getLanguageByExtension };

