import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Bot, Shield, Lock, Eye, Database, Trash2, Cookie } from 'lucide-react'

function Privacy() {
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div className="space-y-8">
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy describes how we collect, use, and protect your personal information when you use 
              our Chat Bot application (the "Service"). We are committed to protecting your privacy and ensuring 
              transparency about our data practices.
            </p>

            <div className="grid gap-6">
              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <Shield className="w-6 h-6 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Privacy First</h3>
                  <p className="text-sm text-muted-foreground">
                    Your conversations are stored locally in your browser. We don't have access to your chat history.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <Lock className="w-6 h-6 text-primary mt-1 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Secure Storage</h3>
                  <p className="text-sm text-muted-foreground">
                    API keys are stored locally and never sent to our servers except to make direct API calls.
                  </p>
                </div>
              </div>
            </div>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
              
              <h3 className="text-lg font-medium text-foreground">Information You Provide</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><span className="font-medium text-foreground">Account Information:</span> When you register, we collect your name and email address</li>
                <li><span className="font-medium text-foreground">API Keys:</span> You provide API keys for third-party AI services (stored locally)</li>
                <li><span className="font-medium text-foreground">Conversations:</span> Chat messages and generated content (stored locally)</li>
                <li><span className="font-medium text-foreground">Preferences:</span> Settings and customization options you choose</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground">Information Collected Automatically</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li><span className="font-medium text-foreground">Usage Data:</span> Anonymous statistics about feature usage (if analytics are enabled)</li>
                <li><span className="font-medium text-foreground">Device Information:</span> Browser type, operating system (for compatibility)</li>
                <li><span className="font-medium text-foreground">Error Logs:</span> Technical information to help diagnose and fix issues</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">2. How We Store Your Data</h2>
              
              <div className="bg-muted/30 rounded-lg p-6 border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Local-First Architecture</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Chat Bot uses a local-first approach to data storage:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span><span className="font-medium text-foreground">Conversations:</span> Stored in your browser's localStorage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span><span className="font-medium text-foreground">API Keys:</span> Encrypted and stored locally</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span><span className="font-medium text-foreground">Settings:</span> Saved locally in your browser</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <span><span className="font-medium text-foreground">No Server Storage:</span> We don't store your chat data on our servers</span>
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>To provide and maintain the Service</li>
                <li>To authenticate your account and secure your data</li>
                <li>To communicate with you about updates or changes</li>
                <li>To improve the Service based on usage patterns</li>
                <li>To detect and prevent fraudulent or abusive activity</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">4. Data Sharing and Third Parties</h2>
              
              <h3 className="text-lg font-medium text-foreground">AI Model Providers</h3>
              <p className="text-muted-foreground leading-relaxed">
                When you use AI features, your prompts and context are sent to third-party AI providers (such as Chutes AI) 
                through their APIs. This is necessary for the Service to function. Please review their privacy policies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Chutes AI Privacy Policy</li>
                <li>Other AI providers you configure</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground">We Do Not Sell Your Data</h3>
              <p className="text-muted-foreground leading-relaxed">
                We do not sell, trade, or rent your personal information to third parties. We may share anonymous, 
                aggregated data for analytical purposes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">5. Your Rights and Control</h2>
              
              <div className="grid gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
                  <Eye className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Access Your Data</h4>
                    <p className="text-sm text-muted-foreground">
                      You can view all your stored data through the application interface
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
                  <Trash2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Delete Your Data</h4>
                    <p className="text-sm text-muted-foreground">
                      You can delete individual conversations or clear all local data at any time
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg border border-border">
                  <Cookie className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-medium text-foreground mb-1">Control Cookies</h4>
                    <p className="text-sm text-muted-foreground">
                      You can clear site data through your browser settings to remove all stored information
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">6. Security Measures</h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>All data is stored locally in your browser, not on our servers</li>
                <li>API keys are never transmitted to our infrastructure</li>
                <li>We use HTTPS for all communications</li>
                <li>Regular security updates to dependencies</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                Since data is stored locally in your browser, it persists until you:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Manually delete it through the application</li>
                <li>Clear your browser's localStorage</li>
                <li>Uninstall or reset the application</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">8. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Service is not intended for use by children under the age of 13. We do not knowingly collect 
                personal information from children under 13. If you are a parent or guardian and believe your child 
                has provided us with personal information, please contact us.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">9. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Since data is stored locally in your browser, your data remains on your device. However, when using 
                AI features, your data may be transmitted to AI providers' servers which may be located in different 
                countries. By using these features, you consent to such transfers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">10. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the 
                new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">11. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy, please:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Open an issue on our GitHub repository</li>
                <li>Contact us through the provided support channels</li>
                <li>Email us at privacy@example.com (if available)</li>
              </ul>
            </section>

            <div className="mt-12 p-6 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-semibold text-foreground mb-2">Summary</h3>
              <p className="text-sm text-muted-foreground">
                We prioritize your privacy by keeping your data local. We don't store your conversations on our 
                servers, and your API keys remain secure on your device. You're always in control of your data.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Privacy
