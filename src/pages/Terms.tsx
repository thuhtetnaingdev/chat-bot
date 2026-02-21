import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Bot } from 'lucide-react'

function Terms() {
  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-border/50 bg-gradient-to-br from-primary/20 to-transparent flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Chat Bot</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/register" className="flex items-center gap-2 text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div className="space-y-8">
            <p className="text-muted-foreground leading-relaxed">
              Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Chat Bot 
              application (the "Service") operated by us.
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part 
                of the terms, you may not access the Service. Your access to and use of the Service is conditioned on 
                your acceptance of and compliance with these Terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
              <p className="text-muted-foreground leading-relaxed">
                Chat Bot is an AI-powered chat application that provides:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Conversational AI interactions using various language models</li>
                <li>Image generation capabilities</li>
                <li>Video generation features</li>
                <li>Voice input and transcription</li>
                <li>Document and image analysis</li>
                <li>Conversation history and storage</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
              <p className="text-muted-foreground leading-relaxed">
                When you create an account with us, you must provide accurate, complete, and current information at all 
                times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of 
                your account.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for safeguarding the password that you use to access the Service and for any activities 
                or actions under your password. You agree not to disclose your password to any third party. You must notify 
                us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">4. API Keys and Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service requires you to provide API keys for third-party AI providers (such as Chutes AI). You are 
                solely responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Obtaining and maintaining valid API keys</li>
                <li>Any costs associated with API usage</li>
                <li>Compliance with third-party terms of service</li>
                <li>Security of your API keys</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                API keys are stored locally in your browser and are never transmitted to our servers except as necessary 
                to make API calls to the respective providers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">5. Acceptable Use</h2>
              <p className="text-muted-foreground leading-relaxed">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Generate, distribute, or promote illegal, harmful, or offensive content</li>
                <li>Create content that violates intellectual property rights</li>
                <li>Generate explicit sexual content involving minors</li>
                <li>Create content that promotes violence, terrorism, or hate speech</li>
                <li>Distribute malware or engage in malicious activities</li>
                <li>Attempt to bypass any security measures</li>
                <li>Use the Service in any way that could damage, disable, or impair the Service</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">6. Content and Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                You retain ownership of any content you input into the Service. However, by using the Service, you grant 
                us a limited license to process your content solely for the purpose of providing the Service to you.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Content generated by AI through our Service may be subject to the terms of the underlying AI model providers. 
                You are responsible for reviewing and complying with those terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">7. Data Storage</h2>
              <p className="text-muted-foreground leading-relaxed">
                Conversation histories and user preferences are stored locally in your browser using localStorage. We do 
                not store your conversations on our servers. You are responsible for backing up any important data.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">8. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall we, nor our directors, employees, partners, agents, suppliers, or affiliates, be liable 
                for any indirect, incidental, special, consequential or punitive damages, including without limitation, 
                loss of profits, data, use, goodwill, or other intangible losses, resulting from:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Your access to or use of or inability to access or use the Service</li>
                <li>Any conduct or content of any third party on the Service</li>
                <li>Any content obtained from the Service</li>
                <li>Unauthorized access, use or alteration of your transmissions or content</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">9. Disclaimer</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" 
                basis. The Service is provided without warranties of any kind, whether express or implied, including, 
                but not limited to, implied warranties of merchantability, fitness for a particular purpose, 
                non-infringement or course of performance.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                AI-generated content may be inaccurate, incomplete, or inappropriate. You should not rely on AI-generated 
                content for critical decisions without verification.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">10. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed and construed in accordance with the laws of your jurisdiction, without 
                regard to its conflict of law provisions.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">11. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision 
                is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. 
                What constitutes a material change will be determined at our sole discretion.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms, please contact us through our GitHub repository or support 
                channels.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Terms
