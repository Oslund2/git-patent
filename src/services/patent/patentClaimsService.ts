import { createPatentClaim } from './patentApplicationService';
import type { PatentClaim } from './patentApplicationService';
import {
  getPatentClaimsIndependentPrompt,
  getPatentClaimsDependentPrompt
} from '../ai/promptResolver';
import {
  makeAIRequest,
  parseJSONArray,
} from '../ai/aiRequestService';


export function formatClaimForDisplay(claim: PatentClaim): string {
  return `${claim.claim_number}. ${claim.claim_text}`;
}

export function formatClaimsSection(claims: PatentClaim[]): string {
  const sorted = [...claims].sort((a, b) => a.claim_number - b.claim_number);
  return sorted.map(claim => formatClaimForDisplay(claim)).join('\n\n');
}

export function getClaimTypeLabel(type: PatentClaim['claim_type']): string {
  return type === 'independent' ? 'Independent' : 'Dependent';
}

export function getCategoryLabel(category: PatentClaim['category']): string {
  const labels: Record<string, string> = {
    method: 'Method',
    system: 'System',
    apparatus: 'Apparatus',
    composition: 'Composition'
  };
  return labels[category] || category;
}

export function validateClaims(claims: PatentClaim[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const independentClaims = claims.filter(c => c.claim_type === 'independent');
  if (independentClaims.length === 0) {
    errors.push('At least one independent claim is required');
  }

  const dependentClaims = claims.filter(c => c.claim_type === 'dependent');
  for (const claim of dependentClaims) {
    if (!claim.parent_claim_id) {
      errors.push(`Dependent claim ${claim.claim_number} must reference a parent claim`);
    }
  }

  const claimNumbers = claims.map(c => c.claim_number);
  const uniqueNumbers = new Set(claimNumbers);
  if (claimNumbers.length !== uniqueNumbers.size) {
    errors.push('Duplicate claim numbers detected');
  }

  for (let i = 1; i <= claims.length; i++) {
    if (!claimNumbers.includes(i)) {
      errors.push(`Missing claim number ${i} in sequence`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function countClaimsByType(claims: PatentClaim[]): { independent: number; dependent: number; total: number } {
  const independent = claims.filter(c => c.claim_type === 'independent').length;
  const dependent = claims.filter(c => c.claim_type === 'dependent').length;
  return { independent, dependent, total: claims.length };
}

export async function generateAIEnhancedClaims(
  applicationId: string,
  features: any[],
  noveltyAnalysis: any,
  projectId?: string | null,
  title?: string,
  inventionDescription?: string
): Promise<PatentClaim[]> {
  const claims: PatentClaim[] = [];

  const independentClaims = await generateIndependentClaims(
    features,
    noveltyAnalysis,
    projectId || null,
    title,
    inventionDescription
  );

  for (let i = 0; i < independentClaims.length; i++) {
    const claimText = independentClaims[i];
    const claim = await createPatentClaim(applicationId, {
      claim_number: i + 1,
      claim_type: 'independent',
      parent_claim_id: null,
      claim_text: claimText,
      status: 'draft',
      category: i === 0 ? 'method' : 'system'
    });
    claims.push(claim);
  }

  const dependentClaims = await generateDependentClaims(features, claims, projectId || null);

  for (let i = 0; i < dependentClaims.length; i++) {
    const { claimText, parentClaimNumber } = dependentClaims[i];
    const parentClaim = claims.find(c => c.claim_number === parentClaimNumber);

    const claim = await createPatentClaim(applicationId, {
      claim_number: claims.length + 1,
      claim_type: 'dependent',
      parent_claim_id: parentClaim?.id || null,
      claim_text: claimText,
      status: 'draft',
      category: parentClaim?.category || 'method'
    });
    claims.push(claim);
  }

  return claims;
}

// Empty defaults — if AI fails, return empty rather than contaminating with unrelated claims
const DEFAULT_INDEPENDENT_CLAIMS: string[] = [];

async function generateIndependentClaims(
  features: any[],
  noveltyAnalysis: any,
  projectId: string | null,
  title?: string,
  inventionDescription?: string
): Promise<string[]> {
  const coreFeatures = features.filter(f => f.is_core_innovation);
  const featureList = coreFeatures.length > 0 ? coreFeatures : features.slice(0, 10);

  const featuresText = featureList.map((f, i) => {
    const name = f.feature_name || f.name || 'Feature';
    const type = f.feature_type || f.type || 'component';
    const desc = f.technical_description || f.technicalDetails || f.description || '';
    const novelty = f.novelty_strength || f.noveltyStrength || 'moderate';
    const source = f.source_file_path || f.sourceFile || '';
    const snippet = f.code_snippet || f.codeSnippet || '';

    let text = `${i + 1}. ${name} (${type}, ${novelty} novelty)`;
    if (desc) text += `\n   Description: ${desc}`;
    if (source) text += `\n   Source: ${source}`;
    if (snippet) text += `\n   Code: ${snippet.substring(0, 300)}`;
    return text;
  }).join('\n\n');

  const prompt = await getPatentClaimsIndependentPrompt(projectId, {
    title: title || 'Invention',
    features: featuresText,
    noveltyAnalysis: noveltyAnalysis.patentabilityAssessment || '',
    inventionDescription: inventionDescription || ''
  });

  const result = await makeAIRequest<string[]>(
    prompt,
    (response) => {
      let claims: string[] = [];

      console.log('Raw AI claims response (first 500 chars):', response.substring(0, 500));

      // Strategy 1: Try parsing as a JSON object with a "claims" key
      try {
        const objMatch = response.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const obj = JSON.parse(objMatch[0]);
          if (obj.claims && Array.isArray(obj.claims)) {
            claims = obj.claims.map((c: any) => {
              if (typeof c === 'string') return c;
              if (typeof c === 'object' && c !== null) return c.text || c.claim_text || c.claimText || '';
              return '';
            });
          }
        }
      } catch { /* fall through */ }

      // Strategy 2: Try as a flat JSON array
      if (claims.length === 0) {
        try {
          const rawClaims = parseJSONArray<any>(response);
          claims = rawClaims.map((c: any) => {
            if (typeof c === 'string') return c;
            if (typeof c === 'object' && c !== null) return c.text || c.claim_text || c.claimText || '';
            return '';
          });
        } catch { /* fall through */ }
      }

      // Strategy 3: Extract claim-like text blocks from plain text
      // Matches numbered claims starting with "1." or "Claim 1:" etc.
      if (claims.length === 0) {
        const claimPattern = /(?:^|\n)\s*(?:Claim\s+)?\d+[\.\):\s]+\s*(A (?:method|system|computer-readable medium|non-transitory|apparatus)[\s\S]*?)(?=(?:\n\s*(?:Claim\s+)?\d+[\.\):\s]+\s*A )|$)/gi;
        let match;
        while ((match = claimPattern.exec(response)) !== null) {
          const text = match[1]?.trim();
          if (text && text.length > 50) claims.push(text);
        }
        if (claims.length > 0) {
          console.log(`Extracted ${claims.length} claims via text pattern matching`);
        }
      }

      // Strategy 4: If response looks like a single claim, use it
      if (claims.length === 0 && response.length > 100) {
        const trimmed = response.replace(/```[\s\S]*?```/g, '').trim();
        if (trimmed.toLowerCase().startsWith('a method') || trimmed.toLowerCase().startsWith('a system') || trimmed.toLowerCase().startsWith('a non-transitory')) {
          claims.push(trimmed);
          console.log('Used entire response as single claim');
        }
      }

      claims = claims.filter((c: string) => typeof c === 'string' && c.length > 50);
      console.log(`Parsed ${claims.length} independent claims`);
      if (claims.length < 2) {
        console.warn(`AI generated only ${claims.length} independent claims, expected 2-4`);
      }
      return claims;
    },
    DEFAULT_INDEPENDENT_CLAIMS,
    {
      maxRetries: 2,
      timeoutMs: 90000,
      featureArea: 'patent_claims',
      onRetry: (attempt, error) => {
        console.log(`Independent claims generation retry ${attempt}: ${error.message}`);
      }
    }
  );

  if (result.fallbackUsed) {
    console.warn('Using fallback independent claims after AI generation failed');
  }

  return result.data || DEFAULT_INDEPENDENT_CLAIMS;
}

type DependentClaimItem = { claimText: string; parentClaimNumber: number };

// Empty defaults — if AI fails, return empty rather than contaminating with unrelated claims
const DEFAULT_DEPENDENT_CLAIMS: DependentClaimItem[] = [];

function isValidDependentClaim(item: unknown): item is DependentClaimItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, any>;

  // Accept common AI format variants
  const text = obj.claimText || obj.claim_text || obj.text || '';
  const parent = obj.parentClaimNumber ?? obj.parent_claim_number ?? obj.parentClaim ?? obj.parent ?? obj.dependsOn ?? obj.depends_on;

  if (typeof text === 'string' && text.length > 30 && (typeof parent === 'number' || typeof parent === 'string')) {
    // Normalize into expected shape
    obj.claimText = text;
    obj.parentClaimNumber = typeof parent === 'number' ? parent : parseInt(parent, 10) || 1;
    return true;
  }
  return false;
}

async function generateDependentClaims(
  features: any[],
  independentClaims: PatentClaim[],
  projectId: string | null
): Promise<DependentClaimItem[]> {
  const independentClaimsText = independentClaims
    .map((c) => `Claim ${c.claim_number}: ${c.claim_text.substring(0, 200)}...`)
    .join('\n\n');

  const featuresText = features
    .map((f, i) => `${i + 1}. ${f.feature_name} (${f.feature_type}, ${f.novelty_strength} novelty)`)
    .join('\n');

  const prompt = await getPatentClaimsDependentPrompt(projectId, {
    independentClaims: independentClaimsText,
    features: featuresText
  });

  const result = await makeAIRequest<DependentClaimItem[]>(
    prompt,
    (response) => {
      console.log('Raw AI dependent claims response (first 500 chars):', response.substring(0, 500));
      let claims: DependentClaimItem[] = [];

      // Strategy 1: Try as JSON object with "claims" key
      try {
        const objMatch = response.match(/\{[\s\S]*\}/);
        if (objMatch) {
          const obj = JSON.parse(objMatch[0]);
          if (obj.claims && Array.isArray(obj.claims)) {
            claims = obj.claims.filter(isValidDependentClaim);
          }
        }
      } catch { /* fall through */ }

      // Strategy 2: Try as flat JSON array
      if (claims.length === 0) {
        try {
          claims = parseJSONArray<DependentClaimItem>(response, isValidDependentClaim);
        } catch { /* fall through */ }
      }

      // Strategy 3: Extract dependent claims from text
      if (claims.length === 0) {
        const depPattern = /(?:^|\n)\s*(?:Claim\s+)?(\d+)[\.\):\s]+\s*(The (?:method|system|apparatus|medium) of claim (\d+)[\s\S]*?)(?=(?:\n\s*(?:Claim\s+)?\d+[\.\):\s]+)|$)/gi;
        let match;
        while ((match = depPattern.exec(response)) !== null) {
          const text = match[2]?.trim();
          const parentNum = parseInt(match[3], 10) || 1;
          if (text && text.length > 30) {
            claims.push({ claimText: text, parentClaimNumber: parentNum });
          }
        }
        if (claims.length > 0) {
          console.log(`Extracted ${claims.length} dependent claims via text pattern matching`);
        }
      }

      console.log(`Parsed ${claims.length} dependent claims`);
      if (claims.length < 10) {
        console.warn(`AI generated only ${claims.length} dependent claims, expected 10-18`);
      }
      return claims;
    },
    DEFAULT_DEPENDENT_CLAIMS,
    {
      maxRetries: 2,
      timeoutMs: 90000,
      featureArea: 'patent_claims',
      onRetry: (attempt, error) => {
        console.log(`Dependent claims generation retry ${attempt}: ${error.message}`);
      }
    }
  );

  if (result.fallbackUsed) {
    console.warn('Using fallback dependent claims after AI generation failed');
  }

  return result.data || DEFAULT_DEPENDENT_CLAIMS;
}
