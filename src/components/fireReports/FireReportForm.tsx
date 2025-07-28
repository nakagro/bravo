import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Separator } from "../ui/separator";
import { ArrowLeftIcon, BookmarkIcon, PaperAirplaneIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useToast } from "../../hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";

interface FireReportFormProps {
  reportId?: Id<"fireReports"> | null;
  onBack: () => void;
  onSaved: () => void;
}

interface FormData {
  // Required fields
  incidentNumber: string;
  brigadeAdvisedDate: string;
  brigadeAdvisedTime: string;
  attendingCapacity: "primary" | "support" | "";
  typeOfAttendance: "grassScrub" | "incident" | "structure" | "nonStructure" | "falseAlarm" | "";
  incidentController: string;
  propertyAddress: string;
  
  // Optional fire call details
  brigadeCaller: string;
  firecomCaller: string;
  jobDetail: string;
  brigadeOIC: string;
  propertyCoordinates: string;
  keysUsed: boolean | null;
  chargeRecommended: boolean | null;
  
  // Property information
  occupierName: string;
  occupierPhone: string;
  occupierType: "private" | "government" | "";
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  ownerType: "private" | "government" | "";
  
  // Actions taken
  actionsTaken: string[];
  
  // Fire details
  materialsFirstIgnited: string;
  causeOfIgnition: string;
  usedForExtinguishment: string;
  numberOfHoseLinesUsed: number;
  problems: string;
  supply: string;
  estimatedLoss: number;
  insurance: boolean | null;
  fireInvestigation: boolean | null;
  
  // Other services
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
  
  // Casualties (array of casualties)
  casualties: {
    name: string;
    injuries: "minor" | "major" | "fatal" | "";
    sex: "male" | "female" | "";
    details: string;
    transported: boolean | null;
  }[];
  
  // Mobile property (array of vehicles)
  vehicles: {
    registration: string;
    state: string;
    make: string;
    model: string;
    year: number;
    details: string;
  }[];
  
  // Notes
  notes: string;
}

const initialFormData: FormData = {
  incidentNumber: "",
  brigadeAdvisedDate: "",
  brigadeAdvisedTime: "",
  attendingCapacity: "",
  typeOfAttendance: "",
  incidentController: "",
  propertyAddress: "",
  brigadeCaller: "",
  firecomCaller: "",
  jobDetail: "",
  brigadeOIC: "",
  propertyCoordinates: "",
  keysUsed: null,
  chargeRecommended: null,
  occupierName: "",
  occupierPhone: "",
  occupierType: "",
  ownerName: "",
  ownerAddress: "",
  ownerPhone: "",
  ownerType: "",
  actionsTaken: [],
  materialsFirstIgnited: "",
  causeOfIgnition: "",
  usedForExtinguishment: "",
  numberOfHoseLinesUsed: 0,
  problems: "",
  supply: "",
  estimatedLoss: 0,
  insurance: null,
  fireInvestigation: null,
  electricityNotified: false,
  electricityAttended: false,
  gasNotified: false,
  gasAttended: false,
  ambulanceNotified: false,
  ambulanceAttended: false,
  policeNotified: false,
  policeAttended: false,
  policeDetails: "",
  otherServices: "",
  firstOnScene: "",
  casualties: [],
  vehicles: [],
  notes: "",
};

const actionOptions = [
  { value: "calledOff", label: "Called Off En-route" },
  { value: "stepUp", label: "Step up" },
  { value: "investigateOnly", label: "Investigate Only" },
  { value: "fireOutOnArrival", label: "Fire Out on Arrival" },
  { value: "washaway", label: "Wash-away" },
  { value: "removeHazard", label: "Remove Hazard, Evacuation" },
  { value: "rescue", label: "Rescue or Assistance" },
  { value: "isolate", label: "Isolate / Shut off" },
  { value: "standby", label: "Standby, Cover Assignment" },
  { value: "extinguish", label: "Extinguish, Salvage, Overhaul, Ventilate" },
  { value: "service", label: "Service, Assist Elderly, Gain Entry etc." },
  { value: "other", label: "Other" },
];

