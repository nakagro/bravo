import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";

export interface FireDetailsValues {
  materialsFirstIgnited: string;
  causeOfIgnition: string;
  usedForExtinguishment: string;
  numberOfHoseLinesUsed: number;
  problems: string;
  supply: string;
  estimatedLoss: number;
  insurance: boolean | null;
  fireInvestigation: boolean | null;
}

interface FireDetailsSectionProps {
  values: FireDetailsValues;
  onChangeField: <K extends keyof FireDetailsValues>(key: K, value: FireDetailsValues[K]) => void;
}

export function FireDetailsSection({ values, onChangeField }: FireDetailsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fire Details</CardTitle>
        <CardDescription>Detailed information about the fire incident</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="materialsFirstIgnited">Materials First Ignited</Label>
            <Input
              id="materialsFirstIgnited"
              value={values.materialsFirstIgnited}
              onChange={(e) => onChangeField("materialsFirstIgnited", e.target.value)}
              placeholder="e.g., grass, timber, fuel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="causeOfIgnition">Cause of Ignition</Label>
            <Input
              id="causeOfIgnition"
              value={values.causeOfIgnition}
              onChange={(e) => onChangeField("causeOfIgnition", e.target.value)}
              placeholder="e.g., electrical fault, arson"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="usedForExtinguishment">Used for Extinguishment</Label>
            <Input
              id="usedForExtinguishment"
              value={values.usedForExtinguishment}
              onChange={(e) => onChangeField("usedForExtinguishment", e.target.value)}
              placeholder="e.g., water, foam, dry chemical"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numberOfHoseLinesUsed">Number of Hose Lines Used</Label>
            <Input
              id="numberOfHoseLinesUsed"
              type="number"
              min="0"
              value={values.numberOfHoseLinesUsed || ""}
              onChange={(e) => onChangeField("numberOfHoseLinesUsed", parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="problems">Problems</Label>
            <Input
              id="problems"
              value={values.problems}
              onChange={(e) => onChangeField("problems", e.target.value)}
              placeholder="Any issues encountered"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supply">Supply</Label>
            <Input
              id="supply"
              value={values.supply}
              onChange={(e) => onChangeField("supply", e.target.value)}
              placeholder="Water supply source"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="estimatedLoss">Estimated $ Loss</Label>
            <Input
              id="estimatedLoss"
              type="number"
              min="0"
              value={values.estimatedLoss || ""}
              onChange={(e) => onChangeField("estimatedLoss", parseInt(e.target.value) || 0)}
              placeholder="0"
            />
          </div>

          <div>
            <Label className="text-base font-medium">Insurance</Label>
            <RadioGroup
              value={values.insurance === null ? "" : values.insurance.toString()}
              onValueChange={(value) => onChangeField("insurance", value === "" ? null : value === "true")}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="insuranceNo" />
                <Label htmlFor="insuranceNo">No</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="insuranceYes" />
                <Label htmlFor="insuranceYes">Yes</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Fire Investigation</Label>
            <RadioGroup
              value={values.fireInvestigation === null ? "" : values.fireInvestigation.toString()}
              onValueChange={(value) => onChangeField("fireInvestigation", value === "" ? null : value === "true")}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="fireInvNo" />
                <Label htmlFor="fireInvNo">No</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="fireInvYes" />
                <Label htmlFor="fireInvYes">Yes</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
