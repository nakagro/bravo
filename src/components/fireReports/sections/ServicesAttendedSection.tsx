import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Checkbox } from "../../ui/checkbox";
import { Separator } from "../../ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";

export interface ServicesValues {
  electricityNotified: boolean;
  electricityAttended: boolean;
  gasNotified: boolean;
  gasAttended: boolean;
  ambulanceNotified: boolean;
  ambulanceAttended: boolean;
  policeNotified: boolean;
  policeAttended: boolean;
  policeDetails: string;
  otherServices: string;
  firstOnScene: string;
}

interface ServicesAttendedSectionProps {
  values: ServicesValues;
  onChangeField: <K extends keyof ServicesValues>(key: K, value: ServicesValues[K]) => void;
}

export function ServicesAttendedSection({ values, onChangeField }: ServicesAttendedSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other Services</CardTitle>
        <CardDescription>Emergency services notified or attended</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Electricity */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Electricity</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="electricityNotified"
                  checked={values.electricityNotified}
                  onCheckedChange={(checked) => onChangeField("electricityNotified", checked as boolean)}
                />
                <Label htmlFor="electricityNotified">Notified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="electricityAttended"
                  checked={values.electricityAttended}
                  onCheckedChange={(checked) => onChangeField("electricityAttended", checked as boolean)}
                />
                <Label htmlFor="electricityAttended">Attended</Label>
              </div>
            </div>
          </div>

          {/* Gas */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Gas</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gasNotified"
                  checked={values.gasNotified}
                  onCheckedChange={(checked) => onChangeField("gasNotified", checked as boolean)}
                />
                <Label htmlFor="gasNotified">Notified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gasAttended"
                  checked={values.gasAttended}
                  onCheckedChange={(checked) => onChangeField("gasAttended", checked as boolean)}
                />
                <Label htmlFor="gasAttended">Attended</Label>
              </div>
            </div>
          </div>

          {/* Ambulance */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Ambulance</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ambulanceNotified"
                  checked={values.ambulanceNotified}
                  onCheckedChange={(checked) => onChangeField("ambulanceNotified", checked as boolean)}
                />
                <Label htmlFor="ambulanceNotified">Notified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ambulanceAttended"
                  checked={values.ambulanceAttended}
                  onCheckedChange={(checked) => onChangeField("ambulanceAttended", checked as boolean)}
                />
                <Label htmlFor="ambulanceAttended">Attended</Label>
              </div>
            </div>
          </div>

          {/* Police */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Police</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="policeNotified"
                  checked={values.policeNotified}
                  onCheckedChange={(checked) => onChangeField("policeNotified", checked as boolean)}
                />
                <Label htmlFor="policeNotified">Notified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="policeAttended"
                  checked={values.policeAttended}
                  onCheckedChange={(checked) => onChangeField("policeAttended", checked as boolean)}
                />
                <Label htmlFor="policeAttended">Attended</Label>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="policeDetails">Police: Name or Number / Station</FieldLabel>
            <Input
              id="policeDetails"
              value={values.policeDetails}
              onChange={(e) => onChangeField("policeDetails", e.target.value)}
              placeholder="Police contact details"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="otherServices">Other Services</FieldLabel>
            <Input
              id="otherServices"
              value={values.otherServices}
              onChange={(e) => onChangeField("otherServices", e.target.value)}
              placeholder="Other emergency services involved"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="firstOnScene">FIRST on SCENE</FieldLabel>
            <Input
              id="firstOnScene"
              value={values.firstOnScene}
              onChange={(e) => onChangeField("firstOnScene", e.target.value)}
              placeholder="First responder on scene"
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
