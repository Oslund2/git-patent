import { supabase } from '../../lib/supabase';
import { createPatentDrawing, deleteAllDrawingsForApplication } from './patentApplicationService';
import type { PatentDrawing, DrawingCallout } from './patentApplicationService';
import type { ExtractedFeature } from '../../types';
import { analyzeDomain, planDrawingFigures, type DrawingSpec } from './dynamicPatentDrawingsService';
import { generateText } from '../ai/geminiService';

interface BlockElement {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  calloutNumber: number;
}

interface ArrowConnection {
  from: string;
  to: string;
  label?: string;
  bidirectional?: boolean;
}

export interface DrawingBlock extends BlockElement {
  description?: string;
}

interface DiagramDefinition {
  figureNumber: number;
  title: string;
  description: string;
  drawingType: PatentDrawing['drawing_type'];
  blocks: BlockElement[];
  arrows: ArrowConnection[];
  width: number;
  height: number;
}

// Legacy static figure definitions — kept for type compatibility but no longer used in generation.
// All drawings are now AI-generated from actual codebase features.
const FIGURE_DEFINITIONS: DiagramDefinition[] = [
  {
    figureNumber: 1,
    title: 'System Architecture Overview',
    description: 'FIG. 1 is a block diagram illustrating the high-level system architecture of the software system according to an embodiment of the present invention.',
    drawingType: 'block_diagram',
    width: 900,
    height: 680,
    blocks: [
      { id: 'client', label: 'Client\nApplication', x: 375, y: 20, width: 150, height: 50, calloutNumber: 100 },
      { id: 'frontend', label: 'User Interface\nLayer', x: 375, y: 100, width: 150, height: 50, calloutNumber: 102 },
      { id: 'auth', label: 'Authentication\n& Authorization', x: 50, y: 180, width: 140, height: 60, calloutNumber: 104 },
      { id: 'database', label: 'Multi-Tenant\nDatabase', x: 50, y: 270, width: 140, height: 70, calloutNumber: 106 },
      { id: 'core_engine', label: 'Core Processing\nEngine', x: 230, y: 180, width: 140, height: 60, calloutNumber: 108 },
      { id: 'workflow_orch', label: 'Workflow\nOrchestrator', x: 520, y: 180, width: 140, height: 60, calloutNumber: 110 },
      { id: 'config', label: 'Configuration\nManagement\nSystem', x: 700, y: 180, width: 150, height: 60, calloutNumber: 112 },
      { id: 'analysis', label: 'Analysis\nModule', x: 50, y: 400, width: 120, height: 60, calloutNumber: 114 },
      { id: 'transform', label: 'Data\nTransformation', x: 190, y: 400, width: 120, height: 60, calloutNumber: 116 },
      { id: 'validation', label: 'Validation\nEngine', x: 330, y: 400, width: 120, height: 60, calloutNumber: 118 },
      { id: 'output_gen', label: 'Output\nGeneration', x: 50, y: 490, width: 120, height: 60, calloutNumber: 120 },
      { id: 'feature_extract', label: 'Feature\nExtraction', x: 480, y: 400, width: 130, height: 60, calloutNumber: 122 },
      { id: 'search', label: 'Search\nService', x: 630, y: 400, width: 110, height: 60, calloutNumber: 124 },
      { id: 'scoring', label: 'Scoring\nEngine', x: 760, y: 400, width: 110, height: 60, calloutNumber: 126 },
      { id: 'report_gen', label: 'Report\nGenerator', x: 480, y: 490, width: 130, height: 60, calloutNumber: 128 },
      { id: 'export', label: 'Export\nModule', x: 630, y: 490, width: 110, height: 60, calloutNumber: 130 },
      { id: 'notification', label: 'Notification\nService', x: 760, y: 490, width: 110, height: 60, calloutNumber: 132 },
      { id: 'ai', label: 'AI Model\nServices', x: 375, y: 280, width: 150, height: 70, calloutNumber: 134 }
    ],
    arrows: [
      { from: 'client', to: 'frontend' },
      { from: 'frontend', to: 'core_engine' },
      { from: 'frontend', to: 'workflow_orch' },
      { from: 'auth', to: 'frontend' },
      { from: 'auth', to: 'database' },
      { from: 'core_engine', to: 'database', bidirectional: true },
      { from: 'workflow_orch', to: 'database', bidirectional: true },
      { from: 'core_engine', to: 'ai' },
      { from: 'workflow_orch', to: 'ai' },
      { from: 'core_engine', to: 'config' },
      { from: 'workflow_orch', to: 'config' },
      { from: 'core_engine', to: 'analysis' },
      { from: 'core_engine', to: 'transform' },
      { from: 'core_engine', to: 'validation' },
      { from: 'validation', to: 'output_gen' },
      { from: 'workflow_orch', to: 'feature_extract' },
      { from: 'workflow_orch', to: 'search' },
      { from: 'workflow_orch', to: 'scoring' },
      { from: 'feature_extract', to: 'report_gen' },
      { from: 'search', to: 'scoring' },
      { from: 'scoring', to: 'report_gen' },
      { from: 'scoring', to: 'notification' },
      { from: 'report_gen', to: 'export' }
    ]
  },
  {
    figureNumber: 2,
    title: 'Data Processing Pipeline',
    description: 'FIG. 2 is a flowchart illustrating the data processing pipeline workflow according to an embodiment of the present invention.',
    drawingType: 'flowchart',
    width: 700,
    height: 700,
    blocks: [
      { id: 'start', label: 'Receive\nInput Data', x: 275, y: 20, width: 150, height: 50, calloutNumber: 200 },
      { id: 'parse', label: 'Parse Data\nStructure', x: 275, y: 100, width: 150, height: 50, calloutNumber: 202 },
      { id: 'extract', label: 'Extract\nKey Fields', x: 275, y: 180, width: 150, height: 50, calloutNumber: 204 },
      { id: 'enrich', label: 'Enrich with\nMetadata', x: 275, y: 260, width: 150, height: 50, calloutNumber: 206 },
      { id: 'validate', label: 'Validate\nIntegrity', x: 275, y: 340, width: 150, height: 50, calloutNumber: 208 },
      { id: 'transform', label: 'Apply\nTransformations', x: 275, y: 420, width: 150, height: 50, calloutNumber: 210 },
      { id: 'generate', label: 'Generate\nOutput', x: 275, y: 500, width: 150, height: 50, calloutNumber: 212 },
      { id: 'store', label: 'Store\nResults', x: 275, y: 580, width: 150, height: 50, calloutNumber: 214 },
      { id: 'rules', label: 'Business\nRules Engine', x: 500, y: 340, width: 130, height: 50, calloutNumber: 216 },
      { id: 'cache', label: 'Results\nCache', x: 500, y: 420, width: 130, height: 50, calloutNumber: 218 }
    ],
    arrows: [
      { from: 'start', to: 'parse' },
      { from: 'parse', to: 'extract' },
      { from: 'extract', to: 'enrich' },
      { from: 'enrich', to: 'validate' },
      { from: 'validate', to: 'transform' },
      { from: 'transform', to: 'generate' },
      { from: 'generate', to: 'store' },
      { from: 'rules', to: 'validate' },
      { from: 'cache', to: 'transform' }
    ]
  },
  {
    figureNumber: 3,
    title: 'Data Model Relationships',
    description: 'FIG. 3 is a block diagram illustrating the core data model relationships and entity structure according to an embodiment of the present invention.',
    drawingType: 'block_diagram',
    width: 750,
    height: 500,
    blocks: [
      { id: 'project', label: 'Project\nEntity', x: 50, y: 180, width: 140, height: 80, calloutNumber: 300 },
      { id: 'manager', label: 'Entity\nManager', x: 280, y: 190, width: 140, height: 60, calloutNumber: 302 },
      { id: 'storage', label: 'Object\nStorage', x: 50, y: 60, width: 140, height: 70, calloutNumber: 304 },
      { id: 'config', label: 'Project\nConfiguration', x: 50, y: 310, width: 140, height: 60, calloutNumber: 306 },
      { id: 'builder', label: 'Query\nBuilder', x: 500, y: 190, width: 140, height: 60, calloutNumber: 308 },
      { id: 'output', label: 'Query\nResult Set', x: 500, y: 320, width: 140, height: 60, calloutNumber: 310 },
      { id: 'schema', label: 'Schema\nDefinition', x: 280, y: 60, width: 140, height: 50, calloutNumber: 312 },
      { id: 'index', label: 'Index\nManager', x: 280, y: 320, width: 140, height: 50, calloutNumber: 314 }
    ],
    arrows: [
      { from: 'project', to: 'manager' },
      { from: 'storage', to: 'manager' },
      { from: 'config', to: 'manager' },
      { from: 'manager', to: 'builder' },
      { from: 'builder', to: 'output' },
      { from: 'schema', to: 'manager' },
      { from: 'index', to: 'manager' }
    ]
  },
  {
    figureNumber: 4,
    title: 'External Service Integration Architecture',
    description: 'FIG. 4 is a block diagram illustrating the external service integration and provider abstraction architecture according to an embodiment of the present invention.',
    drawingType: 'block_diagram',
    width: 800,
    height: 500,
    blocks: [
      { id: 'request', label: 'Service\nRequest Input', x: 50, y: 200, width: 130, height: 60, calloutNumber: 400 },
      { id: 'router', label: 'Service\nRouter', x: 220, y: 140, width: 130, height: 60, calloutNumber: 402 },
      { id: 'abstraction', label: 'Provider\nAbstraction\nLayer', x: 220, y: 240, width: 130, height: 70, calloutNumber: 404 },
      { id: 'provider_a', label: 'Provider A\nAdapter', x: 400, y: 120, width: 120, height: 50, calloutNumber: 406 },
      { id: 'provider_b', label: 'Provider B\nAdapter', x: 400, y: 200, width: 120, height: 50, calloutNumber: 408 },
      { id: 'response', label: 'Unified\nResponse', x: 400, y: 300, width: 120, height: 50, calloutNumber: 410 },
      { id: 'config', label: 'Provider\nConfiguration', x: 560, y: 120, width: 120, height: 60, calloutNumber: 412 },
      { id: 'handler', label: 'Response\nProcessor', x: 560, y: 240, width: 120, height: 60, calloutNumber: 414 },
      { id: 'output', label: 'Processed\nOutput', x: 560, y: 360, width: 120, height: 50, calloutNumber: 416 }
    ],
    arrows: [
      { from: 'request', to: 'router' },
      { from: 'request', to: 'abstraction' },
      { from: 'router', to: 'abstraction' },
      { from: 'abstraction', to: 'provider_a' },
      { from: 'abstraction', to: 'provider_b' },
      { from: 'provider_a', to: 'response' },
      { from: 'provider_b', to: 'response' },
      { from: 'response', to: 'handler' },
      { from: 'config', to: 'handler' },
      { from: 'handler', to: 'output' }
    ]
  },
  {
    figureNumber: 5,
    title: 'Output Generation and Assembly Workflow',
    description: 'FIG. 5 is a flowchart illustrating the output generation and assembly workflow according to an embodiment of the present invention.',
    drawingType: 'flowchart',
    width: 700,
    height: 600,
    blocks: [
      { id: 'input', label: 'Approved\nInput Data', x: 275, y: 20, width: 150, height: 50, calloutNumber: 500 },
      { id: 'plan', label: 'Generation\nPlan', x: 275, y: 100, width: 150, height: 50, calloutNumber: 502 },
      { id: 'stage_a', label: 'Generate\nSection A', x: 100, y: 200, width: 140, height: 50, calloutNumber: 504 },
      { id: 'stage_b', label: 'Generate\nSection B', x: 275, y: 200, width: 150, height: 50, calloutNumber: 506 },
      { id: 'stage_c', label: 'Generate\nSection C', x: 460, y: 200, width: 140, height: 50, calloutNumber: 508 },
      { id: 'queue', label: 'Assembly\nQueue', x: 275, y: 300, width: 150, height: 50, calloutNumber: 510 },
      { id: 'assemble', label: 'Assemble\nDocument', x: 275, y: 380, width: 150, height: 50, calloutNumber: 512 },
      { id: 'validate', label: 'Final\nValidation', x: 275, y: 460, width: 150, height: 50, calloutNumber: 514 },
      { id: 'output', label: 'Completed\nOutput', x: 275, y: 540, width: 150, height: 50, calloutNumber: 516 }
    ],
    arrows: [
      { from: 'input', to: 'plan' },
      { from: 'plan', to: 'stage_a' },
      { from: 'plan', to: 'stage_b' },
      { from: 'plan', to: 'stage_c' },
      { from: 'stage_a', to: 'queue' },
      { from: 'stage_b', to: 'queue' },
      { from: 'stage_c', to: 'queue' },
      { from: 'queue', to: 'assemble' },
      { from: 'assemble', to: 'validate' },
      { from: 'validate', to: 'output' }
    ]
  },
  {
    figureNumber: 6,
    title: 'Configuration Resolution System',
    description: 'FIG. 6 is a block diagram illustrating the configuration resolution system with multi-level caching according to an embodiment of the present invention.',
    drawingType: 'block_diagram',
    width: 750,
    height: 500,
    blocks: [
      { id: 'request', label: 'Config\nRequest', x: 50, y: 200, width: 120, height: 50, calloutNumber: 600 },
      { id: 'memcache', label: 'In-Memory\nCache', x: 220, y: 120, width: 130, height: 50, calloutNumber: 602 },
      { id: 'resolver', label: 'Config\nResolver', x: 220, y: 200, width: 130, height: 60, calloutNumber: 604 },
      { id: 'project_cfg', label: 'Project\nConfig', x: 400, y: 120, width: 130, height: 50, calloutNumber: 606 },
      { id: 'system_cfg', label: 'System\nDefaults', x: 400, y: 200, width: 130, height: 50, calloutNumber: 608 },
      { id: 'version', label: 'Version\nManager', x: 400, y: 290, width: 130, height: 50, calloutNumber: 610 },
      { id: 'interpolate', label: 'Variable\nInterpolation', x: 580, y: 200, width: 130, height: 50, calloutNumber: 612 },
      { id: 'output', label: 'Resolved\nConfig', x: 580, y: 300, width: 130, height: 50, calloutNumber: 614 }
    ],
    arrows: [
      { from: 'request', to: 'memcache' },
      { from: 'request', to: 'resolver' },
      { from: 'memcache', to: 'resolver' },
      { from: 'resolver', to: 'project_cfg' },
      { from: 'resolver', to: 'system_cfg' },
      { from: 'project_cfg', to: 'version' },
      { from: 'system_cfg', to: 'version' },
      { from: 'version', to: 'interpolate' },
      { from: 'interpolate', to: 'output' }
    ]
  },
  {
    figureNumber: 7,
    title: 'Scoring Algorithm Flowchart',
    description: 'FIG. 7 is a flowchart illustrating the scoring algorithm process with weighted factor analysis according to an embodiment of the present invention.',
    drawingType: 'flowchart',
    width: 700,
    height: 650,
    blocks: [
      { id: 'input', label: 'Input\nParameters', x: 275, y: 20, width: 150, height: 50, calloutNumber: 700 },
      { id: 'base', label: 'Calculate\nBase Score', x: 275, y: 100, width: 150, height: 50, calloutNumber: 702 },
      { id: 'weight', label: 'Apply\nWeight Factors', x: 275, y: 180, width: 150, height: 50, calloutNumber: 704 },
      { id: 'normalize', label: 'Normalize\nScores', x: 275, y: 260, width: 150, height: 50, calloutNumber: 706 },
      { id: 'formula', label: 'Weighted\nFormula', x: 480, y: 260, width: 130, height: 50, calloutNumber: 708 },
      { id: 'aggregate', label: 'Aggregate\nResults', x: 275, y: 340, width: 150, height: 50, calloutNumber: 710 },
      { id: 'threshold_a', label: 'Compare\nThreshold A', x: 100, y: 420, width: 140, height: 50, calloutNumber: 712 },
      { id: 'compare', label: 'Generate\nComparison', x: 275, y: 420, width: 150, height: 50, calloutNumber: 714 },
      { id: 'threshold_b', label: 'Compare\nThreshold B', x: 460, y: 420, width: 140, height: 50, calloutNumber: 716 },
      { id: 'rank', label: 'Generate\nRanking', x: 275, y: 500, width: 150, height: 50, calloutNumber: 718 },
      { id: 'output', label: 'Score\nReport', x: 275, y: 580, width: 150, height: 50, calloutNumber: 720 }
    ],
    arrows: [
      { from: 'input', to: 'base' },
      { from: 'base', to: 'weight' },
      { from: 'weight', to: 'normalize' },
      { from: 'formula', to: 'normalize' },
      { from: 'normalize', to: 'aggregate' },
      { from: 'aggregate', to: 'compare' },
      { from: 'threshold_a', to: 'compare' },
      { from: 'threshold_b', to: 'compare' },
      { from: 'compare', to: 'rank' },
      { from: 'rank', to: 'output' }
    ]
  },
  {
    figureNumber: 8,
    title: 'Application Dashboard Interface',
    description: 'FIG. 8 is a simplified wireframe illustration of the application dashboard user interface according to an embodiment of the present invention.',
    drawingType: 'wireframe',
    width: 900,
    height: 600,
    blocks: [
      { id: 'header', label: 'Global Navigation Bar with Project Selector', x: 50, y: 20, width: 800, height: 35, calloutNumber: 800 },
      { id: 'sidebar', label: 'Main\nNavigation\nMenu', x: 50, y: 75, width: 120, height: 475, calloutNumber: 802 },
      { id: 'primary_tab', label: 'Primary\nView', x: 190, y: 75, width: 150, height: 35, calloutNumber: 804 },
      { id: 'secondary_tab', label: 'Secondary\nView', x: 360, y: 75, width: 150, height: 35, calloutNumber: 806 },
      { id: 'selector', label: 'Project\nSelector', x: 190, y: 125, width: 200, height: 50, calloutNumber: 808 },
      { id: 'stats', label: 'Analytics Dashboard\n(Status Metrics)', x: 410, y: 125, width: 440, height: 50, calloutNumber: 810 },
      { id: 'list_panel', label: 'Item List\nPanel', x: 190, y: 195, width: 200, height: 190, calloutNumber: 812 },
      { id: 'preview', label: 'Preview Area\n(Content Display)', x: 410, y: 195, width: 220, height: 190, calloutNumber: 814 },
      { id: 'details', label: 'Details Panel\n(Metadata)', x: 650, y: 195, width: 200, height: 190, calloutNumber: 816 },
      { id: 'actions', label: 'Action Button Bar', x: 190, y: 405, width: 660, height: 45, calloutNumber: 818 },
      { id: 'workflow', label: 'Workflow Progress Tracker', x: 190, y: 470, width: 320, height: 80, calloutNumber: 820 },
      { id: 'summary', label: 'Summary Panel', x: 530, y: 470, width: 320, height: 80, calloutNumber: 822 }
    ],
    arrows: []
  }
];

