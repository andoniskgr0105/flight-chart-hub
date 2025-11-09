import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Aircraft {
  id: string;
  registration: string;
  aircraft_type: string;
  status: "active" | "maintenance" | "inactive";
}

interface AircraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft: Aircraft | null;
  onSuccess: () => void;
}

const AircraftDialog = ({ open, onOpenChange, aircraft, onSuccess }: AircraftDialogProps) => {
  const [formData, setFormData] = useState({
    registration: "",
    aircraft_type: "",
    status: "active" as "active" | "maintenance" | "inactive",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (aircraft) {
      setFormData({
        registration: aircraft.registration,
        aircraft_type: aircraft.aircraft_type,
        status: aircraft.status,
      });
    } else {
      setFormData({
        registration: "",
        aircraft_type: "",
        status: "active",
      });
    }
  }, [aircraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (aircraft) {
        const { error } = await supabase
          .from("aircraft")
          .update(formData)
          .eq("id", aircraft.id);

        if (error) throw error;
        toast.success("Aircraft updated successfully");
      } else {
        const { error } = await supabase
          .from("aircraft")
          .insert([formData]);

        if (error) throw error;
        toast.success("Aircraft added successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save aircraft");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{aircraft ? "Edit Aircraft" : "Add Aircraft"}</DialogTitle>
          <DialogDescription>
            {aircraft ? "Update aircraft details" : "Add a new aircraft to the fleet"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registration">Registration</Label>
            <Input
              id="registration"
              value={formData.registration}
              onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
              placeholder="N123AB"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aircraft_type">Aircraft Type</Label>
            <Input
              id="aircraft_type"
              value={formData.aircraft_type}
              onChange={(e) => setFormData({ ...formData, aircraft_type: e.target.value })}
              placeholder="Boeing 737-800"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: "active" | "maintenance" | "inactive") => 
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : aircraft ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AircraftDialog;
