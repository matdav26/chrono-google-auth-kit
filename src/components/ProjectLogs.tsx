import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, ExternalLink, Upload, Trash2, Edit3, Clock, Loader2, ChevronDown, Calendar, Activity, Search, Filter, CheckSquare, Plus, Pencil } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, subWeeks } from 'date-fns';

interface ActivityLog {
  id: string;
  action: string;
  resource_type: string;
  resource_name: string;
  details: any;
  created_at: string;
  user_id: string;
  users?: {
    id: string;
    name?: string;
    email?: string;
  } | null;
}

interface ProjectLogsProps {
  projectId: string;
}

export const ProjectLogs = ({ projectId }: ProjectLogsProps) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_logs',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      // First get activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activityError) throw activityError;

      // Get unique user IDs
      const userIds = [...new Set(activityData?.map(a => a.user_id) || [])];
      
      // Get user info for those IDs
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (userError) throw userError;

      // Combine the data
      const activitiesWithUsers = activityData?.map(activity => ({
        ...activity,
        users: userData?.find(user => user.id === activity.user_id) || null
      })) || [];

      setActivities(activitiesWithUsers);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action: string, resourceType: string) => {
    // Handle action item icons
    if (resourceType === 'action_item') {
      switch (action) {
        case 'created':
          return <Plus className="h-4 w-4 text-purple-500" />;
        case 'updated':
          return <Pencil className="h-4 w-4 text-yellow-500" />;
        case 'deleted':
          return <Trash2 className="h-4 w-4 text-red-500" />;
        case 'completed':
          return <CheckSquare className="h-4 w-4 text-green-500" />;
        default:
          return <CheckSquare className="h-4 w-4 text-purple-500" />;
      }
    }
    
    switch (action) {
      case 'created':
        return resourceType === 'event' ? 
          <Calendar className="h-4 w-4 text-blue-500" /> : 
          <Upload className="h-4 w-4 text-green-500" />;
      case 'uploaded':
        return <Upload className="h-4 w-4 text-green-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'renamed':
        return <Edit3 className="h-4 w-4 text-blue-500" />;
      default:
        return resourceType === 'url' ? 
          <ExternalLink className="h-4 w-4 text-gray-500" /> : 
          <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityMessage = (activity: ActivityLog) => {
    const { action, resource_type, resource_name, details, users } = activity;
    const userName = users?.name || users?.email || 'Someone';

    // Handle action item specific messages
    if (resource_type === 'action_item') {
      switch (action) {
        case 'created':
          return `${userName} created action item "${resource_name}"`;
        case 'updated':
          return `${userName} updated action item "${resource_name}"`;
        case 'deleted':
          return `${userName} deleted action item "${resource_name}"`;
        case 'completed':
          return `${userName} completed action item "${resource_name}"`;
        default:
          return `${userName} ${action} action item "${resource_name}"`;
      }
    }

    switch (action) {
      case 'created':
        if (resource_type === 'event') {
          return `${userName} created event "${resource_name}"`;
        }
        return `${userName} created ${resource_type} "${resource_name}"`;
      case 'uploaded':
        return `${userName} uploaded ${resource_type} "${resource_name}"`;
      case 'deleted':
        return `${userName} deleted ${resource_type} "${resource_name}"`;
      case 'renamed':
        return `${userName} renamed ${resource_type} from "${details?.old_name}" to "${details?.new_name}"`;
      default:
        return `${userName} performed ${action} on ${resource_type} "${resource_name}"`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const filterOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'uploads', label: 'File Uploads' },
    { value: 'events', label: 'Events' },
    { value: 'action_items', label: 'Action Items' },
    { value: 'renames', label: 'Renames' },
    { value: 'deletions', label: 'Deletions' },
  ];

  const filteredActivities = activities.filter(activity => {
    // Search filter
    const matchesSearch = searchTerm === '' || 
      activity.resource_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getActivityMessage(activity).toLowerCase().includes(searchTerm.toLowerCase());

    // Type filter
    let matchesFilter = true;
    switch (selectedFilter) {
      case 'uploads':
        matchesFilter = activity.action === 'uploaded' || (activity.action === 'created' && activity.resource_type !== 'event' && activity.resource_type !== 'action_item');
        break;
      case 'events':
        matchesFilter = activity.resource_type === 'event';
        break;
      case 'action_items':
        matchesFilter = activity.resource_type === 'action_item';
        break;
      case 'renames':
        matchesFilter = activity.action === 'renamed';
        break;
      case 'deletions':
        matchesFilter = activity.action === 'deleted';
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = new Date(activity.created_at);
    let groupKey: string;

    if (isToday(date)) {
      groupKey = 'Today';
    } else if (isYesterday(date)) {
      groupKey = 'Yesterday';
    } else if (isThisWeek(date)) {
      groupKey = 'This Week';
    } else if (date > subWeeks(new Date(), 1)) {
      groupKey = 'Last Week';
    } else {
      groupKey = format(date, 'MMMM yyyy');
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(activity);
    return groups;
  }, {} as Record<string, ActivityLog[]>);

  const activityCount = activities.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full p-4 h-auto justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <h3 className="text-lg font-semibold">Project Logs</h3>
                <p className="text-sm text-muted-foreground">
                  {activityCount === 0 ? 'No activity yet' : `${activityCount} activities`}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {/* Search and Filter Controls */}
            <div className="space-y-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {filterOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant={selectedFilter === option.value ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedFilter(option.value)}
                  >
                    {option.label}
                  </Badge>
                ))}
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activity yet</p>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activities match your search</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-6">
                  {Object.entries(groupedActivities).map(([groupName, groupActivities]) => (
                    <div key={groupName}>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1">
                        {groupName}
                      </h4>
                      <div className="space-y-4">
                        {groupActivities.map((activity, index) => (
                          <div key={activity.id} className="flex items-start space-x-3 relative">
                            <div className="flex-shrink-0 mt-1">
                              {getActivityIcon(activity.action, activity.resource_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">
                                {getActivityMessage(activity)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            {index < groupActivities.length - 1 && (
                              <div className="absolute left-2 mt-8 h-4 w-px bg-border" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};