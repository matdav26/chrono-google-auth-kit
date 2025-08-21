import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, Search, Loader2, Edit, Trash2, Sparkles, ChevronDown, ChevronUp, Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Event {
  id: string;
  event_name: string;
  event_description?: string;
  event_summary?: string;
  processed?: boolean;
  created_at: string;
  created_by: string;
  project_id: string;
}

interface EventsPanelProps {
  projectId: string;
}

export const EventsPanel = ({ projectId }: EventsPanelProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  
  // Form states
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 16));
  
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!eventName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event name",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase
        .from('events')
        .insert({
          project_id: projectId,
          event_name: eventName.trim(),
          event_description: eventDescription.trim() || null,
          created_at: new Date(eventDate).toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      setCreateDialog(false);
      resetForm();
      fetchEvents();
    } catch (err) {
      console.error('Error creating event:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editingEvent || !eventName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event name",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from('events')
        .update({
          event_name: eventName.trim(),
          event_description: eventDescription.trim() || null,
        })
        .eq('id', editingEvent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event updated successfully",
      });

      setEditDialog(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    } catch (err) {
      console.error('Error updating event:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update event",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    setDeleting(eventId);

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event deleted successfully",
      });

      fetchEvents();
    } catch (err) {
      console.error('Error deleting event:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleGenerateSummary = async (event: Event) => {
    if (!event.event_description) {
      toast({
        title: "Error",
        description: "No description available to summarize",
        variant: "destructive",
      });
      return;
    }

    if (event.processed) {
      toast({
        title: "Info",
        description: "This event already has a generated summary",
      });
      return;
    }

    setGeneratingSummary(event.id);

    try {
      console.log('Making API call to:', `https://chronoboard-backend.onrender.com/api/events/${event.id}/generate-summary`);
      
      const response = await api.post(
        `https://chronoboard-backend.onrender.com/api/events/${event.id}/generate-summary`
      );

      console.log('API Response status:', response.status);
      console.log('API Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response data:', data);

      // Update the event in Supabase with the generated summary
      const { error } = await supabase
        .from('events')
        .update({
          event_summary: data.summary,
          processed: true,
        } as any)
        .eq('id', event.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "AI summary generated successfully",
      });

      fetchEvents();
    } catch (err) {
      console.error('Error generating summary:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setGeneratingSummary(null);
    }
  };

  const startEditing = (event: Event) => {
    setEditingEvent(event);
    setEventName(event.event_name);
    setEventDescription(event.event_description || '');
    setEditDialog(true);
  };

  const resetForm = () => {
    setEventName('');
    setEventDescription('');
    setEventDate(new Date().toISOString().slice(0, 16));
  };

  const toggleDescription = (eventId: string) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedDescriptions(newExpanded);
  };

  const navigateToTimeline = (createdAt: string) => {
    // Deep-link to timeline - you can enhance this with URL parameters if needed
    const timelineSection = document.querySelector('[data-section="timeline"]');
    if (timelineSection) {
      timelineSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const filteredEvents = events.filter(event =>
    event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (event.event_description && event.event_description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Events</h2>
        <Dialog open={createDialog} onOpenChange={setCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Enter event name..."
                />
              </div>
              
              <div>
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="event-description">Description (optional)</Label>
                <Textarea
                  id="event-description"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Enter event description..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateDialog(false);
                    resetForm();
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Event'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {events.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No events yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              {events.length === 0 
                ? "Create your first event to get started tracking project milestones."
                : "No events match your search criteria."
              }
            </p>
            {events.length === 0 && (
              <Button onClick={() => setCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {event.event_name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-primary"
                        onClick={() => navigateToTimeline(event.created_at)}
                      >
                        View in Timeline
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.event_description && !event.processed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateSummary(event)}
                        disabled={generatingSummary === event.id}
                      >
                        {generatingSummary === event.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        {generatingSummary === event.id ? 'Generating...' : 'Generate AI Summary'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(event)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleting === event.id}
                        >
                          {deleting === event.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Event</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{event.event_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(event.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              {(event.event_description || event.event_summary) && (
                <CardContent className="pt-0">
                  {event.event_description && (
                    <Collapsible
                      open={expandedDescriptions.has(event.id)}
                      onOpenChange={() => toggleDescription(event.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto font-normal">
                          {expandedDescriptions.has(event.id) ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              Hide Description
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              Show Description
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md whitespace-pre-wrap">
                          {event.event_description}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                  
                  {event.event_summary && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-medium">AI Summary</h4>
                      </div>
                      <div className="text-sm bg-primary/5 border border-primary/20 p-3 rounded-md">
                        {event.event_summary}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-event-name">Event Name</Label>
              <Input
                id="edit-event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Enter event name..."
              />
            </div>

            <div>
              <Label htmlFor="edit-event-description">Description</Label>
              <Textarea
                id="edit-event-description"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Enter event description..."
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialog(false);
                  setEditingEvent(null);
                  resetForm();
                }}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button onClick={handleEdit} disabled={updating}>
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Event'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};