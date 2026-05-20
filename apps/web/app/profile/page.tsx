'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompletionRing } from '@/components/completion-ring';
import { api } from '@/lib/api';
import {
  Plus, Save, Trash2, X, Upload, FileText, Pencil, ExternalLink, Github, Linkedin, Globe,
} from 'lucide-react';

export default function ProfilePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['profile'], queryFn: () => api.getProfile() });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['profile'] });
    qc.invalidateQueries({ queryKey: ['profile-summary'] });
  }

  if (q.isLoading || !q.data) return <div className="p-8">Loading profile…</div>;
  const { profile, experiences, education, projects, skills, certifications, primaryResume } = q.data;

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Your profile</h1>
          <p className="text-muted-fg text-sm">
            A complete, recruiter-ready profile gets more callbacks. Fill out every section to reach 100%.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg border bg-card">
          <CompletionRing value={profile.completionPct} size={56} />
          <div>
            <div className="text-xs text-muted-fg uppercase tracking-wider">Completion</div>
            <div className="text-lg font-semibold">{profile.completionPct}%</div>
          </div>
        </div>
      </header>

      <PersonalSection profile={profile} onSaved={invalidate} />
      <CareerSection profile={profile} onSaved={invalidate} />
      <ResumeSection primaryResume={primaryResume} onChanged={invalidate} />
      <SkillsSection skills={skills} onChanged={invalidate} />
      <ExperienceSection items={experiences} onChanged={invalidate} />
      <EducationSection items={education} onChanged={invalidate} />
      <ProjectsSection items={projects} onChanged={invalidate} />
      <CertificationsSection items={certifications} onChanged={invalidate} />
    </div>
  );
}

// ---------- Personal ----------

function PersonalSection({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    fullName: profile.fullName || '',
    phone: profile.phone || '',
    currentLocation: profile.currentLocation || '',
    linkedinUrl: profile.linkedinUrl || '',
    githubUrl: profile.githubUrl || '',
    portfolioUrl: profile.portfolioUrl || '',
  });
  const save = useMutation({
    mutationFn: () => api.patchProfile(form),
    onSuccess: onSaved,
  });

  return (
    <SectionCard title="Personal" description="Basic contact info. Used by auto-apply when filling forms.">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Full name">
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Aryan Singh" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 91353 64584" />
        </Field>
        <Field label="Current location">
          <Input value={form.currentLocation} onChange={(e) => setForm({ ...form, currentLocation: e.target.value })} placeholder="Bengaluru, India" />
        </Field>
        <Field label="LinkedIn URL" icon={<Linkedin size={14} />}>
          <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/…" />
        </Field>
        <Field label="GitHub URL" icon={<Github size={14} />}>
          <Input value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/…" />
        </Field>
        <Field label="Portfolio URL" icon={<Globe size={14} />}>
          <Input value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} placeholder="https://your.site" />
        </Field>
      </div>
      <SaveBar mutation={save} />
    </SectionCard>
  );
}

// ---------- Career ----------

function CareerSection({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    jobTitle: profile.jobTitle || '',
    summary: profile.summary || '',
    achievements: profile.achievements || '',
    languages: Array.isArray(profile.languages) ? profile.languages.join(', ') : '',
  });
  const save = useMutation({
    mutationFn: () =>
      api.patchProfile({
        jobTitle: form.jobTitle,
        summary: form.summary,
        achievements: form.achievements,
        languages: form.languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: onSaved,
  });

  const summaryHint =
    form.summary.trim().length < 50
      ? `${50 - form.summary.trim().length} more characters for full credit`
      : 'Looks good ✓';

  return (
    <SectionCard
      title="Career"
      description="Surfaced to recruiters and used when generating optimized resumes."
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Current job title" className="md:col-span-2">
          <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Senior Software Engineer" />
        </Field>
        <Field label={`Professional summary (${form.summary.trim().length} / ≥50 chars)`} className="md:col-span-2" hint={summaryHint}>
          <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Senior engineer with 8 years building distributed systems at scale…" />
        </Field>
        <Field label="Achievements" className="md:col-span-2">
          <Textarea
            value={form.achievements}
            onChange={(e) => setForm({ ...form, achievements: e.target.value })}
            placeholder="Awards, talks, publications, hackathon wins…"
            className="min-h-[80px]"
          />
        </Field>
        <Field label="Languages (comma-separated)" className="md:col-span-2">
          <Input value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} placeholder="English, Hindi, Spanish" />
        </Field>
      </div>
      <SaveBar mutation={save} />
    </SectionCard>
  );
}

