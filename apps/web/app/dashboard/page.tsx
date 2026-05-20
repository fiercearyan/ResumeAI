'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

export default function Dashboard() {
  const resumes = useQuery({ queryKey: ['resumes'], queryFn: api.listResumes });
  const jds = useQuery({ queryKey: ['jds'], queryFn: api.listJds });
  const empty = (resumes.data?.length ?? 0) === 0;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-fg">Upload a resume, paste a job description, and get an instant ATS score.</p>
      </header>

      {empty ? (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Two steps. About 30 seconds.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">1. Upload a resume</CardTitle>
                <CardDescription>PDF, DOCX, or LaTeX. Max 10 MB.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild><Link href="/resumes">Upload</Link></Button>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-base">2. Add a job description</CardTitle>
                <CardDescription>Paste a URL or the JD text.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild><Link href="/jobs">Add JD</Link></Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumes</CardTitle>
              <CardDescription>{resumes.data?.length ?? 0} saved</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline"><Link href="/resumes">Manage</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Job descriptions</CardTitle>
              <CardDescription>{jds.data?.length ?? 0} saved</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline"><Link href="/jobs">Manage</Link></Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