function generateBlockSVG(block: BlockElement): string {
  const lines = block.label.split('\n');
  const lineHeight = 16;
  const textY = block.y + (block.height / 2) - ((lines.length - 1) * lineHeight / 2);

  const textElements = lines.map((line, i) =>
    `<text x="${block.x + block.width / 2}" y="${textY + i * lineHeight}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="12">${line}</text>`
  ).join('');

  return `
    <rect x="${block.x}" y="${block.y}" width="${block.width}" height="${block.height}" fill="white" stroke="black" stroke-width="2" rx="4"/>
    ${textElements}
    <text x="${block.x + 8}" y="${block.y + 14}" font-family="Arial, sans-serif" font-size="10" font-weight="bold">${block.calloutNumber}</text>
  `;
}

function getBlockCenter(block: BlockElement): { x: number; y: number } {
  return {
    x: block.x + block.width / 2,
    y: block.y + block.height / 2
  };
}

function getConnectionPoints(from: BlockElement, to: BlockElement): { x1: number; y1: number; x2: number; y2: number } {
  const fromCenter = getBlockCenter(from);
  const toCenter = getBlockCenter(to);

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  let x1: number, y1: number, x2: number, y2: number;

  if (Math.abs(dy) > Math.abs(dx)) {
    if (dy > 0) {
      x1 = fromCenter.x;
      y1 = from.y + from.height;
      x2 = toCenter.x;
      y2 = to.y;
    } else {
      x1 = fromCenter.x;
      y1 = from.y;
      x2 = toCenter.x;
      y2 = to.y + to.height;
    }
  } else {
    if (dx > 0) {
      x1 = from.x + from.width;
      y1 = fromCenter.y;
      x2 = to.x;
      y2 = toCenter.y;
    } else {
      x1 = from.x;
      y1 = fromCenter.y;
      x2 = to.x + to.width;
      y2 = toCenter.y;
    }
  }

  return { x1, y1, x2, y2 };
}

