import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[720px] mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Ordino
        </Link>

        <div className="mb-10">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-4">
            <span className="text-accent-foreground font-bold text-lg">O</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Employee Data Usage &amp; Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Ordino CRM, Beacon AI Assistant &amp; Content Intelligence Platform — Effective February 24, 2026</p>
        </div>

        {/* Content */}
        <article className="prose prose-sm max-w-none text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-foreground [&_p]:text-foreground/85 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:text-foreground/85 [&_li]:mb-1.5 [&_strong]:text-foreground">

          <h2>1. Purpose</h2>
          <p>This policy explains how Green Light Expediting ("GLE") collects, uses, and protects data generated through employee interactions with the Ordino CRM, Beacon AI assistant, internal chat platforms (Google Chat), email communications, and related tools.</p>

          <h2>2. Scope</h2>
          <p>Applies to all GLE employees, contractors, and authorized users who interact with:</p>
          <ul>
            <li>Ordino CRM (client management, projects, documents)</li>
            <li>Beacon AI Assistant (via Google Chat and Ordino widget)</li>
            <li>Company email (Google Workspace), particularly regulatory topics</li>
            <li>Internal chat spaces where Beacon is deployed</li>
          </ul>

          <h2>3. Data We Collect</h2>

          <h3>3.1 Beacon Chat Interactions</h3>
          <p>When you ask Beacon a question, the following is logged:</p>
          <ul>
            <li>Your question</li>
            <li>Beacon's response</li>
            <li>Your name and user ID</li>
            <li>Chat space name</li>
            <li>Timestamp</li>
            <li>Auto-categorized topic (e.g. Zoning, DOB Filings, FDNY)</li>
            <li>Response quality</li>
            <li>Knowledge base sources referenced</li>
            <li>API usage and cost</li>
          </ul>

          <h3>3.2 Email Communications</h3>
          <p>Work-related emails involving regulatory topics (DOB newsletters, FDNY correspondence, DHCR communications) are analyzed to:</p>
          <ul>
            <li>Identify trending topics</li>
            <li>Extract regulatory updates for the knowledge base</li>
            <li>Generate content opportunities (blog posts, newsletters, guides)</li>
          </ul>

          <h3>3.3 Corrections and Feedback</h3>
          <p>Submitted via <code>/correct</code> or <code>/feedback</code> commands in Beacon, stored with your name for admin review. Approved corrections improve Beacon's knowledge base.</p>

          <h3>3.4 Ordino CRM AI Features</h3>
          <p>When you use Ordino, the following AI-powered features may process your data:</p>
          <ul>
            <li><strong>Project-context queries:</strong> when you ask Beacon a question from a project page, the project's address, BIN, block/lot, and filing numbers are automatically included for context</li>
            <li><strong>Document ingestion:</strong> documents you upload to the knowledge base are automatically chunked, embedded, and indexed by AI for future retrieval</li>
            <li><strong>Content suggestions:</strong> your team's question patterns and expertise areas are analyzed to identify content opportunities (blog posts, guides, newsletters)</li>
            <li><strong>Smart scoring:</strong> AI evaluates content opportunities based on demand, expertise, and business relevance</li>
          </ul>

          <h2>4. How We Use This Data</h2>
          <ul>
            <li><strong>AI Training &amp; Improvement:</strong> questions, corrections, and feedback improve Beacon's accuracy and knowledge base. Your interactions directly make the tool better for the entire team.</li>
            <li><strong>Content Generation:</strong> frequently asked questions, email insights, and team expertise generate blog posts, newsletters, and guides. All content is reviewed and approved by management before publication.</li>
            <li><strong>Analytics &amp; Reporting:</strong> usage data helps management understand what topics the team needs help with, identify training gaps, and allocate resources.</li>
            <li><strong>Knowledge Base Expansion:</strong> insights from team interactions identify gaps in documentation, leading to new guides and reference materials.</li>
            <li><strong>Document Intelligence:</strong> uploaded documents are processed by AI to make them searchable and retrievable when team members ask related questions.</li>
            <li><strong>AI-Assisted Drafting:</strong> in future releases, AI may generate draft responses to DOB objections and other regulatory correspondence, always subject to human review before submission.</li>
          </ul>

          <h2>5. Content Generation Pipeline</h2>
          <p>Data collection → Scoring (demand, expertise, relevance) → AI draft generation (no employee names or personal details included) → Management review and approval → Publication.</p>
          <p><strong>Important:</strong> individual questions and interactions are never published directly. Content is synthesized from aggregate patterns and general expertise, not attributed to specific employees.</p>

          <h2>6. Data Protection</h2>
          <ul>
            <li><strong>Encrypted transmission:</strong> all data transmitted over HTTPS/TLS</li>
            <li><strong>Access controls:</strong> dashboards and admin features restricted to authorized users via Google OAuth</li>
            <li><strong>Secure storage:</strong> data stored in Supabase (SOC 2 Type II compliant) with row-level security</li>
            <li><strong>No third-party sharing:</strong> data is never sold or shared with third parties outside of AI processing</li>
            <li><strong>AI processing providers:</strong> Anthropic (Claude API) for text generation, OpenAI for document embeddings, Pinecone for vector search. None of these providers use your data to train their models per their respective data usage policies.</li>
            <li><strong>Anonymization:</strong> published content never includes employee names, personal details, or individually identifiable information</li>
          </ul>

          <h2>7. Data Retention</h2>
          <p>Data retained for as long as it serves legitimate business purposes including analytics, training, and content generation. Employees may request a summary of stored interactions by contacting management. Data for terminated employees anonymized within 90 days of departure.</p>

          <h2>8. Employee Rights</h2>
          <ul>
            <li><strong>Know what data is collected</strong> (this policy provides that transparency)</li>
            <li><strong>Access your data:</strong> request a report of your Beacon interactions from your administrator</li>
            <li><strong>Request corrections</strong> if any logged data is inaccurate</li>
            <li><strong>Ask questions:</strong> contact management with concerns about data usage</li>
            <li><strong>Provide feedback</strong> via the <code>/feedback</code> command in Beacon</li>
          </ul>

          <h2>9. Changes</h2>
          <p>GLE reserves the right to update this policy as AI tools and processes evolve. Employees notified of material changes via email or team announcement. Continued use after notification constitutes acceptance.</p>
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Green Light Expediting</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </footer>
      </div>
    </div>
  );
}
