import { Input } from "@/components/ui/input";

export function FormFieldTags({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  return (
    <Input
      placeholder="Enter tags separated by commas"
      value={value.join(", ")}
      onChange={(e) => onChange(e.target.value.split(",").map(tag => tag.trim()))}
    />
  );
} 