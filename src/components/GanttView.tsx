import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, CalendarIcon, Pencil, Trash2, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import FlightRouteDialog from "./FlightRouteDialog";

interface Aircraft {
  id: string;
  registration: string;
  aircraft_type: string;
}

interface FlightRoute {
  id: string;
  flight_number: string;
  aircraft_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  status: "scheduled" | "in_flight" | "completed" | "cancelled" | "delayed";
}

const GanttView = () => {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [routes, setRoutes] = useState<FlightRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<FlightRoute | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<FlightRoute | null>(null);
  const [timeView, setTimeView] = useState<6 | 12 | 24>(24); // Hours to display per day

  // Date range state - default to today
  const now = new Date();
  const todayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  const [startDate, setStartDate] = useState<Date>(todayUTC);
  const [endDate, setEndDate] = useState<Date>(addDays(todayUTC, 2)); // Default to 3 days

  // Calculate timeline range
  const numDays = differenceInDays(endDate, startDate) + 1;
  const dayStart = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const dayEnd = new Date(Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
    23, 59, 59, 999
  ));
  // Calculate total number of time chunks (each chunk = timeView hours)
  const totalHoursInRange = numDays * 24;
  const numChunks = Math.ceil(totalHoursInRange / timeView);

  const fetchData = async () => {
    try {
      const [aircraftRes, routesRes] = await Promise.all([
        supabase.from("aircraft").select("*").eq("status", "active").order("registration"),
        supabase
          .from("flight_routes")
          .select("*")
          .gte("departure_time", dayStart.toISOString())
          .lte("departure_time", dayEnd.toISOString())
          .order("departure_time")
      ]);

      if (aircraftRes.error) throw aircraftRes.error;
      if (routesRes.error) throw routesRes.error;

      setAircraft(aircraftRes.data || []);
      setRoutes(routesRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleEdit = (route: FlightRoute) => {
    setSelectedRoute(route);
    setDialogOpen(true);
  };

  const handleDeleteClick = (route: FlightRoute) => {
    setRouteToDelete(route);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!routeToDelete) return;

    try {
      const { error } = await supabase
        .from("flight_routes")
        .delete()
        .eq("id", routeToDelete.id);

      if (error) throw error;

      toast.success("Flight deleted successfully");
      setDeleteDialogOpen(false);
      setRouteToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete flight");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-primary/20 text-primary border-primary/30";
      case "in_flight":
        return "bg-success/20 text-success border-success/30";
      case "completed":
        return "bg-muted text-muted-foreground";
      case "delayed":
        return "bg-warning/20 text-warning border-warning/30";
      case "cancelled":
        return "bg-destructive/20 text-destructive border-destructive/30";
      default:
        return "bg-muted";
    }
  };

  const getFlightPosition = (departureTime: string, arrivalTime: string) => {
    // Parse times as UTC (Supabase stores as UTC timestamptz)
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);
    
    // Calculate total hours from timeline start
    const totalHoursFromStart = (departure.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
    const totalHoursToArrival = (arrival.getTime() - dayStart.getTime()) / (1000 * 60 * 60);
    
    // Check if flight is within date range
    if (totalHoursFromStart < 0 || totalHoursFromStart >= totalHoursInRange) {
      return { left: '0%', width: '0%', visible: false, chunkIndex: -1 };
    }
    
    // Calculate which chunk this flight belongs to
    const departureChunk = Math.floor(totalHoursFromStart / timeView);
    const arrivalChunk = Math.floor(totalHoursToArrival / timeView);
    
    // Calculate position within the chunk (0 to timeView hours)
    const hoursWithinChunk = totalHoursFromStart % timeView;
    const duration = totalHoursToArrival - totalHoursFromStart;
    
    // Calculate position: chunk position + position within chunk
    // Each chunk is 100% of viewport, so chunk position is (chunkIndex / numChunks) * 100% of container
    // Position within chunk is (hoursWithinChunk / timeView) * (100% / numChunks) of container
    const chunkLeftPercent = (departureChunk / numChunks) * 100;
    const positionWithinChunkPercent = (hoursWithinChunk / timeView) * (100 / numChunks);
    const widthPercent = (duration / timeView) * (100 / numChunks);
    
    return { 
      left: `${chunkLeftPercent + positionWithinChunkPercent}%`, 
      width: `${Math.max(0.5, widthPercent)}%`,
      visible: true,
      chunkIndex: departureChunk
    };
  };

  // Generate date labels for chunks (one per chunk)
  const generateDateLabels = () => {
    const dateLabels: { chunkIndex: number; date: Date; label: string }[] = [];
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkStartHour = chunkIndex * timeView;
      const chunkDay = Math.floor(chunkStartHour / 24);
      const dateForChunk = addDays(startDate, chunkDay);
      
      dateLabels.push({
        chunkIndex,
        date: dateForChunk,
        label: format(dateForChunk, "MMM dd")
      });
    }
    return dateLabels;
  };

  // Generate time labels for all chunks (each chunk shows timeView hours)
  const generateTimeLabels = () => {
    const labels: { hour: number; chunkIndex: number; label: string; width: number }[] = [];
    
    // Determine interval based on time view
    let interval: number;
    if (timeView === 24) {
      interval = 1; // Show every hour
    } else if (timeView === 12) {
      interval = 2; // Show every 2 hours
    } else {
      interval = 1; // Show every hour for 6h view
    }
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkStartHour = chunkIndex * timeView;
      
      // Generate labels for this chunk
      for (let hour = 0; hour < timeView; hour += interval) {
        const absoluteHour = chunkStartHour + hour;
        const hourInDayForLabel = absoluteHour % 24;
        
        labels.push({
          hour: hourInDayForLabel,
          chunkIndex,
          width: interval,
          label: `${String(hourInDayForLabel).padStart(2, '0')}:00`
        });
      }
    }
    return labels;
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading schedule...</div>;
  }

  const dateLabels = generateDateLabels();
  const timeLabels = generateTimeLabels();

  // Generate hour separator positions (one for each hour across all chunks)
  const generateHourSeparators = () => {
    const separators: { position: number; chunkIndex: number; hour: number }[] = [];
    
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      // Generate separators for each hour in the chunk (0 to timeView)
      for (let hour = 0; hour <= timeView; hour++) {
        const chunkLeftPercent = (chunkIndex / numChunks) * 100;
        const hourPositionPercent = (hour / timeView) * (100 / numChunks);
        const position = chunkLeftPercent + hourPositionPercent;
        
        // Skip the first separator of each chunk (except the very first) to avoid double lines at chunk boundaries
        if (hour === 0 && chunkIndex > 0) continue;
        
        separators.push({
          position,
          chunkIndex,
          hour
        });
      }
    }
    return separators;
  };

  const hourSeparators = generateHourSeparators();

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Flight Schedule</h2>
          <p className="text-sm text-muted-foreground">Gantt chart view of all flights</p>
        </div>
        <Button onClick={() => { setSelectedRoute(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Flight
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Timeline View</CardTitle>
                <CardDescription>
                  {format(startDate, "MMM dd, yyyy")} - {format(endDate, "MMM dd, yyyy")} UTC
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2 items-center justify-between">
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          const utcDate = new Date(Date.UTC(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate(),
                            0, 0, 0, 0
                          ));
                          setStartDate(utcDate);
                          if (utcDate > endDate) {
                            setEndDate(addDays(utcDate, 2));
                          }
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          const utcDate = new Date(Date.UTC(
                            date.getFullYear(),
                            date.getMonth(),
                            date.getDate(),
                            23, 59, 59, 999
                          ));
                          setEndDate(utcDate);
                          if (utcDate < startDate) {
                            setStartDate(addDays(utcDate, -2));
                          }
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select value={timeView.toString()} onValueChange={(value) => setTimeView(Number(value) as 6 | 12 | 24)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 Hours</SelectItem>
                    <SelectItem value="12">12 Hours</SelectItem>
                    <SelectItem value="24">24 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 overflow-x-auto" id="gantt-scroll-container">
            {/* Date Header - Scrollable */}
            <div className="flex border-b border-border/50 pb-1 relative" style={{ width: `${numChunks * 100}%`, minWidth: '100%' }}>
              <div className="w-48 flex-shrink-0 sticky left-0 bg-background z-20 pr-2"></div>
              <div className="flex text-xs font-semibold text-foreground px-2 relative" style={{ width: `calc(${numChunks * 100}% - 12rem)` }}>
                {dateLabels.map((dateLabel) => {
                  const widthPercent = (100 / numChunks);
                  return (
                    <div
                      key={dateLabel.chunkIndex}
                      className="flex-shrink-0 text-center"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className="whitespace-nowrap">
                        {dateLabel.label}
                      </span>
                    </div>
                  );
                })}
                {/* Vertical separators for hours */}
                {hourSeparators.map((separator, idx) => (
                  <div
                    key={`date-sep-${idx}`}
                    className="absolute top-0 bottom-0 border-l border-border/30"
                    style={{ left: `${separator.position}%` }}
                  />
                ))}
              </div>
            </div>
            {/* Time Header - Scrollable */}
            <div className="flex border-b border-border pb-2 relative" style={{ width: `${numChunks * 100}%`, minWidth: '100%' }}>
              <div className="w-48 font-semibold text-sm flex-shrink-0 sticky left-0 bg-background z-20 pr-2">Aircraft</div>
              <div className="flex text-xs text-muted-foreground px-2 relative" style={{ width: `calc(${numChunks * 100}% - 12rem)` }}>
                {timeLabels.map((label, idx) => {
                  // Each chunk is 100% of viewport width, so each hour within chunk is (100 / timeView)%
                  // But we need to account for the fact that the container is numChunks * 100% wide
                  const widthPercent = (label.width / timeView) * (100 / numChunks);
                  return (
                    <div
                      key={idx}
                      className="flex-shrink-0 text-center"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className="whitespace-nowrap">
                        {label.label}
                      </span>
                    </div>
                  );
                })}
                {/* Vertical separators for hours */}
                {hourSeparators.map((separator, idx) => (
                  <div
                    key={`time-sep-${idx}`}
                    className="absolute top-0 bottom-0 border-l border-border/30"
                    style={{ left: `${separator.position}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Gantt Rows - Scrollable */}
            {aircraft.map((ac) => {
              const aircraftRoutes = routes.filter((r) => r.aircraft_id === ac.id);
              
              return (
                <div key={ac.id} className="flex items-center border-b border-border/50 pb-4" style={{ width: `${numChunks * 100}%`, minWidth: '100%' }}>
                  <div className="w-48 pr-4 flex-shrink-0 sticky left-0 bg-background z-10">
                    <div className="font-semibold text-sm">{ac.registration}</div>
                    <div className="text-xs text-muted-foreground">{ac.aircraft_type}</div>
                  </div>
                  <div 
                    className="relative h-12 bg-muted/30 rounded"
                    style={{ width: `calc(${numChunks * 100}% - 12rem)` }}
                  >
                    {/* Vertical separators for hours */}
                    {hourSeparators.map((separator, idx) => (
                      <div
                        key={`gantt-sep-${ac.id}-${idx}`}
                        className="absolute top-0 bottom-0 border-l border-border/30 z-0"
                        style={{ left: `${separator.position}%` }}
                      />
                    ))}
                    {aircraftRoutes
                      .map((route) => {
                        const position = getFlightPosition(
                          route.departure_time,
                          route.arrival_time
                        );
                        return { route, position };
                      })
                      .filter(({ position }) => position.visible)
                      .map(({ route, position }) => {
                        const { left, width } = position;
                        return (
                        <ContextMenu key={route.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              className="absolute h-10 top-1 cursor-pointer group z-10"
                              style={{ left, width, minWidth: '40px' }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                handleEdit(route);
                              }}
                              onClick={(e) => {
                                // Single click - do nothing, or could show details
                                e.stopPropagation();
                              }}
                            >
                              <Badge
                                className={`${getStatusColor(route.status)} w-full h-full flex flex-col items-center justify-center p-1 text-xs`}
                                variant="outline"
                              >
                                <span className="font-semibold truncate w-full text-center">
                                  {route.flight_number}
                                </span>
                                <span className="text-[10px] truncate w-full text-center">
                                  {route.origin} → {route.destination}
                                </span>
                              </Badge>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-40">
                            <ContextMenuItem
                              onClick={() => handleEdit(route)}
                              className="cursor-pointer"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => handleDeleteClick(route)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <FlightRouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={selectedRoute}
        aircraft={aircraft}
        onSuccess={fetchData}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flight</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete flight <strong>{routeToDelete?.flight_number}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GanttView;
