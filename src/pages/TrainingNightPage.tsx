import { useParams } from "react-router-dom";
import { NightRoll } from "../features/training/components/NightRoll";

export function TrainingNightPage() {
  const { date } = useParams<{ date: string }>();
  return (
    <div data-component="TrainingNightPage">
      <NightRoll date={date ?? ""} />
    </div>
  );
}