function generateArrowSVG(arrow: ArrowConnection, blocks: BlockElement[]): string {
  const fromBlock = blocks.find(b => b.id === arrow.from);
  const toBlock = blocks.find(b => b.id === arrow.to);

  if (!fromBlock || !toBlock) return '';

  const { x1, y1, x2, y2 } = getConnectionPoints(fromBlock, toBlock);

  const markerId = arrow.bidirectional ? 'arrow-bi' : 'arrow';

  let path = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="1.5" marker-end="url(#${markerId})"`;

  if (arrow.bidirectional) {
    path += ` marker-start="url(#arrow-start)"`;
  }

  path += '/>';

  return path;
}

function generateSVG(def: DiagramDefinition): string {
  const blocksSVG = def.blocks.map(generateBlockSVG).join('');
  const arrowsSVG = def.arrows.map(a => generateArrowSVG(a, def.blocks)).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${def.width} ${def.height}" width="${def.width}" height="${def.height}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="black"/>
    </marker>
    <marker id="arrow-bi" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="black"/>
    </marker>
    <marker id="arrow-start" markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M9,0 L9,6 L0,3 z" fill="black"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
  <text x="${def.width / 2}" y="${def.height - 10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold">FIG. ${def.figureNumber}</text>
  ${arrowsSVG}
  ${blocksSVG}
</svg>`;
}

