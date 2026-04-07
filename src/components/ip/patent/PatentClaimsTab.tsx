import { useState } from 'react';
import { List, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { PatentClaim } from '../../../services/patent/patentApplicationService';
import {
  formatClaimForDisplay,
  getClaimTypeLabel,
  getCategoryLabel,
} from '../../../services/patent/patentClaimsService';

interface PatentClaimsTabProps {
  claims: PatentClaim[];
  generating: boolean;
  onGenerate: () => void;
}

export function PatentClaimsTab({ claims, generating, onGenerate }: PatentClaimsTabProps) {
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  const sortedClaims = [...claims].sort((a, b) => a.claim_number - b.claim_number);
  const independentClaims = claims.filter(c => c.claim_type === 'independent');
  const dependentClaims = claims.filter(c => c.claim_type === 'dependent');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <List className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Patent Claims</h2>
            <p className="text-xs text-gray-500 mt-0.5">Define the scope of patent protection</p>
          </div>
        </div>
        {claims.length > 0 && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200 hover:shadow-lg"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Regenerate Claims</>
            )}
          </button>
        )}
      </div>

      {/* Claims Count Summary */}
      {claims.length > 0 && (
        <div className="flex items-center gap-5 bg-white border border-gray-100 rounded-2xl px-6 py-4 shadow-sm">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-gray-800">{claims.length}</span>
            <span className="text-xs text-gray-500 font-medium">Total</span>
          </div>
          <div className="w-px h-10 bg-gray-100" />
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-2xl font-bold text-blue-700">{independentClaims.length}</span>
            </div>
            <span className="text-xs text-gray-500 font-medium">Independent</span>
          </div>
          <div className="w-px h-10 bg-gray-100" />
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <span className="text-2xl font-bold text-gray-600">{dependentClaims.length}</span>
            </div>
            <span className="text-xs text-gray-500 font-medium">Dependent</span>
          </div>
        </div>
      )}

      {/* Claims List */}
      {claims.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <List className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-gray-600 font-medium mb-1">No claims generated yet</p>
          <p className="text-gray-400 text-sm mb-6">Use AI to generate patent claims from your specification</p>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200"
          >
            <Sparkles className="w-4 h-4" />
            Generate Claims
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedClaims.map(claim => {
            const isDependent = claim.claim_type === 'dependent';
            return (
              <div
                key={claim.id}
                className={`bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${isDependent ? 'ml-8' : ''}`}
              >
                <button
                  onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                      claim.claim_type === 'independent'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {claim.claim_number}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        claim.claim_type === 'independent'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-50 text-gray-500 border border-gray-200'
                      }`}>
                        {getClaimTypeLabel(claim.claim_type)}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-50 text-gray-500 border border-gray-100 font-medium">
                        {getCategoryLabel(claim.category)}
                      </span>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${expandedClaim === claim.id ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    {expandedClaim === claim.id ? (
                      <ChevronUp className="w-4 h-4 text-blue-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>
                {expandedClaim === claim.id && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 mt-4 bg-slate-50 border border-gray-100 p-5 rounded-xl leading-relaxed">
                      {formatClaimForDisplay(claim)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
