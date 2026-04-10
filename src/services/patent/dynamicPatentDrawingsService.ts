import type { ExtractedFeature } from '../../types';
import type { PatentDrawing } from './patentApplicationService';

export interface DrawingSpec {
  figureNumber: number;
  title: string;
  description: string;
  drawingType: PatentDrawing['drawing_type'];
  sourceFeatures: ExtractedFeature[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  requiresSplit: boolean;
}

export interface DomainAnalysis {
  domainType: 'general_software';
  topTierFeatures: ExtractedFeature[];
  moderateFeatures: ExtractedFeature[];
  totalFeatureCount: number;
  coreInnovationCount: number;
}

export function analyzeDomain(features: ExtractedFeature[]): DomainAnalysis {
  const topTierFeatures = features.filter(f =>
    f.noveltyStrength === 'strong' && f.isCoreInnovation
  );

  const moderateFeatures = features.filter(f =>
    f.noveltyStrength === 'moderate' ||
    (f.noveltyStrength === 'strong' && !f.isCoreInnovation)
  );

  const coreCount = features.filter(f => f.isCoreInnovation).length;

  return {
    domainType: 'general_software',
    topTierFeatures,
    moderateFeatures,
    totalFeatureCount: features.length,
    coreInnovationCount: coreCount
  };
}

export function planDrawingFigures(
  features: ExtractedFeature[],
  analysis: DomainAnalysis
): DrawingSpec[] {
  const specs: DrawingSpec[] = [];
  let figureNumber = 1;

  const systemComponents = estimateSystemComponents(features);

  // Cap features for Figure 1 to avoid exceeding AI output token limits.
  // Prioritize core innovations, then strong novelty, then moderate.
  const MAX_ARCH_FEATURES = 10;
  const archFeatures = [
    ...features.filter(f => f.isCoreInnovation),
    ...features.filter(f => !f.isCoreInnovation && f.noveltyStrength === 'strong'),
    ...features.filter(f => !f.isCoreInnovation && f.noveltyStrength !== 'strong'),
  ].slice(0, MAX_ARCH_FEATURES);

  // Always generate a single Figure 1 architecture diagram.
  // The feature cap above keeps the SVG within token limits.
  specs.push({
    figureNumber: 1,
    title: 'System Architecture',
    description: `FIG. 1 is a block diagram illustrating the system architecture of the software system according to an embodiment of the present invention.`,
    drawingType: 'block_diagram',
    sourceFeatures: archFeatures,
    estimatedComplexity: systemComponents > 15 ? 'complex' : systemComponents > 10 ? 'moderate' : 'simple',
    requiresSplit: false
  });
  figureNumber = 2;

  for (const feature of analysis.topTierFeatures) {
    const spec = createFeatureDrawingSpec(feature, figureNumber);
    if (spec) {
      specs.push(spec);
      figureNumber++;
    }
  }

  const algorithmFeatures = analysis.moderateFeatures.filter(f => f.type === 'algorithm');
  if (algorithmFeatures.length > 0) {
    for (const feature of algorithmFeatures.slice(0, 2)) {
      const spec = createFeatureDrawingSpec(feature, figureNumber);
      if (spec) {
        specs.push(spec);
        figureNumber++;
      }
    }
  }

  const integrationFeatures = analysis.moderateFeatures.filter(f => f.type === 'integration');
  if (integrationFeatures.length >= 3) {
    specs.push({
      figureNumber,
      title: 'Multi-Provider Integration Architecture',
      description: `FIG. ${figureNumber} is a block diagram illustrating the multi-provider integration architecture with abstraction layers and service orchestration according to an embodiment of the present invention.`,
      drawingType: 'block_diagram',
      sourceFeatures: integrationFeatures,
      estimatedComplexity: 'moderate',
      requiresSplit: false
    });
    figureNumber++;
  }

  const dataStructures = features.filter(f => f.type === 'data_structure');
  if (dataStructures.length >= 2) {
    specs.push({
      figureNumber,
      title: 'Data Structure Relationships',
      description: `FIG. ${figureNumber} is an entity-relationship diagram illustrating the data structure relationships and multi-tenant isolation architecture according to an embodiment of the present invention.`,
      drawingType: 'block_diagram',
      sourceFeatures: dataStructures,
      estimatedComplexity: 'moderate',
      requiresSplit: false
    });
    figureNumber++;
  }

  const workflowFeatures = features.filter(f =>
    f.name.toLowerCase().includes('workflow') ||
    f.name.toLowerCase().includes('pipeline')
  );

  if (workflowFeatures.length > 0) {
    specs.push({
      figureNumber,
      title: 'Processing Workflow',
      description: `FIG. ${figureNumber} is a flowchart illustrating the processing workflow from input to final output according to an embodiment of the present invention.`,
      drawingType: 'flowchart',
      sourceFeatures: workflowFeatures,
      estimatedComplexity: 'moderate',
      requiresSplit: false
    });
    figureNumber++;
  }

  const uiFeatures = features.filter(f => f.type === 'ui_pattern');
  if (uiFeatures.length >= 2) {
    specs.push({
      figureNumber,
      title: 'User Interface Architecture',
      description: `FIG. ${figureNumber} is a wireframe illustration of the user interface architecture showing main navigation and workflow management components according to an embodiment of the present invention.`,
      drawingType: 'wireframe',
      sourceFeatures: uiFeatures,
      estimatedComplexity: 'simple',
      requiresSplit: false
    });
    figureNumber++;
  }

  return specs;
}

function createFeatureDrawingSpec(
  feature: ExtractedFeature,
  figureNumber: number
): DrawingSpec | null {
  const drawingType = getDrawingTypeForFeature(feature);

  return {
    figureNumber,
    title: feature.name,
    description: `FIG. ${figureNumber} is a ${getDrawingTypeDescription(drawingType)} illustrating the ${feature.name.toLowerCase()} according to an embodiment of the present invention.`,
    drawingType,
    sourceFeatures: [feature],
    estimatedComplexity: feature.noveltyStrength === 'strong' ? 'moderate' : 'simple',
    requiresSplit: false
  };
}

function getDrawingTypeForFeature(feature: ExtractedFeature): PatentDrawing['drawing_type'] {
  if (feature.type === 'algorithm') {
    return 'flowchart';
  } else if (feature.type === 'data_structure') {
    return 'block_diagram';
  } else if (feature.type === 'integration') {
    return 'block_diagram';
  } else if (feature.type === 'ui_pattern') {
    return 'wireframe';
  } else {
    return 'block_diagram';
  }
}

function getDrawingTypeDescription(type: PatentDrawing['drawing_type']): string {
  switch (type) {
    case 'flowchart':
      return 'flowchart';
    case 'block_diagram':
      return 'block diagram';
    case 'wireframe':
      return 'wireframe diagram';
    case 'schematic':
      return 'schematic diagram';
    case 'sequence_diagram':
      return 'sequence diagram';
    default:
      return 'diagram';
  }
}

function estimateSystemComponents(features: ExtractedFeature[]): number {
  const coreComponents = 5;
  const featureComponents = Math.ceil(features.length * 0.6);
  const integrationPoints = features.filter(f => f.type === 'integration').length * 2;

  return coreComponents + featureComponents + integrationPoints;
}
