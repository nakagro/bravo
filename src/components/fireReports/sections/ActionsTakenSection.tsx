import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Checkbox } from "../../ui/checkbox";
import { Label } from "../../ui/label";

interface ActionOption {
  value: string;
  label: string;
}

interface ActionsTakenSectionProps {
  options: ActionOption[];
  actions: string[];
  onToggle: (value: string, checked: boolean) => void;
}

export function ActionsTakenSection({ options, actions, onToggle }: ActionsTakenSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions Taken</CardTitle>
        <CardDescription>Select all actions that were performed during this incident</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {options.map((action) => (
            <div key={action.value} className="flex items-center space-x-2">
              <Checkbox
                id={action.value}
                checked={actions.includes(action.value)}
                onCheckedChange={(checked) => onToggle(action.value, checked as boolean)}
              />
              <Label htmlFor={action.value} className="text-sm">{action.label}</Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