function extractCallouts(def: DiagramDefinition): DrawingCallout[] {
  return def.blocks.map(block => ({
    number: block.calloutNumber,
    label: block.label.replace(/\n/g, ' '),
    description: `Reference numeral ${block.calloutNumber} indicates ${block.label.replace(/\n/g, ' ').toLowerCase()}`
  }));
}

export function generateAllDrawings(): { svg: string; definition: DiagramDefinition; callouts: DrawingCallout[] }[] {
  return FIGURE_DEFINITIONS.map(def => ({
    svg: generateSVG(def),
    definition: def,
    callouts: extractCallouts(def)
  }));
}

export function generateDrawing(figureNumber: number): { svg: string; definition: DiagramDefinition; callouts: DrawingCallout[] } | null {
  const def = FIGURE_DEFINITIONS.find(d => d.figureNumber === figureNumber);
  if (!def) return null;

  return {
    svg: generateSVG(def),
    definition: def,
    callouts: extractCallouts(def)
  };
}

export async function generateDrawingsForApplication(
  applicationId: string,
  projectId: string
): Promise<PatentDrawing[]> {
  const drawings: PatentDrawing[] = [];
  const errors: Array<{ figureNumber: string; error: string; details?: any }> = [];

  console.log(`Starting dynamic drawing generation for application ${applicationId}`);

  try {
    await deleteAllDrawingsForApplication(applicationId);
  } catch (error) {
    console.error('Failed to delete existing drawings:', error);
  }

  try {
    // Fetch features from the analysis results stored for this project
    const { data: featureRows } = await (supabase as any)
      .from('extracted_features')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const features: ExtractedFeature[] = (featureRows || []).map((row: any) => ({
      name: row.name || 'Unnamed Feature',
      type: row.type || 'algorithm',
      description: row.description || '',
      technicalDetails: row.technical_details || row.description || '',
      sourceFile: row.source_files?.[0] || undefined,
      noveltyStrength: row.novelty_strength || 'moderate',
      isCoreInnovation: row.is_core_innovation ?? false
    }));

    console.log(`Found ${features.length} features from codebase analysis`);

    if (features.length === 0) {
      console.warn('No features found — skipping drawing generation (no static fallback)');
      return [];
    }

    const domainAnalysis = analyzeDomain(features);
    console.log(`Domain analysis: ${domainAnalysis.coreInnovationCount} core innovations`);

    const drawingSpecs = planDrawingFigures(features, domainAnalysis);
    console.log(`Planned ${drawingSpecs.length} figures for this application`);

    for (const spec of drawingSpecs) {
      await sleep(100);

      try {
        const figureNum = spec.subFigureLetter ? `${spec.figureNumber}${spec.subFigureLetter}` : spec.figureNumber.toString();
        console.log(`Generating Figure ${figureNum}: ${spec.title}`);

        const result = await generateDiagramForSpec(spec, features, domainAnalysis);

        if (!result.svg || result.svg.length === 0) {
          throw new Error(`SVG generation failed: empty SVG output`);
        }

        const drawing = await createPatentDrawing(applicationId, {
          figure_number: spec.figureNumber,
          title: spec.title,
          description: spec.description,
          svg_content: result.svg,
          image_url: null,
          drawing_type: spec.drawingType,
          callouts: result.callouts
        });

        drawings.push(drawing);
        console.log(`Successfully generated Figure ${figureNum}`);
      } catch (error) {
        const errorInfo = extractErrorInfo(error);
        const figureId = spec.subFigureLetter ? `${spec.figureNumber}${spec.subFigureLetter}` : spec.figureNumber.toString();

        console.error(`Failed to generate Figure ${figureId}:`, errorInfo);

        errors.push({
          figureNumber: figureId,
          error: errorInfo.message,
          details: errorInfo.details
        });

        await sleep(200);

        console.log(`Retrying Figure ${figureId}...`);
        try {
          const result = await generateDiagramForSpec(spec, features, domainAnalysis);
          const drawing = await createPatentDrawing(applicationId, {
            figure_number: spec.figureNumber,
            title: spec.title,
            description: spec.description,
            svg_content: result.svg,
            image_url: null,
            drawing_type: spec.drawingType,
            callouts: result.callouts
          });
          drawings.push(drawing);
          console.log(`Retry successful for Figure ${figureId}`);
        } catch (retryError) {
          console.error(`Retry failed for Figure ${figureId}:`, retryError);
        }
      }
    }

    console.log(`Drawing generation complete: ${drawings.length} successful, ${errors.length} failed`);

    if (drawings.length === 0) {
      const detailedErrors = errors.map(e => `Fig ${e.figureNumber}: ${e.error}`).join('; ');
      throw new Error(`All drawing generation attempts failed. Errors: ${detailedErrors}`);
    }

    if (errors.length > 0) {
      console.warn(`Some drawings failed to generate:`, errors);
    }

    return drawings;

  } catch (error) {
    console.error('Feature extraction or planning failed — returning empty drawings (no static fallback):', error);
    return [];
  }
}

