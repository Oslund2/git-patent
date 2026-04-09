/**
 * Patent Strength Service
 *
 * Computes a composite patent strength score for a project based on
 * the best patent application's novelty score and approval probability.
 *
 * Formula: 0.6 * novelty_score + 0.4 * approval_probability
 * Uses the MAX across all patent applications (best invention wins).
 */

import { supabase } from '../../lib/supabase';

export interface PatentStrength {
  score: number | null;
  rating: 'strong' | 'moderate' | 'weak' | null;
}

export function getStrengthRating(score: number): 'strong' | 'moderate' | 'weak' {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'moderate';
  return 'weak';
}

export function getStrengthStyle(score: number) {
  if (score >= 70) return { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', label: 'Strong' };
  if (score >= 40) return { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500', label: 'Moderate' };
  return { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500', label: 'Needs Work' };
}

/**
 * Calculate and persist the patent strength score for a project.
 * Queries all patent applications + their novelty analyses, picks the best composite score.
 */
export async function recalculatePatentStrength(projectId: string): Promise<PatentStrength> {
  // Fetch all patent applications for this project with their novelty scores
  const { data: apps } = await (supabase as any)
    .from('patent_applications')
    .select('id, novelty_score, novelty_analysis_id')
    .eq('project_id', projectId);

  if (!apps || apps.length === 0) {
    return { score: null, rating: null };
  }

  let bestScore = -1;

  for (const app of apps) {
    const noveltyScore = Number(app.novelty_score) || 0;
    let approvalProbability = 0;

    // Try to fetch the approval_probability from the novelty analysis
    if (app.novelty_analysis_id) {
      const { data: analysis } = await (supabase as any)
        .from('patent_novelty_analyses')
        .select('approval_probability')
        .eq('id', app.novelty_analysis_id)
        .maybeSingle();

      if (analysis?.approval_probability != null) {
        approvalProbability = Number(analysis.approval_probability);
      }
    }

    const composite = 0.6 * noveltyScore + 0.4 * approvalProbability;
    if (composite > bestScore) {
      bestScore = composite;
    }
  }

  const score = bestScore >= 0 ? Math.round(bestScore) : null;
  const rating = score != null ? getStrengthRating(score) : null;

  // Persist to projects table
  await (supabase as any)
    .from('projects')
    .update({
      patent_strength_score: score,
      patent_strength_rating: rating,
    })
    .eq('id', projectId);

  return { score, rating };
}
