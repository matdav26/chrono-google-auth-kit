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
import { Loader2, Plus, CalendarIcon, User, Clock, Edit2, Check, X, AlertCircle, Bell } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface ActionItem {
  id: string;
  project_id: string;
  description: string;
  owner_id: string;
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
  description: z.string().min(1, 'Description is required'),
  owner_id: z.string().min(1, 'Owner is required'),
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
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<any>(null);
  const [reminders, setReminders] = useState<Map<string, string>>(new Map());

  const form = useForm<ActionItemFormData>({
    resolver: zodResolver(actionItemSchema),
    defaultValues: {
      description: '',
      owner_id: '',
      status: 'open',
      reminder: 'none',
    },
  });

  useEffect(() => {
    fetchActionItems();
    fetchProjectMembers();
  }, [projectId]);

  const fetchProjectMembers = async () => {
    try {
      // First fetch project memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('project_memberships')
        .select('user_id')
        .eq('project_id', projectId);

      if (membershipError) throw membershipError;

      if (!memberships || memberships.length === 0) {
        setProjectMembers([]);
        return;
      }

      // Then fetch users separately
      const userIds = memberships.map(m => m.user_id);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) throw usersError;

      // Combine the data
      const combinedData = memberships.map(membership => ({
        user_id: membership.user_id,
        users: users?.find(u => u.id === membership.user_id) || {
          id: membership.user_id,
          name: null,
          email: null,
        },
      }));

      setProjectMembers(combinedData);
      
      // Create users map for quick lookup
      const map = new Map<string, User>();
      users?.forEach(user => {
        map.set(user.id, user);
      });
      setUsersMap(map);
    } catch (error) {
      console.error('Error fetching project members:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch project members',
        variant: 'destructive',
      });
    }
  };

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
      setActionItems(data || []);
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
      console.log('Submitting action item with data:', {
        project_id: projectId,
        description: data.description,
        owner_id: data.owner_id,
        deadline: data.deadline?.toISOString(),
        status: data.status,
      });

      const { data: insertedData, error } = await supabase
        .from('action_items')
        .insert({
          project_id: projectId,
          description: data.description,
          owner_id: data.owner_id,
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter action item description..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="owner_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectMembers.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              {member.users?.name || member.users?.email || 'Unknown User'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
            const owner = usersMap.get(item.owner_id);
            const isOverdue = item.deadline && isPast(new Date(item.deadline));
            
            return (
              <Card key={item.id} className={cn(isOverdue && item.status === 'open' && 'border-destructive/50')}>
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      {editingId === item.id && editingField === 'description' ? (
                        <div className="flex items-center gap-2">
                          <Textarea
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="resize-none"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleInlineEdit(item.id, 'description', editingValue)}
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
                        <CardTitle className="text-base flex items-center gap-2 cursor-pointer hover:text-primary" onClick={() => startEditing(item.id, 'description', item.description)}>
                          {item.description}
                          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardTitle>
                      )}
                    </div>
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
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {editingId === item.id && editingField === 'owner_id' ? (
                        <Select
                          value={editingValue}
                          onValueChange={(value) => {
                            handleInlineEdit(item.id, 'owner_id', value);
                          }}
                        >
                          <SelectTrigger className="w-[150px] h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {projectMembers.map((member) => (
                              <SelectItem key={member.user_id} value={member.user_id}>
                                {member.users?.name || member.users?.email || 'Unknown User'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span 
                          className="cursor-pointer hover:text-primary"
                          onClick={() => startEditing(item.id, 'owner_id', item.owner_id)}
                        >
                          {owner?.name || owner?.email || 'Unknown User'}
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