/**
 * Regenerate a single drawing by figure number.
 * Deletes the existing drawing and generates a fresh one.
 */
export async function regenerateSingleDrawing(
  applicationId: string,
  projectId: string,
  figureNumber: number
): Promise<PatentDrawing | null> {
  try {
    // Delete the existing drawing for this figure
    await (supabase as any)
      .from('patent_drawings')
      .delete()
      .eq('application_id', applicationId)
      .eq('figure_number', figureNumber);

    // Fetch features from analysis results
    const { data: featureRows } = await (supabase as any)
      .from('extracted_features')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const features: ExtractedFeature[] = (featureRows || []).map((row: any) => ({
      name: row.name || 'Unnamed Feature',
      type: row.type || 'algorithm',
      description: row.description || '',
      technicalDetails: row.technical_details || row.description || '',
      sourceFile: row.source_files?.[0] || undefined,
      noveltyStrength: row.novelty_strength || 'moderate',
      isCoreInnovation: row.is_core_innovation ?? false
    }));

    if (features.length === 0) {
      return null;
    }

    const domainAnalysis = analyzeDomain(features);
    const drawingSpecs = planDrawingFigures(features, domainAnalysis);
    const spec = drawingSpecs.find(s => s.figureNumber === figureNumber);

    if (!spec) {
      return null;
    }

    const result = await generateDiagramForSpec(spec, features, domainAnalysis);

    if (!result.svg || result.svg.length === 0) {
      return null;
    }

    return await createPatentDrawing(applicationId, {
      figure_number: spec.figureNumber,
      title: spec.title,
      description: spec.description,
      svg_content: result.svg,
      image_url: null,
      drawing_type: spec.drawingType,
      callouts: result.callouts
    });
  } catch (error) {
    console.error(`Failed to regenerate drawing for figure ${figureNumber}:`, error);
    return null;
  }
}

