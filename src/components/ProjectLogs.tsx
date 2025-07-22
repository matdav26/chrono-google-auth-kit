import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, Upload, Trash2, Edit3, Clock, Loader2, ChevronDown, Calendar, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
            {activities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activity yet</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-4">
                  {activities.map((activity, index) => (
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
                      {index < activities.length - 1 && (
                        <div className="absolute left-2 mt-8 h-4 w-px bg-border" />
                      )}
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