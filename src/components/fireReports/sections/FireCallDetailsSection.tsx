import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

export interface FireCallDetailsValues {
  incidentNumber: string;
  brigadeAdvisedDate: string;
  brigadeAdvisedTime: string;
  attendingCapacity: "primary" | "support" | "";
  typeOfAttendance: "grassScrub" | "incident" | "structure" | "nonStructure" | "falseAlarm" | "";
  jobDetail: string;
  incidentController: string;
  brigadeOIC: string;
  brigadeCaller: string;
  firecomCaller: string;
  propertyAddress: string;
  propertyCoordinates: string;
  keysUsed: boolean | null;
  chargeRecommended: boolean | null;
}

interface FireCallDetailsSectionProps {
  values: FireCallDetailsValues;
  onChangeField: <K extends keyof FireCallDetailsValues>(key: K, value: FireCallDetailsValues[K]) => void;
}

export function FireCallDetailsSection({ values, onChangeField }: FireCallDetailsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fire Call Details</CardTitle>
        <CardDescription>Basic incident information and response details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="incidentNumber">Incident Number *</Label>
            <Input
              id="incidentNumber"
              value={values.incidentNumber}
              onChange={(e) => onChangeField("incidentNumber", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brigadeAdvisedDate">Brigade Advised (Date) *</Label>
            <Input
              id="brigadeAdvisedDate"
              type="date"
              value={values.brigadeAdvisedDate}
              onChange={(e) => onChangeField("brigadeAdvisedDate", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brigadeAdvisedTime">Brigade Advised (Time) *</Label>
            <Input
              id="brigadeAdvisedTime"
              type="time"
              value={values.brigadeAdvisedTime}
              onChange={(e) => onChangeField("brigadeAdvisedTime", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brigadeCaller">Brigade Call Number</Label>
            <Input
              id="brigadeCaller"
              value={values.brigadeCaller}
              onChange={(e) => onChangeField("brigadeCaller", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firecomCaller">Firecom Call Number</Label>
            <Input
              id="firecomCaller"
              value={values.firecomCaller}
              onChange={(e) => onChangeField("firecomCaller", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Attending Capacity *</Label>
            <RadioGroup
              value={values.attendingCapacity}
              onValueChange={(value) => onChangeField("attendingCapacity", value as FireCallDetailsValues["attendingCapacity"])}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="primary" id="primary" />
                <Label htmlFor="primary">Primary</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="support" id="support" />
                <Label htmlFor="support">Support</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="typeOfAttendance">Type of Attendance *</Label>
            <Select value={values.typeOfAttendance} onValueChange={(value) => onChangeField("typeOfAttendance", value as FireCallDetailsValues["typeOfAttendance"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grassScrub">Grass & Scrub</SelectItem>
                <SelectItem value="incident">Incident</SelectItem>
                <SelectItem value="structure">Structure</SelectItem>
                <SelectItem value="nonStructure">Non-structure</SelectItem>
                <SelectItem value="falseAlarm">False Alarm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobDetail">Job Detail</Label>
            <Input
              id="jobDetail"
              value={values.jobDetail}
              onChange={(e) => onChangeField("jobDetail", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="incidentController">Incident Controller *</Label>
            <Input
              id="incidentController"
              value={values.incidentController}
              onChange={(e) => onChangeField("incidentController", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brigadeOIC">Brigade OIC</Label>
            <Input
              id="brigadeOIC"
              value={values.brigadeOIC}
              onChange={(e) => onChangeField("brigadeOIC", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address/Location *</Label>
            <Input
              id="propertyAddress"
              value={values.propertyAddress}
              onChange={(e) => onChangeField("propertyAddress", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyCoordinates">GPS Coordinates</Label>
            <Input
              id="propertyCoordinates"
              value={values.propertyCoordinates}
              onChange={(e) => onChangeField("propertyCoordinates", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-8">
          <div>
            <Label className="text-base font-medium">Keys Used</Label>
            <RadioGroup
              value={values.keysUsed === null ? "" : values.keysUsed.toString()}
              onValueChange={(value) => onChangeField("keysUsed", value === "" ? null : value === "true")}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="keysNo" />
                <Label htmlFor="keysNo">No</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="keysYes" />
                <Label htmlFor="keysYes">Yes</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-medium">Charge Recommended</Label>
            <RadioGroup
              value={values.chargeRecommended === null ? "" : values.chargeRecommended.toString()}
              onValueChange={(value) => onChangeField("chargeRecommended", value === "" ? null : value === "true")}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="chargeNo" />
                <Label htmlFor="chargeNo">No</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="chargeYes" />
                <Label htmlFor="chargeYes">Yes</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