/**
 * Generate a patent diagram using AI from actual extracted features.
 * Returns null only if generation truly fails after best effort.
 * No static or template fallback — every diagram must reflect the real codebase.
 */
async function generateDiagramWithAI(
  spec: DrawingSpec,
  _features: ExtractedFeature[],
  baseCalloutNumber: number
): Promise<{ svg: string; callouts: DrawingCallout[] } | null> {
  try {
    const featureDescriptions = spec.sourceFeatures
      .map(f => `- ${f.name}: ${f.description} (type: ${f.type})`)
      .join('\n');

    const prompt = `You are a patent illustrator generating SVG diagrams for USPTO patent applications.

CRITICAL: Every element in this diagram MUST correspond to an actual feature extracted from the codebase. Do NOT invent, fabricate, or add generic placeholder components. If a feature is not listed below, it must NOT appear in the diagram. No output is better than a false output.

FIGURE: FIG. ${spec.figureNumber} — ${spec.title}
TYPE: ${spec.drawingType}
DESCRIPTION: ${spec.description}

ACTUAL CODEBASE COMPONENTS (use ONLY these):
${featureDescriptions}

REQUIREMENTS:
1. Output valid SVG markup (xmlns="http://www.w3.org/2000/svg")
2. Canvas size: 800x600 pixels
3. Use numbered callouts starting at ${baseCalloutNumber} (e.g., ${baseCalloutNumber}, ${baseCalloutNumber + 2}, ${baseCalloutNumber + 4})
4. Each component must have a callout circle (small circle with the number) in its top-left corner
5. Use arrows to show data flow / control flow between components
6. Style: clean, professional, suitable for USPTO filing
7. Font: Arial, minimum 14px for labels, 12px for callouts
8. Colors: Use #EFF6FF fill with #2563EB stroke for core innovation components, #F9FAFB fill with #6B7280 stroke for support components, #F0FDF4 fill with #059669 stroke for external services
9. Minimum stroke width: 2px
10. Include a title at the bottom: "FIG. ${spec.figureNumber} — ${spec.title}"
11. ONLY depict components and relationships that exist in the features listed above — do NOT add generic modules like "Database", "Auth", "Cache" unless they are explicitly listed

${spec.drawingType === 'flowchart' ? 'Use diamond shapes for decision points, rounded rectangles for start/end, rectangles for process steps. Flow should go top-to-bottom.' : ''}
${spec.drawingType === 'block_diagram' ? 'Use rectangles for components with directional arrows showing relationships. Group related components visually.' : ''}
${spec.drawingType === 'wireframe' ? 'Show a simplified UI layout with labeled regions. Use dashed borders for interactive elements.' : ''}

Respond with ONLY the SVG markup. No explanation, no markdown code fences. Start with <svg and end with </svg>.`;

    const response = await generateText(prompt, 'patent_drawing_generation');

    // Extract SVG from response
    const svgMatch = response.match(/<svg[\s\S]*<\/svg>/);
    if (!svgMatch) return null;

    const svg = svgMatch[0];

    // Validate it's reasonable SVG (has at least some content)
    if (svg.length < 200) return null;

    // Extract callouts from the generated SVG by looking for the numbered circles
    const callouts: DrawingCallout[] = [];
    const calloutRegex = new RegExp(`>(${baseCalloutNumber}\\d*)<`, 'g');
    const foundNumbers = new Set<number>();
    let match;
    while ((match = calloutRegex.exec(svg)) !== null) {
      foundNumbers.add(parseInt(match[1]));
    }

    // Build callout descriptions from the spec's source features
    let calloutIdx = 0;
    for (const num of Array.from(foundNumbers).sort((a, b) => a - b)) {
      const feature = spec.sourceFeatures[calloutIdx];
      callouts.push({
        number: num,
        label: feature?.name || `Component ${num}`,
        description: feature?.description || `Reference numeral ${num} indicates a component of the ${spec.title.toLowerCase()}`,
      });
      calloutIdx++;
    }

    // If no callouts were found in SVG, generate based on features
    if (callouts.length === 0) {
      spec.sourceFeatures.forEach((f, i) => {
        callouts.push({
          number: baseCalloutNumber + i * 2,
          label: f.name,
          description: f.description || `Reference numeral ${baseCalloutNumber + i * 2} indicates ${f.name.toLowerCase()}`,
        });
      });
    }

    console.log(`AI generated SVG for FIG. ${spec.figureNumber} (${svg.length} chars, ${callouts.length} callouts)`);
    return { svg, callouts };
  } catch (error) {
    console.warn(`AI drawing generation failed for FIG. ${spec.figureNumber}:`, error);
    return null;
  }
}

