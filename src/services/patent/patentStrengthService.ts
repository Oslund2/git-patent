/**
 * Patent Strength Service
 *
 * Uses the best patent application's novelty score as the project-level
 * patent strength score, ensuring consistency between the project list
 * and individual patent application views.
 *
 * Uses the MAX novelty_score across all patent applications (best invention wins).
 */

import { supabase } from '../../lib/supabase';

export interface PatentStrength {
  score: number | null;
  rating: 'strong' | 'moderate' | 'weak' | null;
  dimensions?: {
    novelty_102: number;
    non_obviousness_103: number;
    technical_depth: number;
    prior_art_differentiation: number;
  } | null;
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
  let bestDimensions: PatentStrength['dimensions'] = null;

  for (const app of apps) {
    const noveltyScore = Number(app.novelty_score) || 0;

    // Use novelty_score directly to match the Patent Application view
    if (noveltyScore > bestScore) {
      bestScore = noveltyScore;

      // Still extract AI dimensional scores for informational display
      if (app.novelty_analysis_id) {
        const { data: analysis } = await (supabase as any)
          .from('patent_novelty_analyses')
          .select('analysis_data')
          .eq('id', app.novelty_analysis_id)
          .maybeSingle();

        const aiScores = analysis?.analysis_data?.ai_scores;
        if (aiScores?.novelty_102 && aiScores?.non_obviousness_103 && aiScores?.technical_depth && aiScores?.prior_art_differentiation) {
          bestDimensions = {
            novelty_102: Number(aiScores.novelty_102.score) || 0,
            non_obviousness_103: Number(aiScores.non_obviousness_103.score) || 0,
            technical_depth: Number(aiScores.technical_depth.score) || 0,
            prior_art_differentiation: Number(aiScores.prior_art_differentiation.score) || 0,
          };
        } else {
          bestDimensions = null;
        }
      }
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

  return { score, rating, dimensions: bestDimensions };
}