export function FireReportForm({ reportId, onBack, onSaved }: FireReportFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Mutations
  const createReport = useMutation(api.fireReports.createFireReport);
  const updateReport = useMutation(api.fireReports.updateFireReport);

  // Query existing report if editing
  const existingReport = useQuery(
    api.fireReports.getFireReport,
    reportId ? { reportId } : "skip"
  );

  // Load existing report data
  useEffect(() => {
    if (existingReport && reportId) {
      setFormData({
        incidentNumber: existingReport.incidentNumber || "",
        brigadeAdvisedDate: existingReport.brigadeAdvisedDate || "",
        brigadeAdvisedTime: existingReport.brigadeAdvisedTime || "",
        attendingCapacity: existingReport.attendingCapacity || "",
        typeOfAttendance: existingReport.typeOfAttendance || "",
        incidentController: existingReport.incidentController || "",
        propertyAddress: existingReport.propertyAddress || "",
        brigadeCaller: existingReport.brigadeCaller || "",
        firecomCaller: existingReport.firecomCaller || "",
        jobDetail: existingReport.jobDetail || "",
        brigadeOIC: existingReport.brigadeOIC || "",
        propertyCoordinates: existingReport.propertyCoordinates || "",
        keysUsed: existingReport.keysUsed ?? null,
        chargeRecommended: existingReport.chargeRecommended ?? null,
        occupierName: existingReport.propertyInfo?.occupier?.name || "",
        occupierPhone: existingReport.propertyInfo?.occupier?.phone || "",
        occupierType: existingReport.propertyInfo?.occupier?.type || "",
        ownerName: existingReport.propertyInfo?.owner?.name || "",
        ownerAddress: existingReport.propertyInfo?.owner?.address || "",
        ownerPhone: existingReport.propertyInfo?.owner?.phone || "",
        ownerType: existingReport.propertyInfo?.owner?.type || "",
        actionsTaken: existingReport.actionsTaken || [],
        materialsFirstIgnited: existingReport.fireDetails?.materialsFirstIgnited || "",
        causeOfIgnition: existingReport.fireDetails?.causeOfIgnition || "",
        usedForExtinguishment: existingReport.fireDetails?.usedForExtinguishment || "",
        numberOfHoseLinesUsed: existingReport.fireDetails?.numberOfHoseLinesUsed || 0,
        problems: existingReport.fireDetails?.problems || "",
        supply: existingReport.fireDetails?.supply || "",
        estimatedLoss: existingReport.fireDetails?.estimatedLoss || 0,
        insurance: existingReport.fireDetails?.insurance ?? null,
        fireInvestigation: existingReport.fireDetails?.fireInvestigation ?? null,
        electricityNotified: existingReport.otherServices?.electricity?.notified || false,
        electricityAttended: existingReport.otherServices?.electricity?.attended || false,
        gasNotified: existingReport.otherServices?.gas?.notified || false,
        gasAttended: existingReport.otherServices?.gas?.attended || false,
        ambulanceNotified: existingReport.otherServices?.ambulance?.notified || false,
        ambulanceAttended: existingReport.otherServices?.ambulance?.attended || false,
        policeNotified: existingReport.otherServices?.police?.notified || false,
        policeAttended: existingReport.otherServices?.police?.attended || false,
        policeDetails: existingReport.otherServices?.police?.details || "",
        otherServices: existingReport.otherServices?.other || "",
        firstOnScene: existingReport.otherServices?.firstOnScene || "",
        casualties: existingReport.casualties ? existingReport.casualties.map(casualty => ({
          name: casualty.name || "",
          injuries: casualty.injuries || "",
          sex: casualty.sex || "",
          details: casualty.details || "",
          transported: casualty.transportedByAV ?? null,
        })) : [],
        vehicles: existingReport.mobileProperty ? [{
          registration: existingReport.mobileProperty.registration || "",
          state: existingReport.mobileProperty.state || "",
          make: existingReport.mobileProperty.make || "",
          model: existingReport.mobileProperty.model || "",
          year: existingReport.mobileProperty.year || 0,
          details: existingReport.mobileProperty.details || ""
        }] : [],
        notes: existingReport.notes || "",
      });
    }
  }, [existingReport, reportId]);

  const validateRequired = () => {
    const required = [
      'incidentNumber',
      'brigadeAdvisedDate',
      'brigadeAdvisedTime',
      'attendingCapacity',
      'typeOfAttendance',
      'incidentController',
      'propertyAddress'
    ];
    
    return required.every(field => formData[field as keyof FormData]);
  };

  const handleSubmit = async (status: "draft" | "submitted") => {
    if (status === "submitted" && !validateRequired()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const reportData = {
        incidentNumber: formData.incidentNumber,
        brigadeAdvisedDate: formData.brigadeAdvisedDate,
        brigadeAdvisedTime: formData.brigadeAdvisedTime,
        attendingCapacity: formData.attendingCapacity as "primary" | "support",
        typeOfAttendance: formData.typeOfAttendance as any,
        incidentController: formData.incidentController,
        propertyAddress: formData.propertyAddress,
        brigadeCaller: formData.brigadeCaller || undefined,
        firecomCaller: formData.firecomCaller || undefined,
        jobDetail: formData.jobDetail || undefined,
        brigadeOIC: formData.brigadeOIC || undefined,
        propertyCoordinates: formData.propertyCoordinates || undefined,
        keysUsed: formData.keysUsed ?? undefined,
        chargeRecommended: formData.chargeRecommended ?? undefined,
        propertyInfo: {
          occupier: {
            name: formData.occupierName || undefined,
            phone: formData.occupierPhone || undefined,
            type: formData.occupierType as any || undefined,
          },
          owner: {
            name: formData.ownerName || undefined,
            address: formData.ownerAddress || undefined,
            phone: formData.ownerPhone || undefined,
            type: formData.ownerType as any || undefined,
          },
        },
        actionsTaken: formData.actionsTaken.length > 0 ? formData.actionsTaken as any : undefined,
        fireDetails: {
          materialsFirstIgnited: formData.materialsFirstIgnited || undefined,
          causeOfIgnition: formData.causeOfIgnition || undefined,
          usedForExtinguishment: formData.usedForExtinguishment || undefined,
          numberOfHoseLinesUsed: formData.numberOfHoseLinesUsed || undefined,
          problems: formData.problems || undefined,
          supply: formData.supply || undefined,
          estimatedLoss: formData.estimatedLoss || undefined,
          insurance: formData.insurance ?? undefined,
          fireInvestigation: formData.fireInvestigation ?? undefined,
        },
        otherServices: {
          electricity: {
            notified: formData.electricityNotified || undefined,
            attended: formData.electricityAttended || undefined,
          },
          gas: {
            notified: formData.gasNotified || undefined,
            attended: formData.gasAttended || undefined,
          },
          ambulance: {
            notified: formData.ambulanceNotified || undefined,
            attended: formData.ambulanceAttended || undefined,
          },
          police: {
            notified: formData.policeNotified || undefined,
            attended: formData.policeAttended || undefined,
            details: formData.policeDetails || undefined,
          },
          other: formData.otherServices || undefined,
          firstOnScene: formData.firstOnScene || undefined,
        },
        casualties: formData.casualties.length > 0 ? formData.casualties.map(casualty => ({
          name: casualty.name || undefined,
          injuries: casualty.injuries || undefined,
          sex: casualty.sex || undefined,
          details: casualty.details || undefined,
          transportedByAV: casualty.transported ?? undefined,
        })) : undefined,
        mobileProperty: formData.vehicles.length > 0 ? formData.vehicles[0] : undefined,
        notes: formData.notes || undefined,
        status,
      };

      if (reportId) {
        await updateReport({
          reportId,
          ...reportData,
        });
        toast({
          title: "Report Updated",
          description: `Fire report has been ${status === "submitted" ? "submitted" : "saved as draft"}.`,
        });
      } else {
        await createReport(reportData);
        toast({
          title: "Report Created",
          description: `Fire report has been ${status === "submitted" ? "submitted" : "saved as draft"}.`,
        });
      }

      onSaved();
    } catch (error) {
      console.error("Error saving report:", error);
      toast({
        title: "Error",
        description: "Failed to save report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleActionChange = (actionValue: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      actionsTaken: checked 
        ? [...prev.actionsTaken, actionValue]
        : prev.actionsTaken.filter(a => a !== actionValue)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {reportId ? "Edit Fire Report" : "New Fire Report"}
          </h1>
          <p className="text-muted-foreground">
            Wyndham Vale Fire Brigade Preliminary Fire Report
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Fire Call Details */}
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
                  value={formData.incidentNumber}
                  onChange={(e) => updateField("incidentNumber", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brigadeAdvisedDate">Brigade Advised (Date) *</Label>
                <Input
                  id="brigadeAdvisedDate"
                  type="date"
                  value={formData.brigadeAdvisedDate}
                  onChange={(e) => updateField("brigadeAdvisedDate", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brigadeAdvisedTime">Brigade Advised (Time) *</Label>
                <Input
                  id="brigadeAdvisedTime"
                  type="time"
                  value={formData.brigadeAdvisedTime}
                  onChange={(e) => updateField("brigadeAdvisedTime", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brigadeCaller">Brigade Call Number</Label>
                <Input
                  id="brigadeCaller"
                  value={formData.brigadeCaller}
                  onChange={(e) => updateField("brigadeCaller", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firecomCaller">Firecom Call Number</Label>
                <Input
                  id="firecomCaller"
                  value={formData.firecomCaller}
                  onChange={(e) => updateField("firecomCaller", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Attending Capacity *</Label>
                <RadioGroup 
                  value={formData.attendingCapacity} 
                  onValueChange={(value) => updateField("attendingCapacity", value)}
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
                <Select value={formData.typeOfAttendance} onValueChange={(value) => updateField("typeOfAttendance", value)}>
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
                  value={formData.jobDetail}
                  onChange={(e) => updateField("jobDetail", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incidentController">Incident Controller *</Label>
                <Input
                  id="incidentController"
                  value={formData.incidentController}
                  onChange={(e) => updateField("incidentController", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brigadeOIC">Brigade OIC</Label>
                <Input
                  id="brigadeOIC"
                  value={formData.brigadeOIC}
                  onChange={(e) => updateField("brigadeOIC", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyAddress">Property Address/Location *</Label>
                <Input
                  id="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={(e) => updateField("propertyAddress", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyCoordinates">GPS Coordinates</Label>
                <Input
                  id="propertyCoordinates"
                  value={formData.propertyCoordinates}
                  onChange={(e) => updateField("propertyCoordinates", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-8">
              <div>
                <Label className="text-base font-medium">Keys Used</Label>
                <RadioGroup 
                  value={formData.keysUsed === null ? "" : formData.keysUsed.toString()} 
                  onValueChange={(value) => updateField("keysUsed", value === "" ? null : value === "true")}
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
                  value={formData.chargeRecommended === null ? "" : formData.chargeRecommended.toString()} 
                  onValueChange={(value) => updateField("chargeRecommended", value === "" ? null : value === "true")}
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

        {/* Actions Taken */}
        <Card>
          <CardHeader>
            <CardTitle>Actions Taken</CardTitle>
            <CardDescription>Select all actions that were performed during this incident</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {actionOptions.map((action) => (
                <div key={action.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={action.value}
                    checked={formData.actionsTaken.includes(action.value)}
                    onCheckedChange={(checked) => handleActionChange(action.value, checked as boolean)}
                  />
                  <Label htmlFor={action.value} className="text-sm">{action.label}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fire Details */}
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
                  value={formData.materialsFirstIgnited}
                  onChange={(e) => updateField("materialsFirstIgnited", e.target.value)}
                  placeholder="e.g., grass, timber, fuel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="causeOfIgnition">Cause of Ignition</Label>
                <Input
                  id="causeOfIgnition"
                  value={formData.causeOfIgnition}
                  onChange={(e) => updateField("causeOfIgnition", e.target.value)}
                  placeholder="e.g., electrical fault, arson"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usedForExtinguishment">Used for Extinguishment</Label>
                <Input
                  id="usedForExtinguishment"
                  value={formData.usedForExtinguishment}
                  onChange={(e) => updateField("usedForExtinguishment", e.target.value)}
                  placeholder="e.g., water, foam, dry chemical"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfHoseLinesUsed">Number of Hose Lines Used</Label>
                <Input
                  id="numberOfHoseLinesUsed"
                  type="number"
                  min="0"
                  value={formData.numberOfHoseLinesUsed || ""}
                  onChange={(e) => updateField("numberOfHoseLinesUsed", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="problems">Problems</Label>
                <Input
                  id="problems"
                  value={formData.problems}
                  onChange={(e) => updateField("problems", e.target.value)}
                  placeholder="Any issues encountered"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supply">Supply</Label>
                <Input
                  id="supply"
                  value={formData.supply}
                  onChange={(e) => updateField("supply", e.target.value)}
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
                  value={formData.estimatedLoss || ""}
                  onChange={(e) => updateField("estimatedLoss", parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <Label className="text-base font-medium">Insurance</Label>
                <RadioGroup 
                  value={formData.insurance === null ? "" : formData.insurance.toString()} 
                  onValueChange={(value) => updateField("insurance", value === "" ? null : value === "true")}
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
                  value={formData.fireInvestigation === null ? "" : formData.fireInvestigation.toString()} 
                  onValueChange={(value) => updateField("fireInvestigation", value === "" ? null : value === "true")}
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

        {/* Other Services */}
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
                      checked={formData.electricityNotified}
                      onCheckedChange={(checked) => updateField("electricityNotified", checked as boolean)}
                    />
                    <Label htmlFor="electricityNotified">Notified</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="electricityAttended"
                      checked={formData.electricityAttended}
                      onCheckedChange={(checked) => updateField("electricityAttended", checked as boolean)}
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
                      checked={formData.gasNotified}
                      onCheckedChange={(checked) => updateField("gasNotified", checked as boolean)}
                    />
                    <Label htmlFor="gasNotified">Notified</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="gasAttended"
                      checked={formData.gasAttended}
                      onCheckedChange={(checked) => updateField("gasAttended", checked as boolean)}
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
                      checked={formData.ambulanceNotified}
                      onCheckedChange={(checked) => updateField("ambulanceNotified", checked as boolean)}
                    />
                    <Label htmlFor="ambulanceNotified">Notified</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ambulanceAttended"
                      checked={formData.ambulanceAttended}
                      onCheckedChange={(checked) => updateField("ambulanceAttended", checked as boolean)}
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
                      checked={formData.policeNotified}
                      onCheckedChange={(checked) => updateField("policeNotified", checked as boolean)}
                    />
                    <Label htmlFor="policeNotified">Notified</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="policeAttended"
                      checked={formData.policeAttended}
                      onCheckedChange={(checked) => updateField("policeAttended", checked as boolean)}
                    />
                    <Label htmlFor="policeAttended">Attended</Label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="policeDetails">Police: Name or Number / Station</Label>
                <Input
                  id="policeDetails"
                  value={formData.policeDetails}
                  onChange={(e) => updateField("policeDetails", e.target.value)}
                  placeholder="Police contact details"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherServices">Other Services</Label>
                <Input
                  id="otherServices"
                  value={formData.otherServices}
                  onChange={(e) => updateField("otherServices", e.target.value)}
                  placeholder="Other emergency services involved"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstOnScene">FIRST on SCENE</Label>
                <Input
                  id="firstOnScene"
                  value={formData.firstOnScene}
                  onChange={(e) => updateField("firstOnScene", e.target.value)}
                  placeholder="First responder on scene"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Casualties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Casualties</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCasualty = {
                    name: "",
                    injuries: "" as const,
                    sex: "" as const,
                    details: "",
                    transported: null
                  };
                  updateField("casualties", [...formData.casualties, newCasualty]);
                }}
                className="gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Casualty
              </Button>
            </CardTitle>
            <CardDescription>
              Record details of any casualties involved in the incident
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.casualties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No casualties recorded.</p>
                <p className="text-sm">Click "Add Casualty" to record casualty information.</p>
              </div>
            ) : (
              formData.casualties.map((casualty, index) => (
                <Card key={index} className="border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Casualty {index + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newCasualties = formData.casualties.filter((_, i) => i !== index);
                          updateField("casualties", newCasualties);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`casualty-name-${index}`}>Name</Label>
                        <Input
                          id={`casualty-name-${index}`}
                          value={casualty.name}
                          onChange={(e) => {
                            const newCasualties = [...formData.casualties];
                            newCasualties[index].name = e.target.value;
                            updateField("casualties", newCasualties);
                          }}
                          placeholder="Casualty name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Injuries</Label>
                        <RadioGroup 
                          value={casualty.injuries} 
                          onValueChange={(value) => {
                            const newCasualties = [...formData.casualties];
                            newCasualties[index].injuries = value as "minor" | "major" | "fatal" | "";
                            updateField("casualties", newCasualties);
                          }}
                          className="flex gap-4 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="minor" id={`injury-minor-${index}`} />
                            <Label htmlFor={`injury-minor-${index}`}>Minor</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="major" id={`injury-major-${index}`} />
                            <Label htmlFor={`injury-major-${index}`}>Major</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fatal" id={`injury-fatal-${index}`} />
                            <Label htmlFor={`injury-fatal-${index}`}>Fatal</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Sex</Label>
                        <RadioGroup 
                          value={casualty.sex} 
                          onValueChange={(value) => {
                            const newCasualties = [...formData.casualties];
                            newCasualties[index].sex = value as "male" | "female" | "";
                            updateField("casualties", newCasualties);
                          }}
                          className="flex gap-6 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="male" id={`sex-male-${index}`} />
                            <Label htmlFor={`sex-male-${index}`}>Male</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="female" id={`sex-female-${index}`} />
                            <Label htmlFor={`sex-female-${index}`}>Female</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label>Transported by AV</Label>
                        <RadioGroup 
                          value={casualty.transported === null ? "" : casualty.transported.toString()} 
                          onValueChange={(value) => {
                            const newCasualties = [...formData.casualties];
                            newCasualties[index].transported = value === "" ? null : value === "true";
                            updateField("casualties", newCasualties);
                          }}
                          className="flex gap-6 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="true" id={`transport-yes-${index}`} />
                            <Label htmlFor={`transport-yes-${index}`}>Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="false" id={`transport-no-${index}`} />
                            <Label htmlFor={`transport-no-${index}`}>No</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`casualty-details-${index}`}>Additional Details</Label>
                      <Textarea
                        id={`casualty-details-${index}`}
                        value={casualty.details}
                        onChange={(e) => {
                          const newCasualties = [...formData.casualties];
                          newCasualties[index].details = e.target.value;
                          updateField("casualties", newCasualties);
                        }}
                        placeholder="Additional casualty details"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Mobile Property */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Mobile Property</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newVehicle = {
                    registration: "",
                    state: "",
                    make: "",
                    model: "",
                    year: 0,
                    details: ""
                  };
                  updateField("vehicles", [...formData.vehicles, newVehicle]);
                }}
                className="gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add Vehicle
              </Button>
            </CardTitle>
            <CardDescription>
              Record details of vehicles involved in the incident
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formData.vehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No vehicles recorded.</p>
                <p className="text-sm">Click "Add Vehicle" to record vehicle information.</p>
              </div>
            ) : (
              formData.vehicles.map((vehicle, index) => (
                <Card key={index} className="border-dashed">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Vehicle {index + 1}</CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newVehicles = formData.vehicles.filter((_, i) => i !== index);
                          updateField("vehicles", newVehicles);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`vehicle-registration-${index}`}>Registration</Label>
                        <Input
                          id={`vehicle-registration-${index}`}
                          value={vehicle.registration}
                          onChange={(e) => {
                            const newVehicles = [...formData.vehicles];
                            newVehicles[index].registration = e.target.value;
                            updateField("vehicles", newVehicles);
                          }}
                          placeholder="ABC123"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`vehicle-state-${index}`}>State</Label>
                        <Input
                          id={`vehicle-state-${index}`}
                          value={vehicle.state}
                          onChange={(e) => {
                            const newVehicles = [...formData.vehicles];
                            newVehicles[index].state = e.target.value;
                            updateField("vehicles", newVehicles);
                          }}
                          placeholder="VIC"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`vehicle-year-${index}`}>Year</Label>
                        <Input
                          id={`vehicle-year-${index}`}
                          type="number"
                          min="1900"
                          max="2100"
                          value={vehicle.year || ""}
                          onChange={(e) => {
                            const newVehicles = [...formData.vehicles];
                            newVehicles[index].year = parseInt(e.target.value) || 0;
                            updateField("vehicles", newVehicles);
                          }}
                          placeholder="2020"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`vehicle-make-${index}`}>Make</Label>
                        <Input
                          id={`vehicle-make-${index}`}
                          value={vehicle.make}
                          onChange={(e) => {
                            const newVehicles = [...formData.vehicles];
                            newVehicles[index].make = e.target.value;
                            updateField("vehicles", newVehicles);
                          }}
                          placeholder="Toyota"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`vehicle-model-${index}`}>Model</Label>
                        <Input
                          id={`vehicle-model-${index}`}
                          value={vehicle.model}
                          onChange={(e) => {
                            const newVehicles = [...formData.vehicles];
                            newVehicles[index].model = e.target.value;
                            updateField("vehicles", newVehicles);
                          }}
                          placeholder="Camry"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`vehicle-details-${index}`}>Vehicle Details</Label>
                      <Textarea
                        id={`vehicle-details-${index}`}
                        value={vehicle.details}
                        onChange={(e) => {
                          const newVehicles = [...formData.vehicles];
                          newVehicles[index].details = e.target.value;
                          updateField("vehicles", newVehicles);
                        }}
                        placeholder="Additional vehicle details"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => handleSubmit("draft")}
            disabled={isSubmitting}
            className="gap-2"
          >
            <BookmarkIcon className="h-4 w-4" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit("submitted")}
            disabled={isSubmitting || !validateRequired()}
            className="gap-2"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
