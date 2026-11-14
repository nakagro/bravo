import { useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

const ranks = [
  "Brigade Member",
  "Probationary",
  "Firefighter",
  "Lieutenant",
  "Captain",
] as const;

type Rank = (typeof ranks)[number];

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  memberNumber: "",
  password: "",
  confirmPassword: "",
  rank: "Brigade Member" as Rank,
};

interface CreateUserProps {
  showTitle?: boolean;
}

export default function CreateUser({ showTitle = true }: CreateUserProps) {
  const createUser = useAction(api.adminUsers.createUser);
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <Key extends keyof typeof form>(
    field: Key,
    value: (typeof form)[Key],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await createUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        memberNumber: form.memberNumber,
        password: form.password,
        rank: form.rank,
      });
      toast.success(
        `${form.firstName.trim()} ${form.lastName.trim()} can now sign in`,
      );
      setForm(initialForm);
    } catch (error) {
      toast.error("Could not create user", {
        description: errorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card data-component="CreateUser">
      <CardHeader>
        {showTitle && <CardTitle>Create user</CardTitle>}
        <CardDescription>
          Create a member account and set their temporary sign-in details on
          their behalf.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-user-first-name">First name</Label>
              <Input
                id="create-user-first-name"
                autoComplete="given-name"
                maxLength={100}
                required
                value={form.firstName}
                onChange={(event) =>
                  updateField("firstName", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-user-last-name">Last name</Label>
              <Input
                id="create-user-last-name"
                autoComplete="family-name"
                maxLength={100}
                required
                value={form.lastName}
                onChange={(event) =>
                  updateField("lastName", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-user-email">Email address</Label>
              <Input
                id="create-user-email"
                type="email"
                autoComplete="off"
                maxLength={254}
                required
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-user-member-number">CFA number</Label>
              <Input
                id="create-user-member-number"
                inputMode="numeric"
                autoComplete="off"
                maxLength={50}
                required
                value={form.memberNumber}
                onChange={(event) =>
                  updateField("memberNumber", event.target.value)
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="create-user-rank">Rank</Label>
            <Select
              value={form.rank}
              onValueChange={(rank: Rank) => updateField("rank", rank)}
            >
              <SelectTrigger id="create-user-rank">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ranks.map((rank) => (
                    <SelectItem key={rank} value={rank}>
                      {rank}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-user-password">Temporary password</Label>
              <Input
                id="create-user-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-user-confirm-password">
                Confirm password
              </Label>
              <Input
                id="create-user-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={
                  form.confirmPassword.length > 0 &&
                  form.password !== form.confirmPassword
                }
                value={form.confirmPassword}
                onChange={(event) =>
                  updateField("confirmPassword", event.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            <UserPlus data-icon="inline-start" />
            {isSubmitting ? "Creating user..." : "Create user"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
