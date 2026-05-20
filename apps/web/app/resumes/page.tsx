'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Upload, FileText } from 'lucide-react';

export default function ResumesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['resumes'], queryFn: api.listResumes });
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadResume(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resumes'] });
      setError(null);
    },
    onError: (e: any) => setError(e.message || 'Upload failed'),
  });

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError('File is larger than 10 MB.');
      return;
    }
    upload.mutate(f);
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumes</h1>
          <p className="text-muted-fg">Upload a resume — we'll parse it and keep the version history.</p>
        </div>
      </header>

      <Card
        className={dragOver ? 'border-primary' : ''}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
      >
        <CardContent className="p-10 text-center space-y-4">
          <Upload size={32} className="mx-auto text-muted-fg" />
          <div>
            <p className="font-medium">Drop a PDF, DOCX, or LaTeX file here</p>
            <p className="text-sm text-muted-fg">…or click to browse. Max 10 MB.</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.tex"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Choose file'}
          </Button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      <section>
        <h2 className="text-lg font-semibold mb-3">Your resumes</h2>
        {list.isLoading ? (
          <p className="text-muted-fg text-sm">Loading…</p>
        ) : !list.data?.length ? (
          <p className="text-muted-fg text-sm">No resumes yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {list.data.map((r: any) => (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText size={16} /> {r.sourceType.toUpperCase()} resume
                    </CardTitle>
                    <Badge variant="outline">{r.versions.length} version{r.versions.length === 1 ? '' : 's'}</Badge>
                  </div>
                  <CardDescription>{new Date(r.createdAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/resumes/${r.id}`}>View</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
