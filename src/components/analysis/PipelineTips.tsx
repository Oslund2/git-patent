import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Code,
  Sparkles,
  FileText,
  Shield,
  BookOpen,
  Scale,
  Clock,
  Lightbulb
} from 'lucide-react';

interface Tip {
  title: string;
  body: string;
  icon: React.ElementType;
}

const TIPS_BY_STAGE: Record<string, Tip[]> = {
  fetching: [
    { title: 'What We\'re Downloading', icon: Search, body: 'Git-Patent fetches your source code files, README, and project metadata. A detailed README significantly improves patent quality since it grounds all AI output in your actual invention.' },
    { title: 'Private Repos Work Too', icon: Code, body: 'If you signed in with GitHub, your private repos are accessible. The code is analyzed in-browser and never stored on external servers beyond your Supabase project.' },
    { title: 'Tip: README Is Key', icon: Lightbulb, body: 'The most impactful thing you can do for patent quality is write a thorough README. Describe what your software does, the problem it solves, and what makes your approach unique.' },
  ],
  parsing: [
    { title: 'Language Detection', icon: Code, body: 'We identify programming languages and parse your codebase structure. TypeScript, Python, Go, Rust, Java, and 20+ other languages are supported.' },
    { title: 'What Gets Analyzed', icon: Search, body: 'We look at source files, configuration, and architecture patterns. Binary files, node_modules, and test fixtures are automatically excluded.' },
  ],
  analyzing: [
    { title: 'Feature Extraction', icon: Sparkles, body: 'AI identifies the novel technical features in your code: unique algorithms, architectures, data pipelines, and integration patterns that could be patentable.' },
    { title: 'What Makes Code Patentable?', icon: Scale, body: 'Software patents protect technical processes, not abstract ideas. Under Alice Corp. v. CLS Bank (2014), your invention must solve a concrete technical problem in a specific way.' },
    { title: 'Types of Software Patents', icon: FileText, body: 'Common categories: method claims (a process), system claims (an apparatus), and computer-readable medium claims. Git-Patent generates all three types.' },
    { title: 'The 35 U.S.C. 101 Test', icon: Shield, body: 'To be patent-eligible, software must pass the Alice two-step test: (1) Is the claim directed to an abstract idea? (2) If so, does it include an "inventive concept" that transforms it?' },
  ],
  generating_patents: [
    { title: 'Patent Specification Structure', icon: FileText, body: 'A full patent has: Field of Invention, Background, Summary, Brief Description of Drawings, Detailed Description, Claims, Abstract, and Drawings. Git-Patent generates all sections.' },
    { title: 'Prior Art: Why It Matters', icon: BookOpen, body: 'Prior art includes any public disclosure before your filing date: patents, papers, products, even blog posts. Your invention must be novel (not identical) and non-obvious (not a trivial combination).' },
    { title: 'Independent vs. Dependent Claims', icon: Scale, body: 'Independent claims define the broadest protection. Dependent claims add specific limitations that narrow scope but are harder to invalidate. A strong patent has both.' },
    { title: 'The Novelty Score', icon: Sparkles, body: 'Git-Patent compares your features against discovered prior art and scores novelty 0-100. Scores above 70 indicate strong patentability. Below 40 may need significant differentiation.' },
    { title: 'Provisional vs. Non-Provisional', icon: Clock, body: 'A provisional application is cheaper ($320 micro-entity) and gives you a filing date with 12 months to file the full non-provisional. Great for establishing priority quickly.' },
    { title: 'Alice/Mayo Risk Assessment', icon: Shield, body: 'Git-Patent evaluates your claims against the Alice/Mayo framework used by patent examiners. Technical specificity, concrete data transformations, and hardware integration reduce rejection risk.' },
  ],
  assessing_ip: [
    { title: 'Copyright vs. Patent', icon: Shield, body: 'Copyright protects your specific code expression automatically. Patents protect the underlying invention and require filing. Both are valuable but protect different things.' },
    { title: 'Trademark Basics', icon: BookOpen, body: 'Your product name and logo can be trademarked. Trademark registration isn\'t required but strengthens enforcement. Git-Patent can help identify trademarkable elements.' },
    { title: 'Filing Timeline', icon: Clock, body: 'In the US, you have 1 year from first public disclosure to file a patent. Internationally, you must file before any public disclosure. File provisional applications early to preserve rights.' },
  ],
};

const ROTATION_INTERVAL = 9000; // 9 seconds

interface PipelineTipsProps {
  currentStep: string;
}

export function PipelineTips({ currentStep }: PipelineTipsProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const prevStep = useRef(currentStep);

  const tips = TIPS_BY_STAGE[currentStep] || TIPS_BY_STAGE.generating_patents;

  // Reset tip index when stage changes
  useEffect(() => {
    if (currentStep !== prevStep.current) {
      setTipIndex(0);
      prevStep.current = currentStep;
    }
  }, [currentStep]);

  // Auto-rotate tips
  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setTipIndex(prev => (prev + 1) % tips.length);
        setFading(false);
      }, 300);
    }, ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [tips.length, currentStep]);

  const currentTip = tips[tipIndex % tips.length];
  const TipIcon = currentTip.icon;

  return (
    <div className="mt-5">
      <div
        className={`flex items-start gap-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl p-4 transition-opacity duration-300 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <TipIcon className="w-4.5 h-4.5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-900">{currentTip.title}</p>
          <p className="text-xs text-indigo-700/80 mt-1 leading-relaxed">{currentTip.body}</p>
        </div>
      </div>

      {/* Dot indicators */}
      {tips.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {tips.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setFading(true);
                setTimeout(() => {
                  setTipIndex(i);
                  setFading(false);
                }, 200);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === tipIndex % tips.length
                  ? 'bg-indigo-500 w-3'
                  : 'bg-indigo-200 hover:bg-indigo-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
