import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, FileText, Clock, Shield, ArrowRight, Zap } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
            <span className="text-xl font-semibold text-foreground">AdeenoAi</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#benefits" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Benefits
            </a>
            <a href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
          </nav>
          <Button variant="default" size="sm">
            Request Demo
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm mb-6">
            <span className="w-2 h-2 bg-accent rounded-full"></span>
            Streamlining FDA Regulatory Workflows
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
            Accelerate Drug Approval with AI-Powered Regulatory Intelligence
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto leading-relaxed">
            AdeenoAi transforms complex FDA documentation and regulatory workflows into streamlined, compliant
            processes. Get your life-saving drugs to market faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">60%</div>
              <div className="text-sm text-muted-foreground">Faster Documentation</div>
            </div>
            <div className="text-center border-x-0 md:border-x border-border">
              <div className="text-4xl font-bold text-foreground mb-2">99.8%</div>
              <div className="text-sm text-muted-foreground">Compliance Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">$2M+</div>
              <div className="text-sm text-muted-foreground">Average Cost Savings</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20 md:py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Built for Regulatory Excellence
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed">
            Our AI-powered platform handles the complexity of FDA submissions so your team can focus on innovation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Automated Documentation</h3>
            <p className="text-muted-foreground leading-relaxed">
              Generate compliant FDA documentation automatically from your research data and clinical trials.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Compliance Validation</h3>
            <p className="text-muted-foreground leading-relaxed">
              Real-time validation against FDA guidelines ensures your submissions meet all regulatory requirements.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Workflow Optimization</h3>
            <p className="text-muted-foreground leading-relaxed">
              Streamline review cycles and approvals with intelligent routing and automated status tracking.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Secure & Compliant</h3>
            <p className="text-muted-foreground leading-relaxed">
              Enterprise-grade security with full audit trails and 21 CFR Part 11 compliance built-in.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">AI-Powered Insights</h3>
            <p className="text-muted-foreground leading-relaxed">
              Leverage machine learning to identify potential issues and optimize submission strategies.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Version Control</h3>
            <p className="text-muted-foreground leading-relaxed">
              Track every change with comprehensive version history and rollback capabilities.
            </p>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="bg-card border-y border-border">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6 text-balance">
                Transform Your Regulatory Process
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                AdeenoAi eliminates bottlenecks in the drug approval process, helping pharmaceutical companies bring
                critical treatments to patients faster while maintaining the highest standards of compliance.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">Reduce Time-to-Market</div>
                    <div className="text-muted-foreground">Cut submission preparation time by up to 60%</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">Minimize Regulatory Risk</div>
                    <div className="text-muted-foreground">AI-powered validation catches issues before submission</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-foreground">Scale Your Operations</div>
                    <div className="text-muted-foreground">Handle multiple submissions simultaneously with ease</div>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-secondary rounded-lg p-8 lg:p-12">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                <img
                  src="/regulatory-workflow-dashboard-interface.jpg"
                  alt="AdeenoAi Platform Interface"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="contact" className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6 text-balance">
            Ready to Accelerate Your FDA Submissions?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 text-pretty leading-relaxed">
            Join leading pharmaceutical companies using AdeenoAi to streamline their regulatory workflows and bring
            life-saving treatments to market faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto">
              Schedule a Demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">A</span>
                </div>
                <span className="text-xl font-semibold text-foreground">AdeenoAi</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Optimizing regulatory workflows for the pharmaceutical industry.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © 2025 AdeenoAi. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
