// Skill-name cleanup shared by the analysis route (lib/analysis) and the
// Convex mutation that saves a user's corrected skills. Pure data + string
// functions only, so it bundles for both Convex and Next.js.

/** Most skills a stored analysis may hold. */
export const MAX_SKILLS = 100
export const MAX_SKILL_NAME = 60
export const MAX_SKILL_EVIDENCE = 300

/**
 * Lookup key for a skill name: lowercase, trimmed, inner whitespace
 * collapsed, trailing punctuation dropped. "React.js " and "react.js" share one.
 */
export function skillKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:]+$/g, "")
    .trim()
}

/** Tidies a raw name for display without changing its meaning. */
export function tidySkillName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-•*·]+|[\s.,;:]+$/g, "")
    .trim()
    .slice(0, MAX_SKILL_NAME)
}

// Canonical name → the spellings that should map to it (keys are matched
// with skillKey, so case and spacing don't matter). The canonical name itself
// is always included.
const CANONICAL: Record<string, string[]> = {
  // Languages
  JavaScript: [
    "js",
    "java script",
    "ecmascript",
    "es6",
    "es2015",
    "vanilla js",
  ],
  TypeScript: ["ts", "type script"],
  Python: ["python3", "python 3", "py"],
  Java: ["core java", "java se"],
  "C++": ["cpp", "c plus plus"],
  "C#": ["c sharp", "csharp"],
  C: ["c language", "c programming"],
  Go: ["golang"],
  Rust: ["rust lang", "rustlang"],
  Kotlin: [],
  Swift: [],
  PHP: [],
  Ruby: [],
  R: ["r language", "r programming"],
  Dart: [],
  Scala: [],
  SQL: ["structured query language"],
  HTML: ["html5", "html 5"],
  CSS: ["css3", "css 3"],
  Bash: ["shell scripting", "shell script", "bash scripting"],
  MATLAB: ["matlab"],
  Solidity: [],
  // Frameworks & libraries
  React: ["react.js", "reactjs", "react js"],
  "React Native": ["react-native", "reactnative"],
  "Next.js": ["nextjs", "next js"],
  "Vue.js": ["vue", "vuejs", "vue js"],
  Nuxt: ["nuxt.js", "nuxtjs"],
  Angular: ["angularjs", "angular.js", "angular js"],
  Svelte: ["sveltekit"],
  "Node.js": ["node", "nodejs", "node js"],
  Express: ["express.js", "expressjs", "express js"],
  NestJS: ["nest.js", "nest js"],
  Django: [],
  Flask: [],
  FastAPI: ["fast api"],
  "Spring Boot": ["springboot", "spring-boot"],
  "ASP.NET": ["asp.net core", "asp net", ".net core", "dotnet", ".net"],
  Laravel: [],
  "Ruby on Rails": ["rails", "ror"],
  Flutter: [],
  jQuery: ["jquery"],
  Redux: ["redux toolkit", "rtk"],
  "Tailwind CSS": ["tailwind", "tailwindcss"],
  Bootstrap: [],
  TensorFlow: ["tensorflow"],
  PyTorch: ["pytorch", "torch"],
  Keras: [],
  "scikit-learn": ["sklearn", "scikit learn", "scikitlearn"],
  Pandas: ["pandas"],
  NumPy: ["numpy"],
  Matplotlib: [],
  OpenCV: ["opencv", "cv2"],
  "Hugging Face Transformers": ["hugging face", "huggingface"],
  LangChain: ["langchain"],
  GraphQL: ["graphql"],
  "REST APIs": [
    "rest",
    "rest api",
    "restful",
    "restful apis",
    "restful api",
    "rest apis",
  ],
  // Tools & databases
  Git: ["git scm"],
  GitHub: ["github"],
  GitLab: ["gitlab"],
  Docker: ["docker compose", "docker-compose"],
  Kubernetes: ["k8s", "kubernetes"],
  Terraform: [],
  Jenkins: [],
  "GitHub Actions": ["gh actions", "github actions"],
  "CI/CD": ["ci cd", "cicd", "ci / cd", "continuous integration"],
  Linux: [],
  PostgreSQL: ["postgres", "postgresql", "psql"],
  MySQL: ["mysql"],
  MongoDB: ["mongo", "mongodb", "mongo db"],
  Redis: [],
  SQLite: ["sqlite3"],
  Firebase: [],
  Supabase: [],
  Elasticsearch: ["elastic search"],
  Kafka: ["apache kafka"],
  "Apache Spark": ["spark", "pyspark"],
  Figma: [],
  Postman: [],
  Jira: [],
  "VS Code": ["vscode", "visual studio code"],
  Webpack: [],
  Vite: [],
  Jest: [],
  Selenium: [],
  Tableau: [],
  "Power BI": ["powerbi", "power-bi"],
  "Microsoft Excel": ["excel", "ms excel"],
  "Machine Learning": ["ml"],
  "Deep Learning": [],
  "Natural Language Processing": ["nlp"],
  "Computer Vision": [],
  "Data Structures and Algorithms": [
    "dsa",
    "data structures",
    "algorithms",
    "data structures & algorithms",
  ],
  "Object-Oriented Programming": ["oop", "oops", "object oriented programming"],
  // Cloud
  AWS: ["amazon web services", "aws cloud"],
  "Google Cloud": ["gcp", "google cloud platform"],
  Azure: ["microsoft azure", "ms azure"],
  Vercel: [],
  Netlify: [],
  Heroku: [],
  // Soft skills
  Communication: [
    "communication skills",
    "verbal communication",
    "written communication",
  ],
  Teamwork: ["team work", "team player", "collaboration"],
  Leadership: ["team leadership"],
  "Problem Solving": ["problem-solving", "problem solving skills"],
  "Time Management": [],
  "Critical Thinking": [],
}

const ALIASES: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>()
  for (const [canonical, aliases] of Object.entries(CANONICAL)) {
    map.set(skillKey(canonical), canonical)
    for (const alias of aliases) map.set(skillKey(alias), canonical)
  }
  return map
})()

/** The canonical name from the fixed alias map, or null if it isn't listed. */
export function aliasFor(name: string): string | null {
  return ALIASES.get(skillKey(name)) ?? null
}

/** Every [spelling, canonical] pair in the alias map, canonical names included. */
export function skillSpellings(): [string, string][] {
  const pairs: [string, string][] = []
  for (const [canonical, aliases] of Object.entries(CANONICAL)) {
    pairs.push([canonical, canonical])
    for (const alias of aliases) pairs.push([alias, canonical])
  }
  return pairs
}