// ---------- Resume ----------

function ResumeSection({ primaryResume, onChanged }: { primaryResume: any | null; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadProfileResume(file),
    onSuccess: () => { setError(null); onChanged(); },
    onError: (e: any) => setError(e?.message || 'Upload failed'),
  });
  const unset = useMutation({
    mutationFn: () => api.unsetProfileResume(),
    onSuccess: onChanged,
  });

  function pick(f: FileList | null) {
    const file = f?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('File is larger than 10 MB.'); return; }
    upload.mutate(file);
  }

  return (
    <SectionCard
      title="Resume"
      description="PDF, DOCX, or LaTeX. We parse it and use it as your default for auto-apply."
    >
      {primaryResume ? (
        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} className="shrink-0 text-muted-fg" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Primary resume linked</div>
              <div className="text-xs text-muted-fg truncate">
                {primaryResume.sourceType.toUpperCase()} · uploaded {new Date(primaryResume.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => unset.mutate()} disabled={unset.isPending}>
              Unlink
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
          className="w-full p-8 border-2 border-dashed rounded-lg text-center hover:bg-muted/30 transition-colors"
        >
          <Upload size={24} className="mx-auto text-muted-fg mb-2" />
          <div className="text-sm font-medium">Drop a resume here, or click to browse</div>
          <div className="text-xs text-muted-fg">PDF / DOCX / .tex · max 10 MB</div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.tex"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
      {upload.isPending && <p className="text-sm text-muted-fg mt-2">Uploading & parsing…</p>}
    </SectionCard>
  );
}

// ---------- Skills ----------

function SkillsSection({ skills, onChanged }: { skills: any[]; onChanged: () => void }) {
  const [draft, setDraft] = useState('');
  const create = useMutation({
    mutationFn: (items: { name: string }[]) => api.createSkills(items),
    onSuccess: () => { setDraft(''); onChanged(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSkill(id),
    onSuccess: onChanged,
  });

  function submitDraft() {
    const items = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    if (!items.length) return;
    create.mutate(items);
  }

  return (
    <SectionCard
      title="Skills"
      description="Comma-separated, or one at a time. Used by the ATS scorer and the auto-apply form-fill."
    >
      <div className="flex gap-2 flex-wrap mb-3">
        {skills.length === 0 && <p className="text-sm text-muted-fg">No skills yet.</p>}
        {skills.map((s: any) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-sm group"
          >
            {s.name}
            <button
              onClick={() => remove.mutate(s.id)}
              className="opacity-50 group-hover:opacity-100 hover:text-danger transition-opacity"
              aria-label={`Remove ${s.name}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitDraft(); } }}
          placeholder="React, TypeScript, Python, AWS"
        />
        <Button onClick={submitDraft} disabled={create.isPending || !draft.trim()}>
          <Plus size={16} /> Add
        </Button>
      </div>
    </SectionCard>
  );
}

// ---------- Experience ----------

function ExperienceSection({ items, onChanged }: { items: any[]; onChanged: () => void }) {
  const [draftOpen, setDraftOpen] = useState(false);
  return (
    <SectionCard
      title="Experience"
      description="Reverse-chronological. Add every role you'd put on your resume."
      action={<Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}><Plus size={14} /> Add experience</Button>}
    >
      {draftOpen && (
        <ExperienceEditor
          initial={{ company: '', role: '', startDate: '', endDate: '', responsibilities: '', techStack: [] }}
          onCancel={() => setDraftOpen(false)}
          onSave={async (data) => { await api.createExperience(data); setDraftOpen(false); onChanged(); }}
        />
      )}
      {items.length === 0 && !draftOpen && (
        <p className="text-sm text-muted-fg">No experience entries yet.</p>
      )}
      <div className="space-y-3">
        {items.map((e: any) => (
          <ExperienceRow key={e.id} item={e} onChanged={onChanged} />
        ))}
      </div>
    </SectionCard>
  );
}

function ExperienceRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ExperienceEditor
        initial={item}
        onCancel={() => setEditing(false)}
        onSave={async (data) => { await api.updateExperience(item.id, data); setEditing(false); onChanged(); }}
      />
    );
  }
  return (
    <div className="p-3 rounded-md border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{item.role} · <span className="text-muted-fg font-normal">{item.company}</span></div>
          <div className="text-xs text-muted-fg">{item.startDate || '—'} – {item.endDate || 'Present'}</div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { await api.deleteExperience(item.id); onChanged(); }}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {item.responsibilities && (
        <p className="text-sm text-muted-fg whitespace-pre-line mt-2">{item.responsibilities}</p>
      )}
      {Array.isArray(item.techStack) && item.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {item.techStack.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
      )}
    </div>
  );
}

function ExperienceEditor({ initial, onSave, onCancel }: { initial: any; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    company: initial.company || '',
    role: initial.role || '',
    startDate: initial.startDate || '',
    endDate: initial.endDate || '',
    responsibilities: initial.responsibilities || '',
    techStack: Array.isArray(initial.techStack) ? initial.techStack.join(', ') : '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.company.trim() || !form.role.trim()) { setError('Company and role are required.'); return; }
    setBusy(true);
    try {
      await onSave({
        company: form.company.trim(),
        role: form.role.trim(),
        startDate: form.startDate.trim(),
        endDate: form.endDate.trim(),
        responsibilities: form.responsibilities,
        techStack: form.techStack.split(',').map((s) => s.trim()).filter(Boolean),
      });
    } catch (e: any) { setError(e?.message || 'Save failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-3 rounded-md border bg-muted/20 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
        <Field label="Role"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
        <Field label="Start date"><Input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} placeholder="Jan 2022" /></Field>
        <Field label="End date"><Input value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} placeholder="Present" /></Field>
        <Field label="Responsibilities" className="md:col-span-2">
          <Textarea value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} placeholder="Led migration of monolith → microservices…" />
        </Field>
        <Field label="Tech stack (comma-separated)" className="md:col-span-2">
          <Input value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} placeholder="Go, Kafka, Postgres, EKS" />
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- Education ----------

function EducationSection({ items, onChanged }: { items: any[]; onChanged: () => void }) {
  const [draftOpen, setDraftOpen] = useState(false);
  return (
    <SectionCard
      title="Education"
      description="Most recent first."
      action={<Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}><Plus size={14} /> Add education</Button>}
    >
      {draftOpen && (
        <EducationEditor
          initial={{ college: '', degree: '', branch: '', startYear: '', endYear: '', gpa: '' }}
          onCancel={() => setDraftOpen(false)}
          onSave={async (data) => { await api.createEducation(data); setDraftOpen(false); onChanged(); }}
        />
      )}
      {items.length === 0 && !draftOpen && <p className="text-sm text-muted-fg">No education entries yet.</p>}
      <div className="space-y-3">
        {items.map((e: any) => <EducationRow key={e.id} item={e} onChanged={onChanged} />)}
      </div>
    </SectionCard>
  );
}

function EducationRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <EducationEditor
        initial={item}
        onCancel={() => setEditing(false)}
        onSave={async (data) => { await api.updateEducation(item.id, data); setEditing(false); onChanged(); }}
      />
    );
  }
  return (
    <div className="p-3 rounded-md border bg-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{item.college}</div>
          <div className="text-sm text-muted-fg">
            {[item.degree, item.branch].filter(Boolean).join(' · ')}
            {item.gpa ? ` · GPA ${item.gpa}` : ''}
          </div>
          <div className="text-xs text-muted-fg">{item.startYear || '—'} – {item.endYear || '—'}</div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { await api.deleteEducation(item.id); onChanged(); }}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EducationEditor({ initial, onSave, onCancel }: { initial: any; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    college: initial.college || '',
    degree: initial.degree || '',
    branch: initial.branch || '',
    startYear: initial.startYear || '',
    endYear: initial.endYear || '',
    gpa: initial.gpa || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.college.trim()) { setError('College is required.'); return; }
    setBusy(true);
    try { await onSave(form); } catch (e: any) { setError(e?.message || 'Save failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-3 rounded-md border bg-muted/20 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="College / University" className="md:col-span-2">
          <Input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} placeholder="IIT Delhi" />
        </Field>
        <Field label="Degree"><Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="B.Tech" /></Field>
        <Field label="Branch / Major"><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="Computer Science" /></Field>
        <Field label="Start year"><Input value={form.startYear} onChange={(e) => setForm({ ...form, startYear: e.target.value })} placeholder="2018" /></Field>
        <Field label="End year"><Input value={form.endYear} onChange={(e) => setForm({ ...form, endYear: e.target.value })} placeholder="2022" /></Field>
        <Field label="GPA" className="md:col-span-2">
          <Input value={form.gpa} onChange={(e) => setForm({ ...form, gpa: e.target.value })} placeholder="8.7 / 10" />
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- Projects ----------

function ProjectsSection({ items, onChanged }: { items: any[]; onChanged: () => void }) {
  const [draftOpen, setDraftOpen] = useState(false);
  return (
    <SectionCard
      title="Projects"
      description="Open source, side projects, hackathon wins. Add the GitHub link so recruiters can click through."
      action={<Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}><Plus size={14} /> Add project</Button>}
    >
      {draftOpen && (
        <ProjectEditor
          initial={{ name: '', description: '', techStack: [], githubUrl: '', liveUrl: '' }}
          onCancel={() => setDraftOpen(false)}
          onSave={async (data) => { await api.createProject(data); setDraftOpen(false); onChanged(); }}
        />
      )}
      {items.length === 0 && !draftOpen && <p className="text-sm text-muted-fg">No projects yet.</p>}
      <div className="space-y-3">
        {items.map((p: any) => <ProjectRow key={p.id} item={p} onChanged={onChanged} />)}
      </div>
    </SectionCard>
  );
}

function ProjectRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ProjectEditor
        initial={item}
        onCancel={() => setEditing(false)}
        onSave={async (data) => { await api.updateProject(item.id, data); setEditing(false); onChanged(); }}
      />
    );
  }
  return (
    <div className="p-3 rounded-md border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {item.name}
            {item.githubUrl && (
              <a href={item.githubUrl} target="_blank" className="text-primary text-xs inline-flex items-center gap-1">
                <Github size={12} /> repo
              </a>
            )}
            {item.liveUrl && (
              <a href={item.liveUrl} target="_blank" className="text-primary text-xs inline-flex items-center gap-1">
                <ExternalLink size={12} /> live
              </a>
            )}
          </div>
          {item.description && <p className="text-sm text-muted-fg mt-1">{item.description}</p>}
          {Array.isArray(item.techStack) && item.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.techStack.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { await api.deleteProject(item.id); onChanged(); }}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectEditor({ initial, onSave, onCancel }: { initial: any; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    techStack: Array.isArray(initial.techStack) ? initial.techStack.join(', ') : '',
    githubUrl: initial.githubUrl || '',
    liveUrl: initial.liveUrl || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) { setError('Project name is required.'); return; }
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description,
        techStack: form.techStack.split(',').map((s) => s.trim()).filter(Boolean),
        githubUrl: form.githubUrl.trim() || undefined,
        liveUrl: form.liveUrl.trim() || undefined,
      });
    } catch (e: any) { setError(e?.message || 'Save failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-3 rounded-md border bg-muted/20 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Project name" className="md:col-span-2">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="otel-toolbox" />
        </Field>
        <Field label="Description" className="md:col-span-2">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="One-line OpenTelemetry setup for Python services…" />
        </Field>
        <Field label="Tech stack" className="md:col-span-2">
          <Input value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} placeholder="Python, OpenTelemetry, Prometheus" />
        </Field>
        <Field label="GitHub URL"><Input value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/…" /></Field>
        <Field label="Live URL"><Input value={form.liveUrl} onChange={(e) => setForm({ ...form, liveUrl: e.target.value })} placeholder="https://example.com" /></Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- Certifications ----------

function CertificationsSection({ items, onChanged }: { items: any[]; onChanged: () => void }) {
  const [draftOpen, setDraftOpen] = useState(false);
  return (
    <SectionCard
      title="Certifications"
      description="Cloud, ML, security — anything that strengthens your application."
      action={<Button size="sm" variant="outline" onClick={() => setDraftOpen(true)}><Plus size={14} /> Add certification</Button>}
    >
      {draftOpen && (
        <CertificationEditor
          initial={{ name: '', issuer: '', issuedDate: '', credentialUrl: '' }}
          onCancel={() => setDraftOpen(false)}
          onSave={async (data) => { await api.createCertification(data); setDraftOpen(false); onChanged(); }}
        />
      )}
      {items.length === 0 && !draftOpen && <p className="text-sm text-muted-fg">No certifications yet.</p>}
      <div className="space-y-3">
        {items.map((c: any) => <CertificationRow key={c.id} item={c} onChanged={onChanged} />)}
      </div>
    </SectionCard>
  );
}

function CertificationRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <CertificationEditor
        initial={item}
        onCancel={() => setEditing(false)}
        onSave={async (data) => { await api.updateCertification(item.id, data); setEditing(false); onChanged(); }}
      />
    );
  }
  return (
    <div className="p-3 rounded-md border bg-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {item.name}
            {item.credentialUrl && (
              <a href={item.credentialUrl} target="_blank" className="text-primary text-xs inline-flex items-center gap-1">
                <ExternalLink size={12} /> verify
              </a>
            )}
          </div>
          <div className="text-xs text-muted-fg">{item.issuer || '—'}{item.issuedDate ? ` · ${item.issuedDate}` : ''}</div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} /></Button>
          <Button size="sm" variant="ghost" onClick={async () => { await api.deleteCertification(item.id); onChanged(); }}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CertificationEditor({ initial, onSave, onCancel }: { initial: any; onSave: (data: any) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    issuer: initial.issuer || '',
    issuedDate: initial.issuedDate || '',
    credentialUrl: initial.credentialUrl || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        issuer: form.issuer.trim() || undefined,
        issuedDate: form.issuedDate.trim() || undefined,
        credentialUrl: form.credentialUrl.trim() || undefined,
      });
    } catch (e: any) { setError(e?.message || 'Save failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-3 rounded-md border bg-muted/20 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Certification name" className="md:col-span-2">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AWS Certified Solutions Architect" />
        </Field>
        <Field label="Issuer"><Input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="Amazon Web Services" /></Field>
        <Field label="Issued date"><Input value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} placeholder="Mar 2024" /></Field>
        <Field label="Credential URL" className="md:col-span-2">
          <Input value={form.credentialUrl} onChange={(e) => setForm({ ...form, credentialUrl: e.target.value })} placeholder="https://verify.example.com/…" />
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}

// ---------- shared helpers ----------

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  icon,
  className,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-fg mb-1 flex items-center gap-1">
        {icon}{label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-fg mt-1">{hint}</p>}
    </div>
  );
}

function SaveBar({ mutation }: { mutation: any }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        <Save size={16} /> {mutation.isPending ? 'Saving…' : 'Save'}
      </Button>
      {mutation.isSuccess && <span className="text-sm text-success">Saved ✓</span>}
      {mutation.isError && <span className="text-sm text-danger">{(mutation.error as any)?.message || 'Failed to save'}</span>}
    </div>
  );
}