/**
 * Enhance callout descriptions using AI to produce professional, USPTO-quality text.
 */
export async function enhanceCalloutDescriptions(
  callouts: DrawingCallout[],
  inventionTitle: string,
  claims: string[]
): Promise<DrawingCallout[]> {
  try {
    const calloutList = callouts.map(c =>
      `- Ref ${c.number}: "${c.label}" — ${c.description}`
    ).join('\n');

    const claimText = claims.length > 0
      ? `\nRELATED CLAIMS:\n${claims.slice(0, 5).map((c, i) => `Claim ${i + 1}: ${c.substring(0, 200)}`).join('\n')}`
      : '';

    const prompt = `You are a patent attorney writing the "Brief Description of the Drawings" section. Enhance each callout description to be professional, USPTO-compliant, and linked to the claims where applicable.

INVENTION: ${inventionTitle}

CURRENT CALLOUTS:
${calloutList}
${claimText}

For each reference numeral, write a 1-2 sentence professional description suitable for a patent specification. Use patent language (e.g., "configured to", "operatively coupled to", "adapted to").

Return a JSON array where each element has:
- "number": the reference numeral (integer)
- "label": the component name (keep same as original)
- "description": the enhanced professional description

Respond with ONLY the JSON array.`;

    const response = await generateText(prompt, 'patent_callout_enhancement');
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return callouts;

    const enhanced = JSON.parse(jsonMatch[0]) as DrawingCallout[];
    if (!Array.isArray(enhanced) || enhanced.length === 0) return callouts;

    // Merge: keep original callouts but update descriptions from AI
    return callouts.map(original => {
      const aiVersion = enhanced.find(e => e.number === original.number);
      return aiVersion ? { ...original, description: aiVersion.description } : original;
    });
  } catch (error) {
    console.warn('AI callout enhancement failed, keeping originals:', error);
    return callouts;
  }
}

