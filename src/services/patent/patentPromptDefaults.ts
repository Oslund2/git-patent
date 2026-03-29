export interface PatentPromptTemplate {
  key: string;
  name: string;
  description: string;
  content: string;
  variables: Array<{
    name: string;
    description: string;
    type: 'string' | 'number' | 'array' | 'object';
    required: boolean;
    example?: string;
  }>;
}

export const PATENT_PROMPT_TEMPLATES: Record<string, PatentPromptTemplate> = {
  patent_claims_independent: {
    key: 'patent_claims_independent',
    name: 'Independent Patent Claims',
    description: 'Generates broad independent claims covering core innovations for method and system categories',
    content: `Generate independent patent claims for the following invention. Create claims that are TECHNICALLY SPECIFIC to survive Alice/Mayo subject matter eligibility challenges while providing meaningful protection.

INVENTION TITLE: \${title}

CORE NOVEL FEATURES:
\${features}

NOVELTY ASSESSMENT:
\${noveltyAnalysis}

INVENTION CONTEXT:
\${inventionDescription}

**KEY INNOVATION AREAS** — Focus claims on the core novel features identified in the analyzed codebase:

\${features}

Use the features above as the basis for claim construction. Each independent claim should cover a distinct innovation area. Dependent claims should drill into specific technical implementations of these features.

**ALICE-DEFENSE LANGUAGE REQUIREMENTS** (CRITICAL):
- Use "processor configured to execute" NOT "computer performs"
- Use "parsing abstract syntax trees" NOT "analyzing code"
- Use "transmitting via API endpoints" NOT "sending data"
- Reference SPECIFIC data structures (JSON schemas, database tables, cache layers)
- Include QUANTIFIABLE improvements (latency reduction, cost savings percentages)
- Describe TECHNICAL TRANSFORMATIONS (input data -> transformed output)

**AVOID THESE ABSTRACT PHRASES:**
- "managing", "organizing", "facilitating" (too abstract)
- "using AI to..." (not specific enough)
- "automatically generating" (needs technical HOW)

Generate exactly 2 independent claims:
1. One METHOD claim - Start with "A computer-implemented method for..."
2. One SYSTEM claim - Start with "A system comprising: one or more processors; a non-transitory computer-readable storage medium storing instructions that, when executed..."

USPTO FORMATTING REQUIREMENTS:
- Each claim MUST be a single sentence (use semicolons to separate elements)
- Use proper antecedent basis ("a/an" for first mention, "the/said" for subsequent)
- Method claims should use gerund form (-ing verbs) with TECHNICAL specificity
- System claims should list components with their CONCRETE functions
- Include at least one mathematical formula or specific algorithm reference
- Reference specific data structures by name (e.g., "hash table", "priority queue", "B-tree index")

Format your response as a JSON array of claim strings:
["claim 1 text...", "claim 2 text..."]`,
    variables: [
      { name: 'title', description: 'Patent application title', type: 'string', required: true, example: 'AI-Orchestrated Software IP Protection System' },
      { name: 'features', description: 'Core novel features in formatted text', type: 'string', required: true },
      { name: 'noveltyAnalysis', description: 'Assessment of patentability and novelty', type: 'string', required: false },
      { name: 'inventionDescription', description: 'User-provided invention description', type: 'string', required: false }
    ]
  },

  patent_claims_dependent: {
    key: 'patent_claims_dependent',
    name: 'Dependent Patent Claims',
    description: 'Generates specific dependent claims that narrow scope and protect specific implementations',
    content: `Generate dependent patent claims based on the independent claims and features provided. Dependent claims narrow the scope and provide fallback positions if independent claims are challenged.

INDEPENDENT CLAIMS:
\${independentClaims}

AVAILABLE FEATURES TO COVER:
\${features}

**ALICE-DEFENSE STRATEGY FOR DEPENDENT CLAIMS:**
Each dependent claim should add TECHNICAL SPECIFICITY that anchors the invention to concrete implementation:

1. **Data Structure Claims** - Specify exact structures used in the codebase
2. **Algorithm Claims** - Include mathematical precision for algorithms identified in the features
3. **Technical Integration Claims** - Specify protocols, APIs, and services used
4. **Performance Claims** - Include measurable improvements where identified

Base your dependent claims on the ACTUAL FEATURES from the analyzed codebase:
\${features}

Generate 15-18 dependent claims that:
1. Reference parent claims properly using "The method of claim X, wherein..." or "The system of claim Y, further comprising..."
2. Cover specific implementations with CONCRETE technical details
3. Include algorithm details, data structures, and protocol specifications
4. Provide fallback positions if independent claims face Alice challenges
5. Cover variations and alternative embodiments

USPTO FORMATTING REQUIREMENTS:
- Start each claim with "The [method/system] of claim [N]"
- Use "wherein" to add limitations or "further comprising" to add elements
- Maintain proper antecedent basis from parent claims
- Each dependent claim should add meaningful TECHNICAL limitations
- Include specific technical details (formulas, data structures, protocols)
- AVOID abstract language - be concrete and specific

Distribute claims: approximately 60% depending on claim 1 (method), 40% on claim 2 (system).

Format as JSON array:
[
  {"claimText": "The method of claim 1, wherein...", "parentClaimNumber": 1},
  {"claimText": "The system of claim 2, further comprising...", "parentClaimNumber": 2}
]`,
    variables: [
      { name: 'independentClaims', description: 'Previously generated independent claims', type: 'string', required: true },
      { name: 'features', description: 'All features to potentially cover', type: 'string', required: true }
    ]
  },

  patent_field_of_invention: {
    key: 'patent_field_of_invention',
    name: 'Patent Field of Invention',
    description: 'Generates concise Field of the Invention section identifying technical domain',
    content: `Generate the "Field of the Invention" section for a patent application.

TITLE: \${title}
TECHNICAL FIELD: \${technicalField}
INVENTION DESCRIPTION: \${inventionDescription}

KEY FEATURES:
\${features}

Write a concise 2-3 sentence field section that:
1. Identifies the technical field based on the invention description provided
2. Describes the general area of application
3. Uses proper patent language

USPTO FORMAT:
"The present invention relates generally to [broad field], and more particularly to [specific technical area and application]."

IMPORTANT:
- Base your response ONLY on the invention description and features provided
- Do NOT include the section heading "Field of the Invention"
- Only provide the paragraph content itself
- Be specific to the actual invention described
- If the invention relates to software intellectual property protection, mention that specifically
- If it relates to patent management software, mention that specifically`,
    variables: [
      { name: 'title', description: 'Patent application title', type: 'string', required: true },
      { name: 'technicalField', description: 'Technical field context', type: 'string', required: false },
      { name: 'inventionDescription', description: 'Detailed invention description', type: 'string', required: false },
      { name: 'features', description: 'Key technical features', type: 'string', required: true }
    ]
  },

  patent_background_section: {
    key: 'patent_background_section',
    name: 'Patent Background Section',
    description: 'Generates comprehensive Background of the Invention describing prior art limitations and gaps',
    content: `Generate a comprehensive "Background of the Invention" section for a patent application. Target 600-1000 words.

INVENTION BEING PATENTED:
\${inventionDescription}

PROBLEM THE INVENTION SOLVES:
\${problemSolved}

PRIOR ART ANALYSIS:
\${priorArt}

DIFFERENTIATION POINTS:
\${differentiationPoints}

Generate a COMPLETE background section with the following structure (5-8 paragraphs):

**PARAGRAPH 1: Field Context**
- Introduce the broader technical field relevant to the invention
- Set the stage for technical discussion

**PARAGRAPH 2-3: State of the Art**
- Describe current existing technologies and approaches
- Explain how conventional systems work
- Reference specific prior art where applicable

**PARAGRAPH 4-5: Limitations and Problems**
- Identify specific technical limitations in existing solutions
- Describe inefficiencies, gaps, or problems that remain unsolved
- Use phrases like "However, existing systems fail to..." or "Current approaches are limited by..."

**PARAGRAPH 6-7: Need for Innovation**
- Articulate why a new approach is needed
- Connect limitations to real-world impact
- Build the case for why the invention matters

**PARAGRAPH 8: Transition (Optional)**
- Brief statement indicating improvement is possible
- Do NOT describe the invention itself

USPTO REQUIREMENTS:
- Do NOT include the section heading "Background of the Invention"
- Do NOT describe YOUR invention in this section
- Focus only on what existed BEFORE your invention
- Be factual and technical, avoid marketing language
- Use passive voice where appropriate for formal tone`,
    variables: [
      { name: 'inventionDescription', description: 'Description of invention being patented', type: 'string', required: false },
      { name: 'problemSolved', description: 'Problem the invention addresses', type: 'string', required: false },
      { name: 'priorArt', description: 'Prior art references and analysis', type: 'string', required: true },
      { name: 'differentiationPoints', description: 'How invention differs from prior art', type: 'string', required: false }
    ]
  },

  patent_summary_section: {
    key: 'patent_summary_section',
    name: 'Patent Summary Section',
    description: 'Generates Summary of the Invention highlighting novel aspects and advantages',
    content: `Generate a "Summary of the Invention" section for a patent application. Target 400-600 words.

INVENTION TITLE: \${title}

KEY FEATURES:
\${features}

DIFFERENTIATION FROM PRIOR ART:
\${differentiationPoints}

INVENTION DESCRIPTION:
\${inventionDescription}

PROBLEM SOLVED:
\${problemSolved}

Generate a summary section with this structure:

**PARAGRAPH 1: Overview Statement**
- Begin with "The present invention provides..." or "In accordance with the present invention..."
- Provide high-level description of what the invention does
- Mention the primary technical approach

**PARAGRAPH 2-3: Key Technical Features**
- Describe the main components or method steps at a high level
- ONLY use reference numerals that are explicitly provided in the invention description context
- DO NOT invent reference numerals - if a component doesn't have one, describe it by name only
- May optionally reference figures if reference numerals are available: "As shown in FIG. 1, the system 100 includes..."
- Highlight what makes the approach novel
- Connect features to the problems they solve

**PARAGRAPH 4: Technical Advantages**
- List specific advantages over prior art
- Use phrases like "advantageously," "beneficially," "in one aspect"
- Be specific about improvements (efficiency, accuracy, cost, etc.)

**PARAGRAPH 5: Scope Statement (Optional)**
- Brief mention of various embodiments
- "In various embodiments, the invention may..."

USPTO REQUIREMENTS:
- Do NOT include the section heading "Summary of the Invention"
- This section should provide a concise overview, not exhaustive detail
- Mirror the language and scope of your broadest independent claim
- Avoid absolute statements; use "may," "can," "in some embodiments"
- Do not include claim numbers or reference specific claims
- NEVER write "(Feature X)" or "Feature X" - describe components by their technical names only
- ONLY use reference numerals that are provided in the invention description context - DO NOT invent numbers
- If a component doesn't have a reference numeral assigned, describe it by name without a number
- May reference figures but less frequently than in detailed description
- Features are listed for context - incorporate them naturally without numbering`,
    variables: [
      { name: 'title', description: 'Patent application title', type: 'string', required: true },
      { name: 'features', description: 'Key technical features', type: 'string', required: true },
      { name: 'differentiationPoints', description: 'Differentiation from prior art', type: 'string', required: false },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false },
      { name: 'problemSolved', description: 'Problem being solved', type: 'string', required: false }
    ]
  },

  patent_details_description: {
    key: 'patent_details_description',
    name: 'Patent Detailed Description',
    description: 'Generates comprehensive Detailed Description with embodiments and technical implementation',
    content: `Generate a portion of the "Detailed Description of the Preferred Embodiments" section for a patent application.

SECTION TO GENERATE: \${sectionType}

INVENTION TITLE: \${title}

FEATURES TO DESCRIBE:
\${features}

INVENTION CONTEXT:
\${inventionDescription}

TECHNICAL FIELD:
\${technicalField}

REFERENCE NUMBER RULES (CRITICAL - READ CAREFULLY):
The invention description above contains a list of VALID reference numerals from the patent drawings.
Each reference numeral is listed with its corresponding figure in the format: "XXX = Component Name (FIG. Y)"
- ONLY use reference numerals that are explicitly listed in the invention description above
- DO NOT invent or make up new reference numerals
- If a component is not listed with a reference numeral, describe it WITHOUT a reference numeral
- When no valid reference numerals are provided, describe components by name only without numbers

FIGURE REFERENCE REQUIREMENTS (CRITICAL FOR CLARITY):
Every reference numeral MUST include its figure source to make the specification clear and unambiguous.
- On FIRST use of any reference numeral, ALWAYS include the figure in parentheses after the number
- Format: "component name XXX (FIG. Y)" where XXX is the reference number and Y is the figure number
- Subsequent uses in the same paragraph may omit the figure reference
- When transitioning to components from a different figure, always include the new figure reference

CORRECT EXAMPLES (with inline figure references):
- "As shown in FIG. 1, the AI pipeline 110 (FIG. 1) includes a Feature Extraction module 112 (FIG. 1)..."
- "The Code Analysis module 116 (FIG. 1) parses source files that are processed..."
- "Referring to FIG. 2, the patent specification generation module 119 (FIG. 2) maintains structural coherence..."
- "The Claims Generation module 118 (FIG. 1) receives feature data from module 116 and produces..."

INCORRECT (NEVER DO THIS):
- "The module 112 generates specifications..." (WRONG - missing figure reference on first use)
- "The pipeline includes module 113, module 114, module 116..." (WRONG - no figure context for any reference)
- DO NOT make up reference numerals like "module 142" unless 142 is explicitly listed above
- DO NOT add reference numerals to components that don't have them in the drawings

Generate detailed technical content following USPTO requirements:

**FOR SYSTEM OVERVIEW SECTIONS:**
- START with a figure reference if reference numerals are available: "As shown in FIG. 1..." or "Referring to FIG. 1..."
- Describe the overall architecture and components
- Explain how components interact
- ONLY use reference numerals that are explicitly provided in the context above
- For components without assigned reference numerals, describe them by name only
- Reference additional figures when discussing subsystems that have assigned reference numerals

**FOR METHOD/PROCESS SECTIONS:**
- Begin with figure reference to the flowchart: "As shown in FIG. 3..."
- Describe step-by-step operation with reference numerals for each step
- Explain data flow and transformations
- Include specific algorithms or formulas where applicable

**FOR IMPLEMENTATION DETAILS:**
- Reference figures showing implementation: "As illustrated in FIG. 4..."
- Provide specific technical implementation options
- Include code structures, data formats, or protocols
- Describe alternative embodiments ("In another embodiment, as shown in FIG. 5...")

**FOR COMPONENT DESCRIPTIONS:**
- Introduce each component with figure reference: "Referring to FIG. 2, the monitoring system 120..."
- Describe each major component's function and structure
- Explain internal operation with sub-component reference numerals
- Describe interfaces with other components

USPTO REQUIREMENTS:
- Do NOT include section headings
- Reference figures when components have assigned reference numerals from the context
- Use consistent terminology throughout
- After referencing a figure, you can continue describing related components in that figure
- When moving to components in a different figure, add a new figure reference
- Provide enough detail to enable one skilled in the art to practice the invention
- ONLY use reference numerals that appear in the provided context - NEVER invent new numbers
- For components without reference numerals, describe them by name only (e.g., "the analysis module identifies..." NOT "the analysis module 142 identifies...")
- NEVER write "(Feature X)" or "Feature X" - only use component names
- Do NOT number features - features are listed for context only`,
    variables: [
      { name: 'sectionType', description: 'Type of section being generated', type: 'string', required: true, example: 'system_overview' },
      { name: 'title', description: 'Patent application title', type: 'string', required: true },
      { name: 'features', description: 'Features to describe in detail', type: 'string', required: true },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false },
      { name: 'technicalField', description: 'Technical field context', type: 'string', required: false }
    ]
  },

  patent_section_regeneration: {
    key: 'patent_section_regeneration',
    name: 'Patent Section Regeneration',
    description: 'Regenerates any patent section with specific instructions and context',
    content: `Regenerate a patent application section based on the provided context and instructions.

SECTION TYPE: \${sectionType}
CURRENT CONTENT: \${currentContent}

REGENERATION INSTRUCTIONS:
\${instructions}

ADDITIONAL CONTEXT:
\${context}

INVENTION DESCRIPTION:
\${inventionDescription}

Regenerate the section following these guidelines:

1. MAINTAIN USPTO COMPLIANCE
   - Use proper patent language and formatting
   - Maintain appropriate section length for the section type
   - Follow antecedent basis rules

2. ADDRESS THE INSTRUCTIONS
   - Incorporate the specific changes requested
   - Maintain consistency with other sections
   - Preserve technical accuracy

3. PRESERVE STRENGTHS
   - Keep effective language from the original where appropriate
   - Maintain technical depth and specificity
   - Ensure claims are still supported

4. IMPROVE WEAKNESSES
   - Address any identified issues in the instructions
   - Enhance clarity where needed
   - Strengthen patent protection where possible

OUTPUT:
- Provide ONLY the regenerated section content
- Do NOT include section headings unless specifically requested
- Do NOT include explanatory comments or meta-text`,
    variables: [
      { name: 'sectionType', description: 'Type of section to regenerate', type: 'string', required: true },
      { name: 'currentContent', description: 'Current content of the section', type: 'string', required: true },
      { name: 'instructions', description: 'Specific regeneration instructions', type: 'string', required: true },
      { name: 'context', description: 'Additional context for regeneration', type: 'string', required: false },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false }
    ]
  },

  patent_differentiation_analysis: {
    key: 'patent_differentiation_analysis',
    name: 'Patent Differentiation Analysis',
    description: 'Analyzes how the invention differs from identified prior art references',
    content: `Analyze how the invention differs from the identified prior art. Provide a comprehensive differentiation analysis.

INVENTION FEATURES:
\${features}

PRIOR ART REFERENCES:
\${priorArt}

INVENTION DESCRIPTION:
\${inventionDescription}

Provide a detailed analysis including:

1. **FEATURE-BY-FEATURE COMPARISON**
   For each major feature of the invention:
   - Identify if prior art teaches this feature
   - If partially taught, explain what's missing
   - If not taught, explain why it's novel

2. **POINTS OF NOVELTY**
   List specific technical aspects that are NOT found in prior art:
   - Novel combinations of known elements
   - New technical approaches
   - Improved implementations
   - Unique architectural decisions

3. **TECHNICAL ADVANTAGES**
   Explain concrete benefits over prior art:
   - Performance improvements
   - Cost reductions
   - Efficiency gains
   - User experience enhancements
   - Scalability benefits

4. **DISTANCE SCORE**
   Provide an overall assessment:
   - Score from 1-10 (10 = completely novel)
   - Justification for the score
   - Key differentiating factors

5. **CLAIM DRAFTING GUIDANCE**
   Suggest how to emphasize differences in claims:
   - Which features to highlight
   - Recommended claim structure
   - Potential vulnerabilities to address

Format response as JSON:
{
  "pointsOfNovelty": ["point 1", "point 2", ...],
  "technicalAdvantages": ["advantage 1", "advantage 2", ...],
  "distanceScore": 8,
  "featureComparison": [...],
  "claimGuidance": "..."
}`,
    variables: [
      { name: 'features', description: 'Invention features to analyze', type: 'string', required: true },
      { name: 'priorArt', description: 'Prior art references for comparison', type: 'string', required: true },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false }
    ]
  },

  patent_art_comparison: {
    key: 'patent_art_comparison',
    name: 'Patent Art Comparison',
    description: 'Performs side-by-side technical comparison with specific prior art references',
    content: `Perform a detailed side-by-side comparison between the invention and specific prior art reference.

INVENTION:
Title: \${inventionTitle}
Features: \${inventionFeatures}
Description: \${inventionDescription}

PRIOR ART REFERENCE:
Patent Number: \${priorArtNumber}
Title: \${priorArtTitle}
Abstract: \${priorArtAbstract}

Provide a structured comparison:

1. **SCOPE COMPARISON**
   - What problem does each solve?
   - What is the technical approach of each?
   - What is the intended use case?

2. **TECHNICAL ELEMENT COMPARISON**
   Create a comparison table (in text format):
   | Element | Invention | Prior Art | Difference |

   Cover:
   - Core algorithms/methods
   - System architecture
   - Data structures
   - User interactions
   - Integration points

3. **OVERLAP ANALYSIS**
   - What elements are shared?
   - How similar are the implementations?
   - Could claims be drafted to avoid overlap?

4. **DIFFERENTIATION OPPORTUNITIES**
   - What unique elements does the invention have?
   - What limitations does the prior art have?
   - How can claims emphasize differences?

5. **RISK ASSESSMENT**
   - Could prior art be used to reject claims?
   - What arguments could overcome rejection?
   - Recommended claim scope adjustments

Provide analysis in clear, technical language suitable for patent prosecution.`,
    variables: [
      { name: 'inventionTitle', description: 'Title of the invention', type: 'string', required: true },
      { name: 'inventionFeatures', description: 'Features of the invention', type: 'string', required: true },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false },
      { name: 'priorArtNumber', description: 'Prior art patent number', type: 'string', required: true },
      { name: 'priorArtTitle', description: 'Prior art title', type: 'string', required: true },
      { name: 'priorArtAbstract', description: 'Prior art abstract', type: 'string', required: true }
    ]
  },

  prior_art_search: {
    key: 'prior_art_search',
    name: 'Prior Art Search',
    description: 'Conducts comprehensive prior art search identifying specific relevant patents with detailed analysis',
    content: `Conduct a comprehensive prior art search and analysis for the following invention. Your goal is to identify REAL, SPECIFIC patents that are most relevant to this invention and that a USPTO examiner would likely cite.

INVENTION TITLE: \${title}

INVENTION DESCRIPTION:
\${inventionDescription}

KEY TECHNICAL FEATURES:
\${features}

ANALYSIS FOCUS: \${analysisTarget}

**SEARCH METHODOLOGY:**
Analyze the invention by examining:
1. The core technical problem being solved
2. The specific technical approach and architecture
3. Individual novel components and their functions
4. The combination of features that creates the overall system
5. CPC/IPC classification codes where similar inventions are found

**CPC/IPC CLASSIFICATION ANALYSIS:**
First, identify the most relevant patent classification codes:
- Primary CPC codes (most specific to the core invention)
- Secondary CPC codes (related technology areas)
- IPC equivalents for international searching
Common relevant classes include:
- G06F (Electric digital data processing)
- G06N (Computing arrangements based on specific computational models - AI/ML)
- G06Q (Data processing systems for business/administrative purposes)
- G06F8 (Software engineering)
- G06F11 (Error detection; Correction; Monitoring)

**IDENTIFY 5-8 SPECIFIC PRIOR ART PATENTS** that a patent examiner would likely cite:

For EACH patent, provide:

1. **PATENT IDENTIFICATION**
   - Patent Number (format: US-XXXXXXX-XX, e.g., US-11556757-B2)
   - Exact Title as it appears on the patent
   - Primary Assignee (company/organization)
   - Key Inventors (1-3 names)

2. **TECHNICAL CONTENT**
   - Abstract: Provide a detailed 2-3 sentence technical summary of what the patent covers
   - Key Claims: Describe the main independent claims in plain language
   - Technical Approach: How does this patent solve its problem?

3. **RELEVANCE ANALYSIS**
   - Relevance Score (0-100): How relevant is this to our invention?
   - Technical Similarity Score (0-100): How similar is the technical approach?
   - Similarity Explanation: 2-3 sentences explaining WHY this patent is relevant and HOW it differs from our invention
   - Relationship Type: Choose one:
     * "similar" - Addresses same problem with similar approach
     * "improvement" - Our invention improves upon this
     * "different_approach" - Addresses same problem differently
     * "component" - Covers a component we use differently
   - Is Blocking: Could this patent block our claims? (true/false)

4. **DIFFERENTIATION POINTS**
   - What does our invention do that this patent does NOT cover?
   - What technical advantages does our invention have?
   - Why is our approach non-obvious over this reference?

**PATENT SELECTION CRITERIA:**
- Prioritize patents from the last 10 years (2015-present)
- Include patents from major tech companies AND smaller innovators
- Include at least one patent that is closely related (high similarity >80)
- Include at least one patent showing a different approach to the same problem
- Focus on GRANTED patents (US-XXXXXXX-B1 or B2) over applications
- Consider patents in the identified CPC classes

**REQUIRED OUTPUT FORMAT:**
Return a JSON array with this exact structure:
[
  {
    "patentNumber": "US-XXXXXXX-B2",
    "title": "Exact Patent Title",
    "abstract": "Detailed 2-3 sentence technical summary of what this patent actually covers and its key innovation...",
    "assignee": "Company Name",
    "inventors": ["Name1", "Name2"],
    "cpcCodes": ["G06F40/00", "G06N3/08"],
    "keyClaimsSummary": "Plain language description of the main independent claims and what they protect...",
    "relevanceScore": 85,
    "technicalSimilarityScore": 72,
    "similarityExplanation": "This patent covers X and Y but does not address Z which our invention uniquely provides through [specific technical approach]...",
    "relationshipType": "improvement",
    "isBlocking": false,
    "differentiationPoints": [
      "Our invention adds [specific feature] not found in this patent",
      "We use [different technical approach] for [function]",
      "Our system provides [specific advantage] not disclosed here"
    ],
    "technicalGaps": "This patent lacks coverage of [specific technical elements our invention includes]...",
    "whyNonObvious": "Our approach is non-obvious because [specific reasoning about unexpected results or novel combination]..."
  }
]

**IMPORTANT:**
- Identify patents that actually exist and are relevant to this technology
- Be specific about technical details, not generic descriptions
- Focus on patents that a USPTO examiner would likely cite during examination
- Explain relationships in terms useful for patent prosecution strategy
- The differentiation analysis should help craft claims that avoid these references`,
    variables: [
      { name: 'title', description: 'Invention title', type: 'string', required: true },
      { name: 'inventionDescription', description: 'Detailed invention description', type: 'string', required: false },
      { name: 'features', description: 'Technical features', type: 'string', required: true },
      { name: 'analysisTarget', description: 'Focus area for analysis', type: 'string', required: false, example: 'software_ip_protection' }
    ]
  },

  patent_novelty_analysis: {
    key: 'patent_novelty_analysis',
    name: 'Patent Novelty Analysis',
    description: 'Assesses patentability and novelty of invention features against prior art',
    content: `Assess the patentability and novelty of the invention based on the provided features and prior art.

INVENTION TITLE: \${title}

EXTRACTED FEATURES:
\${features}

PRIOR ART REFERENCES:
\${priorArt}

INVENTION DESCRIPTION:
\${inventionDescription}

Provide a comprehensive novelty assessment:

1. **OVERALL PATENTABILITY ASSESSMENT**
   - Is the invention likely patentable? (Yes/No/Potentially with modifications)
   - Confidence level (High/Medium/Low)
   - Brief summary of reasoning

2. **NOVELTY ANALYSIS** (35 U.S.C. \u00a7 102)
   For each major feature:
   - Is it novel (not found in single prior art reference)?
   - Which prior art references are closest?
   - Specific elements that establish novelty

3. **NON-OBVIOUSNESS ANALYSIS** (35 U.S.C. \u00a7 103)
   - Would the combination be obvious to one skilled in the art?
   - What makes the combination non-obvious?
   - Teaching away arguments
   - Unexpected results

4. **FEATURE NOVELTY SCORES**
   Rate each feature:
   - Score: 1-10 (10 = highly novel)
   - Is it a core innovation? (Yes/No)
   - Recommended claim strategy

5. **RECOMMENDED CLAIM FOCUS**
   - Which features should be emphasized in independent claims?
   - Which features are best for dependent claims?
   - Any features to avoid claiming?

6. **POTENTIAL REJECTIONS**
   - Anticipate likely examiner objections
   - Suggested responses/arguments

Format response as JSON:
{
  "patentabilityAssessment": "...",
  "confidenceLevel": "High",
  "isLikelyPatentable": true,
  "noveltyAnalysis": [...],
  "nonObviousnessFactors": [...],
  "featureScores": [...],
  "claimRecommendations": "...",
  "potentialRejections": [...]
}`,
    variables: [
      { name: 'title', description: 'Invention title', type: 'string', required: true },
      { name: 'features', description: 'Extracted invention features', type: 'string', required: true },
      { name: 'priorArt', description: 'Prior art references', type: 'string', required: false },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false }
    ]
  },

  patent_abstract_generation: {
    key: 'patent_abstract_generation',
    name: 'Patent Abstract Generation',
    description: 'Generates comprehensive 100-150 word patent abstract with full technical detail',
    content: `Generate a patent abstract for the following invention.

TITLE: \${title}

KEY TECHNICAL FEATURES:
\${features}

INVENTION DESCRIPTION:
\${inventionDescription}

**USPTO ABSTRACT REQUIREMENTS:**
- Target 100-150 words (use the FULL allowance for maximum technical detail)
- MUST be a single paragraph with no line breaks
- Written in third person, present tense
- No marketing language or subjective claims
- No legal claims language ("comprising", "wherein")
- Should NOT start with "The present invention" or "This invention"
- Do NOT include reference numerals (e.g., "100", "102") in the abstract

**CONTENT REQUIREMENTS (in order of priority):**

1. **OPENING (1 sentence):** State what the invention IS
   - Identify whether it's a system, method, apparatus, or combination
   - Name the primary technical function
   - Example: "A computer-implemented system for automated software intellectual property analysis and patent application generation..."

2. **CORE ARCHITECTURE (2-3 sentences):** Describe the KEY technical components
   - Name the major modules, components, and their specific functions
   - Explain how components interact or how data flows through the system
   - Include specific technical elements (APIs, algorithms, data structures, processing steps)
   - Use technical terminology appropriate to the field
   - Be SPECIFIC, not generic - name actual technical approaches

3. **KEY INNOVATION (1-2 sentences):** Highlight what makes this novel
   - Describe the unique technical approach or combination
   - Mention specific algorithms, methods, or architectures if applicable
   - Reference quantifiable improvements or unique capabilities

4. **TECHNICAL RESULT (1 sentence):** State the technical outcome
   - What does the system achieve technically?
   - What problem is solved and how?

**QUALITY REQUIREMENTS:**
- The abstract MUST describe technical structure, not just purpose
- The abstract MUST mention at least 4-5 specific technical components or steps
- An engineer reading this abstract should understand what the system does
- The abstract should be substantive enough to differentiate from prior art
- Use all 150 words - brevity is NOT the goal, completeness IS

**EXAMPLE OF PROPER TECHNICAL DEPTH:**
"A computer-implemented system for automated software intellectual property analysis and patent application generation comprising a codebase analysis engine, a feature extraction processor, a prior art search coordinator, and a multi-stage specification generator. The codebase analysis engine parses source code repositories using abstract syntax tree traversal to extract function signatures, class hierarchies, and data flow patterns. The feature extraction processor identifies patentable features by analyzing code structure, API interfaces, and algorithmic innovations. The prior art search coordinator queries patent databases and performs novelty scoring against identified features. The multi-stage specification generator produces USPTO-compliant patent sections including claims, detailed descriptions, and abstracts using AI-driven text generation with structured output validation. The system enables end-to-end automated patent drafting while maintaining legal compliance through integrated validation workflows."

Generate ONLY the abstract text. Do not include any heading, label, word count, or commentary.`,
    variables: [
      { name: 'title', description: 'Patent application title', type: 'string', required: true },
      { name: 'features', description: 'Key technical features', type: 'string', required: true },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false }
    ]
  },

  patent_alice_risk_assessment: {
    key: 'patent_alice_risk_assessment',
    name: 'Alice Test Risk Assessment',
    description: 'Evaluates patent claims for Alice/Mayo subject matter eligibility risks',
    content: `Perform an Alice/Mayo subject matter eligibility risk assessment for the following patent application.

INVENTION TITLE: \${title}

CLAIMS:
\${claims}

KEY FEATURES:
\${features}

INVENTION DESCRIPTION:
\${inventionDescription}

**ALICE/MAYO TWO-STEP ANALYSIS:**

STEP 1: Is the claim directed to a judicial exception?
- Abstract ideas (fundamental economic practices, mathematical concepts, mental processes, methods of organizing human activity)
- Laws of nature
- Natural phenomena

STEP 2: If yes, does the claim recite additional elements that amount to "significantly more"?
- Improvements to computer functionality
- Specific technical implementations
- Unconventional arrangements of known elements
- Transformation of data into a different state

**EVALUATE EACH CLAIM FOR:**

1. **Abstract Idea Risk** (High/Medium/Low)
   - Is it describing a business method?
   - Is it a mathematical concept without technical application?
   - Could it be performed mentally or with pen and paper?

2. **Technical Anchoring Strength** (Strong/Moderate/Weak)
   - Does it reference specific hardware components?
   - Does it describe concrete data structures?
   - Does it include specific algorithms with technical effect?

3. **Improvement Evidence** (Present/Partial/Absent)
   - Does it improve computer functionality itself?
   - Does it solve a technical problem in a technical way?
   - Does it describe unconventional technical steps?

**RISK INDICATORS TO FLAG:**
- Generic computer implementation language ("using a computer to...")
- Abstract verbs without technical specificity ("managing", "organizing", "facilitating")
- Missing hardware/data structure references
- Business outcome focus vs technical outcome focus

**PROVIDE:**
1. Overall Alice Risk Score (0-100, where 0 = no risk, 100 = high rejection risk)
2. Risk level for each independent claim
3. Specific vulnerable phrases identified
4. Recommended language improvements
5. Technical anchoring suggestions

Format response as JSON:
{
  "overallAliceRiskScore": 35,
  "riskLevel": "Low",
  "claimAnalysis": [
    {
      "claimNumber": 1,
      "riskScore": 30,
      "riskLevel": "Low",
      "abstractIdeaRisk": "Low",
      "technicalAnchoringStrength": "Strong",
      "improvementEvidence": "Present",
      "vulnerablePhrases": ["phrase 1"],
      "strengths": ["strength 1"],
      "recommendations": ["recommendation 1"]
    }
  ],
  "overallStrengths": ["strength 1", "strength 2"],
  "overallWeaknesses": ["weakness 1"],
  "recommendedImprovements": ["improvement 1", "improvement 2"],
  "summary": "Brief assessment summary"
}`,
    variables: [
      { name: 'title', description: 'Patent application title', type: 'string', required: true },
      { name: 'claims', description: 'Patent claims text', type: 'string', required: true },
      { name: 'features', description: 'Key technical features', type: 'string', required: true },
      { name: 'inventionDescription', description: 'Invention description', type: 'string', required: false }
    ]
  }
};

export function getPatentPromptTemplate(key: string): PatentPromptTemplate | undefined {
  return PATENT_PROMPT_TEMPLATES[key];
}

export function getAllPatentPromptKeys(): string[] {
  return Object.keys(PATENT_PROMPT_TEMPLATES);
}

export function getPatentPromptContent(key: string): string | undefined {
  return PATENT_PROMPT_TEMPLATES[key]?.content;
}

export function getPatentPromptVariables(key: string): PatentPromptTemplate['variables'] {
  return PATENT_PROMPT_TEMPLATES[key]?.variables || [];
}
