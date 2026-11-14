import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Plus } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";

export interface Vehicle {
  registration: string;
  state: string;
  make: string;
  model: string;
  year: number;
  details: string;
}

interface MobilePropertySectionProps {
  vehicles: Vehicle[];
  onChange: (next: Vehicle[]) => void;
}

export function MobilePropertySection({ vehicles, onChange }: MobilePropertySectionProps) {
  const addVehicle = () => {
    const newVehicle: Vehicle = {
      registration: "",
      state: "",
      make: "",
      model: "",
      year: 0,
      details: "",
    };
    onChange([...(vehicles || []), newVehicle]);
  };

  const removeVehicle = (index: number) => {
    const next = (vehicles || []).filter((_, i) => i !== index);
    onChange(next);
  };

  const updateAt = <K extends keyof Vehicle>(index: number, key: K, value: Vehicle[K]) => {
    const next = [...(vehicles || [])];
    next[index] = { ...next[index], [key]: value } as Vehicle;
    onChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Mobile Property</span>
          <Button type="button" variant="outline" size="sm" onClick={addVehicle} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Vehicle
          </Button>
        </CardTitle>
        <CardDescription>Record details of vehicles involved in the incident</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(vehicles?.length ?? 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No vehicles recorded.</p>
            <p className="text-sm">Click "Add Vehicle" to record vehicle information.</p>
          </div>
        ) : (
          (vehicles || []).map((vehicle, index) => (
            <Card key={index} className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Vehicle {index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVehicle(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field>
                    <FieldLabel htmlFor={`vehicle-registration-${index}`}>Registration</FieldLabel>
                    <Input
                      id={`vehicle-registration-${index}`}
                      value={vehicle.registration}
                      onChange={(e) => updateAt(index, "registration", e.target.value)}
                      placeholder="ABC123"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`vehicle-state-${index}`}>State</FieldLabel>
                    <Input
                      id={`vehicle-state-${index}`}
                      value={vehicle.state}
                      onChange={(e) => updateAt(index, "state", e.target.value)}
                      placeholder="VIC"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`vehicle-year-${index}`}>Year</FieldLabel>
                    <Input
                      id={`vehicle-year-${index}`}
                      type="number"
                      min="1900"
                      max="2100"
                      value={vehicle.year || ""}
                      onChange={(e) => updateAt(index, "year", parseInt(e.target.value) || 0)}
                      placeholder="2020"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor={`vehicle-make-${index}`}>Make</FieldLabel>
                    <Input
                      id={`vehicle-make-${index}`}
                      value={vehicle.make}
                      onChange={(e) => updateAt(index, "make", e.target.value)}
                      placeholder="Toyota"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`vehicle-model-${index}`}>Model</FieldLabel>
                    <Input
                      id={`vehicle-model-${index}`}
                      value={vehicle.model}
                      onChange={(e) => updateAt(index, "model", e.target.value)}
                      placeholder="Camry"
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor={`vehicle-details-${index}`}>Vehicle Details</FieldLabel>
                  <Textarea
                    id={`vehicle-details-${index}`}
                    value={vehicle.details}
                    onChange={(e) => updateAt(index, "details", e.target.value)}
                    placeholder="Additional vehicle details"
                    rows={2}
                  />
                </Field>
              </CardContent>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  );
}
