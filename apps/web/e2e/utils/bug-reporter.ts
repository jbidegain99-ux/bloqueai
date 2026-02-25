interface Bug {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  module: string
  steps: string[]
  expected: string
  actual: string
  screenshot?: string
  url: string
  browser: string
  timestamp: string
}

export class BugReporter {
  private bugs: Bug[] = []

  addBug(bug: Omit<Bug, 'id' | 'timestamp'>) {
    this.bugs.push({
      ...bug,
      id: `BUG-${Date.now()}`,
      timestamp: new Date().toISOString(),
    })
  }

  generateReport(): string {
    let report = '# Bug Report - TalentOS QA Session\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`
    report += `Total bugs found: ${this.bugs.length}\n\n`

    const bySeverity = {
      critical: this.bugs.filter((b) => b.severity === 'critical'),
      high: this.bugs.filter((b) => b.severity === 'high'),
      medium: this.bugs.filter((b) => b.severity === 'medium'),
      low: this.bugs.filter((b) => b.severity === 'low'),
    }

    report += `## Summary\n`
    report += `- Critical: ${bySeverity.critical.length}\n`
    report += `- High: ${bySeverity.high.length}\n`
    report += `- Medium: ${bySeverity.medium.length}\n`
    report += `- Low: ${bySeverity.low.length}\n\n`

    for (const bug of this.bugs) {
      report += `---\n\n`
      report += `### ${bug.id}: ${bug.title}\n\n`
      report += `**Severity:** ${bug.severity}\n`
      report += `**Module:** ${bug.module}\n`
      report += `**URL:** ${bug.url}\n\n`
      report += `**Steps to Reproduce:**\n`
      bug.steps.forEach((step, i) => {
        report += `${i + 1}. ${step}\n`
      })
      report += `\n**Expected:** ${bug.expected}\n`
      report += `**Actual:** ${bug.actual}\n\n`
    }

    return report
  }

  getBugs() {
    return this.bugs
  }
}
