import { Check, UserRound, UserRoundPlus, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getUserFullName, type CrewAssignmentMember } from "../types";
import type { Id } from "../../../../convex/_generated/dataModel";

interface CheckAssignmentMenuProps {
  members: CrewAssignmentMember[];
  effectiveAssignedTo?: Id<"users">;
  directAssignedTo?: Id<"users">;
  canAssign: boolean;
  contextLabel: string;
  inheritedFromArea?: boolean;
  onAssign: (userId: Id<"users"> | undefined) => void;
}

const memberLabel = (member: CrewAssignmentMember) =>
  member.firstName || getUserFullName(member);

export function CheckAssignmentMenu({
  members,
  effectiveAssignedTo,
  directAssignedTo,
  canAssign,
  contextLabel,
  inheritedFromArea = false,
  onAssign,
}: CheckAssignmentMenuProps) {
  const assignedMember = members.find(
    (member) => member._id === effectiveAssignedTo,
  );

  if (!canAssign) {
    return assignedMember ? (
      <Badge
        variant="secondary"
        className="max-w-32 gap-1"
        title={`${contextLabel}: ${getUserFullName(assignedMember)}`}
      >
        <UserRound className="size-3" aria-hidden="true" />
        <span className="truncate">{memberLabel(assignedMember)}</span>
      </Badge>
    ) : null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={assignedMember ? "secondary" : "outline"}
          size="sm"
          className="h-8 max-w-36 gap-1.5 px-2"
          title={
            assignedMember
              ? `${contextLabel}: ${getUserFullName(assignedMember)}${
                  inheritedFromArea && !directAssignedTo ? " (from area)" : ""
                }`
              : contextLabel
          }
        >
          <UserRoundPlus data-icon="inline-start" aria-hidden="true" />
          <span className="truncate">
            {assignedMember ? memberLabel(assignedMember) : "Assign"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>{contextLabel}</DropdownMenuLabel>
        <DropdownMenuGroup>
          {members.map((member) => (
            <DropdownMenuItem
              key={member._id}
              onSelect={() => onAssign(member._id)}
            >
              {directAssignedTo === member._id && <Check aria-hidden="true" />}
              <span>{getUserFullName(member)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {directAssignedTo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onAssign(undefined)}>
                <UserRoundX aria-hidden="true" />
                {inheritedFromArea ? "Use area allocation" : "Clear allocation"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
