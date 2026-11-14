import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Textarea } from "../../ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";

interface IncidentSummarySectionProps {
  notes: string;
  onChange: (value: string) => void;
}

export function IncidentSummarySection({ notes, onChange }: IncidentSummarySectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Incident Summary</CardTitle>
        <CardDescription>Briefly describe what occurred at the incident.</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="notes">Comments about the job</FieldLabel>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => onChange(e.target.value)}
            placeholder="E.g. On arrival, crews found..."
            rows={4}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
