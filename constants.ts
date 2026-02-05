export const TOOL_CATEGORIES = [
  { id: 'leadership', name: 'Executive', icon: 'fa-building' },
  { id: 'teacher', name: 'Educators', icon: 'fa-chalkboard-user' },
  { id: 'admin', name: 'Operations', icon: 'fa-briefcase' },
  { id: 'learner', name: 'Development', icon: 'fa-graduation-cap' },
];

export interface ToolConfig {
  id: string;
  categoryId: string;
  name: string;
  basePrompt: string;
  examplePrompt: string;
  description: string;
  modelTier: 'flash' | 'pro';
}

export const TOOLS_CONFIG: ToolConfig[] = [
  {
    id: 'strategy-toolkit',
    categoryId: 'leadership',
    name: 'Strategic Roadmap',
    description: 'Corporate-grade strategic planning and change management frameworks.',
    basePrompt: 'Draft a high-level strategic roadmap or executive memo. Treat the Principal as a CEO. Use corporate management frameworks (SWOT, OKRs) applied to education.',
    examplePrompt: 'Scenario: transitioning a traditional school to a digital-first curriculum over 24 months with limited budget.',
    modelTier: 'pro'
  },
  {
    id: 'sgb-governance',
    categoryId: 'leadership',
    name: 'Governance & Compliance',
    description: 'Legally sound policy drafting for Governing Bodies.',
    basePrompt: 'Draft a formal governance policy or resolution. Ensure strict adherence to South African legal frameworks and corporate governance best practices.',
    examplePrompt: 'Draft a Conflict of Interest policy for the School Governing Body members.',
    modelTier: 'pro'
  },
  {
    id: 'lesson-plan',
    categoryId: 'teacher',
    name: 'Curriculum Architect',
    description: 'High-fidelity, CAPS-aligned instructional design.',
    basePrompt: 'Design a comprehensive, high-fidelity lesson plan. Focus on innovative pedagogy, differentiation strategies, and measurable outcomes.',
    examplePrompt: 'Grade 11 Physical Sciences: Intermolecular Forces. 60-minute active learning session.',
    modelTier: 'pro'
  },
  {
    id: 'assessment-gen',
    categoryId: 'teacher',
    name: 'Assessment Engine',
    description: 'Bloom\'s Taxonomy aligned testing instruments.',
    basePrompt: 'Create a formal assessment instrument with a marking matrix and cognitive level analysis (Bloom\'s).',
    examplePrompt: 'Grade 10 Business Studies: Creative Thinking and Problem Solving. Case study based assessment.',
    modelTier: 'flash'
  },
  {
    id: 'parent-comms',
    categoryId: 'admin',
    name: 'Stakeholder Comms',
    description: 'Professional crisis and routine communication generator.',
    basePrompt: 'Draft a professional stakeholder communication. Tone should be reassuring, clear, and authoritative yet empathetic.',
    examplePrompt: 'Urgent notice regarding a change in exam timetables due to unforeseen circumstances.',
    modelTier: 'flash'
  },
  {
    id: 'fundraising-pro',
    categoryId: 'admin',
    name: 'Capital Raising',
    description: 'Corporate sponsorship proposals and grant applications.',
    basePrompt: 'Write a persuasive corporate sponsorship proposal. Focus on CSI (Corporate Social Investment) benefits and tangible ROI for the sponsor.',
    examplePrompt: 'Proposal to a telecommunications company to sponsor fibre internet installation.',
    modelTier: 'pro'
  },
  {
    id: 'study-guide',
    categoryId: 'learner',
    name: 'Knowledge Synthesizer',
    description: 'Rapid revision summaries and concept maps.',
    basePrompt: 'Synthesize complex curriculum topics into high-impact "Cheat Sheets" or summaries. Use mnemonics and clear structure.',
    examplePrompt: 'Grade 12 History: The collapse of the USSR. Key timeline and causes.',
    modelTier: 'flash'
  }
];