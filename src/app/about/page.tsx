import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Shield, Users, FileText, Target, Eye, Heart } from 'lucide-react'
import Link from 'next/link'

const teamMembers = [
  { name: 'Investigation Team', role: 'Investigative Journalists', count: 5 },
  { name: 'Editorial Team', role: 'Senior Editors', count: 3 },
  { name: 'Legal Team', role: 'Legal Advisors', count: 2 },
  { name: 'Technical Team', role: 'Developers & IT', count: 2 },
]

const values = [
  {
    icon: Shield,
    title: 'Integrity',
    description: 'Maintaining truth and accuracy in every report.',
  },
  {
    icon: Eye,
    title: 'Transparency',
    description: 'Open about processes, sources, and funding.',
  },
  {
    icon: Target,
    title: 'Accountability',
    description: 'Responsible for every published content.',
  },
  {
    icon: Heart,
    title: 'Independence',
    description: 'Free from political and commercial influence.',
  },
]

export default function AboutPage() {
  return (
    <div className="py-12">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4">About Bali Journal</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            An independent investigative journalism platform for Bali, 
            committed to evidence-based news and high ethical standards.
          </p>
        </div>

        {/* Mission */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              Bali Journal exists to deliver high-quality investigative journalism 
              focused on important issues in Bali. We believe the public has the right 
              to receive accurate, balanced, and accountable information.
            </p>
            <Separator className="my-4" />
            <p className="text-muted-foreground leading-relaxed">
              Using AI technology for legal risk analysis and content moderation, 
              we ensure every article meets Indonesian legal and journalistic ethics standards.
            </p>
          </CardContent>
        </Card>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {values.map((value) => (
            <Card key={value.title}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <value.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Team */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Our Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamMembers.map((team) => (
                <div key={team.name} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-sm text-muted-foreground">{team.role}</p>
                  </div>
                  <Badge variant="secondary">{team.count} people</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Technology */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Technology & AI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Bali Journal uses AI technology to support the editorial process:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border text-center">
                <p className="font-medium text-sm">Legal Risk Analysis</p>
                <p className="text-xs text-muted-foreground">ITE & Press Law</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="font-medium text-sm">Comment Moderation</p>
                <p className="text-xs text-muted-foreground">SARA & Defamation</p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <p className="font-medium text-sm">Tone Control</p>
                <p className="text-xs text-muted-foreground">Editorial Neutrality</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold">Join Us</h2>
          <p className="text-muted-foreground">
            Become part of the independent investigative journalism community in Bali.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button>Register Now</Button>
            </Link>
            <Link href="/submit-report">
              <Button variant="outline">Submit Report</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
