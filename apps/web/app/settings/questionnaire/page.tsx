'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Pencil, MessageSquare, Save } from 'lucide-react';

export default function QuestionnairePage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['saved-answers'], queryFn: api.listSavedAnswers });
  const [draft, setDraft] = useState<{ q: string; a: string }>({ q: '', a: '' });

  const upsert = useMutation({
    mutationFn: ({ q, a }: { q: string; a: string }) => api.upsertSavedAnswer(q, a),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-answers'] });
      setDraft({ q: '', a: '' });
    },
  });
  const remove = useMutation({
    mutationFn: (key: string) => api.deleteSavedAnswer(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-answers'] }),
  });

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Application questionnaire</h1>
        <p className="text-muted-fg text-sm">
          Every free-text answer you've ever given on an application form. Add or edit them here
          and the auto-apply worker will reuse them across all future Greenhouse postings.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus size={16} /> Add a new answer</CardTitle>
          <CardDescription>
            Paste the exact question wording you've seen on past forms (e.g. "Are you authorized to work in the U.S.?") — minor capitalization / punctuation differences are matched automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Question (as it appears on the form)"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
          <Textarea
            placeholder="Your answer"
            value={draft.a}
            onChange={(e) => setDraft({ ...draft, a: e.target.value })}
          />
          <Button
            onClick={() => upsert.mutate(draft)}
            disabled={!draft.q.trim() || !draft.a.trim() || upsert.isPending}
          >
            <Save size={16} /> Save answer
          </Button>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageSquare size={18} /> Your saved answers
        </h2>
        {list.isLoading ? (
          <p className="text-muted-fg text-sm">Loading…</p>
        ) : !list.data?.length ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-fg text-sm">
              No saved answers yet. They appear here automatically the first time the auto-apply
              worker asks you to answer something it couldn't autofill.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {list.data.map((a: any) => (
              <AnswerRow
                key={a.questionKey}
                question={a.questionText}
                questionKey={a.questionKey}
                answer={a.answerText}
                source={a.source}
                onSave={(q, ans) => upsert.mutate({ q, a: ans })}
                onDelete={() => remove.mutate(a.questionKey)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AnswerRow({
  question, questionKey, answer, source, onSave, onDelete,
}: {
  question: string;
  questionKey: string;
  answer: string;
  source: string;
  onSave: (q: string, a: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer);

  if (editing) {
    return (
      <Card className="border-primary/30">
        <CardContent className="p-3 space-y-2">
          <div className="text-sm font-medium">{question}</div>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onSave(question, draft); setEditing(false); }}><Save size={14} /> Save</Button>
            <Button size="sm" variant="outline" onClick={() => { setDraft(answer); setEditing(false); }}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
              {question}
              <Badge variant="outline">{source}</Badge>
            </div>
            <div className="text-sm text-muted-fg whitespace-pre-wrap mt-1">{answer}</div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 size={14} /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
