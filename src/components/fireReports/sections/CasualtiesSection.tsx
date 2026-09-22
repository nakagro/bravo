import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Plus } from "lucide-react";

export interface Casualty {
  name: string;
  injuries: "minor" | "major" | "fatal" | "";
  sex: "male" | "female" | "";
  details: string;
  transported: boolean | null;
}

interface CasualtiesSectionProps {
  casualties: Casualty[];
  onChange: (next: Casualty[]) => void;
}

export function CasualtiesSection({ casualties, onChange }: CasualtiesSectionProps) {
  const addCasualty = () => {
    const newCasualty: Casualty = {
      name: "",
      injuries: "",
      sex: "",
      details: "",
      transported: null,
    };
    onChange([...(casualties || []), newCasualty]);
  };

  const removeCasualty = (index: number) => {
    const next = (casualties || []).filter((_, i) => i !== index);
    onChange(next);
  };

  const updateAt = <K extends keyof Casualty>(index: number, key: K, value: Casualty[K]) => {
    const next = [...(casualties || [])];
    next[index] = { ...next[index], [key]: value } as Casualty;
    onChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Casualties</span>
          <Button type="button" variant="outline" size="sm" onClick={addCasualty} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Casualty
          </Button>
        </CardTitle>
        <CardDescription>Record details of any casualties involved in the incident</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(casualties?.length ?? 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No casualties recorded.</p>
            <p className="text-sm">Click "Add Casualty" to record casualty information.</p>
          </div>
        ) : (
          (casualties || []).map((casualty, index) => (
            <Card key={index} className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Casualty {index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCasualty(index)}
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
                      onChange={(e) => updateAt(index, "name", e.target.value)}
                      placeholder="Casualty name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Injuries</Label>
                    <RadioGroup
                      value={casualty.injuries}
                      onValueChange={(value) => updateAt(index, "injuries", value as Casualty["injuries"])}
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
                      onValueChange={(value) => updateAt(index, "sex", value as Casualty["sex"])}
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
                      onValueChange={(value) =>
                        updateAt(index, "transported", value === "" ? null : value === "true")
                      }
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
                    onChange={(e) => updateAt(index, "details", e.target.value)}
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
  );
}
