import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
          <p className="text-muted-foreground text-sm">Ordino CRM &amp; Beacon AI Assistant — Internal Use</p>
        </div>

        {/* Content */}
        <article className="prose prose-sm max-w-none text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground [&_p]:text-foreground/85 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:text-foreground/85 [&_li]:mb-1.5 [&_strong]:text-foreground">

          <h2>1. Acceptance</h2>
          <p>By accessing Ordino CRM and/or the Beacon AI assistant, you agree to these terms. Access is limited to authorized GLE employees and contractors.</p>

          <h2>2. Permitted Use</h2>
          <p>Ordino and Beacon are internal business tools provided for work-related purposes only. You may use them to:</p>
          <ul>
            <li>Manage client projects and properties</li>
            <li>Look up regulatory information</li>
            <li>Submit corrections and feedback</li>
            <li>Access and contribute to the company knowledge base</li>
          </ul>
          <p>You may <strong>not:</strong></p>
          <ul>
            <li>Use them for personal purposes unrelated to GLE business</li>
            <li>Share login credentials with unauthorized individuals</li>
            <li>Attempt to bypass access controls or security measures</li>
            <li>Use Beacon to generate content that misrepresents GLE's services or expertise</li>
          </ul>

          <h2>3. AI Disclaimer</h2>
          <p>Beacon is an AI assistant. While it references GLE's internal knowledge base and official regulatory documents, its responses may contain errors or outdated information. Always verify critical regulatory information (code sections, filing requirements, deadlines, fee amounts) against official NYC sources (DOB NOW, BIS, ZR) before relying on it for filings or client advice. GLE is not liable for decisions made solely based on Beacon's responses.</p>

          <h2>4. Data Usage</h2>
          <p>Your interactions with Ordino and Beacon are logged and may be used for AI training, content generation, and business analytics as described in our <Link to="/privacy" className="text-accent hover:underline">Privacy Policy</Link>. See the Privacy Policy for full details.</p>

          <h2>5. Intellectual Property</h2>
          <p>Content generated through Beacon and Ordino, including AI-generated drafts, knowledge base entries, analytics reports, and content engine outputs, is the property of Green Light Expediting.</p>

          <h2>6. Account Security</h2>
          <p>You are responsible for maintaining the security of your Google account used to access Ordino. Report any unauthorized access to management immediately. Access may be revoked at management's discretion.</p>

          <h2>7. Modifications</h2>
          <p>GLE reserves the right to modify these terms at any time. Employees will be notified of material changes. Continued use after notification constitutes acceptance.</p>

          <h2>8. Contact</h2>
          <p>Questions about these terms should be directed to GLE management.</p>
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Green Light Expediting</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </footer>
      </div>
    </div>
  );
}
