import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "../ui/button";
import { ArrowLeftIcon, BookmarkIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";

import { ActionsTakenSection } from "./sections/ActionsTakenSection";
import { IncidentSummarySection } from "./sections/IncidentSummarySection";
import { CasualtiesSection } from "./sections/CasualtiesSection";
import { MobilePropertySection } from "./sections/MobilePropertySection";
import { FireDetailsSection } from "./sections/FireDetailsSection";
import { ServicesAttendedSection } from "./sections/ServicesAttendedSection";
import { FireCallDetailsSection } from "./sections/FireCallDetailsSection";

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
      toast.error("Please fill in all required fields before submitting.");
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
        toast.success("Report Updated", { description: `Fire report has been ${status === "submitted" ? "submitted" : "saved as draft"}.` });
      } else {
        await createReport(reportData);
        toast.success("Report Created", { description: `Fire report has been ${status === "submitted" ? "submitted" : "saved as draft"}.` });
      }

      onSaved();
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report. Please try again.");
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
        <FireCallDetailsSection
          values={{
            incidentNumber: formData.incidentNumber,
            brigadeAdvisedDate: formData.brigadeAdvisedDate,
            brigadeAdvisedTime: formData.brigadeAdvisedTime,
            attendingCapacity: formData.attendingCapacity,
            typeOfAttendance: formData.typeOfAttendance,
            jobDetail: formData.jobDetail,
            incidentController: formData.incidentController,
            brigadeOIC: formData.brigadeOIC,
            brigadeCaller: formData.brigadeCaller,
            firecomCaller: formData.firecomCaller,
            propertyAddress: formData.propertyAddress,
            propertyCoordinates: formData.propertyCoordinates,
            keysUsed: formData.keysUsed,
            chargeRecommended: formData.chargeRecommended,
          }}
          onChangeField={(key, value) => updateField(key as any, value as any)}
        />

        {/* Actions Taken */}
        <ActionsTakenSection
          options={actionOptions}
          actions={formData.actionsTaken}
          onToggle={handleActionChange}
        />

        {/* Fire Details */}
        <FireDetailsSection
          values={{
            materialsFirstIgnited: formData.materialsFirstIgnited,
            causeOfIgnition: formData.causeOfIgnition,
            usedForExtinguishment: formData.usedForExtinguishment,
            numberOfHoseLinesUsed: formData.numberOfHoseLinesUsed,
            problems: formData.problems,
            supply: formData.supply,
            estimatedLoss: formData.estimatedLoss,
            insurance: formData.insurance,
            fireInvestigation: formData.fireInvestigation,
          }}
          onChangeField={(key, value) => updateField(key as any, value as any)}
        />

        {/*  Services Attended */}
        <ServicesAttendedSection
          values={{
            electricityNotified: formData.electricityNotified,
            electricityAttended: formData.electricityAttended,
            gasNotified: formData.gasNotified,
            gasAttended: formData.gasAttended,
            ambulanceNotified: formData.ambulanceNotified,
            ambulanceAttended: formData.ambulanceAttended,
            policeNotified: formData.policeNotified,
            policeAttended: formData.policeAttended,
            policeDetails: formData.policeDetails,
            otherServices: formData.otherServices,
            firstOnScene: formData.firstOnScene,
          }}
          onChangeField={(key, value) => updateField(key as any, value as any)}
        />

        {/* Casualties */}
        <CasualtiesSection
          casualties={formData.casualties}
          onChange={(next) => updateField("casualties", next)}
        />

        {/* Mobile Property */}
        <MobilePropertySection
          vehicles={formData.vehicles}
          onChange={(next) => updateField("vehicles", next)}
        />

        {/* Incident Summary */}
        <IncidentSummarySection
          notes={formData.notes}
          onChange={(value) => updateField("notes", value)}
        />

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
