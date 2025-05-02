"use client";

import { useState, useEffect } from "react";
import { api } from "@/trpc/react"; // Correct import path - use 'api'
import { CostBasisMethod } from "@/lib/cost-basis";
// Import error type if needed, or use standard Error
import type { TRPCClientErrorLike } from "@trpc/client"; 
// Import the specific router type for mutation callback types
import type { AppRouter } from "@/server/api/root"; 
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/Spinner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define type for mutation success data based on router definition
type UserSettingsUpdateOutput = Awaited<ReturnType<AppRouter['userSettings']['update']['_def']['mutation']>>;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  // Use local state, seeded by the query
  const [selectedMethod, setSelectedMethod] = useState<CostBasisMethod>(CostBasisMethod.HIFO);

  // Fetch current setting - Use 'api'
  const { data: settingsData, isLoading: isLoadingSettings } = api.userSettings.get.useQuery(
    undefined,
    { enabled: open } // Only fetch when the dialog is open
  );

  // Update local state when data loads
  useEffect(() => {
    if (settingsData?.accountingMethod) {
      setSelectedMethod(settingsData.accountingMethod);
    }
  }, [settingsData]);

  const utils = api.useUtils(); // Use 'api'

  // Update mutation - Use 'api'
  const updateMutation = api.userSettings.update.useMutation({
    onSuccess: (data: UserSettingsUpdateOutput) => { // Add explicit type for data
      // Invalidate the get query to refetch fresh data next time dialog opens
      utils.userSettings.get.invalidate();
      // Optionally update local state if needed immediately
      // setSelectedMethod(data.accountingMethod); 
      onOpenChange(false); // Close dialog on success
    },
    onError: (error: TRPCClientErrorLike<AppRouter>) => { // Add explicit type for error
      console.error("Failed to update settings:", error.message);
      // TODO: Show user-friendly error message (e.g., toast notification)
    },
  });

  const handleSave = () => {
    updateMutation.mutate({ accountingMethod: selectedMethod });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tax Settings</DialogTitle>
          <DialogDescription>
            Adjust your tax calculation preferences here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cost-basis-method" className="text-right col-span-1">
              Inventory Method
            </Label>
            {isLoadingSettings ? (
              <div className="col-span-3 flex items-center">
                <Spinner size="sm" />
              </div>
            ) : (
              <Select
                value={selectedMethod} // Use local state
                onValueChange={(v) => setSelectedMethod(v as CostBasisMethod)}
                disabled={isLoadingSettings || updateMutation.isLoading}
              >
                <SelectTrigger id="cost-basis-method" className="col-span-3">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CostBasisMethod).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {/* Add more settings here */}
        </div>
        <DialogFooter>
          <Button 
            type="button" 
            onClick={handleSave} 
            disabled={updateMutation.isLoading || isLoadingSettings}
          >
            {updateMutation.isLoading ? <Spinner size="sm" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 