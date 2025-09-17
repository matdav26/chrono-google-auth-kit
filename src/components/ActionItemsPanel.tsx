import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, CalendarIcon, User, Clock, Edit2, Check, X, AlertCircle, Bell, Trash2 } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface ActionItem {
  id: string;
  project_id: string;
  action_name: string;
  description: string | null;
  owner_id: string;
  owner_name: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
}

interface ProjectMember {
  user_id: string;
  users: User;
}

const actionItemSchema = z.object({
  action_name: z.string().min(1, 'Action name is required'),
  description: z.string().optional(),
  owner_name: z.string().min(1, 'Owner name is required'),
  deadline: z.date().optional(),
  status: z.enum(['open', 'closed']),
  reminder: z.enum(['none', '1', '3', '7']).optional(),
});

type ActionItemFormData = z.infer<typeof actionItemSchema>;

interface ActionItemsPanelProps {
  projectId: string;
}

export const ActionItemsPanel = ({ projectId }: ActionItemsPanelProps) => {
  const { toast } = useToast();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<any>(null);
  const [reminders, setReminders] = useState<Map<string, string>>(new Map());

  const form = useForm<ActionItemFormData>({
    resolver: zodResolver(actionItemSchema),
    defaultValues: {
      action_name: '',
      description: '',
      owner_name: '',
      status: 'open',
      reminder: 'none',
    },
  });

  useEffect(() => {
    fetchActionItems();
  }, [projectId]);

  // Removed fetchProjectMembers function since we're using free-text owner_name field now

  const fetchActionItems = async () => {
    try {
      setLoading(true);
      console.log('Fetching action items for project:', projectId);
      
      const { data, error } = await supabase
        .from('action_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching action items:', error);
        throw error;
      }

      console.log('Fetched action items:', data);
      // Map the data to include action_name field, handling the migration
      const mappedData = (data || []).map((item: any) => ({
        ...item,
        action_name: item.action_name || item.description || '',
        description: item.action_name ? item.description : null,
      }));
      setActionItems(mappedData);
    } catch (error) {
      console.error('Error fetching action items:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch action items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ActionItemFormData) => {
    try {
      // Get current user to set as owner_id (creator)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('Submitting action item with data:', {
        project_id: projectId,
        action_name: data.action_name,
        description: data.description || null,
        owner_id: user.id,
        owner_name: data.owner_name,
        deadline: data.deadline?.toISOString(),
        status: data.status,
      });

      const { data: insertedData, error } = await supabase
        .from('action_items')
        .insert({
          project_id: projectId,
          action_name: data.action_name,
          description: data.description || null,
          owner_id: user.id,  // Set creator as owner_id
          owner_name: data.owner_name,  // Set manual owner name
          deadline: data.deadline?.toISOString(),
          status: data.status,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Successfully created action item:', insertedData);

      // Log the activity for the action item creation (user already fetched above)
      if (user && insertedData) {
        await supabase
          .from('activity_logs')
          .insert({
            project_id: projectId,
            user_id: user.id,
            action: 'created',
            resource_type: 'action_item',
            resource_name: data.action_name,
            details: {
              description: data.description,
              owner_name: data.owner_name,
              deadline: data.deadline?.toISOString(),
              status: data.status,
            },
          });
      }

      // Store reminder preference in memory
      if (data.reminder && data.reminder !== 'none' && insertedData) {
        const newReminders = new Map(reminders);
        newReminders.set(insertedData.id, data.reminder);
        setReminders(newReminders);
      }

      toast({
        title: 'Success',
        description: 'Action item created successfully',
      });

      setOpen(false);
      form.reset();
      fetchActionItems();
    } catch (error) {
      console.error('Error creating action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to create action item',
        variant: 'destructive',
      });
    }
  };

  const handleInlineEdit = async (itemId: string, field: string, value: any) => {
    try {
      const updateData: any = {};
      
      if (field === 'deadline') {
        updateData[field] = value ? new Date(value).toISOString() : null;
      } else {
        updateData[field] = value;
      }

      const { error } = await supabase
        .from('action_items')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      // Log the activity for action item update
      const { data: { user } } = await supabase.auth.getUser();
      const item = actionItems.find(i => i.id === itemId);
      if (user && item) {
        const action = field === 'status' && value === 'closed' ? 'completed' : 'updated';
        await supabase
          .from('activity_logs')
          .insert({
            project_id: projectId,
            user_id: user.id,
            action,
            resource_type: 'action_item',
            resource_name: item.action_name,
            details: {
              field_updated: field,
              new_value: value,
            },
          });
      }

      toast({
        title: 'Success',
        description: 'Action item updated successfully',
      });

      fetchActionItems();
      setEditingId(null);
      setEditingField(null);
    } catch (error) {
      console.error('Error updating action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update action item',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const item = actionItems.find(i => i.id === itemId);
      
      const { error } = await supabase
        .from('action_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      // Log the activity for action item deletion
      const { data: { user } } = await supabase.auth.getUser();
      if (user && item) {
        await supabase
          .from('activity_logs')
          .insert({
            project_id: projectId,
            user_id: user.id,
            action: 'deleted',
            resource_type: 'action_item',
            resource_name: item.action_name,
            details: {
              description: item.description,
            },
          });
      }

      toast({
        title: 'Success',
        description: 'Action item deleted successfully',
      });

      fetchActionItems();
    } catch (error) {
      console.error('Error deleting action item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete action item',
        variant: 'destructive',
      });
    }
  };

  const startEditing = (itemId: string, field: string, value: any) => {
    setEditingId(itemId);
    setEditingField(field);
    setEditingValue(value);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingField(null);
    setEditingValue(null);
  };

  const getStatusColor = (status: string) => {
    return status === 'open' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' : 'bg-muted text-muted-foreground';
  };

  const getDeadlineColor = (deadline: string | null) => {
    if (!deadline) return '';
    const isOverdue = isPast(new Date(deadline));
    const daysUntil = differenceInDays(new Date(deadline), new Date());
    
    if (isOverdue) return 'text-destructive';
    if (daysUntil <= 3) return 'text-orange-600';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Action Items</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Action Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Action Item</DialogTitle>
              <DialogDescription>
                Add a new action item to track tasks and deliverables.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="action_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter action item name..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter detailed description if needed..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Provide additional context or details about this action item
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="owner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter owner's name..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Manually enter the name of the person responsible for this action item
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Deadline</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0))
                            }
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reminder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reminder</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Set reminder" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No reminder</SelectItem>
                          <SelectItem value="1">1 day before deadline</SelectItem>
                          <SelectItem value="3">3 days before deadline</SelectItem>
                          <SelectItem value="7">7 days before deadline</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        <Bell className="inline h-3 w-3 mr-1" />
                        Reminder notifications (UI only for now)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit">Create Action Item</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {actionItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No action items yet. Create your first action item to start tracking tasks.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {actionItems.map((item) => {
            const isOverdue = item.deadline && isPast(new Date(item.deadline));
            
            return (
              <Card key={item.id} className={cn(isOverdue && item.status === 'open' && 'border-destructive/50')}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      {editingId === item.id && editingField === 'action_name' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleInlineEdit(item.id, 'action_name', editingValue)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2 cursor-pointer hover:text-primary" onClick={() => startEditing(item.id, 'action_name', item.action_name)}>
                            {item.action_name}
                            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </CardTitle>
                          {item.description && (
                            <CardDescription className="mt-1">
                              {item.description}
                            </CardDescription>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingId === item.id && editingField === 'status' ? (
                        <Select
                          value={editingValue}
                          onValueChange={(value) => {
                            handleInlineEdit(item.id, 'status', value);
                          }}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge 
                          className={cn('cursor-pointer', getStatusColor(item.status))}
                          onClick={() => startEditing(item.id, 'status', item.status)}
                        >
                          {item.status}
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {editingId === item.id && editingField === 'owner_name' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="w-[150px] h-7"
                            placeholder="Owner name..."
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleInlineEdit(item.id, 'owner_name', editingValue)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={cancelEditing}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span 
                          className="cursor-pointer hover:text-primary"
                          onClick={() => startEditing(item.id, 'owner_name', item.owner_name || '')}
                        >
                          {item.owner_name || 'Unassigned'}
                        </span>
                      )}
                    </div>
                    
                    {(item.deadline || editingId === item.id && editingField === 'deadline') && (
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        {editingId === item.id && editingField === 'deadline' ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="h-7 text-xs"
                              >
                                {editingValue ? format(new Date(editingValue), "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={editingValue ? new Date(editingValue) : undefined}
                                onSelect={(date) => {
                                  handleInlineEdit(item.id, 'deadline', date);
                                }}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span 
                            className={cn('cursor-pointer hover:text-primary', getDeadlineColor(item.deadline))}
                            onClick={() => startEditing(item.id, 'deadline', item.deadline)}
                          >
                            {format(new Date(item.deadline!), 'PPP')}
                            {isOverdue && item.status === 'open' && ' (Overdue)'}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {!item.deadline && editingId !== item.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => startEditing(item.id, 'deadline', null)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add deadline
                      </Button>
                    )}
                  </div>
                  
                  <CardDescription className="text-xs">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Created {format(new Date(item.created_at), 'PPp')}
                    {item.updated_at !== item.created_at && 
                      ` • Updated ${format(new Date(item.updated_at), 'PPp')}`
                    }
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};