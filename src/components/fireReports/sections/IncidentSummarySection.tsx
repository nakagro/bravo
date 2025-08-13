import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";

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
        <div className="space-y-2">
          <Label htmlFor="notes">Comments about the job</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => onChange(e.target.value)}
            placeholder="E.g. On arrival, crews found..."
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  );
}