async function generateDiagramForSpec(
  spec: DrawingSpec,
  features: ExtractedFeature[],
  _domainAnalysis: any
): Promise<{ svg: string; callouts: DrawingCallout[] }> {
  const baseCalloutNumber = spec.figureNumber * 100;

  // All drawings must be AI-generated from actual features — no static/template fallback
  const aiResult = await generateDiagramWithAI(spec, features, baseCalloutNumber);
  if (aiResult) return aiResult;

  throw new Error(`AI drawing generation failed for FIG. ${spec.figureNumber} — no static fallback allowed`);
}

function extractErrorInfo(error: any): { message: string; details: any } {
  if (error instanceof Error) {
    return {
      message: error.message,
      details: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause
      }
    };
  } else if (typeof error === 'object' && error !== null) {
    return {
      message: JSON.stringify(error),
      details: error
    };
  } else {
    return {
      message: String(error),
      details: { rawError: error, type: typeof error }
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getDrawingDefinitions(): DiagramDefinition[] {
  return FIGURE_DEFINITIONS;
}

export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

export function formatDrawingsDescriptionSection(drawings: PatentDrawing[]): string {
  const sorted = [...drawings].sort((a, b) => a.figure_number - b.figure_number);

  const drawingTypeLabels: Record<string, string> = {
    block_diagram: 'a block diagram',
    flowchart: 'a flowchart',
    wireframe: 'a wireframe illustration',
    schematic: 'a schematic diagram',
    sequence_diagram: 'a sequence diagram'
  };

  let description = 'BRIEF DESCRIPTION OF THE DRAWINGS\n\n';
  description += 'The accompanying drawings, which are incorporated in and constitute a part of this specification, illustrate embodiments of the invention and, together with the description, serve to explain the principles of the invention.\n\n';

  for (const drawing of sorted) {
    const typeLabel = drawingTypeLabels[drawing.drawing_type] || 'a diagram';
    const titleLower = drawing.title.toLowerCase();
    description += `    FIG. ${drawing.figure_number} is ${typeLabel} illustrating the ${titleLower} according to an embodiment of the present invention.\n`;
  }

  return description;
}
