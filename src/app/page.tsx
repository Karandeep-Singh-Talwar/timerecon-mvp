import Link from 'next/link';
import SeedDemoButton from '@/components/common/SeedDemoButton';
import styles from './page.module.css';

export const metadata = {
  title: 'TimeRecon — AI Workday Reconstruction for Software Engineering',
  description:
    'Instead of reconstructing your workday from memory, review what AI reconstructed for you from Jira, GitHub, and Calendar evidence.',
};

export default function LandingPage() {
  return (
    <div className={styles.landingPage}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>TR</div>
          <div className={styles.brandTitle}>TimeRecon</div>
        </div>
        <nav className={styles.navLinks}>
          <Link href="/dashboard" className={styles.navLink}>
            Dashboard
          </Link>
          <Link href="/timeline" className={styles.navLink}>
            Timeline
          </Link>
          <Link href="/review" className={styles.navLink}>
            Review
          </Link>
          <Link href="/settings/integrations" className={styles.navLink}>
            Integrations
          </Link>
          <Link href="/dashboard" className="btn btn-primary btn-sm">
            Launch App
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span>⚡ AI Workday Reconstruction System</span>
        </div>
        <h1 className={styles.heroTitle}>
          Stop reconstructing your workday <span className={styles.heroHighlight}>from memory</span>.
        </h1>
        <p className={styles.heroSubtitle}>
          Given that you worked, TimeRecon collects digital evidence across Jira, GitHub, and Calendar to present an explainable, human-approved timesheet in under 60 seconds.
        </p>

        <div className={styles.heroCtas}>
          <Link href="/dashboard" className="btn btn-primary btn-lg">
            Open App Dashboard &rarr;
          </Link>
          <Link href="/timeline" className="btn btn-secondary btn-lg">
            View Workday Timeline
          </Link>
        </div>
      </section>

      {/* Demo Launcher Card */}
      <section className={styles.demoBox}>
        <div className={styles.demoCard}>
          <div>
            <div className={styles.demoTextTitle}>⚡ Test with 5-Day Synthetic Developer Dataset</div>
            <div className={styles.demoTextDesc}>
              Instantly seed Monday through Friday data (Jira tickets, GitHub commits/PRs, standup meetings, and long debugging sessions).
            </div>
          </div>
          <div>
            <SeedDemoButton />
          </div>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section className={styles.navGridSection}>
        <h2 className={styles.sectionHeading}>Explore Application Modules</h2>
        <p className={styles.sectionSubheading}>
          Click any card below to test the full end-to-end functionality directly in your browser.
        </p>

        <div className={styles.quickNavGrid}>
          <Link href="/dashboard" className={styles.navCard}>
            <div>
              <div className={styles.navCardHeader}>
                <div className={styles.navCardIcon}>&#9633;</div>
                <span className="badge badge-high">Live</span>
              </div>
              <div className={styles.navCardTitle}>Dashboard</div>
              <div className={styles.navCardDesc}>
                Overview of daily hours reconstructed, allocated vs unallocated breakdown, and connected integration status.
              </div>
            </div>
            <div className={styles.navCardArrow}>Open Dashboard &rarr;</div>
          </Link>

          <Link href="/timeline" className={styles.navCard}>
            <div>
              <div className={styles.navCardHeader}>
                <div className={styles.navCardIcon}>&#9655;</div>
                <span className="badge badge-high">Core UI</span>
              </div>
              <div className={styles.navCardTitle}>Workday Timeline</div>
              <div className={styles.navCardDesc}>
                Interactive vertical timeline with high/medium/review confidence blocks, evidence explanations, split, merge, and edit controls.
              </div>
            </div>
            <div className={styles.navCardArrow}>View Timeline &rarr;</div>
          </Link>

          <Link href="/review" className={styles.navCard}>
            <div>
              <div className={styles.navCardHeader}>
                <div className={styles.navCardIcon}>&#10003;</div>
                <span className="badge badge-high">Export</span>
              </div>
              <div className={styles.navCardTitle}>Review & Submit</div>
              <div className={styles.navCardDesc}>
                End-of-day summary review experience. Approve your day in one click and download CSV timesheet exports.
              </div>
            </div>
            <div className={styles.navCardArrow}>Go to Review &rarr;</div>
          </Link>

          <Link href="/settings/integrations" className={styles.navCard}>
            <div>
              <div className={styles.navCardHeader}>
                <div className={styles.navCardIcon}>&#8644;</div>
                <span className="badge badge-medium">Integrations</span>
              </div>
              <div className={styles.navCardTitle}>Connectors & Sync</div>
              <div className={styles.navCardDesc}>
                Manage Jira, GitHub, and Google Calendar connections, trigger manual syncs, and toggle mock connector mode.
              </div>
            </div>
            <div className={styles.navCardArrow}>Manage Integrations &rarr;</div>
          </Link>

          <Link href="/settings" className={styles.navCard}>
            <div>
              <div className={styles.navCardHeader}>
                <div className={styles.navCardIcon}>&#9881;</div>
                <span className="badge badge-medium">Preferences</span>
              </div>
              <div className={styles.navCardTitle}>User Preferences</div>
              <div className={styles.navCardDesc}>
                Configure working hours (e.g. 09:00 - 17:30), timezone (IST, EST, PST, UTC), and profile settings.
              </div>
            </div>
            <div className={styles.navCardArrow}>View Settings &rarr;</div>
          </Link>
        </div>
      </section>

      {/* Feature Pillars */}
      <section style={{ maxWidth: '1000px', margin: '0 auto var(--space-3xl)', padding: '0 var(--space-xl)' }}>
        <h2 className={styles.sectionHeading}>Product Principles & Architecture</h2>
        <p className={styles.sectionSubheading}>Designed specifically for software engineering workflows</p>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>✓ Explainable Evidence Systems</div>
            <div className={styles.featureDesc}>
              Every AI allocation comes with transparent evidence: Jira key references in commit messages, active branch names, meeting titles, and repo context.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>✓ Work Without a Deliverable</div>
            <div className={styles.featureDesc}>
              A 3-hour debugging session with 0 commits is still real work. TimeRecon infers context from Jira activity, active branches, and temporal continuity.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>✓ Fast Human Correction</div>
            <div className={styles.featureDesc}>
              Single-click Approve, Edit, Split, and Merge actions. Every correction teaches the system project & meeting mappings for future days.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>✓ Zero Surveillance</div>
            <div className={styles.featureDesc}>
              Strictly no screenshots, no webcam tracking, no keystroke logging, no mouse tracking, and no productivity scoring.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>TimeRecon &mdash; AI Workday Reconstruction System &bull; Production Ready MVP</p>
      </footer>
    </div>
  );
}
